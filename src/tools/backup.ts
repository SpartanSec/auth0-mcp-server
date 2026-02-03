import type { HandlerConfig, HandlerRequest, HandlerResponse, Tool } from '../utils/types.js';
import { log } from '../utils/logger.js';
import { createErrorResponse, createSuccessResponse } from '../utils/http-utility.js';
import type { Auth0Config } from '../utils/config.js';
import { getManagementClient } from '../utils/auth0-client.js';
import {
  generateTimestamp,
  generateBackupFilename,
  generateSummaryFilename,
  validateOutputDirectory,
  writeBackupFile,
  writeSummaryFile,
  createBackupMetadata,
  createSummaryMetadata,
  fetchAllApplications,
  fetchAllConnections,
  fetchAllActions,
  fetchAllResourceServers,
  fetchAllForms,
  SUPPORTED_RESOURCE_TYPES,
  type BackupFile,
  type BackupSummary,
  type ResourceBackupStatus,
  type ResourceType,
  type SummaryMetadataOptions,
} from '../utils/backup-utils.js';

// Define the backup tool
export const BACKUP_TOOLS: Tool[] = [
  {
    name: 'auth0_backup_tenant',
    description:
      'Backup all Auth0 tenant configurations to JSON files. Creates separate files for each resource type (applications, connections, actions, resource_servers, forms) plus a summary file. Each backup file includes metadata with timestamp, tenant domain, and resource count.',
    inputSchema: {
      type: 'object',
      properties: {
        output_directory: {
          type: 'string',
          description:
            'Directory path where backup files will be saved. Defaults to current working directory.',
        },
        include_resources: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of resource types to backup. Defaults to all supported types: ["applications", "connections", "actions", "resource_servers", "forms"]',
        },
      },
      required: [],
    },
    _meta: {
      requiredScopes: [
        'read:clients',
        'read:connections',
        'read:actions',
        'read:resource_servers',
        'read:forms',
      ],
      readOnly: true,
    },
    annotations: {
      title: 'Backup Auth0 Tenant',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true, // Writes to filesystem
    },
  },
];

/**
 * Backup applications to a JSON file
 */
