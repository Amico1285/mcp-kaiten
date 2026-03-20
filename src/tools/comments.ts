import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import {
  simplifyComment, simplifyList,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

export function registerCommentTools(
  server: McpServer,
): void {
  server.tool(
    "kaiten_get_card_comments",
    "Get all comments for a card, ordered by "
    + "date. Returns author, text, timestamps.",
    {
      cardId: z.number().int().describe("Card ID"),
      verbosity: verbositySchema,
    },
    handleTool(async ({ cardId, verbosity }) => {
      const v = verbosity as Verbosity;
      const comments = await get(
        `/cards/${cardId}/comments`,
      );
      return jsonResult(
        simplifyList(comments, simplifyComment, v),
      );
    }),
  );

  server.tool(
    "kaiten_create_comment",
    "Add a comment to a card. Text supports HTML "
    + "formatting (<b>, <i>, <a>, <ul>, <ol>).",
    {
      cardId: z.number().int().describe("Card ID"),
      text: z.string().describe(
        "Comment text (HTML)",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({
      cardId, text, verbosity,
    }) => {
      const v = verbosity as Verbosity;
      const comment = await post<Obj>(
        `/cards/${cardId}/comments`, { text },
      );
      return jsonResult(
        simplifyComment(comment, v),
      );
    }),
  );

  server.tool(
    "kaiten_update_comment",
    "Replace comment text. Requires both cardId "
    + "and commentId. Text supports HTML.",
    {
      cardId: z.number().int().describe("Card ID"),
      commentId: z.number().int().describe(
        "Comment ID",
      ),
      text: z.string().describe("New text (HTML)"),
      verbosity: verbositySchema,
    },
    handleTool(async ({
      cardId, commentId, text, verbosity,
    }) => {
      const v = verbosity as Verbosity;
      const comment = await patch<Obj>(
        `/cards/${cardId}/comments/${commentId}`,
        { text },
      );
      return jsonResult(
        simplifyComment(comment, v),
      );
    }),
  );

  server.tool(
    "kaiten_delete_comment",
    "Permanently delete a comment from a card.",
    {
      cardId: z.number().int().describe("Card ID"),
      commentId: z.number().int().describe(
        "Comment ID",
      ),
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
