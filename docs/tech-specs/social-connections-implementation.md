# Technical Specification: Auth0 Social Login Connections

## 1. Overview

### 1.1 Purpose

Enable users to manage social login providers (Google, Facebook, GitHub, LinkedIn) through the Auth0 MCP server. This feature allows AI assistants to create, configure, and link social identity provider connections to Auth0 applications via natural language commands.

### 1.2 Goals

- Provide CRUD operations for Auth0 social connections
- Support core social identity providers: Google, Facebook, GitHub, LinkedIn
- Enable linking/unlinking connections to specific applications
- Follow existing codebase patterns for consistency and maintainability
- Maintain security best practices with proper OAuth scope management

### 1.3 Non-Goals

- Enterprise connections (SAML, OIDC, Active Directory) - future enhancement
- Database connections management - separate feature
- Custom social connections - requires custom OAuth configuration
- Connection migration between tenants

### 1.4 Success Metrics

- All 6 connection tools pass unit tests with >80% coverage
- Integration with existing tool registry works seamlessly
- Error handling provides actionable feedback for common scenarios
- Documentation enables users to configure social providers end-to-end

## 2. Background and Context

### 2.1 Current State

The Auth0 MCP server currently supports:

- Applications (clients) - CRUD operations
- Resource Servers (APIs) - CRUD operations
- Actions - CRUD + deploy operations
- Logs - read operations
- Forms - CRUD operations

**Gap:** No support for managing Auth0 connections, which are required to enable authentication methods including social login.

### 2.2 Proposed State

Add a new `connections` tool module that provides:

- List all connections with optional strategy filtering
- Get connection details by ID
- Create new social connections with provider credentials
- Update existing connection configurations
- Delete connections (with user awareness of data implications)
- Enable/disable connections for specific applications

### 2.3 User Impact

Users will be able to:

- Set up social login (Google, Facebook, GitHub, LinkedIn) via AI assistant
- Configure OAuth credentials for social providers
- Link social connections to their Auth0 applications
- Manage connection settings without accessing the Auth0 dashboard

## 3. Technical Decisions

### Decision 1: Supported Social Providers

- **Chosen Approach**: Core providers (Google, Facebook, GitHub, LinkedIn)
- **Rationale**: These cover 90%+ of social login use cases. Extended providers can be added incrementally.
- **Alternatives Considered**:
  - All 30+ providers: Complexity without clear demand
  - Single provider: Too limited for practical use
- **Implications**: Strategy enum in input schema will be limited to 4 values initially

### Decision 2: Application Linking Tool

- **Chosen Approach**: Include `auth0_enable_connection_for_client` tool
- **Rationale**: Enabling a connection for an app is a critical step in the social login setup flow. Without this, users would need to complete setup in the dashboard.
- **Alternatives Considered**:
  - Dashboard-only linking: Breaks the end-to-end AI-assisted flow
- **Implications**: Additional tool and handler, uses `connections.updateEnabledClients()` SDK method

### Decision 3: Delete Connection Tool

- **Chosen Approach**: Include delete tool with clear warning about user data
- **Rationale**: Full CRUD provides complete management capability. Clear documentation and error messages will warn about destructive nature.
- **Alternatives Considered**:
  - No delete: Safer but incomplete functionality
- **Implications**: Tool must have `destructiveHint: true` annotation and description must warn about user deletion

### Decision 4: Milestone Granularity

- **Chosen Approach**: Fine-grained (6 milestones)
- **Rationale**: Allows incremental review and testing. Each milestone delivers demonstrable progress.
- **Alternatives Considered**:
  - Medium (3 milestones): Less review checkpoints
  - Coarse (2 milestones): Higher risk per PR
- **Implications**: 6 separate PRs, each independently testable

## 4. Architecture and Design

### 4.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server (server.ts)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Tool Registry                       │   │
│  │  ┌─────────────┬─────────────┬─────────────────┐    │   │
│  │  │ Applications│ Resource    │ Connections     │    │   │
│  │  │             │ Servers     │ (NEW)           │    │   │
│  │  └─────────────┴─────────────┴─────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Auth0 Management Client                  │   │
│  │              (utils/auth0-client.ts)                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │   Auth0 Management API   │
              │   /api/v2/connections    │
              └─────────────────────────┘
