# Cursor MCP Configuration - Fixed ✅

## What Was Fixed

The issue was that the `init` command was overwriting your configuration to use the npm package (`@auth0/auth0-mcp-server` version 0.1.0-beta.7) instead of your local build (version 0.1.0-beta.9).

**The configuration has been updated to use your local build which includes:**

- ✅ Backup tool (`auth0_backup_tenant`)
- ✅ All 6 connection tools
- ✅ All 26 total tools

## Current Configuration

Your `~/.cursor/mcp.json` is now correctly configured:

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
      ],
      "env": {
        "DEBUG": "auth0-mcp"
      },
      "capabilities": ["tools"]
    }
  }
}
```

## ⚠️ IMPORTANT: Do NOT Run `init` Command

**DO NOT run:**

```bash
node dist/index.js init --client cursor
```

This will overwrite your configuration back to the npm package!

If you need to re-authenticate, use:

```bash
node dist/index.js logout
node dist/index.js init --client cursor --tools "*" --scopes "read:*,create:*,update:*,delete:connections" --no-interaction
```

Then immediately run:

```bash
./fix-cursor-config.sh
```

## Next Steps

1. **Completely quit Cursor:**
   - Press `Cmd+Q` (or Cursor → Quit Cursor)
   - Make sure it's fully quit, not just closed

2. **Restart Cursor:**
   - Open Cursor again
   - Wait 10-15 seconds for MCP servers to initialize

3. **Verify it's working:**

   ```bash
   ps aux | grep 'dist/index.js.*run' | grep -v grep
   ```

   You should see a process running your local build.

4. **Check your tools:**
   - You should now see all 26 tools including:
     - `auth0_backup_tenant`
     - `auth0_list_connections`
     - `auth0_get_connection`
     - `auth0_create_connection`
     - `auth0_update_connection`
     - `auth0_delete_connection`
     - `auth0_enable_connection_for_client`

## If It Still Doesn't Work

1. **Check if local build is running:**

   ```bash
   ps aux | grep 'dist/index.js.*run'
   ```

2. **If npm package is still running, kill it:**

   ```bash
   pkill -9 -f "@auth0/auth0-mcp-server"
   ```

3. **Re-run the fix script:**

   ```bash
   cd /Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server
   ./fix-cursor-config.sh
   ```

4. **Check Cursor logs:**
   - Look for MCP connection errors in Cursor's developer console
   - Check if there are any permission issues with the local build path

## Quick Fix Script

If you need to fix the configuration again, run:

```bash
cd /Users/harshdeep.ahuja/Documents/workspace/auth0-mcp-server
./fix-cursor-config.sh
```

This script will:

- Kill npm package processes
- Update the config to use local build
- Verify all tools are available
- Provide next steps
