# Auth0 Tenant Backup Tool - Tech Spec Summary

## Overview

This tech spec describes the implementation of an `auth0_backup_tenant` MCP tool that exports all Auth0 tenant configurations to structured JSON files.

## Key Decisions

| Decision              | Choice                          | Rationale                                           |
| --------------------- | ------------------------------- | --------------------------------------------------- |
| **Tool Design**       | Single comprehensive tool       | One tool call backs up everything - simpler UX      |
| **File Organization** | One JSON file per resource type | Easier to review and manage individual resources    |
| **Pagination**        | Auto-paginate all resources     | Ensures complete backup without user intervention   |
| **Error Handling**    | Continue on partial failures    | Better to backup what's possible than fail entirely |
| **Scope**             | Backup only (no restore)        | Focused scope for this iteration                    |
| **Storage**           | Local filesystem                | Simple, no cloud dependencies                       |

## Resources to Backup

1. **Applications** (clients)
2. **Connections** (identity providers)
3. **Actions** (extensibility code)
4. **Resource Servers** (APIs)
5. **Forms** (UI customization)

## Architecture Highlights

- **Single MCP Tool**: `auth0_backup_tenant`
- **Output**: Separate JSON files per resource type + summary file
- **Metadata**: Each file includes backup timestamp, tenant domain, resource count
- **Security**: Read-only operation, no secrets/credentials included

## Implementation Approach

**Vertical Slicing** - Each milestone delivers a working subset:

| Milestone | Deliverable                               |
| --------- | ----------------------------------------- |
| M1        | Core infrastructure + Applications backup |
| M2        | Add Connections backup                    |
| M3        | Add Actions backup                        |
| M4        | Add Resource Servers backup               |
| M5        | Add Forms backup                          |
| M6        | Summary file + complete metadata          |

## Key Files to Create/Modify

**New Files:**

- `src/tools/backup.ts` - Tool definition and handlers
- `src/utils/backup-utils.ts` - Pagination and file utilities
- `test/tools/backup.test.ts` - Handler tests

**Files to Modify:**

- `src/tools/index.ts` - Add backup tools to aggregation

## Patterns to Follow

- Tool definition: `src/tools/applications.ts:17-40`
- Handler implementation: `src/tools/applications.ts:274-400`
- Pagination handling: `src/tools/applications.ts:306-350`
- Response formatting: `src/utils/http-utility.ts:31-69`
- Test structure: `test/tools/applications.test.ts:1-95`

## Risks & Mitigations

| Risk                           | Mitigation                                                 |
| ------------------------------ | ---------------------------------------------------------- |
| Rate limiting on large tenants | Use existing retry logic, report partial success           |
| Filesystem permission errors   | Validate directory before starting, clear error messages   |
| Sensitive data exposure        | Auth0 API doesn't return secrets; document what's included |

## Output File Structure

```
{output_directory}/
├── auth0-backup-applications-{timestamp}.json
├── auth0-backup-connections-{timestamp}.json
├── auth0-backup-actions-{timestamp}.json
├── auth0-backup-resource-servers-{timestamp}.json
├── auth0-backup-forms-{timestamp}.json
└── auth0-backup-summary-{timestamp}.json
```

## Required Scopes

```
read:clients
read:connections
read:actions
read:resource_servers
read:forms
```

## Next Steps

1. Review and approve this tech spec
2. Begin Milestone 1 implementation
3. Iterate through milestones 2-6
4. Release in next beta version

---

**Full Tech Spec**: [docs/tech-spec-auth0-backup-tool.md](./tech-spec-auth0-backup-tool.md)
