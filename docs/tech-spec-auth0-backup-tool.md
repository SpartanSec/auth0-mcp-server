# Technical Specification: Auth0 Tenant Backup MCP Tool

## 1. Overview

### 1.1 Purpose

Create an MCP tool that enables AI assistants to systematically backup all Auth0 tenant configurations to structured JSON files on the local filesystem. This provides a reliable way to export and preserve Auth0 configurations for disaster recovery, migration, or audit purposes.

### 1.2 Goals

- Export all supported Auth0 resource types to JSON files
- Auto-paginate through large datasets to ensure complete backups
- Generate structured, restorable backup files with metadata
- Provide a summary file documenting all backed-up resources

### 1.3 Non-Goals

- **Restore functionality** - This spec covers backup only; restore is a future iteration
- **Cloud storage** - Backups are saved to local filesystem only
- **Incremental backups** - Each backup is a full snapshot
- **Secrets/credentials backup** - Sensitive data like client secrets are not included for security

### 1.4 Success Metrics

- All supported resource types are backed up completely (100% coverage)
- Backup files are valid JSON that can be parsed without errors
- Summary file accurately reflects all backed-up resources
- Tool completes successfully on tenants with 1000+ resources per type

## 2. Background and Context

### 2.1 Current State

The Auth0 MCP Server currently provides tools to list and get individual resources (applications, connections, actions, resource servers, forms). Users must manually call each tool and save results individually, which is tedious and error-prone for full tenant backups.

### 2.2 Proposed State

A single `auth0_backup_tenant` MCP tool that:

1. Iterates through all supported resource types
2. Auto-paginates to fetch all items
3. Saves each resource type to a separate JSON file
4. Generates a summary file with backup metadata

### 2.3 User Impact

AI assistants can backup entire Auth0 tenants with a single tool call, providing:

- Quick disaster recovery preparation
- Easy configuration auditing
- Migration documentation
- Configuration versioning when combined with git

## 3. Technical Decisions

### Decision 1: Single Comprehensive Tool vs. Multiple Granular Tools

- **Chosen Approach**: Single `auth0_backup_tenant` tool
- **Rationale**: Simplifies user experience - one call backs up everything. Follows the principle of least surprise.
- **Alternatives Considered**:
  - Multiple tools (`auth0_backup_applications`, etc.) - Rejected because it requires users to remember and call multiple tools
- **Implications**: Tool handler will be more complex but user experience is streamlined

### Decision 2: File Organization Strategy

- **Chosen Approach**: One JSON file per resource type + summary file
- **Rationale**: Easier to review individual resource types, prevents massive single files
- **File Structure**:
  ```
  {output_directory}/
  ├── auth0-backup-applications-{timestamp}.json
  ├── auth0-backup-connections-{timestamp}.json
  ├── auth0-backup-actions-{timestamp}.json
  ├── auth0-backup-resource-servers-{timestamp}.json
  ├── auth0-backup-forms-{timestamp}.json
  └── auth0-backup-summary-{timestamp}.json
  ```
- **Implications**: Requires consistent timestamp across all files from a single backup run

### Decision 3: Pagination Strategy

- **Chosen Approach**: Auto-paginate all resources (fetch every page automatically)
- **Rationale**: Ensures complete backup without user intervention
- **Alternatives Considered**:
  - Configurable limit - Rejected because incomplete backups defeat the purpose
- **Implications**: May take longer on large tenants; need rate limit handling

### Decision 4: Error Handling Strategy

- **Chosen Approach**: Continue on partial failures, report in summary
- **Rationale**: Better to backup what's possible than fail entirely
- **Alternatives Considered**:
  - Fail fast on any error - Rejected because one failing resource type shouldn't prevent backing up others
- **Implications**: Summary file must include error details for any failed resource types

## 4. Architecture and Design

### 4.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (AI Assistant)                 │
└─────────────────────────┬───────────────────────────────────┘
                          │ CallToolRequest
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server (server.ts)                   │
│  - Validates configuration                                   │
│  - Routes to backup handler                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Backup Handler (tools/backup.ts)               │
│  - Orchestrates backup process                               │
│  - Calls resource-specific backup functions                  │
│  - Writes files to filesystem                                │
└────────┬────────────────┬────────────────┬──────────────────┘
         │                │                │
         ▼                ▼                ▼
┌────────────┐   ┌────────────┐   ┌────────────────┐
│ Applications│   │ Connections│   │ Other Resources │
│   Backup   │   │   Backup   │   │    Backups      │
└─────┬──────┘   └─────┬──────┘   └───────┬────────┘
      │                │                   │
      ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Auth0 Management API                       │
