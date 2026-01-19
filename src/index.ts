#!/usr/bin/env node

import { startServer } from './server.js';

// Start the MCP server
startServer().catch((error) => {
  console.error('[camoufox-mcp] Fatal error:', error);
  process.exit(1);
});
