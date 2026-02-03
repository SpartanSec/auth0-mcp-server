import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  generateTimestamp,
  generateBackupFilename,
  generateSummaryFilename,
  validateOutputDirectory,
  writeBackupFile,
  createBackupMetadata,
  createSummaryMetadata,
  paginateAllResources,
  fetchAllApplications,
  fetchAllConnections,
  SUPPORTED_RESOURCE_TYPES,
} from '../../src/utils/backup-utils';

// Mock the logger
vi.mock('../../src/utils/logger', () => ({
  log: vi.fn(),
}));

// Mock fs module
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

describe('Backup Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTimestamp', () => {
    it('should generate a filesystem-safe timestamp', () => {
      const timestamp = generateTimestamp();

      // Should not contain colons (filesystem-safe)
      expect(timestamp).not.toContain(':');

      // Should end with Z
      expect(timestamp).toMatch(/Z$/);

      // Should be a valid-ish ISO-like format (with hyphens instead of colons)
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
    });
  });

  describe('generateBackupFilename', () => {
    it('should generate correct filename for applications', () => {
      const timestamp = '2024-01-15T10-30-00Z';
      const filename = generateBackupFilename('applications', timestamp);

      expect(filename).toBe('auth0-backup-applications-2024-01-15T10-30-00Z.json');
    });

    it('should generate correct filename for connections', () => {
      const timestamp = '2024-01-15T10-30-00Z';
      const filename = generateBackupFilename('connections', timestamp);

      expect(filename).toBe('auth0-backup-connections-2024-01-15T10-30-00Z.json');
    });
  });

  describe('generateSummaryFilename', () => {
    it('should generate correct summary filename', () => {
      const timestamp = '2024-01-15T10-30-00Z';
      const filename = generateSummaryFilename(timestamp);

      expect(filename).toBe('auth0-backup-summary-2024-01-15T10-30-00Z.json');
    });
  });

  describe('validateOutputDirectory', () => {
    it('should return valid for an existing writable directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await validateOutputDirectory('/valid/directory');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for non-existent directory', async () => {
      const error: any = new Error('ENOENT');
      error.code = 'ENOENT';
      vi.mocked(fs.stat).mockRejectedValue(error);

      const result = await validateOutputDirectory('/non/existent');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should return error for non-writable directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      const error: any = new Error('EACCES');
      error.code = 'EACCES';
      vi.mocked(fs.access).mockRejectedValue(error);

      const result = await validateOutputDirectory('/readonly/directory');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not writable');
    });

    it('should return error for path that is not a directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
      } as any);

      const result = await validateOutputDirectory('/path/to/file.txt');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a directory');
    });
  });

  describe('writeBackupFile', () => {
    it('should write backup file with correct content', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const backupData = {
        metadata: {
          backupTimestamp: '2024-01-15T10:30:00.000Z',
          tenantDomain: 'test.auth0.com',
          resourceType: 'applications',
          totalCount: 2,
          mcpServerVersion: '0.1.0-beta.9',
        },
        data: [{ client_id: 'app1' }, { client_id: 'app2' }],
      };

      await writeBackupFile('/output', 'test.json', backupData);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/output', 'test.json'),
        JSON.stringify(backupData, null, 2),
        'utf-8'
      );
    });
  });

  describe('createBackupMetadata', () => {
    it('should create metadata with correct structure', () => {
      const timestamp = '2024-01-15T10-30-00Z';
      const metadata = createBackupMetadata(timestamp, 'test.auth0.com', 'applications', 5);

      expect(metadata).toEqual({
        backupTimestamp: '2024:01:15T10:30:00.000Z',
        tenantDomain: 'test.auth0.com',
        resourceType: 'applications',
        totalCount: 5,
        mcpServerVersion: '0.1.0-beta.9',
      });
    });
  });

  describe('createSummaryMetadata', () => {
    it('should create summary metadata with correct structure', () => {
      const timestamp = '2024-01-15T10-30-00Z';
      const startTime = new Date('2024-01-15T10:30:00.000Z');
      const endTime = new Date('2024-01-15T10:30:05.500Z');

      const metadata = createSummaryMetadata({
        timestamp,
        startTime,
        endTime,
        domain: 'test.auth0.com',
        totalResourcesBacked: 10,
        resourceTypesAttempted: 5,
        resourceTypesSucceeded: 4,
        resourceTypesFailed: 1,
      });

      expect(metadata).toEqual({
        backupTimestamp: '2024:01:15T10:30:00.000Z',
        backupStartTime: '2024-01-15T10:30:00.000Z',
        backupEndTime: '2024-01-15T10:30:05.500Z',
        durationMs: 5500,
        tenantDomain: 'test.auth0.com',
        mcpServerVersion: '0.1.0-beta.9',
        totalResourcesBacked: 10,
        resourceTypesAttempted: 5,
        resourceTypesSucceeded: 4,
        resourceTypesFailed: 1,
      });
    });

    it('should calculate duration correctly', () => {
      const startTime = new Date('2024-01-15T10:30:00.000Z');
      const endTime = new Date('2024-01-15T10:32:30.000Z'); // 2 minutes 30 seconds later

      const metadata = createSummaryMetadata({
        timestamp: '2024-01-15T10-30-00Z',
        startTime,
        endTime,
        domain: 'test.auth0.com',
        totalResourcesBacked: 100,
        resourceTypesAttempted: 5,
        resourceTypesSucceeded: 5,
        resourceTypesFailed: 0,
      });

      expect(metadata.durationMs).toBe(150000); // 2.5 minutes in milliseconds
    });
  });

  describe('paginateAllResources', () => {
    it('should fetch all resources across multiple pages', async () => {
      const mockFetchPage = vi
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], total: 5 })
        .mockResolvedValueOnce({ data: [{ id: 3 }, { id: 4 }], total: 5 })
        .mockResolvedValueOnce({ data: [{ id: 5 }], total: 5 });

      const result = await paginateAllResources(mockFetchPage, 2);

      expect(result).toHaveLength(5);
      expect(mockFetchPage).toHaveBeenCalledTimes(3);
      expect(mockFetchPage).toHaveBeenNthCalledWith(1, 0, 2);
      expect(mockFetchPage).toHaveBeenNthCalledWith(2, 1, 2);
      expect(mockFetchPage).toHaveBeenNthCalledWith(3, 2, 2);
    });

    it('should handle empty result', async () => {
      const mockFetchPage = vi.fn().mockResolvedValue({ data: [], total: 0 });

      const result = await paginateAllResources(mockFetchPage);

      expect(result).toHaveLength(0);
      expect(mockFetchPage).toHaveBeenCalledTimes(1);
    });

    it('should handle single page result', async () => {
      const mockFetchPage = vi.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        total: 2,
      });

      const result = await paginateAllResources(mockFetchPage, 100);

      expect(result).toHaveLength(2);
      expect(mockFetchPage).toHaveBeenCalledTimes(1);
    });

    it('should stop when receiving fewer items than page size (no total)', async () => {
      const mockFetchPage = vi
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] }) // No total provided
        .mockResolvedValueOnce({ data: [{ id: 3 }] }); // Less than perPage

      const result = await paginateAllResources(mockFetchPage, 2);

      expect(result).toHaveLength(3);
      expect(mockFetchPage).toHaveBeenCalledTimes(2);
    });
  });

  describe('SUPPORTED_RESOURCE_TYPES', () => {
    it('should include all expected resource types', () => {
      expect(SUPPORTED_RESOURCE_TYPES).toContain('applications');
      expect(SUPPORTED_RESOURCE_TYPES).toContain('connections');
      expect(SUPPORTED_RESOURCE_TYPES).toContain('actions');
      expect(SUPPORTED_RESOURCE_TYPES).toContain('resource_servers');
      expect(SUPPORTED_RESOURCE_TYPES).toContain('forms');
      expect(SUPPORTED_RESOURCE_TYPES).toHaveLength(5);
    });
  });
});