```

### 4.2 Data Model

**Connection Object (from Auth0 API):**

```typescript
interface Connection {
  id: string; // Connection ID (e.g., "con_abc123")
  name: string; // Unique name within tenant
  display_name: string; // UI display name
  strategy: string; // Provider type (e.g., "google-oauth2")
  options: {
    // Strategy-specific options
    client_id?: string; // OAuth client ID
    client_secret?: string; // OAuth client secret (masked in responses)
    scope?: string[]; // OAuth scopes
    [key: string]: any; // Provider-specific options
  };
  enabled_clients?: string[]; // DEPRECATED - use /connections/{id}/clients
  realms: string[]; // Authentication realms
  is_domain_connection?: boolean;
  show_as_button?: boolean; // Show in Universal Login
}
```

**Create Connection Request:**

```typescript
interface ConnectionCreate {
  name: string; // Required - unique identifier
  display_name?: string; // Optional - UI name
  strategy: ConnectionStrategy; // Required - provider type
  options?: ConnectionOptions; // Provider credentials & settings
  enabled_clients?: string[]; // Client IDs to enable for
  show_as_button?: boolean; // Show in login page
}

type ConnectionStrategy = 'google-oauth2' | 'facebook' | 'github' | 'linkedin';
```

### 4.3 API Design

**New MCP Tools:**

| Tool Name                            | HTTP Method | Auth0 Endpoint                     | Description                                    |
| ------------------------------------ | ----------- | ---------------------------------- | ---------------------------------------------- |
| `auth0_list_connections`             | GET         | `/api/v2/connections`              | List connections with optional strategy filter |
| `auth0_get_connection`               | GET         | `/api/v2/connections/{id}`         | Get connection details                         |
| `auth0_create_connection`            | POST        | `/api/v2/connections`              | Create new connection                          |
| `auth0_update_connection`            | PATCH       | `/api/v2/connections/{id}`         | Update connection settings                     |
| `auth0_delete_connection`            | DELETE      | `/api/v2/connections/{id}`         | Delete connection and its users                |
| `auth0_enable_connection_for_client` | PATCH       | `/api/v2/connections/{id}/clients` | Enable connection for applications             |

### 4.4 Service Interactions

```
User Request (via MCP)
        │
        ▼
