#!/bin/bash

echo "=========================================="
echo "Forcing Cursor to use Local Build"
echo "=========================================="
echo ""

# Kill all npm package processes
echo "1. Killing npm package processes..."
pkill -f "@auth0/auth0-mcp-server" 2>/dev/null
sleep 1
echo "   ✓ Done"
echo ""

# Verify configuration
echo "2. Verifying configuration..."
MCP_CONFIG="$HOME/.cursor/mcp.json"
if [ -f "$MCP_CONFIG" ]; then
    if grep -q "dist/index.js" "$MCP_CONFIG"; then
        echo "   ✓ Configuration points to local build"
    else
        echo "   ✗ Configuration needs update"
        exit 1
    fi
else
    echo "   ✗ Configuration file not found"
    exit 1
fi
echo ""

# Check local build
echo "3. Verifying local build..."
cd "$(dirname "$0")"
if [ ! -f "dist/index.js" ]; then
    echo "   ✗ Local build not found - building..."
    npm run build
fi

BACKUP_EXISTS=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.find(t => t.name === 'auth0_backup_tenant') ? 'YES' : 'NO');" 2>/dev/null)
CONNECTION_COUNT=$(node -e "const {TOOLS} = require('./dist/tools/index.js'); console.log(TOOLS.filter(t => t.name.includes('connection')).length);" 2>/dev/null)

echo "   Backup tool: $BACKUP_EXISTS"
echo "   Connection tools: $CONNECTION_COUNT"
echo ""

if [ "$BACKUP_EXISTS" != "YES" ] || [ "$CONNECTION_COUNT" != "6" ]; then
    echo "   ✗ Local build missing tools - rebuilding..."
    npm run build
fi
echo ""

# Clear Cursor MCP cache (if it exists)
echo "4. Clearing Cursor MCP cache..."
CACHE_DIR="$HOME/.cursor/projects"
if [ -d "$CACHE_DIR" ]; then
    find "$CACHE_DIR" -path "*/mcps/user-auth0/*" -type d 2>/dev/null | while read dir; do
        echo "   Removing cached MCP descriptors: $dir"
        rm -rf "$dir" 2>/dev/null
    done
    echo "   ✓ Cache cleared"
else
    echo "   No cache found (this is OK)"
fi
echo ""

echo "=========================================="
echo "✓ Setup Complete"
echo "=========================================="
echo ""
echo "NEXT STEPS:"
echo "1. Completely quit Cursor (Cmd+Q)"
echo "2. Restart Cursor"
echo "3. Wait 10-15 seconds for MCP servers to initialize"
echo "4. Verify tools are available"
echo ""
echo "To verify after restart, check if local build is running:"
echo "  ps aux | grep 'dist/index.js.*run'"
echo ""
