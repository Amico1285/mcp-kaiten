import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, positiveId, buildOptionalBody,
  requireSomeFields,
} from "../utils/schemas.js";
import {
  assertChildBelongsToParent,
} from "../utils/preflight.js";
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
        "List all comments on a card. Each comment exposes its "
        + "`id` — pass it as `commentId` to "
        + "kaiten_update_comment or kaiten_delete_comment. "
        + "Resolve cardId via kaiten_search_cards or "
        + "kaiten_get_card. Returns: array of comments "
        + "(simplified per verbosity).",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards or "
          + "kaiten_get_card)",
        ),
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
        "Add an HTML comment to a card. Resolve cardId via "
        + "kaiten_search_cards or kaiten_get_card; list "
        + "existing comments via kaiten_get_card_comments. "
        + "Returns: the created comment object (including its "
        + "`id`, needed for kaiten_update_comment / "
        + "kaiten_delete_comment).",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards or "
          + "kaiten_get_card)",
        ),
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
        "Replace the HTML body of an existing comment. "
        + "Resolve commentId via kaiten_get_card_comments. "
        + "The cardId is part of the URL path — both cardId "
        + "and commentId must reference the actual "
        + "card-comment pair (mismatched pair returns 500 "
        + "from Kaiten). Returns: the updated comment object.",
      inputSchema: {
        cardId: positiveId(
          "Card ID the comment belongs to (from "
          + "kaiten_get_card_comments)",
        ),
        commentId: positiveId(
          "Comment ID (from kaiten_get_card_comments)",
        ),
        text: z.string().optional().describe("New HTML body"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      cardId, commentId, text, verbosity,
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["text", text],
      ]);

      requireSomeFields(body, "kaiten_update_comment", ["text"]);

      await assertChildBelongsToParent({
        toolName: "kaiten_update_comment",
        childId: commentId,
        childDescriptor: `comment ${commentId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/comments`,
        ),
      });

      const [currentUser, comment] = await Promise.all([
        fetchCurrentUser(),
        patch<Obj>(
          `/cards/${cardId}/comments/${commentId}`,
          body,
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
        cardId: positiveId(
          "Card ID the comment belongs to (from "
          + "kaiten_get_card_comments)",
        ),
        commentId: positiveId(
          "Comment ID (from kaiten_get_card_comments)",
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
      await assertChildBelongsToParent({
        toolName: "kaiten_delete_comment",
        childId: commentId,
        childDescriptor: `comment ${commentId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/comments`,
        ),
      });
      await del(
        `/cards/${cardId}/comments/${commentId}`,
      );
      return textResult(
        `Comment ${commentId} deleted`,
      );
    }),
  );
}
