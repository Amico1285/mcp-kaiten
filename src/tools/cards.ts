import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import { getDefaultSpaceId } from "../config.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, optionalInt, paginationSchema,
  conditionSchema, buildOptionalBody,
  addOptionalParams,
} from "../utils/schemas.js";
import {
  simplifyCard, simplifyList,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

export function registerCardTools(
  server: McpServer,
): void {
  server.tool(
    "kaiten_get_card",
    "Get full card details by ID. Returns title, "
    + "description, owner, column, board, tags, "
    + "dates. Set includeChildren=true to also "
    + "fetch child cards.",
    {
      cardId: z.number().int().describe("Card ID"),
      includeChildren: z.boolean().default(false)
        .describe("Also fetch child cards"),
      verbosity: verbositySchema,
    },
    handleTool(async ({
      cardId, includeChildren, verbosity,
    }) => {
      const v = verbosity as Verbosity;
      const card = await get<Obj>(
        `/cards/${cardId}`,
      );

      if (includeChildren) {
        try {
          const children = await get(
            `/cards/${cardId}/children`,
          );
          card.children = simplifyList(
            children, simplifyCard, v,
          );
        } catch {
          card.children = [];
        }
      }

      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.tool(
    "kaiten_search_cards",
    "Search cards with filters, dates, and "
    + "pagination. Always specify boardId or "
    + "spaceId to avoid large responses. Use root "
    + "word forms for query (e.g. 'авториз' "
    + "instead of 'авторизация'). Case-insensitive "
    + "partial match on title.",
    {
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
      state: optionalInt("Card state filter"),
      condition: z.number().int().min(1).max(3)
        .default(1)
        .describe("1=active, 2=archived, 3=all"),
      asap: z.boolean().optional().describe(
        "Filter urgent cards",
      ),
      archived: z.boolean().optional().describe(
        "Filter archived cards",
      ),
      overdue: z.boolean().optional().describe(
        "Filter overdue cards",
      ),
      withDueDate: z.boolean().optional().describe(
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
    handleTool(async (p) => {
      const v = p.verbosity as Verbosity;
      const q: Record<string, string> = {
        limit: String(p.limit),
        skip: String(p.offset),
        condition: String(p.condition),
        order_by: p.sortBy,
        order_direction: p.sortDirection,
        search_fields: "title",
      };

      addOptionalParams(q, [
        ["query", p.query],
        ["board_id", p.boardId],
        [
          "space_id",
          p.spaceId ?? getDefaultSpaceId(),
        ],
        ["column_id", p.columnId],
        ["lane_id", p.laneId],
        ["owner_id", p.ownerId],
        ["type_id", p.typeId],
        ["state", p.state],
        ["asap", p.asap],
        ["archived", p.archived],
        ["overdue", p.overdue],
        ["with_due_date", p.withDueDate],
        ["created_before", p.createdBefore],
        ["created_after", p.createdAfter],
        ["updated_before", p.updatedBefore],
        ["updated_after", p.updatedAfter],
        ["due_date_before", p.dueDateBefore],
        ["due_date_after", p.dueDateAfter],
        ["owner_ids", p.ownerIds],
        ["member_ids", p.memberIds],
        ["tag_ids", p.tagIds],
      ]);

      const cards = await get("/cards", q);
      return jsonResult(
        simplifyList(cards, simplifyCard, v),
      );
    }),
  );

  server.tool(
    "kaiten_get_space_cards",
    "List cards in a space, sorted by creation "
    + "date (newest first). Use "
    + "kaiten_list_spaces first to find the "
    + "space ID.",
    {
      spaceId: z.number().int().describe("Space ID"),
      condition: conditionSchema,
      ...paginationSchema,
      verbosity: verbositySchema,
    },
    handleTool(async ({
      spaceId, condition, limit, offset, verbosity,
    }) => {
      const v = verbosity as Verbosity;
      const cards = await get(
        "/cards",
        {
          space_id: String(spaceId),
          limit: String(limit),
          skip: String(offset),
          condition: String(condition),
          sort_by: "created",
          sort_direction: "desc",
        },
      );
      return jsonResult(
        simplifyList(cards, simplifyCard, v),
      );
    }),
  );

  server.tool(
    "kaiten_get_board_cards",
    "List cards on a board, sorted by creation "
    + "date (newest first). Use "
    + "kaiten_list_boards first to find the "
    + "board ID.",
    {
      boardId: z.number().int().describe("Board ID"),
      condition: conditionSchema,
      ...paginationSchema,
      verbosity: verbositySchema,
    },
    handleTool(async ({
      boardId, condition, limit, offset, verbosity,
    }) => {
      const v = verbosity as Verbosity;
      const cards = await get(
        "/cards",
        {
          board_id: String(boardId),
          limit: String(limit),
          skip: String(offset),
          condition: String(condition),
          sort_by: "created",
          sort_direction: "desc",
        },
      );
      return jsonResult(
        simplifyList(cards, simplifyCard, v),
      );
    }),
  );

  server.tool(
    "kaiten_create_card",
    "Create a new card on a board. Requires "
    + "boardId and columnId (use "
    + "kaiten_list_columns to find). Returns the "
    + "created card.",
    {
      boardId: z.number().int().describe("Board ID"),
      columnId: z.number().int().describe(
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
      size: z.number().min(0).optional().describe(
        "Story points / size",
      ),
      asap: z.boolean().optional().describe(
        "Mark as urgent",
      ),
      ownerId: optionalInt("Owner user ID"),
      dueDate: z.string().optional().describe(
        "Due date (ISO 8601)",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async (p) => {
      const v = p.verbosity as Verbosity;
      const body = {
        board_id: p.boardId,
        column_id: p.columnId,
        title: p.title,
        ...buildOptionalBody([
          ["lane_id", p.laneId],
          ["description", p.description],
          ["type_id", p.typeId],
          ["sort_order", p.sortOrder],
          ["size", p.size],
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

  server.tool(
    "kaiten_update_card",
    "Update card fields: title, description, "
    + "column, lane, board, type, state, size, "
    + "owner, due date, urgency. Only provided "
    + "fields are changed.",
    {
      cardId: z.number().int().describe("Card ID"),
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
      state: optionalInt("Change state"),
      size: z.number().min(0).optional().describe(
        "Story points / size",
      ),
      asap: z.boolean().optional().describe(
        "Mark as urgent",
      ),
      ownerId: optionalInt("Change owner user ID"),
      dueDate: z.string().optional().describe(
        "Due date (ISO 8601)",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({
      cardId, verbosity, ...fields
    }) => {
      const v = verbosity as Verbosity;
      const body = buildOptionalBody([
        ["title", fields.title],
        ["description", fields.description],
        ["column_id", fields.columnId],
        ["lane_id", fields.laneId],
        ["board_id", fields.boardId],
        ["type_id", fields.typeId],
        ["state", fields.state],
        ["size", fields.size],
        ["asap", fields.asap],
        ["owner_id", fields.ownerId],
        ["due_date", fields.dueDate],
      ]);

      const card = await patch<Obj>(
        `/cards/${cardId}`, body,
      );
      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.tool(
    "kaiten_delete_card",
    "Permanently delete a card. This action "
    + "cannot be undone.",
    {
      cardId: z.number().int().describe("Card ID"),
    },
    handleTool(async ({ cardId }) => {
      await del(`/cards/${cardId}`);
      return textResult(
        `Card ${cardId} deleted`,
      );
    }),
  );
}
