#!/bin/bash

echo "=========================================="
echo "Fixing Cursor MCP Configuration"
echo "=========================================="
echo ""

# Kill all npm processes
echo "1. Killing npm package processes..."
pkill -9 -f "@auth0/auth0-mcp-server" 2>/dev/null
sleep 1
echo "   ✓ Done"
echo ""

# Get absolute path to local build
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_BUILD="$SCRIPT_DIR/dist/index.js"

if [ ! -f "$LOCAL_BUILD" ]; then
    echo "✗ Local build not found at $LOCAL_BUILD"
    echo "  Building..."
    cd "$SCRIPT_DIR"
    npm run build
    if [ ! -f "$LOCAL_BUILD" ]; then
        echo "✗ Build failed!"
        exit 1
    fi
fi

echo "2. Local build found: $LOCAL_BUILD"
echo ""

# Update Cursor config
MCP_CONFIG="$HOME/.cursor/mcp.json"
echo "3. Updating Cursor configuration..."

# Create config directory if it doesn't exist
mkdir -p "$(dirname "$MCP_CONFIG")"

# Write the correct configuration
cat > "$MCP_CONFIG" << EOF
{
  "mcpServers": {
    "auth0": {
      "command": "node",
      "args": [
        "$LOCAL_BUILD",
        "run",
        "--tools",
        "*"
      ],
      "env": {
        "DEBUG": "auth0-mcp"
      },
      "capabilities": [
        "tools"
      ]
    }
  }
}
EOF

echo "   ✓ Configuration updated"
echo ""

# Verify the config
echo "4. Verifying configuration..."
if grep -q "$LOCAL_BUILD" "$MCP_CONFIG"; then
    echo "   ✓ Config points to local build"
else
    echo "   ✗ Config verification failed"
    exit 1
fi
echo ""

# Verify local build has all tools
echo "5. Verifying local build tools..."
cd "$SCRIPT_DIR"
BACKUP_EXISTS=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.find(t => t.name === 'auth0_backup_tenant') ? 'YES' : 'NO');" 2>/dev/null)
CONNECTION_COUNT=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.filter(t => t.name.includes('connection')).length);" 2>/dev/null)

echo "   Backup tool: $BACKUP_EXISTS"
echo "   Connection tools: $CONNECTION_COUNT"
echo ""

if [ "$BACKUP_EXISTS" != "YES" ] || [ "$CONNECTION_COUNT" != "6" ]; then
    echo "   ✗ Local build missing tools - rebuilding..."
    npm run build
fi

echo "=========================================="
echo "✓ Configuration Fixed"
echo "=========================================="
echo ""
echo "IMPORTANT:"
echo "1. The config file has been updated to use the local build"
echo "2. DO NOT run 'node dist/index.js init' - it will overwrite this config"
echo "3. Completely quit Cursor (Cmd+Q)"
echo "4. Restart Cursor"
echo "5. Wait 10-15 seconds for MCP servers to initialize"
echo ""
echo "To verify after restart:"
echo "  ps aux | grep 'dist/index.js.*run' | grep -v grep"
echo ""
