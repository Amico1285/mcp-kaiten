import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, buildOptionalBody,
  positiveId, intId, isoDate, optionalIsoDate,
  requireSomeFields,
} from "../utils/schemas.js";
import {
  assertChildBelongsToParent,
} from "../utils/preflight.js";
import { usersCache } from "../utils/cache.js";
import {
  simplifyTimelog,
  enrichAuthor,
  verbositySchema,
  asV,
  type Verbosity,
} from "../utils/simplify.js";

// Time-log endpoints expose author/user only as integer IDs
// (per docs/api/card-time-logs/add-time-log.md and a probe of
// /users/{id}/time-logs). We resolve the name from the cached
// current user when the author is the API caller.
function fetchCurrentUser(): Promise<Obj> {
  return usersCache.getOrFetch(
    "current", () => get<Obj>("/users/current"),
  );
}

function simplifyTimelogList(
  logs: unknown,
  v: Verbosity,
  currentUser: Obj,
): unknown {
  if (!Array.isArray(logs)) return logs;
  return (logs as Obj[]).map(
    (l) => simplifyTimelog(enrichAuthor(l, currentUser), v),
  );
}

export function registerTimelogTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_get_user_timelogs",
    {
      title: "List User Timelogs",
      description:
        "List a user's timelogs across cards. Returns "
        + "array; `time_spent` is in minutes. from/to in "
        + "YYYY-MM-DD format. userId from "
        + "kaiten_get_current_user or kaiten_list_users. "
        + "Card titles via kaiten_get_card.",
      inputSchema: {
        userId: positiveId("User ID"),
        from: isoDate("Range start (YYYY-MM-DD)"),
        to: isoDate("Range end (YYYY-MM-DD)"),
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
      const [currentUser, logs] = await Promise.all([
        fetchCurrentUser(),
        get(
          `/users/${userId}/time-logs`, { from, to },
        ),
      ]);
      return jsonResult(
        simplifyTimelogList(logs, v, currentUser),
      );
    }),
  );

  server.registerTool(
    "kaiten_get_card_timelogs",
    {
      title: "List Card Timelogs",
      description:
        "List a card's timelogs. Returns array; "
        + "`time_spent` is in minutes. logId is used by "
        + "kaiten_update_timelog / kaiten_delete_timelog; "
        + "cardId from kaiten_search_cards. NOTE: returns "
        + "[] for nonexistent cards as well as cards with "
        + "no timelogs — verify cardId via "
        + "kaiten_search_cards if you need to distinguish.",
      inputSchema: {
        cardId: positiveId("Card ID"),
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
      const [currentUser, logs] = await Promise.all([
        fetchCurrentUser(),
        get(`/cards/${cardId}/time-logs`),
      ]);
      return jsonResult(
        simplifyTimelogList(logs, v, currentUser),
      );
    }),
  );

  server.registerTool(
    "kaiten_create_timelog",
    {
      title: "Create Timelog",
      description:
        "Log time (in minutes) on a card. roleId from "
        + "kaiten_list_company_roles; cardId from "
        + "kaiten_search_cards; verify with "
        + "kaiten_get_card_timelogs.",
      inputSchema: {
      cardId: positiveId("Card ID"),
      timeSpentMinutes: z.coerce.number().int().min(1)
        .describe("Minutes spent"),
      roleId: intId("Role ID"),
      comment: z.string().optional().describe(
        "Log comment",
      ),
      forDate: optionalIsoDate(
        "Date the work happened (YYYY-MM-DD). "
        + "Defaults to today.",
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

      const [currentUser, log] = await Promise.all([
        fetchCurrentUser(),
        post<Obj>(
          `/cards/${cardId}/time-logs`, body,
        ),
      ]);
      return jsonResult(
        simplifyTimelog(
          enrichAuthor(log, currentUser), v,
        ),
      );
    }),
  );

  server.registerTool(
    "kaiten_update_timelog",
    {
      title: "Update Timelog",
      description:
        "Patch a timelog (timeSpentMinutes is in "
        + "minutes). logId and cardId from "
        + "kaiten_get_card_timelogs or "
        + "kaiten_get_user_timelogs.",
      inputSchema: {
      cardId: positiveId("Card ID"),
      logId: positiveId("Time-log ID"),
      timeSpentMinutes: z.coerce.number().int().min(1)
        .optional()
        .describe("New minutes"),
      roleId: z.coerce.number().int().optional().describe(
        "New role",
      ),
      comment: z.string().optional().describe(
        "New comment",
      ),
      forDate: optionalIsoDate(
        "Date the work happened (YYYY-MM-DD)",
      ),
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
      cardId, logId, verbosity, ...fields
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["time_spent", fields.timeSpentMinutes],
        ["role_id", fields.roleId],
        ["comment", fields.comment],
        ["for_date", fields.forDate],
      ]);
      requireSomeFields(body, "kaiten_update_timelog", [
        "timeSpentMinutes", "comment", "forDate", "roleId",
      ]);

      const [currentUser, log] = await Promise.all([
        fetchCurrentUser(),
        patch<Obj>(
          `/cards/${cardId}/time-logs/${logId}`, body,
        ),
      ]);
      return jsonResult(
        simplifyTimelog(
          enrichAuthor(log, currentUser), v,
        ),
      );
    }),
  );

  server.registerTool(
    "kaiten_delete_timelog",
    {
      title: "Delete Timelog",
      description:
        "Delete a timelog. WARNING: Kaiten ignores "
        + "cardId in the URL path and resolves the log "
        + "purely by logId — passing a wrong cardId will "
        + "still delete the log from its real owner card. "
        + "Always verify the pair via "
        + "kaiten_get_card_timelogs(cardId) before "
        + "deleting.",
      inputSchema: {
        cardId: positiveId("Card ID"),
        logId: positiveId("Time-log ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, logId }) => {
      await assertChildBelongsToParent({
        toolName: "kaiten_delete_timelog",
        childId: logId,
        childDescriptor: `timelog ${logId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/time-logs`,
        ),
      });
      await del(
        `/cards/${cardId}/time-logs/${logId}`,
      );
      return textResult(
        `Time-log ${logId} deleted`,
      );
    }),
  );
}
