import { promises as fs } from 'fs';
import path from 'path';
import { ManagementClient } from 'auth0';
import { log } from './logger.js';

// Package version for metadata
const PACKAGE_VERSION = '0.1.0-beta.9';

/**
 * Backup file metadata structure
 */
export interface BackupMetadata {
  backupTimestamp: string;
  tenantDomain: string;
  resourceType: string;
  totalCount: number;
  mcpServerVersion: string;
}

/**
 * Backup file structure
 */
export interface BackupFile<T> {
  metadata: BackupMetadata;
  data: T[];
}

/**
 * Resource backup status
 */
export interface ResourceBackupStatus {
  count: number;
  fileName: string;
  status: 'success' | 'failed' | 'partial';
  error?: string;
}

/**
 * Summary file metadata
 */
export interface BackupSummaryMetadata {
  backupTimestamp: string;
  backupStartTime: string;
  backupEndTime: string;
  durationMs: number;
  tenantDomain: string;
  mcpServerVersion: string;
  totalResourcesBacked: number;
  resourceTypesAttempted: number;
  resourceTypesSucceeded: number;
  resourceTypesFailed: number;
}

/**
 * Backup summary structure
 */
export interface BackupSummary {
  metadata: BackupSummaryMetadata;
  resources: Record<string, ResourceBackupStatus>;
  files: string[];
}

/**
 * Supported resource types for backup
 */
export const SUPPORTED_RESOURCE_TYPES = [
  'applications',
  'connections',
  'actions',
  'resource_servers',
  'forms',
] as const;

export type ResourceType = (typeof SUPPORTED_RESOURCE_TYPES)[number];

/**
 * Generate an ISO timestamp string suitable for filenames
 * Replaces colons with hyphens to be filesystem-safe
 */
export function generateTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generate a backup filename for a specific resource type
 */
export function generateBackupFilename(resourceType: string, timestamp: string): string {
  return `auth0-backup-${resourceType}-${timestamp}.json`;
}

/**
 * Generate the summary filename
 */
export function generateSummaryFilename(timestamp: string): string {
  return `auth0-backup-summary-${timestamp}.json`;
}

/**
 * Validate that the output directory exists and is writable
 */
export async function validateOutputDirectory(
  outputDir: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if directory exists
    const stats = await fs.stat(outputDir);
    if (!stats.isDirectory()) {
      return { valid: false, error: `Path '${outputDir}' is not a directory` };
    }

    // Check if directory is writable by trying to access it
    await fs.access(outputDir, fs.constants.W_OK);

    return { valid: true };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { valid: false, error: `Directory '${outputDir}' does not exist` };
    }
    if (error.code === 'EACCES') {
      return { valid: false, error: `Directory '${outputDir}' is not writable` };
    }
    return { valid: false, error: `Cannot access directory '${outputDir}': ${error.message}` };
  }
}

/**
 * Write a backup file to disk
 */
export async function writeBackupFile<T>(
  outputDir: string,
  filename: string,
  data: BackupFile<T>
): Promise<void> {
  const filePath = path.join(outputDir, filename);
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
  log(`Backup file written: ${filePath}`);
}

/**
 * Write the summary file to disk
 */
