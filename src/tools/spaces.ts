import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { jsonResult, handleTool } from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import {
  spacesCache, boardsCache,
} from "../utils/cache.js";
import {
  simplifySpace, simplifyBoard,
  simplifyColumn, simplifyLane, simplifyList,
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
        "List spaces visible to current user. Space IDs are "
        + "used by boards, cards, and custom properties tools.",
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
        "Fetch one space by ID. Use after "
        + "kaiten_list_spaces when the list view is "
        + "not enough before drilling into boards.",
      inputSchema: {
        spaceId: z.coerce.number().int().describe(
          "Space ID",
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
        "List boards in a space. boardId for columns, "
        + "kaiten_get_board_cards, kaiten_search_cards, "
        + "kaiten_create_card.",
      inputSchema: {
        spaceId: z.coerce.number().int().describe(
          "Space ID",
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
        "Get board metadata. Column IDs: kaiten_list_columns. "
        + "boardId from kaiten_list_boards.",
      inputSchema: {
        boardId: z.coerce.number().int().describe(
          "Board ID",
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
        "Board columns (statuses). columnId for "
        + "kaiten_create_card, kaiten_update_card. boardId "
        + "from kaiten_list_boards.",
      inputSchema: {
        boardId: z.coerce.number().int().describe(
          "Board ID",
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
    handleTool(async ({ boardId, verbosity }) => {
      const v = asV(verbosity);
      const columns = await boardsCache.getOrFetch(
        `board:${boardId}:columns`,
        () => get(`/boards/${boardId}/columns`),
      );
      return jsonResult(
        simplifyList(columns, simplifyColumn, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_list_lanes",
    {
      title: "List Lanes",
      description:
        "Swimlanes for a board. Optional laneId on "
        + "kaiten_create_card and kaiten_update_card "
        + "when the board uses lanes.",
      inputSchema: {
        boardId: z.coerce.number().int().describe(
          "Board ID",
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
        "Workspace card types (Bug, Story, etc.). typeId in "
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
}