│  (via ManagementClient from auth0-client.ts)                 │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Data Model

**Backup File Structure** (per resource type):

```typescript
interface BackupFile<T> {
  metadata: {
    backupTimestamp: string; // ISO 8601 format
    tenantDomain: string; // e.g., "your-tenant.us.auth0.com"
    resourceType: string; // e.g., "applications"
    totalCount: number; // Number of items backed up
    mcpServerVersion: string; // Version of auth0-mcp-server
  };
  data: T[]; // Array of resources
}
```

**Summary File Structure**:

```typescript
interface BackupSummary {
  metadata: {
    backupTimestamp: string;
    tenantDomain: string;
    mcpServerVersion: string;
    totalResourcesBacked: number;
  };
  resources: {
    [resourceType: string]: {
      count: number;
      fileName: string;
      status: 'success' | 'failed' | 'partial';
      error?: string;
    };
  };
  files: string[]; // List of all backup file paths
}
```

### 4.3 API Design

**Tool Definition**:

```typescript
{
  name: 'auth0_backup_tenant',
  description: 'Backup all Auth0 tenant configurations to JSON files. Creates separate files for each resource type (applications, connections, actions, resource servers, forms) plus a summary file.',
  inputSchema: {
    type: 'object',
    properties: {
      output_directory: {
        type: 'string',
        description: 'Directory path where backup files will be saved. Defaults to current working directory.',
      },
      include_resources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of resource types to backup. Defaults to all supported types: ["applications", "connections", "actions", "resource_servers", "forms"]',
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
    openWorldHint: true,  // Writes to filesystem
  },
}
```

### 4.4 Service Interactions

1. **MCP Server → Backup Handler**: Server routes `auth0_backup_tenant` calls to handler
2. **Backup Handler → Auth0 API**: Uses existing `getManagementClient()` from `auth0-client.ts`
3. **Backup Handler → Filesystem**: Uses Node.js `fs/promises` for file operations
4. **Backup Handler → MCP Server**: Returns success/error response with file paths

### 4.5 Security Considerations

