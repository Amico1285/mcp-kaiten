import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  addOptionalParams,
  optionalPositiveId,
  positiveId,
  type Obj,
} from "../utils/schemas.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

export function simplifyTag(
  tag: Obj,
  v: Verbosity = "min",
): Obj {
  if (v === "raw") return tag;
  const out: Obj = {
    id: tag.id,
    name: tag.name,
  };
  if (v !== "min") {
    out.color = tag.color ?? null;
  }
  return out;
}

export function registerTagTools(
  server: McpServer,
): void {
  // Card-scoped tag operations. For the workspace-wide tag pool,
  // see kaiten_list_workspace_tags below.
  server.registerTool(
    "kaiten_list_card_tags",
    {
      title: "List Card Tags",
      description:
        "List tags currently attached to a card. Endpoint: "
        + "GET /cards/{card_id}/tags. cardId from "
        + "kaiten_search_cards or kaiten_get_card. To create a "
        + "new tag, just call kaiten_add_tag with a name; "
        + "Kaiten auto-creates missing tags on demand. For the "
        + "workspace-wide tag pool (across all cards), use "
        + "kaiten_list_workspace_tags.",
      inputSchema: {
        cardId: positiveId("Card ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ cardId }) => {
      const tags = await get<Obj[]>(
        `/cards/${cardId}/tags`,
      );
      return jsonResult(tags.map((t) => simplifyTag(t)));
    }),
  );

  server.registerTool(
    "kaiten_add_tag",
    {
      title: "Add Card Tag",
      description:
        "Attach a tag to a card by name. cardId from "
        + "kaiten_search_cards or kaiten_get_card. If a tag "
        + "with this name does not yet exist in the workspace, "
        + "Kaiten will auto-create it (and it will then also "
        + "appear in kaiten_list_workspace_tags). Returns the "
        + "tag object (including its ID, which you need for "
        + "kaiten_remove_tag). Idempotent — re-adding the same "
        + "tag name returns the same tagId (no duplicate).",
      inputSchema: {
        cardId: positiveId("Card ID"),
        name: z.string().min(1)
          .describe("Tag name (auto-created if missing)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ cardId, name }) => {
      const tag = await post<Obj>(
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
        "Remove a tag from a card. WARNING: Kaiten returns "
        + "success even when tagId does not belong to the card "
        + "(or doesn't exist at all). Verify the tag is "
        + "actually attached via kaiten_list_card_tags before "
        + "relying on the success message. tagId from "
        + "kaiten_list_card_tags or kaiten_add_tag.",
      inputSchema: {
        cardId: positiveId("Card ID"),
        tagId: positiveId("Tag ID"),
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

  server.registerTool(
    "kaiten_list_workspace_tags",
    {
      title: "List Workspace Tags",
      description:
        "List ALL tags in the workspace (across all cards). "
        + "For tags on a specific card, use "
        + "kaiten_list_card_tags. tagId for kaiten_remove_tag. "
        + "Tags auto-create when added to a card via "
        + "kaiten_add_tag.",
      inputSchema: {
        query: z.string().optional().describe(
          "Filter by name substring (server-side)",
        ),
        spaceId: optionalPositiveId(
          "Restrict to tags used in a specific space",
        ),
        limit: z.coerce.number().int().min(1).max(100)
          .optional().describe("Max results"),
        offset: z.coerce.number().int().min(0)
          .optional().describe("Pagination offset"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      query, spaceId, limit, offset, verbosity,
    }) => {
      const v = asV(verbosity);
      const q: Record<string, string> = {};
      addOptionalParams(q, [
        ["query", query],
        ["space_id", spaceId],
        ["limit", limit],
        ["offset", offset],
      ]);
      const tags = await get<Obj[]>("/tags", q);
      return jsonResult(tags.map((t) => simplifyTag(t, v)));
    }),
  );
}
