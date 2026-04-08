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
import { registerSubtaskTools } from "./tools/subtasks.js";
import { registerTagTools } from "./tools/tags.js";
import { registerChecklistTools } from "./tools/checklists.js";
import { registerFileTools } from "./tools/files.js";
import { registerCustomFieldTools } from "./tools/customFields.js";
import { registerMemberTools } from "./tools/members.js";
import { registerBlockerTools } from "./tools/blockers.js";
import { registerResources, registerPrompts } from "./resources.js";

const server = new McpServer(
  {
    name: "mcp-kaiten",
    version: "1.0.2",
  },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
      prompts: { listChanged: true },
      logging: {},
    },
  },
);

registerCardTools(server);
registerCommentTools(server);
registerTimelogTools(server);
registerSpaceTools(server);
registerUserTools(server);
registerSubtaskTools(server);
registerTagTools(server);
registerChecklistTools(server);
registerFileTools(server);
registerCustomFieldTools(server);
registerMemberTools(server);
registerBlockerTools(server);
registerResources(server);
registerPrompts(server);

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
