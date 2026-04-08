import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";

interface Tag {
  readonly id: number;
  readonly name: string;
}

export function simplifyTag(
  tag: Record<string, unknown>,
): Tag {
  return {
    id: tag.id as number,
    name: tag.name as string,
  };
}

export function registerTagTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_card_tags",
    {
      title: "List Card Tags",
      description:
        "List tags currently attached to a card. Endpoint: "
        + "GET /cards/{card_id}/tags. NOTE: Kaiten REST API "
        + "does not expose a workspace-wide tag list — tags "
        + "live on cards. To create a new tag, just call "
        + "kaiten_add_tag with a name; Kaiten auto-creates "
        + "missing tags on demand.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ cardId }) => {
      const tags = await get<Record<string, unknown>[]>(
        `/cards/${cardId}/tags`,
      );
      return jsonResult(tags.map(simplifyTag));
    }),
  );

  server.registerTool(
    "kaiten_add_tag",
    {
      title: "Add Card Tag",
      description:
        "Attach a tag to a card by name. If a tag with "
        + "this name does not yet exist in the workspace, "
        + "Kaiten will auto-create it. Returns the tag "
        + "object (including its ID, which you need for "
        + "kaiten_remove_tag).",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        name: z.string().min(1)
          .describe("Tag name (auto-created if missing)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, name }) => {
      const tag = await post<Record<string, unknown>>(
        `/cards/${cardId}/tags`,
        { name },
      );
      return jsonResult(simplifyTag(tag));
    }),
  );

  server.registerTool(
    "kaiten_remove_tag",
    {
      title: "Remove Card Tag",
      description:
        "Detach a tag from a card. tagId is the numeric "
        + "ID of the tag on the card — obtain it from "
        + "kaiten_get_card (verbosity=max) or from the "
        + "response of kaiten_add_tag.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        tagId: z.coerce.number().int().describe("Tag ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, tagId }) => {
      await del(
        `/cards/${cardId}/tags/${tagId}`,
      );
      return textResult(
        `Tag ${tagId} removed from card ${cardId}`,
      );
    }),
  );
}
