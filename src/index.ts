#!/usr/bin/env node

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCardTools } from "./tools/cards.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerTimelogTools } from "./tools/timelogs.js";
import { registerSpaceTools } from "./tools/spaces.js";
import { registerUserTools } from "./tools/users.js";

const server = new McpServer(
  {
    name: "mcp-kaiten",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
    },
  },
);

registerCardTools(server);
registerCommentTools(server);
registerTimelogTools(server);
registerSpaceTools(server);
registerUserTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : String(error);
  console.error("Server startup error:", message);
  process.exit(1);
});
