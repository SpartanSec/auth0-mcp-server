# Social Login Connections - Tech Lead Summary

## Feature Overview

Add support for managing social login providers (Google, Facebook, GitHub, LinkedIn) through the Auth0 MCP server, enabling end-to-end social authentication setup via AI assistants.

## Key Technical Decisions

| Decision                | Choice                                            | Rationale                                            |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| **Supported Providers** | Core 4 (Google, Facebook, GitHub, LinkedIn)       | Covers 90%+ of use cases; can expand later           |
| **App Linking**         | Include `auth0_enable_connection_for_client` tool | Required for complete setup flow without dashboard   |
| **Delete Tool**         | Include with warnings                             | Full CRUD needed; `destructiveHint: true` annotation |
| **Milestones**          | 6 fine-grained milestones                         | Allows incremental review and lower risk per PR      |

## New Tools (6 total)

1. `auth0_list_connections` - List/filter connections by strategy
2. `auth0_get_connection` - Get connection details by ID
3. `auth0_create_connection` - Create social connection with OAuth credentials
4. `auth0_update_connection` - Modify connection settings
5. `auth0_delete_connection` - Remove connection (warns about user data loss)
6. `auth0_enable_connection_for_client` - Link connection to application(s)

## Required OAuth Scopes

- `read:connections` - list, get
- `create:connections` - create
- `update:connections` - update, enable_for_client
- `delete:connections` - delete

## Implementation Approach

**Pattern:** Follow existing `src/tools/applications.ts` exactly

- Same tool definition structure with `_meta.requiredScopes` and `annotations`
- Same handler pattern with token/domain validation
- Same error handling with status-code-specific messages
- Same test structure using MSW for mocking

**Files to Create:**

- `src/tools/connections.ts` - Tools and handlers
- `test/tools/connections.test.ts` - Unit tests
- `test/mocks/auth0/connections.ts` - Mock data

**Files to Modify:**

- `src/tools/index.ts` - Register new tools/handlers
- `test/mocks/handlers.ts` - Add connection API mocks

## Risk Mitigation

| Risk                | Mitigation                                             |
| ------------------- | ------------------------------------------------------ |
| Accidental deletion | Clear warning in description + `destructiveHint: true` |
| Credential exposure | Never log secrets; Auth0 masks in responses            |
| Scope confusion     | Clear error messages with remediation steps            |

## Milestone Summary

1. **List/Get tools** - Read operations + basic test infrastructure
2. **Create tool** - Social connection creation with options schema
3. **Update tool** - Partial updates for connection settings
4. **Delete tool** - Removal with appropriate warnings
5. **App linking tool** - Enable connections for specific clients
6. **Integration + Docs** - E2E testing, coverage verification, documentation

## Dependencies

- Uses existing `auth0` npm package (^4.21.0) - no new dependencies
- Leverages existing `getManagementClient()` from `utils/auth0-client.ts`

## Backwards Compatibility

Fully backwards compatible - additive change only. No breaking changes to existing tools.

---

**Full specification:** [social-connections-implementation.md](./social-connections-implementation.md)
