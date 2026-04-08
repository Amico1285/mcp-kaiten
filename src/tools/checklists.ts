import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, boolish, buildOptionalBody,
  positiveId, requireSomeFields,
} from "../utils/schemas.js";
import {
  assertChildBelongsToParent,
} from "../utils/preflight.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

// Checklists have no card-scoped LIST endpoint
// (`GET /cards/{cardId}/checklists` is 405) and the single-
// checklist GET silently returns cross-card (that's CC-1 itself).
// The only source-of-truth is the bare `GET /cards/{cardId}`,
// which returns checklists inline with `card_id` per checklist
// and `items` arrays per checklist. We fetch it once and reuse
// for both the checklist-level and the item-level check.
async function fetchCardChecklists(
  cardId: number,
): Promise<Obj[]> {
  const card = await get<Obj>(`/cards/${cardId}`);
  return Array.isArray(card.checklists)
    ? (card.checklists as Obj[])
    : [];
}

export function simplifyChecklistItem(
  item: Obj,
  v: Verbosity,
): Obj {
  if (v === "raw") return item;
  // max exposes audit-trail fields (who checked it and when,
  // who's responsible, when it's due) plus the external uid.
  // min/normal keep the historical 4-field shape unchanged.
  if (v === "max") {
    return {
      id: item.id,
      uid: item.uid ?? null,
      text: item.text,
      checked: item.checked ?? false,
      sort_order: item.sort_order,
      due_date: item.due_date ?? null,
      responsible_id: item.responsible_id ?? null,
      checker_id: item.checker_id ?? null,
      checked_at: item.checked_at ?? null,
      created: item.created ?? null,
      updated: item.updated ?? null,
    };
  }
  return {
    id: item.id,
    text: item.text,
    checked: item.checked ?? false,
    sort_order: item.sort_order,
  };
}

export function simplifyChecklist(
  cl: Obj,
  v: Verbosity,
): Obj {
  if (v === "raw") return cl;
  const items = Array.isArray(cl.items)
    ? (cl.items as Obj[]).map(
      (i) => simplifyChecklistItem(i, v),
    )
    : [];

  return {
    id: cl.id,
    name: cl.name,
    items_count: items.length,
    checked_count: items.filter(
      (i) => i.checked,
    ).length,
    ...(v !== "min" ? { items } : {}),
  };
}

