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
  type Verbosity,
} from "../utils/simplify.js";

export function registerSpaceTools(
  server: McpServer,
): void {
  server.tool(
    "kaiten_list_spaces",
    "List all spaces available to the current "
    + "user. Use this to discover space IDs for "
    + "other tools.",
    { verbosity: verbositySchema },
    handleTool(async ({ verbosity }) => {
      const v = verbosity as Verbosity;
      const spaces = await spacesCache.getOrFetch(
        "all", () => get("/spaces"),
      );
      return jsonResult(
        simplifyList(spaces, simplifySpace, v),
      );
    }),
  );

  server.tool(
    "kaiten_get_space",
    "Get space details: title, description, "
    + "members.",
    {
      spaceId: z.number().int().describe(
        "Space ID",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({ spaceId, verbosity }) => {
      const v = verbosity as Verbosity;
      const space = await spacesCache.getOrFetch(
        `space:${spaceId}`,
        () => get<Obj>(`/spaces/${spaceId}`),
      );
      return jsonResult(simplifySpace(space, v));
    }),
  );

  server.tool(
    "kaiten_list_boards",
    "List all boards in a space. Use this to "
    + "discover board IDs for card operations.",
    {
      spaceId: z.number().int().describe(
        "Space ID",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({ spaceId, verbosity }) => {
      const v = verbosity as Verbosity;
      const boards = await boardsCache.getOrFetch(
        `space:${spaceId}:boards`,
        () => get(`/spaces/${spaceId}/boards`),
      );
      return jsonResult(
        simplifyList(boards, simplifyBoard, v),
      );
    }),
  );

  server.tool(
    "kaiten_get_board",
    "Get board details: title, columns, lanes, "
    + "space.",
    {
      boardId: z.number().int().describe(
        "Board ID",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({ boardId, verbosity }) => {
      const v = verbosity as Verbosity;
      const board = await boardsCache.getOrFetch(
        `board:${boardId}`,
        () => get<Obj>(`/boards/${boardId}`),
      );
      return jsonResult(simplifyBoard(board, v));
    }),
  );

  server.tool(
    "kaiten_list_columns",
    "List columns of a board. Columns represent "
    + "card statuses (e.g. To Do, In Progress, "
    + "Done). Needed for kaiten_create_card.",
    {
      boardId: z.number().int().describe(
        "Board ID",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({ boardId, verbosity }) => {
      const v = verbosity as Verbosity;
      const columns = await boardsCache.getOrFetch(
        `board:${boardId}:columns`,
        () => get(`/boards/${boardId}/columns`),
      );
      return jsonResult(
        simplifyList(columns, simplifyColumn, v),
      );
    }),
  );

  server.tool(
    "kaiten_list_lanes",
    "List swimlanes of a board. Lanes are "
    + "horizontal rows that group cards (e.g. by "
    + "team or priority).",
    {
      boardId: z.number().int().describe(
        "Board ID",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({ boardId, verbosity }) => {
      const v = verbosity as Verbosity;
      const lanes = await boardsCache.getOrFetch(
        `board:${boardId}:lanes`,
        () => get(`/boards/${boardId}/lanes`),
      );
      return jsonResult(
        simplifyList(lanes, simplifyLane, v),
      );
    }),
  );

  server.tool(
    "kaiten_list_card_types",
    "List card types available on a board (e.g. "
    + "Bug, Feature, Task). Use typeId in "
    + "kaiten_create_card.",
    {
      boardId: z.number().int().describe(
        "Board ID",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({ boardId, verbosity }) => {
      const v = verbosity as Verbosity;
      const types = await boardsCache.getOrFetch(
        `board:${boardId}:types`,
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
