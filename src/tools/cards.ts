import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, optionalInt, paginationSchema,
  conditionSchema, buildOptionalBody,
  boolish, boolishWithDefault, removedField,
} from "../utils/schemas.js";
import {
  simplifyCard, simplifyList,
  verbositySchema,
  asV,
} from "../utils/simplify.js";
import { buildSearchQuery } from "../utils/queryBuilder.js";

export function registerCardTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_get_card",
    {
      title: "Get Card",
      description:
        "Get card by ID. verbosity=max; includeChildren for "
        + "child cards. ID from kaiten_search_cards or "
        + "kaiten_get_board_cards.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        includeChildren: boolishWithDefault(false)
          .describe("Also fetch child cards"),
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
      cardId, includeChildren, verbosity,
    }) => {
      const v = asV(verbosity);

      if (includeChildren) {
        const [card, children] = await Promise.all([
          get<Obj>(`/cards/${cardId}`),
          get(`/cards/${cardId}/children`)
            .catch(() => []),
        ]);
        card.children = simplifyList(
          children, simplifyCard, v,
        );
        return jsonResult(simplifyCard(card, v));
      }

      const card = await get<Obj>(
        `/cards/${cardId}`,
      );
      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.registerTool(
    "kaiten_search_cards",
    {
      title: "Search Cards",
      description:
        "Search cards with filters and pagination. Pass boardId "
        + "or spaceId to limit scope. Use kaiten_get_card for "
        + "details.",
      inputSchema: {
      query: z.string().optional().describe(
        "Search query",
      ),
      boardId: optionalInt("Filter by board ID"),
      spaceId: optionalInt(
        "Filter by space ID "
        + "(uses KAITEN_DEFAULT_SPACE_ID if omitted)",
      ),
      columnId: optionalInt("Filter by column ID"),
      laneId: optionalInt("Filter by lane ID"),
      ownerId: optionalInt("Filter by owner ID"),
      typeId: optionalInt(
        "Filter by card type ID",
      ),
      state: optionalInt(
        "Card state: draft|queued|in_progress|done",
      ),
      condition: conditionSchema,
      asap: boolish.optional().describe(
        "Filter urgent cards",
      ),
      archived: boolish.optional().describe(
        "Filter archived cards",
      ),
      overdue: boolish.optional().describe(
        "Filter overdue cards",
      ),
      withDueDate: boolish.optional().describe(
        "Filter cards with due date",
      ),
      createdBefore: z.string().optional().describe(
        "Created before (ISO 8601)",
      ),
      createdAfter: z.string().optional().describe(
        "Created after (ISO 8601)",
      ),
      updatedBefore: z.string().optional().describe(
        "Updated before (ISO 8601)",
      ),
      updatedAfter: z.string().optional().describe(
        "Updated after (ISO 8601)",
      ),
      dueDateBefore: z.string().optional().describe(
        "Due date before (ISO 8601)",
      ),
      dueDateAfter: z.string().optional().describe(
        "Due date after (ISO 8601)",
      ),
      ownerIds: z.string().optional().describe(
        "Comma-separated owner IDs",
      ),
      memberIds: z.string().optional().describe(
        "Comma-separated member IDs",
      ),
      tagIds: z.string().optional().describe(
        "Comma-separated tag IDs",
      ),
      typeIds: z.string().optional().describe(
        "Comma-separated card type IDs",
      ),
      doneOnTime: boolish.optional().describe(
        "Filter by done on time",
      ),
      excludeArchived: boolish.optional()
        .describe("Exclude archived cards"),
      excludeCompleted: boolish.optional()
        .describe("Exclude completed cards"),
      sortBy: z.enum(
        ["created", "updated", "title"],
      )
        .default("created")
        .describe("Sort field"),
      sortDirection: z.enum(["asc", "desc"])
        .default("desc")
        .describe("Sort direction"),
      ...paginationSchema,
      verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async (p) => {
      const v = asV(p.verbosity);
      const q = buildSearchQuery(p);

      const cards = await get("/cards", q);
      return jsonResult(
        simplifyList(cards, simplifyCard, v),
      );
    }),
  );

  const fetchCardsByScope = (
    scopeKey: string,
    scopeId: number,
    condition: number,
    limit: number,
    offset: number,
    verbosity: string,
  ) => {
    const v = asV(verbosity);
    return get("/cards", {
      [scopeKey]: String(scopeId),
      limit: String(limit),
      skip: String(offset),
      condition: String(condition),
      order_by: "created",
      order_direction: "desc",
    }).then((cards) =>
      jsonResult(simplifyList(cards, simplifyCard, v)),
    );
  };

  server.registerTool(
    "kaiten_get_space_cards",
    {
      title: "List Space Cards",
      description:
        "Recent cards in a space (newest first, no filters). "
        + "For filtered search use kaiten_search_cards.",
      inputSchema: {
        spaceId: z.coerce.number().int().describe("Space ID"),
        condition: conditionSchema,
        ...paginationSchema,
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
      spaceId, condition, limit, offset, verbosity,
    }) => fetchCardsByScope(
      "space_id", spaceId,
      condition, limit, offset, verbosity,
    )),
  );

  server.registerTool(
    "kaiten_get_board_cards",
    {
      title: "List Board Cards",
      description:
        "Recent cards on a board (newest first, no filters). "
        + "For filtered search use kaiten_search_cards.",
      inputSchema: {
        boardId: z.coerce.number().int().describe("Board ID"),
        condition: conditionSchema,
        ...paginationSchema,
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
      boardId, condition, limit, offset, verbosity,
    }) => fetchCardsByScope(
      "board_id", boardId,
      condition, limit, offset, verbosity,
    )),
  );

  server.registerTool(
    "kaiten_create_card",
    {
      title: "Create Card",
      description:
        "Create card. Requires boardId + columnId from "
        + "kaiten_list_columns. Optional: laneId, typeId, "
        + "sizeText. ownerId must be a positive integer "
        + "(Kaiten requires every card to have an owner).",
      inputSchema: {
      boardId: z.coerce.number().int().describe("Board ID"),
      columnId: z.coerce.number().int().describe(
        "Column ID",
      ),
      title: z.string().min(1).max(500).describe(
        "Card title",
      ),
      laneId: optionalInt("Lane ID"),
      description: z.string().optional().describe(
        "Card description (HTML)",
      ),
      typeId: optionalInt("Card type ID"),
      sortOrder: optionalInt(
        "Sort order in column",
      ),
      sizeText: z.union([z.string(), z.coerce.number()])
        .optional()
        .describe(
          "Card size as text. Examples: '1', '5 SP', "
          + "'L', '3 M', 'XL'. Sent as `size_text` to API. "
          + "The numeric `size` field on a card is read-only "
          + "and computed from this text.",
        ),
      asap: boolish.optional().describe(
        "Mark as urgent",
      ),
      ownerId: z.coerce.number().int().positive().optional()
        .describe(
          "Owner user ID (must be a positive integer). "
          + "Defaults to API caller if omitted.",
        ),
      dueDate: z.string().optional().describe(
        "Due date (ISO 8601)",
      ),
      verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async (p) => {
      const v = asV(p.verbosity);
      const body = {
        board_id: p.boardId,
        column_id: p.columnId,
        title: p.title,
        ...buildOptionalBody([
          ["lane_id", p.laneId],
          ["description", p.description],
          ["type_id", p.typeId],
          ["sort_order", p.sortOrder],
          ["size_text", p.sizeText],
          ["asap", p.asap],
          ["owner_id", p.ownerId],
          ["due_date", p.dueDate],
        ]),
      };

      const card = await post<Obj>(
        "/cards", body,
      );
      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.registerTool(
    "kaiten_update_card",
    {
      title: "Update Card",
      description:
        "Update card fields. For moves use "
        + "kaiten_list_columns, kaiten_list_lanes, "
        + "kaiten_list_boards IDs. To change state — move "
        + "the card via columnId (Kaiten state is computed "
        + "from column.type, not settable directly). "
        + "To change size — use sizeText (the numeric size "
        + "field on a card is read-only).",
      inputSchema: {
      cardId: z.coerce.number().int().describe("Card ID"),
      title: z.string().optional().describe(
        "New title",
      ),
      description: z.string().optional().describe(
        "New description (HTML)",
      ),
      columnId: optionalInt("Move to column ID"),
      laneId: optionalInt("Move to lane ID"),
      boardId: optionalInt("Move to board ID"),
      typeId: optionalInt("Change card type ID"),
      sizeText: z.union([z.string(), z.coerce.number()])
        .optional()
        .describe(
          "Card size as text. Examples: '1', '5 SP', "
          + "'L', '3 M', 'XL'. Sent as `size_text` to API. "
          + "The numeric `size` field on a card is read-only "
          + "and computed from this text.",
        ),
      // Legacy fields kept in the schema only so a friendly
      // error fires when a caller still passes them. Handler
      // never reads them.
      size: removedField(
        "'size' is read-only in Kaiten — pass `sizeText` "
        + "(e.g. '5 SP') and the numeric `size` will be "
        + "computed from it.",
      ),
      state: removedField(
        "'state' is computed from column.type, not settable "
        + "directly. To change it, move the card via "
        + "`columnId` (column type 1=queued, 2=in_progress, "
        + "3=done).",
      ),
      asap: boolish.optional().describe(
        "Mark as urgent",
      ),
      ownerId: z.coerce.number().int().positive().optional()
        .describe(
          "Reassign owner to user ID (must be a positive "
          + "integer). Kaiten requires every card to have "
          + "an owner — cannot be unset, only reassigned.",
        ),
      dueDate: z.string().optional().describe(
        "Due date (ISO 8601)",
      ),
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
      cardId, verbosity, ...fields
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["title", fields.title],
        ["description", fields.description],
        ["column_id", fields.columnId],
        ["lane_id", fields.laneId],
        ["board_id", fields.boardId],
        ["type_id", fields.typeId],
        ["size_text", fields.sizeText],
        ["asap", fields.asap],
        ["owner_id", fields.ownerId],
        ["due_date", fields.dueDate],
      ]);

      // Empty PATCH on /cards/{id} returns 403 from Kaiten —
      // not actionable for the caller. Block it early with a
      // hint that lists which fields actually do something.
      if (Object.keys(body).length === 0) {
        throw new Error(
          "kaiten_update_card requires at least one field "
          + "to update. Available fields: title, description, "
          + "columnId, laneId, boardId, typeId, sizeText, "
          + "asap, ownerId, dueDate. Note: 'size' is "
          + "read-only (use sizeText), and 'state' is "
          + "computed from column.type (move via columnId).",
        );
      }

      const card = await patch<Obj>(
        `/cards/${cardId}`, body,
      );
      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.registerTool(
    "kaiten_delete_card",
    {
      title: "Delete Card",
      description:
        "Permanently delete a card (cannot be undone). "
        + "Resolve cardId via kaiten_search_cards or "
        + "kaiten_get_card.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId }) => {
      await del(`/cards/${cardId}`);
      return textResult(
        `Card ${cardId} deleted`,
      );
    }),
  );
}
