import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { jsonResult, handleTool } from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import { usersCache, rolesCache } from "../utils/cache.js";
import {
  simplifyUser, simplifyRole, simplifyList,
  verbositySchema,
  asV,
} from "../utils/simplify.js";

export function registerUserTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_get_current_user",
    {
      title: "Get Current User",
      description:
        "Current user (id, name, email). id for "
        + "kaiten_get_user_timelogs and "
        + "kaiten_search_cards.ownerId. Calling this also "
        + "warms an internal cache used by enrichAuthor for "
        + "comments and timelogs — so author_name is "
        + "populated on create_comment / create_timelog "
        + "responses instead of coming back null.",
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
      const user = await usersCache.getOrFetch(
        "current",
        () => get<Obj>("/users/current"),
      );
      return jsonResult(simplifyUser(user, v));
    }),
  );

  server.registerTool(
    "kaiten_list_users",
    {
      title: "List Users",
      description:
        "Returns the full company user list — no pagination "
        + "and no server-side filtering, suitable for small "
        + "workspaces only. IDs feed kaiten_search_cards "
        + "filters, kaiten_create_card.ownerId and "
        + "kaiten_update_card.ownerId. If /users is denied "
        + "on the current token, fall back to "
        + "kaiten_get_current_user as a single-user source.",
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
      const users = await usersCache.getOrFetch(
        "all", () => get("/users"),
      );
      return jsonResult(
        simplifyList(users, simplifyUser, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_list_company_roles",
    {
      title: "List Company Roles",
      description:
        "Global role definitions for the company. "
        + "id → kaiten_create_timelog.roleId. NOTE: the "
        + "system 'Employee' role has id -1, which is valid "
        + "for kaiten_create_timelog but would fail "
        + ".positive() validation — that's why roleId on "
        + "create_timelog/update_timelog is not "
        + "strict-positive.",
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
      const roles = await rolesCache.getOrFetch(
        "roles", () => get<Obj[]>("/user-roles"),
      );
      return jsonResult(simplifyList(roles, simplifyRole, v));
    }),
  );
}
