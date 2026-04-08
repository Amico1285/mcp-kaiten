import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, buildOptionalBody,
} from "../utils/schemas.js";
import {
  simplifyTimelog, simplifyList,
  verbositySchema,
  asV,
} from "../utils/simplify.js";

export function registerTimelogTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_get_user_timelogs",
    {
      title: "List User Timelogs",
      description:
        "User timelogs, from/to ISO. userId from "
        + "kaiten_get_current_user; titles via kaiten_get_card.",
      inputSchema: {
        userId: z.coerce.number().int().describe("User ID"),
        from: z.string().describe("ISO start"),
        to: z.string().describe("ISO end"),
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
      userId, from, to, verbosity,
    }) => {
      const v = asV(verbosity);
      const logs = await get(
        `/users/${userId}/time-logs`, { from, to },
      );
      return jsonResult(
        simplifyList(logs, simplifyTimelog, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_get_card_timelogs",
    {
      title: "List Card Timelogs",
      description:
        "Card timelogs. logId for kaiten_update_timelog/"
        + "kaiten_delete_timelog; cardId from "
        + "kaiten_search_cards.",
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
      const logs = await get(
        `/cards/${cardId}/time-logs`,
      );
      return jsonResult(
        simplifyList(logs, simplifyTimelog, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_create_timelog",
    {
      title: "Create Timelog",
      description:
        "Log time on card. roleId from kaiten_get_user_roles; "
        + "cardId from kaiten_search_cards; see "
        + "kaiten_get_card_timelogs.",
      inputSchema: {
      cardId: z.coerce.number().int().describe("Card ID"),
      timeSpentMinutes: z.coerce.number().int().min(1)
        .describe("Minutes spent"),
      roleId: z.coerce.number().int().describe("Role ID"),
      comment: z.string().optional().describe(
        "Log comment",
      ),
      forDate: z.string().optional().describe(
        "Log date (ISO 8601, e.g. 2026-03-21)",
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
      cardId, timeSpentMinutes, roleId,
      comment, forDate, verbosity,
    }) => {
      const v = asV(verbosity);
      const body = {
        time_spent: timeSpentMinutes,
        role_id: roleId,
        ...buildOptionalBody([
          ["comment", comment],
          ["for_date", forDate],
        ]),
      };

      const log = await post<Obj>(
        `/cards/${cardId}/time-logs`, body,
      );
      return jsonResult(simplifyTimelog(log, v));
    }),
  );

  server.registerTool(
    "kaiten_update_timelog",
    {
      title: "Update Timelog",
      description:
        "Patch timelog. logId and cardId from "
        + "kaiten_get_card_timelogs or "
        + "kaiten_get_user_timelogs.",
      inputSchema: {
      cardId: z.coerce.number().int().describe("Card ID"),
      logId: z.coerce.number().int().describe(
        "Time-log ID",
      ),
      timeSpentMinutes: z.coerce.number().int().min(1)
        .optional()
        .describe("New minutes"),
      roleId: z.coerce.number().int().optional().describe(
        "New role",
      ),
      comment: z.string().optional().describe(
        "New comment",
      ),
      forDate: z.string().optional().describe(
        "New date (ISO 8601, e.g. 2026-03-21)",
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
      cardId, logId, verbosity, ...fields
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["time_spent", fields.timeSpentMinutes],
        ["role_id", fields.roleId],
        ["comment", fields.comment],
        ["for_date", fields.forDate],
      ]);

      const log = await patch<Obj>(
        `/cards/${cardId}/time-logs/${logId}`, body,
      );
      return jsonResult(simplifyTimelog(log, v));
    }),
  );

  server.registerTool(
    "kaiten_delete_timelog",
    {
      title: "Delete Timelog",
      description:
        "Delete timelog. cardId and logId from "
        + "kaiten_get_card_timelogs or "
        + "kaiten_get_user_timelogs.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        logId: z.coerce.number().int().describe(
          "Time-log ID",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, logId }) => {
      await del(
        `/cards/${cardId}/time-logs/${logId}`,
      );
      return textResult(
        `Time-log ${logId} deleted`,
      );
    }),
  );
}
