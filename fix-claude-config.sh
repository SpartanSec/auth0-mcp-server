#!/bin/bash

echo "=========================================="
echo "Fixing Claude Desktop MCP Configuration"
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

# Update Claude Desktop config
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
echo "3. Updating Claude Desktop configuration..."

# Create config directory if it doesn't exist
mkdir -p "$(dirname "$CLAUDE_CONFIG")"

# Read existing config if it exists
if [ -f "$CLAUDE_CONFIG" ]; then
    # Use jq or python to merge, or just overwrite the auth0 section
    # For simplicity, we'll read the file and update just the auth0 section
    python3 << EOF
import json
import os

config_path = "$CLAUDE_CONFIG"
local_build = "$LOCAL_BUILD"

# Read existing config or create new one
if os.path.exists(config_path):
    with open(config_path, 'r') as f:
        config = json.load(f)
else:
    config = {}

# Update auth0 server config
if 'mcpServers' not in config:
    config['mcpServers'] = {}

config['mcpServers']['auth0'] = {
    "command": "node",
    "args": [
        local_build,
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

# Write updated config
with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)

print("   ✓ Configuration updated")
EOF
else
    # Create new config
    cat > "$CLAUDE_CONFIG" << EOF
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
    echo "   ✓ Configuration created"
fi

echo ""

# Verify the config
echo "4. Verifying configuration..."
if grep -q "$LOCAL_BUILD" "$CLAUDE_CONFIG"; then
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
echo "2. DO NOT run 'node dist/index.js init --client claude' - it will overwrite this config"
echo "3. Completely quit Claude Desktop (Cmd+Q)"
echo "4. Restart Claude Desktop"
echo "5. Wait 10-15 seconds for MCP servers to initialize"
echo ""
echo "To verify after restart:"
echo "  ps aux | grep 'dist/index.js.*run' | grep -v grep"
echo ""
