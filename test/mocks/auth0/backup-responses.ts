// Mock data for backup tool testing
import { mockApplications } from './applications';
import { mockConnections } from './connections';

// Mock paginated applications response (for backup pagination testing)
export const mockPaginatedApplicationsPage1 = {
  clients: mockApplications.slice(0, 1),
  total: mockApplications.length,
  start: 0,
  limit: 1,
};

export const mockPaginatedApplicationsPage2 = {
  clients: mockApplications.slice(1, 2),
  total: mockApplications.length,
  start: 1,
  limit: 1,
};

// Mock large dataset for pagination testing
export const mockLargeApplicationsList = Array.from({ length: 150 }, (_, i) => ({
  client_id: `app-${i + 1}`,
  name: `Test Application ${i + 1}`,
  app_type:
    i % 4 === 0 ? 'spa' : i % 4 === 1 ? 'native' : i % 4 === 2 ? 'non_interactive' : 'regular_web',
  description: `Test application ${i + 1} for pagination testing`,
  callbacks: [`https://example${i + 1}.com/callback`],
  allowed_origins: [`https://example${i + 1}.com`],
}));

// Mock backup file structure
export const mockBackupFileStructure = {
  metadata: {
    backupTimestamp: '2024-01-15T10:30:00.000Z',
    tenantDomain: 'test-tenant.auth0.com',
    resourceType: 'applications',
    totalCount: 2,
    mcpServerVersion: '0.1.0-beta.9',
  },
  data: mockApplications,
};

// Mock summary file structure
export const mockSummaryStructure = {
  metadata: {
    backupTimestamp: '2024-01-15T10:30:00.000Z',
    tenantDomain: 'test-tenant.auth0.com',
    mcpServerVersion: '0.1.0-beta.9',
    totalResourcesBacked: 2,
  },
  resources: {
    applications: {
      count: 2,
      fileName: 'auth0-backup-applications-2024-01-15T10-30-00Z.json',
      status: 'success',
    },
  },
  files: [
    'auth0-backup-applications-2024-01-15T10-30-00Z.json',
    'auth0-backup-summary-2024-01-15T10-30-00Z.json',
  ],
};

// Mock connections backup file structure
export const mockConnectionsBackupFileStructure = {
  metadata: {
    backupTimestamp: '2024-01-15T10:30:00.000Z',
    tenantDomain: 'test-tenant.auth0.com',
    resourceType: 'connections',
    totalCount: mockConnections.length,
    mcpServerVersion: '0.1.0-beta.9',
  },
  data: mockConnections,
};

// Mock large connections list for pagination testing
export const mockLargeConnectionsList = Array.from({ length: 150 }, (_, i) => ({
  id: `con_${i + 1}`,
  name: `connection-${i + 1}`,
  display_name: `Connection ${i + 1}`,
  strategy:
    i % 4 === 0 ? 'google-oauth2' : i % 4 === 1 ? 'facebook' : i % 4 === 2 ? 'github' : 'linkedin',
  options: {
    client_id: `client-id-${i + 1}`,
    client_secret: '***',
  },
  enabled_clients: [],
  realms: [`connection-${i + 1}`],
  is_domain_connection: false,
  show_as_button: true,
}));