export function registerChecklistTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_create_checklist",
    {
      title: "Create Checklist",
      description:
        "Create an empty checklist on a card. Add rows "
        + "with kaiten_add_checklist_item; read back "
        + "with kaiten_get_checklist.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_get_card or "
          + "kaiten_search_cards)",
        ),
        name: z.string().min(1).describe(
          "Checklist name",
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
      cardId, name, verbosity,
    }) => {
      const v = asV(verbosity);
      const cl = await post<Obj>(
        `/cards/${cardId}/checklists`,
        { name },
      );
      return jsonResult(simplifyChecklist(cl, v));
    }),
  );

  server.registerTool(
    "kaiten_get_checklist",
    {
      title: "Get Checklist",
      description:
        "Get a checklist with its items. NOTE: Kaiten "
        + "resolves checklists by checklistId alone — "
        + "passing a wrong cardId still returns the real "
        + "checklist if checklistId is valid. Verify via "
        + "the returned checklist's parent card if cardId "
        + "is reconstructed from memory. checklistId from "
        + "kaiten_create_checklist or kaiten_get_card "
        + "(verbosity=max).",
      inputSchema: {
        cardId: positiveId("Card ID"),
        checklistId: positiveId("Checklist ID"),
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
      cardId, checklistId, verbosity,
    }) => {
      const v = asV(verbosity);
      // Preflight: the raw `/cards/{cardId}/checklists/{id}`
      // endpoint silently returns cross-card, so we verify
      // via the bare card (authoritative). The matched object
      // already contains items, so we return it directly —
      // no duplicate fetch.
      const cl = await assertChildBelongsToParent({
        toolName: "kaiten_get_checklist",
        childId: checklistId,
        childDescriptor: `checklist ${checklistId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => fetchCardChecklists(cardId),
      });
      return jsonResult(simplifyChecklist(cl, v));
    }),
  );

  server.registerTool(
    "kaiten_delete_checklist",
    {
      title: "Delete Checklist",
      description:
        "Delete checklist and all items (irreversible). "
        + "checklistId from kaiten_get_checklist or "
        + "kaiten_get_card.",
      inputSchema: {
        cardId: positiveId("Card ID"),
        checklistId: positiveId("Checklist ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, checklistId }) => {
      await del(
        `/cards/${cardId}/checklists/${checklistId}`,
      );
      return textResult(
        `Checklist ${checklistId} deleted`,
      );
    }),
  );

  server.registerTool(
    "kaiten_add_checklist_item",
    {
      title: "Add Checklist Item",
      description:
        "Add a checklist item. text has a 4096-character "
        + "limit (Kaiten server-side cap). Item supports "
        + "text and checked state only — `due_date` and "
        + "`responsible_id` are not exposed by this fork. "
        + "checklistId from kaiten_create_checklist or "
        + "kaiten_get_checklist; edit with "
        + "kaiten_update_checklist_item.",
      inputSchema: {
        cardId: positiveId("Card ID"),
        checklistId: positiveId("Checklist ID"),
        text: z.string().min(1).describe("Item text"),
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
      cardId, checklistId, text, verbosity,
    }) => {
      const v = asV(verbosity);
      const item = await post<Obj>(
        `/cards/${cardId}/checklists`
          + `/${checklistId}/items`,
        { text },
      );
      return jsonResult(
        simplifyChecklistItem(item, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_update_checklist_item",
    {
      title: "Update Checklist Item",
      description:
        "Update a checklist item's text or checked flag. "
        + "text has a 4096-character limit (Kaiten "
        + "server-side cap). Item supports text and "
        + "checked state only — `due_date` and "
        + "`responsible_id` are not exposed by this fork. "
        + "itemId from kaiten_get_checklist.",
      inputSchema: {
        cardId: positiveId("Card ID"),
        checklistId: positiveId("Checklist ID"),
        itemId: positiveId("Item ID"),
        text: z.string().optional().describe(
          "New item text",
        ),
        checked: boolish.optional().describe(
          "Check/uncheck the item",
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
      cardId, checklistId, itemId,
      text, checked, verbosity,
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["text", text],
        ["checked", checked],
      ]);
      requireSomeFields(body, "kaiten_update_checklist_item", [
        "text", "checked",
      ]);

      // Two-level preflight in a single round-trip: the matched
      // checklist from the card also carries the `items` array,
      // so we reuse it to verify itemId membership.
      const cl = await assertChildBelongsToParent({
        toolName: "kaiten_update_checklist_item",
        childId: checklistId,
        childDescriptor: `checklist ${checklistId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => fetchCardChecklists(cardId),
      });
      await assertChildBelongsToParent({
        toolName: "kaiten_update_checklist_item",
        childId: itemId,
        childDescriptor: `checklist item ${itemId}`,
        parentDescriptor: `checklist ${checklistId}`,
        fetchPool: async () => Array.isArray(cl.items)
          ? (cl.items as Obj[])
          : [],
      });

      const item = await patch<Obj>(
        `/cards/${cardId}/checklists`
          + `/${checklistId}/items/${itemId}`,
        body,
      );
      return jsonResult(
        simplifyChecklistItem(item, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_delete_checklist_item",
    {
      title: "Delete Checklist Item",
      description:
        "Remove a single item from a checklist. cardId, "
        + "checklistId, and itemId all from "
        + "kaiten_get_checklist. NOTE: Kaiten resolves the "
        + "item by itemId alone — wrong cardId/checklistId "
        + "still deletes the real item. Verify the pair "
        + "before deleting.",
      inputSchema: {
        cardId: positiveId("Card ID"),
        checklistId: positiveId("Checklist ID"),
        itemId: positiveId("Item ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, checklistId, itemId }) => {
      const cl = await assertChildBelongsToParent({
        toolName: "kaiten_delete_checklist_item",
        childId: checklistId,
        childDescriptor: `checklist ${checklistId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => fetchCardChecklists(cardId),
      });
      await assertChildBelongsToParent({
        toolName: "kaiten_delete_checklist_item",
        childId: itemId,
        childDescriptor: `checklist item ${itemId}`,
        parentDescriptor: `checklist ${checklistId}`,
        fetchPool: async () => Array.isArray(cl.items)
          ? (cl.items as Obj[])
          : [],
      });
      await del(
        `/cards/${cardId}/checklists/${checklistId}`
          + `/items/${itemId}`,
      );
      return textResult(
        `Checklist item ${itemId} deleted from checklist `
        + `${checklistId} on card ${cardId}`,
      );
    }),
  );

  server.registerTool(
    "kaiten_rename_checklist",
    {
      title: "Rename Checklist",
      description:
        "Rename a checklist. cardId and checklistId from "
        + "kaiten_get_checklist. The only field supported "
        + "is name; items are managed via the "
        + "*_checklist_item tools.",
      inputSchema: {
        cardId: positiveId("Card ID"),
        checklistId: positiveId("Checklist ID"),
        name: z.string().min(1).describe("New checklist name"),
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
      cardId, checklistId, name, verbosity,
    }) => {
      const v = asV(verbosity);
      const updated = await patch<Obj>(
        `/cards/${cardId}/checklists/${checklistId}`,
        { name },
      );
      return jsonResult(simplifyChecklist(updated, v));
    }),
  );
}
