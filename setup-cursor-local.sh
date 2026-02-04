#!/bin/bash

echo "=========================================="
echo "Setting up Cursor with Local Auth0 MCP Server"
echo "=========================================="
echo ""

# Get absolute path to local build
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_BUILD="$SCRIPT_DIR/dist/index.js"

echo "1. Verifying local build..."
if [ ! -f "$LOCAL_BUILD" ]; then
    echo "   ✗ Local build not found - building..."
    cd "$SCRIPT_DIR"
    npm run build
    if [ ! -f "$LOCAL_BUILD" ]; then
        echo "   ✗ Build failed!"
        exit 1
    fi
fi

echo "   ✓ Local build found: $LOCAL_BUILD"
echo ""

# Verify local build has all tools
echo "2. Verifying tools in local build..."
cd "$SCRIPT_DIR"
BACKUP_EXISTS=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.find(t => t.name === 'auth0_backup_tenant') ? 'YES' : 'NO');" 2>/dev/null)
CONNECTION_COUNT=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.filter(t => t.name.includes('connection')).length);" 2>/dev/null)
TOTAL_TOOLS=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.length);" 2>/dev/null)

echo "   Total tools: $TOTAL_TOOLS"
echo "   Backup tool: $BACKUP_EXISTS"
echo "   Connection tools: $CONNECTION_COUNT"
echo ""

# Check Auth0 session
echo "3. Checking Auth0 authentication..."
cd "$SCRIPT_DIR"
SESSION_OUTPUT=$(node dist/index.js session 2>&1)
if echo "$SESSION_OUTPUT" | grep -q "Active authentication session"; then
    TENANT=$(echo "$SESSION_OUTPUT" | grep "Domain:" | awk '{print $2}')
    echo "   ✓ Authenticated with: $TENANT"
else
    echo "   ⚠️  No active session - you'll need to authenticate"
    echo "   Run: node dist/index.js init --client cursor --tools '*' --no-interaction"
fi
echo ""

# Update Cursor config
CURSOR_CONFIG="$HOME/.cursor/mcp.json"
echo "4. Updating Cursor configuration..."

# Create config directory if it doesn't exist
mkdir -p "$(dirname "$CURSOR_CONFIG")"

# Write the configuration
cat > "$CURSOR_CONFIG" << EOF
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
echo "5. Verifying configuration..."
if grep -q "$LOCAL_BUILD" "$CURSOR_CONFIG"; then
    echo "   ✓ Config points to local build"
else
    echo "   ✗ Config verification failed"
    exit 1
fi
echo ""

echo "=========================================="
echo "✓ Cursor Setup Complete"
echo "=========================================="
echo ""
echo "Configuration file: $CURSOR_CONFIG"
echo ""
echo "NEXT STEPS:"
echo "1. Completely quit Cursor (Cmd+Q)"
echo "2. Restart Cursor"
echo "3. Wait 10-15 seconds for MCP servers to initialize"
echo "4. Verify tools are available in Cursor"
echo ""
echo "To verify after restart:"
echo "  ps aux | grep 'dist/index.js.*run' | grep -v grep"
echo ""
echo "If you need to authenticate:"
echo "  cd $SCRIPT_DIR"
echo "  node dist/index.js init --client cursor --tools '*' --scopes 'read:*,create:*,update:*,delete:connections' --no-interaction"
echo "  ./setup-cursor-local.sh  # Run this again to fix config"
echo ""
