import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, boolish, buildOptionalBody,
} from "../utils/schemas.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

export function simplifyChecklistItem(
  item: Obj,
  _v: Verbosity,
): Obj {
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
        cardId: z.coerce.number().int().describe("Card ID"),
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
        "Get checklist with items. checklistId from "
        + "kaiten_create_checklist or kaiten_get_card "
        + "(verbosity=max).",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        checklistId: z.coerce.number().int().describe(
          "Checklist ID",
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
    handleTool(async ({
      cardId, checklistId, verbosity,
    }) => {
      const v = asV(verbosity);
      const cl = await get<Obj>(
        `/cards/${cardId}/checklists/${checklistId}`,
      );
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
        cardId: z.coerce.number().int().describe("Card ID"),
        checklistId: z.coerce.number().int().describe(
          "Checklist ID",
        ),
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
        "Add item. checklistId from kaiten_create_checklist/"
        + "kaiten_get_checklist; edit: "
        + "kaiten_update_checklist_item.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        checklistId: z.coerce.number().int().describe(
          "Checklist ID",
        ),
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
        "Update checklist item text or checked flag. itemId "
        + "from kaiten_get_checklist.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        checklistId: z.coerce.number().int().describe(
          "Checklist ID",
        ),
        itemId: z.coerce.number().int().describe("Item ID"),
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
        idempotentHint: false,
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
}
