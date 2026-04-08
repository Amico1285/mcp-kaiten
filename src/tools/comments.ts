import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import { usersCache } from "../utils/cache.js";
import {
  simplifyComment, simplifyList,
  enrichAuthor,
  verbositySchema,
  asV,
} from "../utils/simplify.js";

// Comment POST/PATCH endpoints return only `author_id` (per
// docs/api/card-comments/{add,update}-comment.md). When the
// caller is the comment author — the common case for
// create/update — we substitute the cached current-user name
// so verbosity≥normal doesn't show author_name:null.
function fetchCurrentUser(): Promise<Obj> {
  return usersCache.getOrFetch(
    "current", () => get<Obj>("/users/current"),
  );
}

export function registerCommentTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_get_card_comments",
    {
      title: "List Card Comments",
      description:
        "Comments. commentId for kaiten_update_comment/"
        + "kaiten_delete_comment; cardId from "
        + "kaiten_search_cards/kaiten_get_card.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ cardId, verbosity }) => {
      const v = asV(verbosity);
      const comments = await get(
        `/cards/${cardId}/comments`,
      );
      return jsonResult(
        simplifyList(comments, simplifyComment, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_create_comment",
    {
      title: "Create Comment",
      description:
        "Add HTML comment. cardId from kaiten_search_cards "
        + "or kaiten_get_card; list: kaiten_get_card_comments.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        text: z.string().describe("HTML comment"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      cardId, text, verbosity,
    }) => {
      const v = asV(verbosity);
      const [currentUser, comment] = await Promise.all([
        fetchCurrentUser(),
        post<Obj>(
          `/cards/${cardId}/comments`, { text },
        ),
      ]);
      return jsonResult(
        simplifyComment(
          enrichAuthor(comment, currentUser), v,
        ),
      );
    }),
  );

  server.registerTool(
    "kaiten_update_comment",
    {
      title: "Update Comment",
      description:
        "Replace comment HTML. commentId from "
        + "kaiten_get_card_comments; cardId must match.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        commentId: z.coerce.number().int().describe(
          "Comment ID",
        ),
        text: z.string().describe("New HTML"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      cardId, commentId, text, verbosity,
    }) => {
      const v = asV(verbosity);
      const [currentUser, comment] = await Promise.all([
        fetchCurrentUser(),
        patch<Obj>(
          `/cards/${cardId}/comments/${commentId}`,
          { text },
        ),
      ]);
      return jsonResult(
        simplifyComment(
          enrichAuthor(comment, currentUser), v,
        ),
      );
    }),
  );

  server.registerTool(
    "kaiten_delete_comment",
    {
      title: "Delete Comment",
      description:
        "Delete comment. commentId and cardId from "
        + "kaiten_get_card_comments.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        commentId: z.coerce.number().int().describe(
          "Comment ID",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, commentId }) => {
      await del(
        `/cards/${cardId}/comments/${commentId}`,
      );
      return textResult(
        `Comment ${commentId} deleted`,
      );
    }),
  );
}
