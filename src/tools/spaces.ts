import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { jsonResult, handleTool } from "../utils/errors.js";
import { positiveId, type Obj } from "../utils/schemas.js";
import {
  spacesCache, boardsCache,
} from "../utils/cache.js";
import {
  simplifySpace, simplifyBoard,
  simplifyColumn, simplifyLane,
  simplifyUser, simplifyList,
  verbositySchema,
  asV,
} from "../utils/simplify.js";

export function registerSpaceTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_spaces",
    {
      title: "List Spaces",
      description:
        "List spaces visible to current user. Typical "
        + "drill-down: kaiten_get_space for detail, "
        + "kaiten_list_boards(spaceId) for the boards in a "
        + "space, kaiten_list_space_users(spaceId) for "
        + "members. Space IDs also feed kaiten_search_cards, "
        + "kaiten_create_card, and kaiten_list_custom_properties.",
      inputSchema: { verbosity: verbositySchema },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ verbosity }) => {
      const v = asV(verbosity);
      const spaces = await spacesCache.getOrFetch(
        "all", () => get("/spaces"),
      );
      return jsonResult(
        simplifyList(spaces, simplifySpace, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_get_space",
    {
      title: "Get Space",
      description:
        "Fetch one space by ID including settings and "
        + "allowed card types at verbosity=normal/max. "
        + "Typical drill-down: kaiten_list_boards(spaceId) "
        + "for the boards in this space, "
        + "kaiten_list_space_users(spaceId) for members. "
        + "spaceId from kaiten_list_spaces.",
      inputSchema: {
        spaceId: positiveId("Space ID, from kaiten_list_spaces"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ spaceId, verbosity }) => {
      const v = asV(verbosity);
      const space = await spacesCache.getOrFetch(
        `space:${spaceId}`,
        () => get<Obj>(`/spaces/${spaceId}`),
      );
      return jsonResult(simplifySpace(space, v));
    }),
  );

  server.registerTool(
    "kaiten_list_boards",
    {
      title: "List Boards",
      description:
        "List boards in a space. boardId feeds "
        + "kaiten_get_board, kaiten_list_columns, "
        + "kaiten_list_lanes, kaiten_get_board_cards, "
        + "kaiten_search_cards, kaiten_create_card, and "
        + "kaiten_update_card. spaceId from kaiten_list_spaces.",
      inputSchema: {
        spaceId: positiveId("Space ID, from kaiten_list_spaces"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ spaceId, verbosity }) => {
      const v = asV(verbosity);
      const boards = await boardsCache.getOrFetch(
        `space:${spaceId}:boards`,
        () => get(`/spaces/${spaceId}/boards`),
      );
      return jsonResult(
        simplifyList(boards, simplifyBoard, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_get_board",
    {
      title: "Get Board",
      description:
        "Get board metadata. verbosity=max returns inline "
        + "columns and lanes — no need to call "
        + "kaiten_list_columns / kaiten_list_lanes separately "
        + "for a board overview. boardId from kaiten_list_boards.",
      inputSchema: {
        boardId: positiveId("Board ID, from kaiten_list_boards"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ boardId, verbosity }) => {
      const v = asV(verbosity);
      const board = await boardsCache.getOrFetch(
        `board:${boardId}`,
        () => get<Obj>(`/boards/${boardId}`),
      );
      return jsonResult(simplifyBoard(board, v));
    }),
  );

  server.registerTool(
    "kaiten_list_columns",
    {
      title: "List Columns",
      description:
        "Board columns (statuses). Each column has a "
        + "col_type (1=queued, 2=in_progress, 3=done) — THIS "
        + "is the mechanism for moving card state: pass the "
        + "columnId of a column with the desired type to "
        + "kaiten_update_card to change the card's state. "
        + "columnId for kaiten_create_card, kaiten_update_card. "
        + "boardId from kaiten_list_boards.",
      inputSchema: {
        boardId: positiveId("Board ID, from kaiten_list_boards"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ boardId, verbosity }) => {
      const v = asV(verbosity);
      const columns = await boardsCache.getOrFetch(
        `board:${boardId}:columns`,
        () => get(`/boards/${boardId}/columns`),
      );
      // Pass boardId down so verbosity=max surfaces the
      // owning board_id cross-ref on each column (the raw
      // /boards/{id}/columns response doesn't carry it).
      return jsonResult(
        simplifyList(
          columns,
          (c, cv) => simplifyColumn(c, cv, boardId),
          v,
        ),
      );
    }),
  );

  server.registerTool(
    "kaiten_list_lanes",
    {
      title: "List Lanes",
      description:
        "Swimlanes for a board. Optional laneId on "
        + "kaiten_create_card and kaiten_update_card when "
        + "the board uses lanes. NOTE: the default lane "
        + "often has an empty `title` — refer to it by "
        + "lowest sort_order if you need to identify it. "
        + "boardId from kaiten_list_boards.",
      inputSchema: {
        boardId: positiveId("Board ID, from kaiten_list_boards"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ boardId, verbosity }) => {
      const v = asV(verbosity);
      const lanes = await boardsCache.getOrFetch(
        `board:${boardId}:lanes`,
        () => get(`/boards/${boardId}/lanes`),
      );
      return jsonResult(
        simplifyList(lanes, simplifyLane, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_list_card_types",
    {
      title: "List Card Types",
      description:
        "Card types defined globally per company (NOT "
        + "per-board — a per-board endpoint does not exist). "
        + "Returns Bug, Story, Feature, etc. typeId for "
        + "kaiten_create_card or kaiten_update_card.",
      inputSchema: {
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ verbosity }) => {
      const v = asV(verbosity);
      const types = await boardsCache.getOrFetch(
        "global:card-types",
        () => get<Obj[]>("/card-types"),
      );
      if (v === "raw") return jsonResult(types);
      return jsonResult(
        types.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
        })),
      );
    }),
  );

  server.registerTool(
    "kaiten_list_space_users",
    {
      title: "List Space Users",
      description:
        "Members of a space. Use to find user IDs for "
        + "kaiten_update_card.ownerId or "
        + "kaiten_create_card.ownerId when the target user "
        + "isn't the API caller. spaceId from "
        + "kaiten_list_spaces.",
      inputSchema: {
        spaceId: positiveId("Space ID, from kaiten_list_spaces"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ spaceId, verbosity }) => {
      const v = asV(verbosity);
      const users = await get<Obj[]>(
        `/spaces/${spaceId}/users`,
      );
      return jsonResult(simplifyList(users, simplifyUser, v));
    }),
  );
}