async function backupApplications(
  managementClient: any,
  outputDir: string,
  timestamp: string,
  domain: string
): Promise<ResourceBackupStatus> {
  const filename = generateBackupFilename('applications', timestamp);

  try {
    log('Backing up applications...');
    const applications = await fetchAllApplications(managementClient);

    const backupData: BackupFile<any> = {
      metadata: createBackupMetadata(timestamp, domain, 'applications', applications.length),
      data: applications,
    };

    await writeBackupFile(outputDir, filename, backupData);

    log(`Successfully backed up ${applications.length} applications`);
    return {
      count: applications.length,
      fileName: filename,
      status: 'success',
    };
  } catch (error: any) {
    log(`Failed to backup applications: ${error.message}`);
    return {
      count: 0,
      fileName: filename,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Backup connections to a JSON file
 */
async function backupConnections(
  managementClient: any,
  outputDir: string,
  timestamp: string,
  domain: string
): Promise<ResourceBackupStatus> {
  const filename = generateBackupFilename('connections', timestamp);

  try {
    log('Backing up connections...');
    const connections = await fetchAllConnections(managementClient);

    const backupData: BackupFile<any> = {
      metadata: createBackupMetadata(timestamp, domain, 'connections', connections.length),
      data: connections,
    };

    await writeBackupFile(outputDir, filename, backupData);

    log(`Successfully backed up ${connections.length} connections`);
    return {
      count: connections.length,
      fileName: filename,
      status: 'success',
    };
  } catch (error: any) {
    log(`Failed to backup connections: ${error.message}`);
    return {
      count: 0,
      fileName: filename,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Backup actions to a JSON file
 */
async function backupActions(
  managementClient: any,
  outputDir: string,
  timestamp: string,
  domain: string
): Promise<ResourceBackupStatus> {
  const filename = generateBackupFilename('actions', timestamp);

  try {
    log('Backing up actions...');
    const actions = await fetchAllActions(managementClient);

    const backupData: BackupFile<any> = {
      metadata: createBackupMetadata(timestamp, domain, 'actions', actions.length),
      data: actions,
    };

    await writeBackupFile(outputDir, filename, backupData);

    log(`Successfully backed up ${actions.length} actions`);
    return {
      count: actions.length,
      fileName: filename,
      status: 'success',
    };
  } catch (error: any) {
    log(`Failed to backup actions: ${error.message}`);
    return {
      count: 0,
      fileName: filename,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Backup resource servers (APIs) to a JSON file
 */
async function backupResourceServers(
  managementClient: any,
  outputDir: string,
  timestamp: string,
  domain: string
): Promise<ResourceBackupStatus> {
  const filename = generateBackupFilename('resource-servers', timestamp);

  try {
    log('Backing up resource servers...');
    const resourceServers = await fetchAllResourceServers(managementClient);

    const backupData: BackupFile<any> = {
      metadata: createBackupMetadata(timestamp, domain, 'resource_servers', resourceServers.length),
      data: resourceServers,
    };

    await writeBackupFile(outputDir, filename, backupData);

    log(`Successfully backed up ${resourceServers.length} resource servers`);
    return {
      count: resourceServers.length,
      fileName: filename,
      status: 'success',
    };
  } catch (error: any) {
    log(`Failed to backup resource servers: ${error.message}`);
    return {
      count: 0,
      fileName: filename,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Backup forms to a JSON file
 */
async function backupForms(
  managementClient: any,
  outputDir: string,
  timestamp: string,
  domain: string
): Promise<ResourceBackupStatus> {
  const filename = generateBackupFilename('forms', timestamp);

  try {
    log('Backing up forms...');
    const forms = await fetchAllForms(managementClient);

    const backupData: BackupFile<any> = {
      metadata: createBackupMetadata(timestamp, domain, 'forms', forms.length),
      data: forms,
    };

    await writeBackupFile(outputDir, filename, backupData);

    log(`Successfully backed up ${forms.length} forms`);
    return {
      count: forms.length,
      fileName: filename,
      status: 'success',
    };
  } catch (error: any) {
    log(`Failed to backup forms: ${error.message}`);
    return {
      count: 0,
      fileName: filename,
      status: 'failed',
      error: error.message,
    };
  }
}

// Define handlers for backup tools
export const BACKUP_HANDLERS: Record<
  string,
  (request: HandlerRequest, config: HandlerConfig) => Promise<HandlerResponse>
> = {
  auth0_backup_tenant: async (
    request: HandlerRequest,
    config: HandlerConfig
  ): Promise<HandlerResponse> => {
    try {
      // Validate token
      if (!request.token) {
        log('Warning: Token is missing');
        return createErrorResponse('Error: Missing authorization token');
      }

      // Validate domain
      if (!config.domain) {
        log('Error: Auth0 domain is not configured');
        return createErrorResponse('Error: Auth0 domain is not configured');
      }

      // Get parameters
      const outputDir = request.parameters.output_directory || process.cwd();
      const includeResources: ResourceType[] = request.parameters.include_resources || [
        ...SUPPORTED_RESOURCE_TYPES,
      ];

      // Validate output directory
      const dirValidation = await validateOutputDirectory(outputDir);
      if (!dirValidation.valid) {
        return createErrorResponse(`Error: ${dirValidation.error}`);
      }

      // Validate resource types
      const invalidResources = includeResources.filter(
        (r) => !SUPPORTED_RESOURCE_TYPES.includes(r as ResourceType)
      );
      if (invalidResources.length > 0) {
        return createErrorResponse(
          `Error: Invalid resource types: ${invalidResources.join(', ')}. ` +
            `Supported types: ${SUPPORTED_RESOURCE_TYPES.join(', ')}`
        );
      }

      // Track backup start time
      const startTime = new Date();

      // Initialize management client
      const managementClientConfig: Auth0Config = {
        domain: config.domain,
        token: request.token,
      };
      const managementClient = await getManagementClient(managementClientConfig);

      // Generate timestamp for all files in this backup
      const timestamp = generateTimestamp();
      const resources: Record<string, ResourceBackupStatus> = {};
      const files: string[] = [];
      let totalResourcesBacked = 0;

      log(`Starting backup to directory: ${outputDir}`);
      log(`Backup timestamp: ${timestamp}`);
      log(`Resources to backup: ${includeResources.join(', ')}`);

      // Backup each resource type
      for (const resourceType of includeResources) {
        switch (resourceType) {
          case 'applications': {
            const status = await backupApplications(
              managementClient,
              outputDir,
              timestamp,
              config.domain
            );
            resources.applications = status;
            files.push(status.fileName);
            if (status.status === 'success') {
              totalResourcesBacked += status.count;
            }
            break;
          }
          case 'connections': {
            const status = await backupConnections(
              managementClient,
              outputDir,
              timestamp,
              config.domain
            );
            resources.connections = status;
            files.push(status.fileName);
            if (status.status === 'success') {
              totalResourcesBacked += status.count;
            }
            break;
          }
          case 'actions': {
            const status = await backupActions(
              managementClient,
              outputDir,
              timestamp,
              config.domain
            );
            resources.actions = status;
            files.push(status.fileName);
            if (status.status === 'success') {
              totalResourcesBacked += status.count;
            }
            break;
          }
          case 'resource_servers': {
            const status = await backupResourceServers(
              managementClient,
              outputDir,
              timestamp,
              config.domain
            );
            resources.resource_servers = status;
            files.push(status.fileName);
            if (status.status === 'success') {
              totalResourcesBacked += status.count;
            }
            break;
          }
          case 'forms': {
            const status = await backupForms(managementClient, outputDir, timestamp, config.domain);
            resources.forms = status;
            files.push(status.fileName);
            if (status.status === 'success') {
              totalResourcesBacked += status.count;
            }
            break;
          }
        }
      }

      // Track backup end time
      const endTime = new Date();

      // Calculate success/failure counts
      const successCount = Object.values(resources).filter((r) => r.status === 'success').length;
      const failedCount = Object.values(resources).filter((r) => r.status === 'failed').length;
      const attemptedCount = Object.keys(resources).length;

      // Generate and write summary file
      const summaryFilename = generateSummaryFilename(timestamp);
      const summaryMetadataOptions: SummaryMetadataOptions = {
        timestamp,
        startTime,
        endTime,
        domain: config.domain,
        totalResourcesBacked,
        resourceTypesAttempted: attemptedCount,
        resourceTypesSucceeded: successCount,
        resourceTypesFailed: failedCount,
      };
      const summary: BackupSummary = {
        metadata: createSummaryMetadata(summaryMetadataOptions),
        resources,
        files: [...files, summaryFilename],
      };

      await writeSummaryFile(outputDir, summaryFilename, summary);
      files.push(summaryFilename);

      // Build response
      const durationMs = endTime.getTime() - startTime.getTime();

      let statusMessage: string;
      if (failedCount === 0) {
        statusMessage = `Backup completed successfully. Backed up ${totalResourcesBacked} resources across ${successCount} resource types in ${durationMs}ms.`;
      } else if (successCount > 0) {
        statusMessage = `Backup partially completed. ${successCount} resource types succeeded, ${failedCount} failed. Backed up ${totalResourcesBacked} resources in ${durationMs}ms.`;
      } else {
        statusMessage = 'Backup failed. No resources were backed up.';
      }

      const result = {
        status: failedCount === 0 ? 'success' : failedCount < attemptedCount ? 'partial' : 'failed',
        message: statusMessage,
        outputDirectory: outputDir,
        timestamp: timestamp.replace(/-/g, ':').replace('Z', '.000Z'),
        durationMs,
        summary: {
          totalResourcesBacked,
          resourceTypesAttempted: attemptedCount,
          resourceTypesSucceeded: successCount,
          resourceTypesFailed: failedCount,
          resourceTypes: resources,
        },
        files,
      };

      log(statusMessage);
      return createSuccessResponse(result);
    } catch (error: any) {
      log(`Backup error: ${error.message}`);

      let errorMessage = `Failed to backup tenant: ${error.message || 'Unknown error'}`;

      // Add context based on common error codes
      if (error.statusCode === 401) {
        errorMessage +=
          '\nError: Unauthorized. Your token might be expired or invalid. Try running "npx @auth0/auth0-mcp-server init" to refresh your token.';
      } else if (error.statusCode === 403) {
        errorMessage +=
          '\nError: Forbidden. Your token might not have the required scopes. Required scopes: read:clients, read:connections, read:actions, read:resource_servers, read:forms.';
      } else if (error.statusCode === 429) {
        errorMessage +=
          '\nError: Rate limited. You have made too many requests to the Auth0 API. Please try again later.';
      } else if (error.statusCode >= 500) {
        errorMessage +=
          '\nError: Auth0 server error. The Auth0 API might be experiencing issues. Please try again later.';
      }

      return createErrorResponse(errorMessage);
    }
  },
};