┌───────────────────┐
│  MCP Server       │
│  (server.ts)      │
│  - Validates tool │
│  - Routes request │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Connection       │
│  Handler          │
│  (connections.ts) │
│  - Validates      │
│  - Transforms     │
│  - Calls SDK      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Auth0 SDK        │
│  ManagementClient │
│  .connections     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Auth0 API        │
│  (External)       │
└───────────────────┘
```

### 4.5 Security Considerations

- **Authentication**: Uses existing OAuth token flow with refresh capability
- **Authorization**: New scopes required:
  - `read:connections` - for list/get operations
  - `create:connections` - for create operation
  - `update:connections` - for update and enable/disable operations
  - `delete:connections` - for delete operation
- **Data Protection**:
  - `client_secret` values are masked in API responses
  - Secrets should never be logged or included in error messages
- **Input Validation**:
  - Strategy enum validation prevents arbitrary provider creation
  - Connection names validated against Auth0 naming rules

### 4.6 Observability

- **Logging**: Use existing `log()` utility from `utils/logger.js`
  - Log connection operations with ID (not secrets)
  - Log errors with status codes for debugging
- **Analytics**: Existing analytics wrapper in `tools/index.ts` will track:
  - Tool invocation counts
  - Success/failure rates per tool
- **Error Tracking**: Structured error responses with actionable remediation steps

## 5. Best Practices and Patterns

### 5.1 Codebase Best Practices to Follow

- Follow existing tool definition patterns exactly
- Use Auth0 SDK methods, not direct HTTP calls
- Validate required parameters before SDK calls
- Provide specific error messages with remediation steps
- Include all tools in the same PR as their tests

### 5.2 Anti-Patterns to Avoid

- Don't hardcode domains - use `config.domain`
- Don't skip token validation - always check `request.token`
- Don't expose secrets in logs or error messages
- Don't use generic error messages - provide status-code-specific guidance
- Don't create tools without corresponding tests

### 5.3 Local Code Patterns

**Tool Definition Pattern** - Follow `src/tools/applications.ts:17-259`:

```typescript
export const CONNECTION_TOOLS: Tool[] = [
  {
    name: 'auth0_xxx',
    description: 'Description with clear purpose',
    inputSchema: {
      /* JSON Schema */
    },
    _meta: {
      requiredScopes: ['scope:name'],
      readOnly: true | false,
    },
    annotations: {
      title: 'User-friendly title',
      readOnlyHint: boolean,
      destructiveHint: boolean,
      idempotentHint: boolean,
      openWorldHint: boolean,
    },
  },
];
```

**Handler Pattern** - Follow `src/tools/applications.ts:279-395`:

```typescript
auth0_xxx: async (request: HandlerRequest, config: HandlerConfig): Promise<HandlerResponse> => {
  try {
    // 1. Validate token
    if (!request.token) {
      return createErrorResponse('Error: Missing authorization token');
    }

    // 2. Validate domain
    if (!config.domain) {
      return createErrorResponse('Error: Auth0 domain is not configured');
    }

    // 3. Validate required parameters
    const { param } = request.parameters;
    if (!param) {
      return createErrorResponse('Error: param is required');
    }

    try {
      // 4. Initialize SDK client
      const managementClient = await getManagementClient({ domain: config.domain, token: request.token });

      // 5. Call SDK method
      const result = await managementClient.connections.xxx();

      // 6. Return success
      return createSuccessResponse(result);
    } catch (sdkError: any) {
      // 7. Handle SDK errors with specific messages
      let errorMessage = `Failed to xxx: ${sdkError.message}`;
      if (sdkError.statusCode === 401) { /* ... */ }
      return createErrorResponse(errorMessage);
    }
  } catch (error: any) {
    return createErrorResponse(`Error: ${error.message}`);
  }
},
```

## 6. Testing Strategy

### 6.1 Unit Testing

- Test each handler function independently
- Mock Auth0 SDK responses using MSW
- Test success paths and error paths
- Target: >80% code coverage

### 6.2 Integration Testing

- Verify tool registration in index.ts
- Verify tools appear in MCP ListTools response
- Verify handler routing works correctly

### 6.3 Manual Testing

- Test against real Auth0 tenant (development)
- Verify social connection creation end-to-end
- Verify app linking works correctly
- Test error scenarios (invalid credentials, missing scopes)

### 6.4 Test File Structure

```
test/
├── tools/
│   └── connections.test.ts    # Handler unit tests
└── mocks/
    └── auth0/
        └── connections.ts     # Mock data fixtures
