#!/bin/bash

echo "=========================================="
echo "Auth0 MCP Server - Tool Verification"
echo "=========================================="
echo ""

# Check if local build has all tools
echo "1. Checking local build..."
cd "$(dirname "$0")"
LOCAL_TOOLS=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.length);" 2>/dev/null)
BACKUP_EXISTS=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.find(t => t.name === 'auth0_backup_tenant') ? 'YES' : 'NO');" 2>/dev/null)
CONNECTION_COUNT=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.filter(t => t.name.includes('connection')).length);" 2>/dev/null)

echo "   Total tools in local build: $LOCAL_TOOLS"
echo "   Backup tool: $BACKUP_EXISTS"
echo "   Connection tools: $CONNECTION_COUNT"
echo ""

# Check MCP configuration
echo "2. Checking MCP configuration..."
MCP_CONFIG="$HOME/.cursor/mcp.json"
if [ -f "$MCP_CONFIG" ]; then
    echo "   Config file exists: ✓"
    if grep -q "dist/index.js" "$MCP_CONFIG"; then
        echo "   Using local build: ✓"
    else
        echo "   Using npm package: ✗ (needs update)"
    fi
else
    echo "   Config file missing: ✗"
fi
echo ""

# Check running processes
echo "3. Checking running MCP server processes..."
RUNNING_NPM=$(ps aux | grep -E "@auth0/auth0-mcp-server" | grep -v grep | wc -l | tr -d ' ')
RUNNING_LOCAL=$(ps aux | grep -E "dist/index.js.*run" | grep -v grep | wc -l | tr -d ' ')

echo "   NPM package processes: $RUNNING_NPM"
echo "   Local build processes: $RUNNING_LOCAL"
echo ""

# Summary
echo "=========================================="
echo "Summary:"
echo "=========================================="
if [ "$BACKUP_EXISTS" = "YES" ] && [ "$CONNECTION_COUNT" = "6" ]; then
    echo "✓ Local build has all required tools"
else
    echo "✗ Local build is missing tools - rebuild needed"
fi

if grep -q "dist/index.js" "$MCP_CONFIG" 2>/dev/null; then
    echo "✓ Configuration points to local build"
    echo ""
    echo "⚠️  ACTION REQUIRED:"
    echo "   1. Completely quit Cursor (Cmd+Q)"
    echo "   2. Restart Cursor"
    echo "   3. The tools should appear after restart"
else
    echo "✗ Configuration still uses npm package"
    echo ""
    echo "⚠️  Run: node dist/index.js init --client cursor --tools '*'"
fi
echo ""
