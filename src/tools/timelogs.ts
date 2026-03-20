import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import { buildOptionalBody } from "../utils/schemas.js";
import {
  simplifyTimelog, simplifyList,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

type Obj = Record<string, unknown>;

export function registerTimelogTools(
  server: McpServer,
): void {
  server.tool(
    "kaiten_get_user_timelogs",
    "Get time-logs for a user in a date range. "
    + "Use kaiten_get_current_user first to get "
    + "userId. Dates must be ISO 8601.",
    {
      userId: z.number().int().describe("User ID"),
      from: z.string().describe(
        "Start date (ISO 8601, e.g. "
        + "2026-03-01T00:00:00Z)",
      ),
      to: z.string().describe(
        "End date (ISO 8601, e.g. "
        + "2026-03-31T23:59:59Z)",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({
      userId, from, to, verbosity,
    }) => {
      const v = verbosity as Verbosity;
      const logs = await get(
        `/users/${userId}/time-logs`, { from, to },
      );
      return jsonResult(
        simplifyList(logs, simplifyTimelog, v),
      );
    }),
  );

  server.tool(
    "kaiten_get_card_timelogs",
    "Get all time-log entries for a specific "
    + "card. Returns time spent, author, date, "
    + "and comment.",
    {
      cardId: z.number().int().describe("Card ID"),
      verbosity: verbositySchema,
    },
    handleTool(async ({ cardId, verbosity }) => {
      const v = verbosity as Verbosity;
      const logs = await get(
        `/cards/${cardId}/time-logs`,
      );
      return jsonResult(
        simplifyList(logs, simplifyTimelog, v),
      );
    }),
  );

  server.tool(
    "kaiten_create_timelog",
    "Log time spent on a card. Time is in "
    + "minutes (e.g. 90 for 1.5 hours). Optional "
    + "comment and date (defaults to today).",
    {
      cardId: z.number().int().describe("Card ID"),
      timeSpentMinutes: z.number().int().min(1)
        .describe("Time spent in minutes"),
      comment: z.string().optional().describe(
        "Comment for the time-log",
      ),
      forDate: z.string().optional().describe(
        "Date for the log (ISO 8601)",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({
      cardId, timeSpentMinutes, comment,
      forDate, verbosity,
    }) => {
      const v = verbosity as Verbosity;
      const body = {
        time_spent: timeSpentMinutes,
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

  server.tool(
    "kaiten_update_timelog",
    "Update a time-log entry. Only provided "
    + "fields are changed. Get logId from "
    + "kaiten_get_card_timelogs.",
    {
      cardId: z.number().int().describe("Card ID"),
      logId: z.number().int().describe(
        "Time-log ID",
      ),
      timeSpentMinutes: z.number().int().min(1)
        .optional()
        .describe("New time spent in minutes"),
      comment: z.string().optional().describe(
        "New comment",
      ),
      forDate: z.string().optional().describe(
        "New date (ISO 8601)",
      ),
      verbosity: verbositySchema,
    },
    handleTool(async ({
      cardId, logId, verbosity, ...fields
    }) => {
      const v = verbosity as Verbosity;
      const body = buildOptionalBody([
        ["time_spent", fields.timeSpentMinutes],
        ["comment", fields.comment],
        ["for_date", fields.forDate],
      ]);

      const log = await patch<Obj>(
        `/cards/${cardId}/time-logs/${logId}`, body,
      );
      return jsonResult(simplifyTimelog(log, v));
    }),
  );

  server.tool(
    "kaiten_delete_timelog",
    "Delete a time-log entry by logId. Get logId "
    + "from kaiten_get_card_timelogs or "
    + "kaiten_get_user_timelogs.",
    {
      logId: z.number().int().describe(
        "Time-log ID",
      ),
    },
    handleTool(async ({ logId }) => {
      await del(`/time-logs/${logId}`);
      return textResult(
        `Time-log ${logId} deleted`,
      );
    }),
  );
}
