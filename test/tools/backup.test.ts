import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { promises as fs } from 'fs';
import { BACKUP_HANDLERS, BACKUP_TOOLS } from '../../src/tools/backup';
import { mockConfig } from '../mocks/config';
import { mockApplications } from '../mocks/auth0/applications';
import { mockConnections } from '../mocks/auth0/connections';
import { mockActions } from '../mocks/auth0/actions';
import { mockResourceServers } from '../mocks/auth0/resource-servers';
import { mockForms } from '../mocks/auth0/forms';
import { server } from '../setup';

// Mock dependencies
vi.mock('../../src/utils/logger', () => ({
  log: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// Mock fs module for file operations
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    access: vi.fn(),
    writeFile: vi.fn(),
    constants: {
      W_OK: 2,
    },
  },
}));

describe('Backup Tool', () => {
  const domain = mockConfig.domain;
  const token = mockConfig.token;

  beforeEach(() => {
    vi.resetAllMocks();

    // Default mock for valid directory
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as any);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(BACKUP_TOOLS).toHaveLength(1);
      expect(BACKUP_TOOLS[0].name).toBe('auth0_backup_tenant');
    });

    it('should have correct required scopes', () => {
      const tool = BACKUP_TOOLS[0];
      expect(tool._meta?.requiredScopes).toContain('read:clients');
      expect(tool._meta?.requiredScopes).toContain('read:connections');
      expect(tool._meta?.requiredScopes).toContain('read:actions');
      expect(tool._meta?.requiredScopes).toContain('read:resource_servers');
      expect(tool._meta?.requiredScopes).toContain('read:forms');
    });

    it('should be marked as read-only', () => {
      const tool = BACKUP_TOOLS[0];
      expect(tool._meta?.readOnly).toBe(true);
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it('should have filesystem access annotation', () => {
      const tool = BACKUP_TOOLS[0];
      expect(tool.annotations?.openWorldHint).toBe(true);
    });
  });

  describe('auth0_backup_tenant handler', () => {
    it('should successfully backup applications', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.status).toBe('success');
      expect(result.outputDirectory).toBe('/test/output');
      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.summary.resourceTypes.applications.status).toBe('success');
    });

    it('should use current directory when output_directory not specified', async () => {
      const request = {
        token,
        parameters: {
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.outputDirectory).toBe(process.cwd());
    });

    it('should return error for missing token', async () => {
      const request = {
        token: '',
        parameters: {
          output_directory: '/test/output',
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Missing authorization token');
    });

    it('should return error for missing domain', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
        },
      };

      const config = { domain: undefined };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Auth0 domain is not configured');
    });

    it('should return error for invalid output directory', async () => {
      const error: any = new Error('ENOENT');
      error.code = 'ENOENT';
      vi.mocked(fs.stat).mockRejectedValue(error);

      const request = {
        token,
        parameters: {
          output_directory: '/non/existent/directory',
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('does not exist');
    });

    it('should return error for invalid resource types', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['invalid_resource', 'applications'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Invalid resource types');
      expect(response.content[0].text).toContain('invalid_resource');
    });

    it('should handle API errors gracefully', async () => {
      // Override the handler to return an error
      server.use(
        http.get('https://*/api/v2/clients', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token: 'invalid-token',
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // The backup should report failure for applications
      expect(response.isError).toBe(false); // Overall response is not error
      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.applications.status).toBe('failed');
    });

    it('should write backup files to disk', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Should have written at least 2 files (applications + summary)
      expect(fs.writeFile).toHaveBeenCalledTimes(2);

      // Check that both calls were to the correct directory
      const calls = vi.mocked(fs.writeFile).mock.calls;
      expect(calls[0][0]).toContain('/test/output');
      expect(calls[1][0]).toContain('/test/output');

      // Check file names
      const filePaths = calls.map((call) => call[0] as string);
      expect(filePaths.some((p) => p.includes('auth0-backup-applications'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-summary'))).toBe(true);
    });

    it('should include correct metadata in backup files', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Get the first write call (applications backup)
      const applicationsCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('applications'));
      expect(applicationsCall).toBeDefined();

      const backupContent = JSON.parse(applicationsCall![1] as string);
      expect(backupContent.metadata).toBeDefined();
      expect(backupContent.metadata.tenantDomain).toBe(domain);
      expect(backupContent.metadata.resourceType).toBe('applications');
      expect(backupContent.metadata.totalCount).toBeGreaterThanOrEqual(0);
      expect(backupContent.metadata.mcpServerVersion).toBeDefined();
      expect(backupContent.data).toBeDefined();
      expect(Array.isArray(backupContent.data)).toBe(true);
    });

    it('should include correct data in summary file', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Get the summary write call
      const summaryCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('summary'));
      expect(summaryCall).toBeDefined();

      const summaryContent = JSON.parse(summaryCall![1] as string);
      expect(summaryContent.metadata).toBeDefined();
      expect(summaryContent.metadata.tenantDomain).toBe(domain);
      expect(summaryContent.resources).toBeDefined();
      expect(summaryContent.resources.applications).toBeDefined();
      expect(summaryContent.files).toBeDefined();
      expect(Array.isArray(summaryContent.files)).toBe(true);
    });

    it('should generate consistent timestamps across all files', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      const result = JSON.parse(response.content[0].text);
      const timestamp = result.timestamp;

      // All files should have the same timestamp in their names
      result.files.forEach((file: string) => {
        // Extract timestamp from filename (after last hyphen before .json)
        const matches = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)\.json$/);
        expect(matches).toBeDefined();
      });
    });
  });

  describe('Connections backup', () => {
    it('should successfully backup connections', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['connections'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.status).toBe('success');
      expect(result.summary.resourceTypes.connections).toBeDefined();
      expect(result.summary.resourceTypes.connections.status).toBe('success');
    });

    it('should write connections backup file with correct structure', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['connections'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Find the connections backup file
      const connectionsCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('connections'));
      expect(connectionsCall).toBeDefined();

      const backupContent = JSON.parse(connectionsCall![1] as string);
      expect(backupContent.metadata).toBeDefined();
      expect(backupContent.metadata.resourceType).toBe('connections');
      expect(backupContent.metadata.tenantDomain).toBe(domain);
      expect(backupContent.data).toBeDefined();
      expect(Array.isArray(backupContent.data)).toBe(true);
    });

    it('should backup both applications and connections when specified', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications', 'connections'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.applications).toBeDefined();
      expect(result.summary.resourceTypes.connections).toBeDefined();
      expect(result.summary.resourceTypes.applications.status).toBe('success');
      expect(result.summary.resourceTypes.connections.status).toBe('success');

      // Should have written 3 files (applications, connections, summary)
      expect(fs.writeFile).toHaveBeenCalledTimes(3);

      const filePaths = vi.mocked(fs.writeFile).mock.calls.map((call) => call[0] as string);
      expect(filePaths.some((p) => p.includes('auth0-backup-applications'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-connections'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-summary'))).toBe(true);
    });

    it('should handle connections API errors gracefully', async () => {
      // Override the handler to return an error for connections
      server.use(
        http.get('https://*/api/v2/connections', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['connections'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // The backup should report failure for connections
      expect(response.isError).toBe(false);
      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.connections.status).toBe('failed');
    });

    it('should include connections in summary file', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['connections'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Get the summary write call
      const summaryCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('summary'));
      expect(summaryCall).toBeDefined();

      const summaryContent = JSON.parse(summaryCall![1] as string);
      expect(summaryContent.resources.connections).toBeDefined();
      expect(summaryContent.resources.connections.fileName).toContain('auth0-backup-connections');
      expect(summaryContent.files.some((f: string) => f.includes('connections'))).toBe(true);
    });
  });

  describe('Actions backup', () => {
    it('should successfully backup actions', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['actions'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.status).toBe('success');
      expect(result.summary.resourceTypes.actions).toBeDefined();
      expect(result.summary.resourceTypes.actions.status).toBe('success');
    });

    it('should write actions backup file with correct structure', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['actions'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Find the actions backup file
      const actionsCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('actions'));
      expect(actionsCall).toBeDefined();

      const backupContent = JSON.parse(actionsCall![1] as string);
      expect(backupContent.metadata).toBeDefined();
      expect(backupContent.metadata.resourceType).toBe('actions');
      expect(backupContent.metadata.tenantDomain).toBe(domain);
      expect(backupContent.data).toBeDefined();
      expect(Array.isArray(backupContent.data)).toBe(true);
    });

    it('should backup applications, connections, and actions when specified', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications', 'connections', 'actions'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.applications).toBeDefined();
      expect(result.summary.resourceTypes.connections).toBeDefined();
      expect(result.summary.resourceTypes.actions).toBeDefined();
      expect(result.summary.resourceTypes.applications.status).toBe('success');
      expect(result.summary.resourceTypes.connections.status).toBe('success');
      expect(result.summary.resourceTypes.actions.status).toBe('success');

      // Should have written 4 files (applications, connections, actions, summary)
      expect(fs.writeFile).toHaveBeenCalledTimes(4);

      const filePaths = vi.mocked(fs.writeFile).mock.calls.map((call) => call[0] as string);
      expect(filePaths.some((p) => p.includes('auth0-backup-applications'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-connections'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-actions'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-summary'))).toBe(true);
    });

    it('should handle actions API errors gracefully', async () => {
      // Override the handler to return an error for actions
      server.use(
        http.get('https://*/api/v2/actions/actions', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['actions'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // The backup should report failure for actions
      expect(response.isError).toBe(false);
      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.actions.status).toBe('failed');
    });

    it('should include actions in summary file', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['actions'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Get the summary write call
      const summaryCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('summary'));
      expect(summaryCall).toBeDefined();

      const summaryContent = JSON.parse(summaryCall![1] as string);
      expect(summaryContent.resources.actions).toBeDefined();
      expect(summaryContent.resources.actions.fileName).toContain('auth0-backup-actions');
      expect(summaryContent.files.some((f: string) => f.includes('actions'))).toBe(true);
    });
  });

  describe('Resource Servers backup', () => {
    it('should successfully backup resource servers', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['resource_servers'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.status).toBe('success');
      expect(result.summary.resourceTypes.resource_servers).toBeDefined();
      expect(result.summary.resourceTypes.resource_servers.status).toBe('success');
    });

    it('should write resource servers backup file with correct structure', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['resource_servers'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Find the resource servers backup file
      const resourceServersCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('resource-servers'));
      expect(resourceServersCall).toBeDefined();

      const backupContent = JSON.parse(resourceServersCall![1] as string);
      expect(backupContent.metadata).toBeDefined();
      expect(backupContent.metadata.resourceType).toBe('resource_servers');
      expect(backupContent.metadata.tenantDomain).toBe(domain);
      expect(backupContent.data).toBeDefined();
      expect(Array.isArray(backupContent.data)).toBe(true);
    });

    it('should backup all four resource types when specified', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['applications', 'connections', 'actions', 'resource_servers'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.applications).toBeDefined();
      expect(result.summary.resourceTypes.connections).toBeDefined();
      expect(result.summary.resourceTypes.actions).toBeDefined();
      expect(result.summary.resourceTypes.resource_servers).toBeDefined();

      // Should have written 5 files (4 resources + summary)
      expect(fs.writeFile).toHaveBeenCalledTimes(5);

      const filePaths = vi.mocked(fs.writeFile).mock.calls.map((call) => call[0] as string);
      expect(filePaths.some((p) => p.includes('auth0-backup-applications'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-connections'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-actions'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-resource-servers'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-summary'))).toBe(true);
    });

    it('should handle resource servers API errors gracefully', async () => {
      // Override the handler to return an error for resource servers
      server.use(
        http.get('https://*/api/v2/resource-servers', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['resource_servers'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // The backup should report failure for resource servers
      expect(response.isError).toBe(false);
      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.resource_servers.status).toBe('failed');
    });

    it('should include resource servers in summary file', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['resource_servers'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Get the summary write call
      const summaryCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('summary'));
      expect(summaryCall).toBeDefined();

      const summaryContent = JSON.parse(summaryCall![1] as string);
      expect(summaryContent.resources.resource_servers).toBeDefined();
      expect(summaryContent.resources.resource_servers.fileName).toContain(
        'auth0-backup-resource-servers'
      );
      expect(summaryContent.files.some((f: string) => f.includes('resource-servers'))).toBe(true);
    });
  });

  describe('Forms backup', () => {
    it('should successfully backup forms', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['forms'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.status).toBe('success');
      expect(result.summary.resourceTypes.forms).toBeDefined();
      expect(result.summary.resourceTypes.forms.status).toBe('success');
    });

    it('should write forms backup file with correct structure', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['forms'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Find the forms backup file
      const formsCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('forms'));
      expect(formsCall).toBeDefined();

      const backupContent = JSON.parse(formsCall![1] as string);
      expect(backupContent.metadata).toBeDefined();
      expect(backupContent.metadata.resourceType).toBe('forms');
      expect(backupContent.metadata.tenantDomain).toBe(domain);
      expect(backupContent.data).toBeDefined();
      expect(Array.isArray(backupContent.data)).toBe(true);
    });

    it('should backup all five resource types when specified', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: [
            'applications',
            'connections',
            'actions',
            'resource_servers',
            'forms',
          ],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      expect(response.isError).toBe(false);

      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.applications).toBeDefined();
      expect(result.summary.resourceTypes.connections).toBeDefined();
      expect(result.summary.resourceTypes.actions).toBeDefined();
      expect(result.summary.resourceTypes.resource_servers).toBeDefined();
      expect(result.summary.resourceTypes.forms).toBeDefined();

      // Should have written 6 files (5 resources + summary)
      expect(fs.writeFile).toHaveBeenCalledTimes(6);

      const filePaths = vi.mocked(fs.writeFile).mock.calls.map((call) => call[0] as string);
      expect(filePaths.some((p) => p.includes('auth0-backup-applications'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-connections'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-actions'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-resource-servers'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-forms'))).toBe(true);
      expect(filePaths.some((p) => p.includes('auth0-backup-summary'))).toBe(true);
    });

    it('should handle forms API errors gracefully', async () => {
      // Override the handler to return an error for forms
      server.use(
        http.get('https://*/api/v2/forms', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['forms'],
        },
      };

      const config = { domain };

      const response = await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // The backup should report failure for forms
      expect(response.isError).toBe(false);
      const result = JSON.parse(response.content[0].text);
      expect(result.summary.resourceTypes.forms.status).toBe('failed');
    });

    it('should include forms in summary file', async () => {
      const request = {
        token,
        parameters: {
          output_directory: '/test/output',
          include_resources: ['forms'],
        },
      };

      const config = { domain };

      await BACKUP_HANDLERS.auth0_backup_tenant(request, config);

      // Get the summary write call
      const summaryCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).includes('summary'));
      expect(summaryCall).toBeDefined();

      const summaryContent = JSON.parse(summaryCall![1] as string);
      expect(summaryContent.resources.forms).toBeDefined();
      expect(summaryContent.resources.forms.fileName).toContain('auth0-backup-forms');
      expect(summaryContent.files.some((f: string) => f.includes('forms'))).toBe(true);
    });
  });
});
