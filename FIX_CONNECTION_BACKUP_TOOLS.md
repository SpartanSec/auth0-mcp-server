# Fix: Missing Connection and Backup Tools

## Problem

Your MCP client (Cursor) is not showing:

- **Connection tools** (6 tools for managing database, social, enterprise connections)
- **Backup tool** (`auth0_backup_tenant`)

## Root Cause

Cursor was still running the npm package version (`@auth0/auth0-mcp-server`) which doesn't have these newer tools. The local build has all 26 tools, but Cursor needs to be restarted to use the updated configuration.

## Solution

### Step 1: Verify Configuration ✅ (Already Done)

Your `~/.cursor/mcp.json` is correctly configured to use the local build:

```json
{
  "mcpServers": {
    "auth0": {
      "command": "node",
      "args": [
        "/Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server/dist/index.js",
        "run",
        "--tools",
        "*"
      ]
    }
  }
}
```

### Step 2: Restart Cursor 🔄

**IMPORTANT:** You must completely quit and restart Cursor:

1. **Quit Cursor completely:**
   - Press `Cmd+Q` (or Cursor → Quit Cursor)
   - Don't just close the window - fully quit the application

2. **Restart Cursor:**
   - Open Cursor again
   - Wait a few seconds for MCP servers to initialize

3. **Verify tools are available:**
   - Check your available tools list
   - You should now see all 26 tools including:
     - `auth0_backup_tenant` (backup tool)
     - `auth0_list_connections`
     - `auth0_get_connection`
     - `auth0_create_connection`
     - `auth0_update_connection`
     - `auth0_delete_connection`
     - `auth0_enable_connection_for_client`

## What You'll Have After Restart

### Complete Tool List (26 tools):

**Applications (4 tools):**

- auth0_list_applications
- auth0_get_application
- auth0_create_application
- auth0_update_application

**Resource Servers (4 tools):**

- auth0_list_resource_servers
- auth0_get_resource_server
- auth0_create_resource_server
- auth0_update_resource_server

**Actions (5 tools):**

- auth0_list_actions
- auth0_get_action
- auth0_create_action
- auth0_update_action
- auth0_deploy_action

**Logs (2 tools):**

- auth0_list_logs
- auth0_get_log

**Forms (4 tools):**

- auth0_list_forms
- auth0_get_form
- auth0_create_form
- auth0_update_form

**Connections (6 tools) - NEW:**

- auth0_list_connections
- auth0_get_connection
- auth0_create_connection
- auth0_update_connection
- auth0_delete_connection
- auth0_enable_connection_for_client

**Backup (1 tool) - NEW:**

- auth0_backup_tenant

## Troubleshooting

If tools still don't appear after restart:

1. **Check if local build is running:**

   ```bash
   ps aux | grep "dist/index.js.*run"
   ```

   Should show a process running your local build.

2. **Verify configuration:**

   ```bash
   cat ~/.cursor/mcp.json
   ```

   Should show `dist/index.js` in the args.

3. **Rebuild if needed:**

   ```bash
   cd /Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server
   npm run build
   ```

4. **Check Cursor logs:**
   - Look for MCP server connection errors in Cursor's developer console

## Verification Script

Run this to check everything:

```bash
cd /Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server
./verify-tools.sh
```
