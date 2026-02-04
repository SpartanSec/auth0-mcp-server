# Cursor Setup with Local Auth0 MCP Server ✅

## Status: Ready to Use!

Your Cursor is now configured to use the **local build** of the Auth0 MCP server with all 26 tools.

## Current Configuration

**Config File**: `~/.cursor/mcp.json`

**Using**: Local build at `/Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server/dist/index.js`

**Auth0 Tenant**: `affirm-dev.us.auth0.com` (dev tenant)

**Tools Available**: 26 tools including:

- ✅ Backup tool (`auth0_backup_tenant`)
- ✅ 6 Connection tools
- ✅ All other Auth0 management tools

## Next Steps

### 1. Restart Cursor

**IMPORTANT**: You must completely quit and restart Cursor:

1. **Quit Cursor completely:**
   - Press `Cmd+Q` (or Cursor → Quit Cursor)
   - Don't just close the window - fully quit the application

2. **Restart Cursor:**
   - Open Cursor again
   - Wait 10-15 seconds for MCP servers to initialize

### 2. Verify It's Working

After restart, check if the local build is running:

```bash
ps aux | grep 'dist/index.js.*run' | grep -v grep
```

You should see a process running your local build.

### 3. Test in Cursor

In Cursor, try asking:

- "List my Auth0 applications"
- "Show me all connections"
- "Backup my Auth0 tenant configuration"

## Available Tools (26 Total)

### Applications (4 tools)

- `auth0_list_applications`
- `auth0_get_application`
- `auth0_create_application`
- `auth0_update_application`

### Resource Servers (4 tools)

- `auth0_list_resource_servers`
- `auth0_get_resource_server`
- `auth0_create_resource_server`
- `auth0_update_resource_server`

### Actions (5 tools)

- `auth0_list_actions`
- `auth0_get_action`
- `auth0_create_action`
- `auth0_update_action`
- `auth0_deploy_action`

### Logs (2 tools)

- `auth0_list_logs`
- `auth0_get_log`

### Forms (4 tools)

- `auth0_list_forms`
- `auth0_get_form`
- `auth0_create_form`
- `auth0_update_form`

### Connections (6 tools) ✅

- `auth0_list_connections`
- `auth0_get_connection`
- `auth0_create_connection`
- `auth0_update_connection`
- `auth0_delete_connection`
- `auth0_enable_connection_for_client`

### Backup (1 tool) ✅

- `auth0_backup_tenant`

## Troubleshooting

### If tools don't appear:

1. **Check if local build is running:**

   ```bash
   ps aux | grep 'dist/index.js.*run'
   ```

2. **If npm package is running instead:**

   ```bash
   pkill -9 -f "@auth0/auth0-mcp-server"
   ./setup-cursor-local.sh
   ```

3. **Verify configuration:**

   ```bash
   cat ~/.cursor/mcp.json
   ```

   Should show `dist/index.js` in the args.

4. **Rebuild if needed:**
   ```bash
   cd /Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server
   npm run build
   ./setup-cursor-local.sh
   ```

### If you need to re-authenticate:

```bash
cd /Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server
node dist/index.js logout
node dist/index.js init --client cursor --tools '*' --scopes 'read:*,create:*,update:*,delete:connections' --no-interaction
./setup-cursor-local.sh  # Always run this after init to fix config
```

## Important Notes

⚠️ **DO NOT run `init` without fixing config afterward:**

```bash
# DON'T do this alone:
node dist/index.js init --client cursor

# Instead, always run the setup script after init:
./setup-cursor-local.sh
```

The `init` command overwrites the config to use npm package. The setup script fixes it back to local build.

## Quick Commands

```bash
# Check current session
node dist/index.js session

# Check if local build is running
ps aux | grep 'dist/index.js.*run'

# Re-run setup (if needed)
./setup-cursor-local.sh

# Rebuild and setup
npm run build && ./setup-cursor-local.sh
```

## Success Indicators

✅ Cursor shows Auth0 tools in the MCP panel
✅ Can ask Cursor to manage Auth0 resources
✅ Local build process is running (not npm package)
✅ All 26 tools are available

Enjoy using Auth0 management in Cursor! 🚀