- **Authentication**: Uses existing token from keychain (no new auth needed)
- **Authorization**: Requires read-only scopes for all resource types
- **Data Protection**:
  - Client secrets are NOT included in application backups (Auth0 API doesn't return them)
  - Connection credentials are NOT included (Auth0 API doesn't return them)
  - Files are written with default user permissions
- **Input Validation**:
  - Validate `output_directory` exists and is writable
  - Sanitize resource type names to prevent path traversal

### 4.6 Observability

- **Metrics**: Track via existing analytics wrapper (`trackEvent.trackTool`)
- **Logging**: Use existing logger utility for debug output
- **Response Content**: Include detailed progress in response for transparency

## 5. Best Practices and Patterns

### 5.1 Patterns to Follow

**Tool Definition Pattern** (from `src/tools/applications.ts:17-40`):

- Define tool with clear description
- Include `_meta` with required scopes and `readOnly: true`
- Use MCP 2025-03-26 annotations

**Handler Pattern** (from `src/tools/applications.ts:274-400`):

- Check for token presence first
- Get ManagementClient via `getManagementClient()`
- Use try/catch with specific error handling
- Return via `createSuccessResponse()` or `createErrorResponse()`

**Pagination Pattern** (from `src/tools/applications.ts:306-350`):

- Use `page` and `per_page` parameters
- Handle both array and paginated object responses
- Continue until no more results

**Error Handling Pattern** (from `src/tools/applications.ts:365-387`):

- Handle 401 (Unauthorized), 403 (Forbidden), 429 (Rate Limited), 5xx (Server Error)
- Provide helpful error messages with context

### 5.2 Anti-Patterns to Avoid

- ❌ Don't create new authentication flows - use existing `loadConfig()` and keychain
- ❌ Don't make synchronous file operations - use `fs/promises`
- ❌ Don't swallow errors silently - always report failures in response
- ❌ Don't hardcode pagination limits - make them configurable internally

### 5.3 Local Code Patterns

| Pattern                   | Reference File                    | Line Numbers |
| ------------------------- | --------------------------------- | ------------ |
| Tool definition structure | `src/tools/applications.ts`       | 17-40        |
| Handler implementation    | `src/tools/applications.ts`       | 274-400      |
| Pagination handling       | `src/tools/applications.ts`       | 306-350      |
| Error handling            | `src/tools/applications.ts`       | 365-387      |
| Response formatting       | `src/utils/http-utility.ts`       | 31-69        |
| Tool aggregation          | `src/tools/index.ts`              | 11-68        |
| Test structure            | `test/tools/applications.test.ts` | 1-95         |

## 6. Testing Strategy

### 6.1 Unit Testing

- Test pagination utility function with various page counts
- Test file writing utility with mock filesystem
- Test timestamp formatting
- Test backup file structure generation
- **Target coverage**: 80%+

### 6.2 Integration Testing

- Test full backup flow with MSW mocked Auth0 API
- Test error handling when individual resource types fail
- Test partial success scenarios
- Test large dataset handling (multi-page pagination)

### 6.3 Manual Testing

- Run backup on a real Auth0 tenant
- Verify all files are created with correct structure
- Verify summary file accuracy
- Test with empty tenant (no resources)
- Test with large tenant (100+ items per resource type)

### 6.4 Test File Structure

```
test/
├── tools/
│   └── backup.test.ts           # Handler tests
├── utils/
│   └── backup-utils.test.ts     # Utility function tests
└── mocks/
    └── auth0/
        └── backup-responses.ts  # Mock data for backup tests
```

## 7. Rollout and Deployment

### 7.1 Deployment Strategy

- Feature is additive (new tool) - no breaking changes
- Ship in next beta release
- Document in README and changelog

### 7.2 Feature Flags

- Not required (additive feature, not behavioral change)

### 7.3 Database Migrations

- Not applicable (no database used)

### 7.4 Backwards Compatibility

- Fully backwards compatible - adds new tool without modifying existing ones
- Existing tool patterns remain unchanged

### 7.5 Rollback Plan

- Remove `auth0_backup_tenant` from `TOOLS` array in `src/tools/index.ts`
- Remove import of backup module
- No data migration needed

## 8. Risks and Mitigations

### Risk 1: Rate Limiting on Large Tenants

- **Likelihood**: Medium
- **Impact**: Medium (backup may fail partway through)
- **Mitigation**:
  - Use existing retry logic from ManagementClient (`maxRetries: 10`)
  - Add delay between resource types if rate limited
  - Report partial success in summary file

### Risk 2: Filesystem Permission Errors

- **Likelihood**: Low
- **Impact**: High (backup fails completely)
- **Mitigation**:
  - Validate output directory is writable before starting
  - Provide clear error message with directory path
  - Suggest alternative directory if default fails

### Risk 3: Very Large Tenants Timeout

- **Likelihood**: Low
- **Impact**: Medium (backup incomplete)
- **Mitigation**:
  - Process resource types sequentially to spread load
  - Return partial results if timeout occurs
  - Document expected behavior for large tenants

### Risk 4: Sensitive Data Exposure

- **Likelihood**: Low
- **Impact**: High (security concern)
- **Mitigation**:
  - Auth0 API doesn't return secrets in list/get operations
  - Document what data IS and IS NOT included in backups
  - Recommend appropriate file permissions for backup directory

## 9. Dependencies

### 9.1 Internal Dependencies

- `src/utils/auth0-client.ts` - ManagementClient factory
- `src/utils/http-utility.ts` - Response formatting utilities
- `src/utils/types.ts` - Type definitions
- `src/utils/config.ts` - Configuration loading

### 9.2 External Dependencies

- `auth0` package (v4.21.0) - Already installed
- `fs/promises` - Node.js built-in for file operations
- No new external dependencies required

### 9.3 Infrastructure Dependencies

- Local filesystem write access
- Auth0 Management API access (existing)

## 10. Open Questions

- [x] ~~Which resource types to include?~~ → All supported types
- [x] ~~Single tool or multiple tools?~~ → Single comprehensive tool
- [x] ~~Auto-paginate or configurable limit?~~ → Auto-paginate
- [x] ~~Restore functionality scope?~~ → Out of scope for this iteration
- [ ] Should we add compression option for large backups? (Future enhancement)
- [ ] Should we add encryption option for sensitive tenants? (Future enhancement)

## 11. Implementation Plan

### Milestone 1: Core Infrastructure + Applications Backup

**Objective**: Create working backup tool that saves Applications to JSON file with full pagination support.

**Success Criteria**:

- `auth0_backup_tenant` tool appears in MCP tool list
- Calling tool with default parameters backs up all applications
- Backup file contains valid JSON with metadata and data array
- Pagination works for tenants with 100+ applications
- Tests pass with 80%+ coverage

**Files to Create**:

- `src/tools/backup.ts` - Tool definition and handler
- `src/utils/backup-utils.ts` - Shared utilities (pagination, file writing)
- `test/tools/backup.test.ts` - Handler tests
- `test/utils/backup-utils.test.ts` - Utility tests
- `test/mocks/auth0/backup-responses.ts` - Mock data

**Files to Modify**:

- `src/tools/index.ts:11-18` - Add BACKUP_TOOLS to aggregation
- `src/tools/index.ts:21-28` - Add BACKUP_HANDLERS to aggregation

**Implementation Steps**:

1. Create `src/utils/backup-utils.ts` with:
   - `generateTimestamp()` - Returns ISO timestamp for filenames
   - `paginateAllResources()` - Generic function to fetch all pages
   - `writeBackupFile()` - Writes JSON with metadata wrapper
   - `validateOutputDirectory()` - Checks directory exists and is writable

2. Create `src/tools/backup.ts` with:
   - `BACKUP_TOOLS` array with `auth0_backup_tenant` definition
   - `BACKUP_HANDLERS` object with handler implementation
   - `backupApplications()` - Fetches and saves all applications

3. Update `src/tools/index.ts` to include backup tools and handlers

4. Create test files following pattern from `test/tools/applications.test.ts`

**Testing Strategy**:

- Unit test pagination utility with mock data (0, 1, 5, 100 items)
- Unit test file writing with mock filesystem
- Integration test full handler with MSW mocks
- Test error handling for API failures

**Dependencies**: None (first milestone)

**Risks and Mitigations**:

- Risk: Pagination logic errors → Test with various page sizes
- Risk: File path issues on Windows → Use `path.join()` for cross-platform

---

### Milestone 2: Add Connections Backup

**Objective**: Extend backup tool to include Connections resource type.

**Success Criteria**:

- Backup includes connections file alongside applications
- Connection-specific fields are preserved correctly
- Tests cover connection-specific scenarios

**Files to Modify**:

- `src/tools/backup.ts` - Add `backupConnections()` function
- `src/utils/backup-utils.ts` - Add connection-specific types if needed
- `test/tools/backup.test.ts` - Add connection backup tests
- `test/mocks/auth0/backup-responses.ts` - Add connection mock data

**Implementation Steps**:

1. Add `backupConnections()` function following `backupApplications()` pattern
2. Update main handler to call `backupConnections()`
3. Update summary generation to include connections
4. Add tests for connections backup

**Testing Strategy**:

- Test connections with various strategies (database, social, enterprise)
- Test enabled_clients array preservation

**Dependencies**: Milestone 1

---

### Milestone 3: Add Actions Backup

**Objective**: Extend backup tool to include Actions resource type.

**Success Criteria**:

- Backup includes actions file
- Action code is preserved correctly
- Deployed vs. draft status is captured

**Files to Modify**:

- `src/tools/backup.ts` - Add `backupActions()` function
- `test/tools/backup.test.ts` - Add action backup tests
- `test/mocks/auth0/backup-responses.ts` - Add action mock data

**Implementation Steps**:

1. Add `backupActions()` function
2. Handle actions-specific pagination (uses `triggers` endpoint structure)
3. Update main handler to call `backupActions()`
4. Add tests for actions backup

**Testing Strategy**:

- Test actions with code blocks
- Test various trigger types (post-login, pre-user-registration, etc.)

**Dependencies**: Milestone 2

---

### Milestone 4: Add Resource Servers Backup

**Objective**: Extend backup tool to include Resource Servers (APIs) resource type.

**Success Criteria**:

- Backup includes resource-servers file
- API scopes and permissions are preserved
- Identifier (audience) is captured correctly

**Files to Modify**:

- `src/tools/backup.ts` - Add `backupResourceServers()` function
- `test/tools/backup.test.ts` - Add resource server backup tests
- `test/mocks/auth0/backup-responses.ts` - Add resource server mock data

**Implementation Steps**:

1. Add `backupResourceServers()` function
2. Update main handler to call `backupResourceServers()`
3. Add tests for resource servers backup

**Testing Strategy**:

- Test resource servers with various scope configurations
- Test token settings preservation

**Dependencies**: Milestone 3

---

### Milestone 5: Add Forms Backup

**Objective**: Extend backup tool to include Forms resource type.

**Success Criteria**:

- Backup includes forms file
- Form configuration and flow are preserved
- Embedded HTML/CSS/JS is captured correctly

**Files to Modify**:

- `src/tools/backup.ts` - Add `backupForms()` function
- `test/tools/backup.test.ts` - Add form backup tests
- `test/mocks/auth0/backup-responses.ts` - Add form mock data

**Implementation Steps**:

1. Add `backupForms()` function
2. Update main handler to call `backupForms()`
3. Add tests for forms backup

**Testing Strategy**:

- Test forms with complex flow configurations
- Test embedded content preservation

**Dependencies**: Milestone 4

---

### Milestone 6: Summary File + Metadata

**Objective**: Generate comprehensive summary file and ensure all backup files have complete metadata.

**Success Criteria**:

- Summary file lists all backed-up resources with counts
- Summary includes success/failure status per resource type
- All backup files have consistent metadata structure
- Summary includes total resource count across all types
- Summary lists all generated file paths

**Files to Modify**:

- `src/tools/backup.ts` - Add `generateSummary()` function, update handler
- `src/utils/backup-utils.ts` - Add summary type definitions
- `test/tools/backup.test.ts` - Add summary generation tests

**Implementation Steps**:

1. Define `BackupSummary` interface in types
2. Implement `generateSummary()` function
3. Update main handler to:
   - Track success/failure for each resource type
   - Collect all file paths
   - Generate and write summary file
4. Update response to include summary information
5. Add comprehensive integration tests

**Testing Strategy**:

- Test summary with all resources successful
- Test summary with partial failures
- Test summary with empty tenant (0 resources)
- Verify file paths in summary are correct

**Dependencies**: Milestone 5

---

## 12. Appendix

### 12.1 References

- [Auth0 Management API Documentation](https://auth0.com/docs/api/management/v2)
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- Existing tool implementations in `src/tools/*.ts`

### 12.2 Code References

| File                              | Purpose                 | Key Lines |
| --------------------------------- | ----------------------- | --------- |
| `src/tools/applications.ts`       | Tool definition pattern | 17-40     |
| `src/tools/applications.ts`       | Handler pattern         | 274-400   |
| `src/tools/applications.ts`       | Pagination handling     | 306-350   |
| `src/utils/http-utility.ts`       | Response utilities      | 31-69     |
| `src/utils/auth0-client.ts`       | Client factory          | 40-49     |
| `src/tools/index.ts`              | Tool aggregation        | 11-68     |
| `test/tools/applications.test.ts` | Test pattern            | 1-95      |
| `test/setup.ts`                   | Test setup with MSW     | 1-43      |

### 12.3 Example Backup Output

**applications backup file** (`auth0-backup-applications-2024-01-15T10-30-00Z.json`):

```json
{
  "metadata": {
    "backupTimestamp": "2024-01-15T10:30:00.000Z",
    "tenantDomain": "my-tenant.us.auth0.com",
    "resourceType": "applications",
    "totalCount": 5,
    "mcpServerVersion": "0.1.0-beta.9"
  },
  "data": [
    {
      "client_id": "abc123",
      "name": "My SPA",
      "app_type": "spa",
      "callbacks": ["https://myapp.com/callback"],
      ...
    },
    ...
  ]
}
```

**summary file** (`auth0-backup-summary-2024-01-15T10-30-00Z.json`):

```json
{
  "metadata": {
    "backupTimestamp": "2024-01-15T10:30:00.000Z",
    "tenantDomain": "my-tenant.us.auth0.com",
    "mcpServerVersion": "0.1.0-beta.9",
    "totalResourcesBacked": 47
  },
  "resources": {
    "applications": {
      "count": 5,
      "fileName": "auth0-backup-applications-2024-01-15T10-30-00Z.json",
      "status": "success"
    },
    "connections": {
      "count": 12,
      "fileName": "auth0-backup-connections-2024-01-15T10-30-00Z.json",
      "status": "success"
    },
    "actions": {
      "count": 8,
      "fileName": "auth0-backup-actions-2024-01-15T10-30-00Z.json",
      "status": "success"
    },
    "resource_servers": {
      "count": 3,
      "fileName": "auth0-backup-resource-servers-2024-01-15T10-30-00Z.json",
      "status": "success"
    },
    "forms": {
      "count": 19,
      "fileName": "auth0-backup-forms-2024-01-15T10-30-00Z.json",
      "status": "success"
    }
  },
  "files": [
    "auth0-backup-applications-2024-01-15T10-30-00Z.json",
    "auth0-backup-connections-2024-01-15T10-30-00Z.json",
    "auth0-backup-actions-2024-01-15T10-30-00Z.json",
    "auth0-backup-resource-servers-2024-01-15T10-30-00Z.json",
    "auth0-backup-forms-2024-01-15T10-30-00Z.json",
    "auth0-backup-summary-2024-01-15T10-30-00Z.json"
  ]
}
```