```

## 7. Rollout and Deployment

### 7.1 Deployment Strategy

- Feature ships with standard npm release
- No feature flags required (tools self-register)
- Backwards compatible (additive change only)

### 7.2 Feature Flags

None required - new tools are additive and don't affect existing functionality.

### 7.3 Database Migrations

None required - no local data storage changes.

### 7.4 Backwards Compatibility

- Fully backwards compatible
- Existing tools unaffected
- New OAuth scopes required only for new functionality

### 7.5 Rollback Plan

- Remove connections.ts from imports in index.ts
- Redeploy previous version if critical issues found

## 8. Risks and Mitigations

### Risk 1: OAuth Scope Configuration Complexity

- **Likelihood**: Medium
- **Impact**: Medium
- **Mitigation**: Clear error messages guide users to re-run init command with required scopes. Document scope requirements.

### Risk 2: Accidental Connection Deletion (User Data Loss)

- **Likelihood**: Low
- **Impact**: High
- **Mitigation**:
  - Tool description explicitly warns about user deletion
  - `destructiveHint: true` annotation
  - Consider confirmation prompt in future enhancement

### Risk 3: Social Provider Credential Exposure

- **Likelihood**: Low
- **Impact**: High
- **Mitigation**:
  - Never log client_secret values
  - Auth0 API masks secrets in responses
  - Error messages don't include credential data

### Risk 4: Rate Limiting on Bulk Operations

- **Likelihood**: Medium
- **Impact**: Low
- **Mitigation**:
  - Handle 429 errors with clear retry guidance
  - Existing SDK retry logic (10 retries)

## 9. Dependencies

### 9.1 Internal Dependencies

- `src/utils/types.ts` - Type definitions
- `src/utils/auth0-client.ts` - SDK client factory
- `src/utils/http-utility.ts` - Response helpers
- `src/utils/logger.ts` - Logging utility
- `src/tools/index.ts` - Tool registry

### 9.2 External Dependencies

- `auth0` npm package (^4.21.0) - Already installed, provides ConnectionsManager

### 9.3 Infrastructure Dependencies

- Auth0 Management API access
- Valid Auth0 tenant with social connection capability

## 10. Open Questions

- [ ] Should we support batch operations (enable connection for multiple apps at once)?
- [ ] Should we add a tool to list available strategies/providers?
- [ ] Should connection options validation be strategy-specific?

## 11. Implementation Plan

### Milestone 1: List and Get Connection Tools

**Objective**: Enable users to view existing connections and their configurations

**Success Criteria**:

- `auth0_list_connections` returns paginated list of connections
- `auth0_get_connection` returns full connection details by ID
- Strategy filtering works correctly
- Unit tests pass with >80% coverage

**Files to Create**:

- `src/tools/connections.ts` - Initial file with list/get tools and handlers
- `test/mocks/auth0/connections.ts` - Mock connection data
- `test/tools/connections.test.ts` - Test suite for list/get handlers

**Files to Modify**:

- `src/tools/index.ts` - Import and register CONNECTION_TOOLS and CONNECTION_HANDLERS
- `test/mocks/handlers.ts` - Add MSW handlers for connections API

**Implementation Steps**:

1. Create `src/tools/connections.ts` with imports and type definitions
2. Define `auth0_list_connections` tool with strategy filter support
3. Define `auth0_get_connection` tool
4. Implement `auth0_list_connections` handler using `managementClient.connections.getAll()`
5. Implement `auth0_get_connection` handler using `managementClient.connections.get()`
6. Create mock data in `test/mocks/auth0/connections.ts`
7. Add MSW handlers to `test/mocks/handlers.ts`
8. Write unit tests for both handlers
9. Update `src/tools/index.ts` to register new tools

**Testing Strategy**:

- Unit tests for handler success paths
- Unit tests for error scenarios (401, 403, 404, 429)
- Test strategy filtering
- Test pagination parameters

**Risks and Mitigations**:

- Risk: SDK response format may differ from expectations
- Mitigation: Test against real API during development

---

### Milestone 2: Create Connection Tool

**Objective**: Enable users to create new social connections with provider credentials

**Success Criteria**:

- `auth0_create_connection` creates Google, Facebook, GitHub, LinkedIn connections
- Proper validation of required fields (name, strategy)
- Options schema supports client_id, client_secret, scope
- Unit tests pass

**Files to Modify**:

- `src/tools/connections.ts` - Add create tool and handler
- `test/tools/connections.test.ts` - Add create tests
- `test/mocks/handlers.ts` - Add POST handler

**Implementation Steps**:

1. Define `auth0_create_connection` tool with comprehensive input schema
2. Implement handler with validation for name and strategy
3. Transform parameters to `ConnectionCreate` format
4. Call `managementClient.connections.create()`
5. Add MSW POST handler
6. Write unit tests for create scenarios

**Testing Strategy**:

- Test creating each supported strategy
- Test validation error messages
- Test duplicate name handling (409)
- Test missing required fields

**Risks and Mitigations**:

- Risk: Different providers require different options
- Mitigation: Options object is flexible; document common patterns

---

### Milestone 3: Update Connection Tool

**Objective**: Enable users to modify existing connection configurations

**Success Criteria**:

- `auth0_update_connection` updates connection options
- Partial updates work (only specified fields change)
- Unit tests pass

**Files to Modify**:

- `src/tools/connections.ts` - Add update tool and handler
- `test/tools/connections.test.ts` - Add update tests
- `test/mocks/handlers.ts` - Add PATCH handler

**Implementation Steps**:

1. Define `auth0_update_connection` tool with update-able fields
2. Implement handler that builds partial update object
3. Call `managementClient.connections.update()`
4. Add MSW PATCH handler
5. Write unit tests

**Testing Strategy**:

- Test partial updates (single field)
- Test 404 error handling
- Test options object updates

**Risks and Mitigations**:

- Risk: Options object is replaced, not merged (Auth0 API behavior)
- Mitigation: Document in tool description; consider helper in future

---

### Milestone 4: Delete Connection Tool

**Objective**: Enable users to remove connections (with appropriate warnings)

**Success Criteria**:

- `auth0_delete_connection` removes connection by ID
- Tool description warns about user data deletion
- Unit tests pass

**Files to Modify**:

- `src/tools/connections.ts` - Add delete tool and handler
- `test/tools/connections.test.ts` - Add delete tests
- `test/mocks/handlers.ts` - Add DELETE handler

**Implementation Steps**:

1. Define `auth0_delete_connection` tool with warning in description
2. Set `destructiveHint: true` in annotations
3. Implement handler calling `managementClient.connections.delete()`
4. Add MSW DELETE handler
5. Write unit tests

**Testing Strategy**:

- Test successful deletion (204 response)
- Test 404 error handling
- Verify warning text in tool description

**Risks and Mitigations**:

- Risk: Accidental deletion loses user data
- Mitigation: Clear description warning; destructiveHint annotation

---

### Milestone 5: Enable Connection for Client Tool

**Objective**: Enable users to link connections to specific applications

**Success Criteria**:

- `auth0_enable_connection_for_client` enables/disables connection for apps
- Can specify multiple client IDs
- Unit tests pass

**Files to Modify**:

- `src/tools/connections.ts` - Add enable tool and handler
- `test/tools/connections.test.ts` - Add enable tests
- `test/mocks/handlers.ts` - Add PATCH clients handler

**Implementation Steps**:

1. Define `auth0_enable_connection_for_client` tool
2. Accept connection_id and array of client_ids
3. Implement handler calling `managementClient.connections.updateEnabledClients()`
4. Add MSW handler for PATCH /connections/{id}/clients
5. Write unit tests

**Testing Strategy**:

- Test enabling for single client
- Test enabling for multiple clients
- Test with invalid connection ID
- Test with invalid client ID

**Risks and Mitigations**:

- Risk: SDK method signature may differ
- Mitigation: Review SDK types; test against real API

---

### Milestone 6: Integration Testing and Documentation

**Objective**: Ensure all tools work together and are properly documented

**Success Criteria**:

- All 6 tools registered and appear in ListTools
- End-to-end flow works: list -> create -> enable -> update -> delete
- README or documentation updated
- Code coverage >80%

**Files to Modify**:

- `README.md` - Add connections tools documentation
- Various - Fix any issues found in integration testing

**Implementation Steps**:

1. Run full test suite and fix any failures
2. Test tools via MCP inspector
3. Verify tool registration in ListTools response
4. Test complete social login setup flow
5. Update documentation
6. Run coverage report and add tests if needed

**Testing Strategy**:

- Integration tests with MCP inspector
- Manual testing against development tenant
- Coverage verification

**Risks and Mitigations**:

- Risk: Edge cases not covered
- Mitigation: Manual testing with real Auth0 tenant

## 12. Appendix

### 12.1 References

- [Auth0 Node.js SDK](https://github.com/auth0/node-auth0)
- [Auth0 Management API - Connections](https://auth0.com/docs/api/management/v2/connections)
- [Auth0 Social Connections](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

### 12.2 Code References

- Tool definition pattern: `src/tools/applications.ts:17-259`
- Handler pattern: `src/tools/applications.ts:279-395`
- Tool registry: `src/tools/index.ts:10-25`
- SDK client: `src/utils/auth0-client.ts:40-49`
- Type definitions: `src/utils/types.ts:1-70`
- Response helpers: `src/utils/http-utility.ts:32-69`
- Test setup: `test/setup.ts:1-43`
- MSW handlers: `test/mocks/handlers.ts:1-296`
- Mock data pattern: `test/mocks/auth0/applications.ts:1-40`
- Test structure: `test/tools/applications.test.ts:1-256`

### 12.3 OAuth Scopes Summary

| Scope                | Tools                     |
| -------------------- | ------------------------- |
| `read:connections`   | list, get                 |
| `create:connections` | create                    |
| `update:connections` | update, enable_for_client |
| `delete:connections` | delete                    |

### 12.4 Social Provider Strategy Reference

| Provider | Strategy Value  | Common Scopes                     |
| -------- | --------------- | --------------------------------- |
| Google   | `google-oauth2` | `email`, `profile`, `openid`      |
| Facebook | `facebook`      | `email`, `public_profile`         |
| GitHub   | `github`        | `user:email`, `read:user`         |
| LinkedIn | `linkedin`      | `r_emailaddress`, `r_liteprofile` |