export async function writeSummaryFile(
  outputDir: string,
  filename: string,
  summary: BackupSummary
): Promise<void> {
  const filePath = path.join(outputDir, filename);
  const content = JSON.stringify(summary, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
  log(`Summary file written: ${filePath}`);
}

/**
 * Create backup metadata
 */
export function createBackupMetadata(
  timestamp: string,
  domain: string,
  resourceType: string,
  count: number
): BackupMetadata {
  return {
    backupTimestamp: timestamp.replace(/-/g, ':').replace('Z', '.000Z'),
    tenantDomain: domain,
    resourceType,
    totalCount: count,
    mcpServerVersion: PACKAGE_VERSION,
  };
}

/**
 * Summary metadata options
 */
export interface SummaryMetadataOptions {
  timestamp: string;
  startTime: Date;
  endTime: Date;
  domain: string;
  totalResourcesBacked: number;
  resourceTypesAttempted: number;
  resourceTypesSucceeded: number;
  resourceTypesFailed: number;
}

/**
 * Create summary metadata
 */
export function createSummaryMetadata(options: SummaryMetadataOptions): BackupSummaryMetadata {
  const {
    timestamp,
    startTime,
    endTime,
    domain,
    totalResourcesBacked,
    resourceTypesAttempted,
    resourceTypesSucceeded,
    resourceTypesFailed,
  } = options;
  return {
    backupTimestamp: timestamp.replace(/-/g, ':').replace('Z', '.000Z'),
    backupStartTime: startTime.toISOString(),
    backupEndTime: endTime.toISOString(),
    durationMs: endTime.getTime() - startTime.getTime(),
    tenantDomain: domain,
    mcpServerVersion: PACKAGE_VERSION,
    totalResourcesBacked,
    resourceTypesAttempted,
    resourceTypesSucceeded,
    resourceTypesFailed,
  };
}

/**
 * Paginate through all resources of a given type
 * This function handles Auth0's pagination to fetch all items
 */
export async function paginateAllResources<T>(
  fetchPage: (page: number, perPage: number) => Promise<{ data: T[]; total?: number }>,
  perPage: number = 100
): Promise<T[]> {
  const allResources: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    log(`Fetching page ${page + 1}...`);
    const result = await fetchPage(page, perPage);

    if (result.data.length === 0) {
      hasMore = false;
    } else {
      allResources.push(...result.data);

      // Check if we've fetched all items
      if (result.total !== undefined) {
        hasMore = allResources.length < result.total;
      } else {
        // If no total is provided, stop if we got fewer items than requested
        hasMore = result.data.length === perPage;
      }

      page++;
    }
  }

  log(`Fetched ${allResources.length} total resources`);
  return allResources;
}

/**
 * Fetch all applications with pagination
 */
export async function fetchAllApplications(managementClient: ManagementClient): Promise<any[]> {
  return paginateAllResources(async (page, perPage) => {
    const response = await managementClient.clients.getAll({
      page,
      per_page: perPage,
      include_totals: true,
    });

    const responseData = response.data as any;

    // Handle different response formats
    if (Array.isArray(responseData)) {
      return { data: responseData, total: responseData.length };
    } else if (responseData && 'clients' in responseData) {
      return {
        data: responseData.clients || [],
        total: responseData.total,
      };
    }

    return { data: [], total: 0 };
  });
}

/**
 * Fetch all connections with pagination
 */
export async function fetchAllConnections(managementClient: ManagementClient): Promise<any[]> {
  return paginateAllResources(async (page, perPage) => {
    const response = await managementClient.connections.getAll({
      page,
      per_page: perPage,
      include_totals: true,
    });

    const responseData = response.data as any;

    // Handle different response formats
    if (Array.isArray(responseData)) {
      return { data: responseData, total: responseData.length };
    } else if (responseData && 'connections' in responseData) {
      return {
        data: responseData.connections || [],
        total: responseData.total,
      };
    }

    return { data: [], total: 0 };
  });
}

/**
 * Fetch all actions with pagination
 */
export async function fetchAllActions(managementClient: ManagementClient): Promise<any[]> {
  return paginateAllResources(async (page, perPage) => {
    const response = await managementClient.actions.getAll({
      page,
      per_page: perPage,
    });

    const responseData = response.data as any;

    // Handle different response formats
    if (Array.isArray(responseData)) {
      return { data: responseData, total: responseData.length };
    } else if (responseData && 'actions' in responseData) {
      return {
        data: responseData.actions || [],
        total: responseData.total,
      };
    }

    return { data: [], total: 0 };
  });
}

/**
 * Fetch all resource servers (APIs) with pagination
 */
export async function fetchAllResourceServers(managementClient: ManagementClient): Promise<any[]> {
  return paginateAllResources(async (page, perPage) => {
    const response = await managementClient.resourceServers.getAll({
      page,
      per_page: perPage,
      include_totals: true,
    });

    const responseData = response.data as any;

    // Handle different response formats
    if (Array.isArray(responseData)) {
      return { data: responseData, total: responseData.length };
    } else if (responseData && 'resource_servers' in responseData) {
      return {
        data: responseData.resource_servers || [],
        total: responseData.total,
      };
    }

    return { data: [], total: 0 };
  });
}

/**
 * Fetch all forms with pagination
 */
export async function fetchAllForms(managementClient: ManagementClient): Promise<any[]> {
  return paginateAllResources(async (page, perPage) => {
    const response = await managementClient.forms.getAll({
      page,
      per_page: perPage,
      include_totals: true,
    });

    const responseData = response.data as any;

    // Handle different response formats
    if (Array.isArray(responseData)) {
      return { data: responseData, total: responseData.length };
    } else if (responseData && 'forms' in responseData) {
      return {
        data: responseData.forms || [],
        total: responseData.total,
      };
    }

    return { data: [], total: 0 };
  });
}
