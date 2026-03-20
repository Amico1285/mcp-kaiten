import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { jsonResult, handleTool } from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import { usersCache } from "../utils/cache.js";
import {
  simplifyUser, simplifyList,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

export function registerUserTools(
  server: McpServer,
): void {
  server.tool(
    "kaiten_get_current_user",
    "Get the authenticated user's profile: id, "
    + "name, email. Use the id for "
    + "kaiten_get_user_timelogs.",
    { verbosity: verbositySchema },
    handleTool(async ({ verbosity }) => {
      const v = verbosity as Verbosity;
      const user = await usersCache.getOrFetch(
        "current",
        () => get<Obj>("/users/current"),
      );
      return jsonResult(simplifyUser(user, v));
    }),
  );

  server.tool(
    "kaiten_list_users",
    "List all users in the organization. Use to "
    + "find user IDs for ownerId/memberIds "
    + "filters in search.",
    { verbosity: verbositySchema },
    handleTool(async ({ verbosity }) => {
      const v = verbosity as Verbosity;
      const users = await usersCache.getOrFetch(
        "all", () => get("/users"),
      );
      return jsonResult(
        simplifyList(users, simplifyUser, v),
      );
    }),
  );

  server.tool(
    "kaiten_get_user_roles",
    "Get roles and permissions of the current "
    + "user across spaces and boards.",
    { verbosity: verbositySchema },
    handleTool(async ({ verbosity }) => {
      const v = verbosity as Verbosity;
      const roles = await get("/user-roles");
      if (v === "raw") return jsonResult(roles);
      if (!Array.isArray(roles)) {
        return jsonResult(roles);
      }
      return jsonResult(
        (roles as Obj[]).map((r) => ({
          id: r.id,
          name: r.name,
          space_id: r.space_id,
        })),
      );
    }),
  );
}
