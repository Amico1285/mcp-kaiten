import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import { type Obj, positiveId } from "../utils/schemas.js";
import {
  simplifyUser,
  asV,
  verbositySchema,
} from "../utils/simplify.js";
import {
  assertChildBelongsToParent,
} from "../utils/preflight.js";

export function registerMemberTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_card_members",
    {
      title: "List Card Members",
      description:
        "List users assigned to a card (members and the "
        + "responsible user). Each row carries `type`: "
        + "1=member, 2=responsible. cardId from "
        + "kaiten_search_cards or kaiten_get_card. Returns: "
        + "array of user objects (per verbosity) with a `type` "
        + "field added.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards "
          + "or kaiten_get_card)",
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
    handleTool(async ({ cardId, verbosity }) => {
      const v = asV(verbosity);
      const members = await get<Obj[]>(
        `/cards/${cardId}/members`,
      );
      if (v === "raw") return jsonResult(members);
      return jsonResult(
        members.map((m) => ({
          ...simplifyUser(m, v),
          type: m.type,
        })),
      );
    }),
  );

  server.registerTool(
    "kaiten_add_card_member",
    {
      title: "Add Card Member",
      description:
        "Attach a user to a card as a member. The user will "
        + "be listed by kaiten_list_card_members with type=1 "
        + "(member). Use kaiten_set_card_responsible to "
        + "promote an existing member to type=2 (responsible). "
        + "userId from kaiten_list_users or "
        + "kaiten_list_space_users. Returns: the added user "
        + "(simplified per verbosity) including the `type` "
        + "field.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards "
          + "or kaiten_get_card)",
        ),
        userId: positiveId(
          "User ID (from kaiten_list_users "
          + "or kaiten_list_space_users)",
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
    handleTool(async ({ cardId, userId, verbosity }) => {
      const v = asV(verbosity);
      const member = await post<Obj>(
        `/cards/${cardId}/members`,
        { user_id: userId },
      );
      if (v === "raw") return jsonResult(member);
      return jsonResult({
        ...simplifyUser(member, v),
        type: member.type,
      });
    }),
  );

  server.registerTool(
    "kaiten_remove_card_member",
    {
      title: "Remove Card Member",
      description:
        "Detach a user from a card. WARNING: Kaiten resolves "
        + "the member by userId alone — this preflight "
        + "verifies the user is actually a member of this "
        + "specific card before deleting. cardId from "
        + "kaiten_search_cards; userId from "
        + "kaiten_list_card_members. Returns: the removed "
        + "userId.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards)",
        ),
        userId: positiveId(
          "User ID (from kaiten_list_card_members)",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, userId }) => {
      await assertChildBelongsToParent({
        toolName: "kaiten_remove_card_member",
        childId: userId,
        childDescriptor: `user ${userId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/members`,
        ),
      });
      await del(`/cards/${cardId}/members/${userId}`);
      return textResult(
        `User ${userId} removed from card ${cardId}`,
      );
    }),
  );

  server.registerTool(
    "kaiten_set_card_responsible",
    {
      title: "Set Card Responsible Member",
      description:
        "Promote an existing card member to `type=2` "
        + "(responsible). Kaiten's API only accepts `type:2` "
        + "on this endpoint — there is no 'unset responsible' "
        + "call (demote via kaiten_remove_card_member then "
        + "re-add with kaiten_add_card_member). The user must "
        + "already be a member; call kaiten_add_card_member "
        + "first if needed. userId from "
        + "kaiten_list_card_members. Returns: the updated "
        + "user.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards)",
        ),
        userId: positiveId(
          "User ID of existing member "
          + "(from kaiten_list_card_members)",
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
    handleTool(async ({ cardId, userId, verbosity }) => {
      const v = asV(verbosity);
      // The preflight fetches GET /cards/{id}/members which
      // returns the FULL user shape (id, full_name, email,
      // username, avatar_*, lng, timezone, theme, activated,
      // created, updated, card_id, user_id, type). The PATCH
      // response, by contrast, is a skeleton
      // {created, updated, card_id, user_id, type} with no
      // user profile fields — running simplifyUser on it
      // would yield mostly `undefined`. So we reuse the
      // preflight's match as the response source and override
      // type:2 locally (we know it's 2 because the PATCH
      // below just succeeded).
      const match = await assertChildBelongsToParent({
        toolName: "kaiten_set_card_responsible",
        childId: userId,
        childDescriptor: `user ${userId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/members`,
        ),
      });
      await patch(
        `/cards/${cardId}/members/${userId}`,
        { type: 2 },
      );
      if (v === "raw") {
        return jsonResult({ ...match, type: 2 });
      }
      return jsonResult({
        ...simplifyUser(match, v),
        type: 2,
      });
    }),
  );
}
