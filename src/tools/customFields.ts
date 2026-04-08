import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import {
  jsonResult, handleTool,
} from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";
import { TtlCache } from "../utils/cache.js";

const propsCache = new TtlCache<unknown>();

function simplifyProperty(
  p: Obj,
  v: Verbosity,
): Obj {
  if (v === "raw") return p;
  const result: Obj = {
    id: p.id,
    name: p.name,
    type: p.type,
  };
  if (v !== "min") {
    result.condition = p.condition;
    result.show_on_facade = p.show_on_facade ?? false;
    result.multiline = p.multiline ?? false;
    result.multi_select = p.multi_select ?? false;
    result.values_type = p.values_type ?? null;
    result.fields_settings = p.fields_settings ?? null;
  }
  return result;
}

export function registerCustomFieldTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_custom_properties",
    {
      title: "List Custom Properties",
      description:
        "List company-wide custom property definitions "
        + "(custom fields). In Kaiten, custom properties "
        + "are global per company/workspace, not per space. "
        + "The `type` field on each property determines the "
        + "value shape when writing via "
        + "kaiten_update_card.properties: "
        + "string | number | date | select id | "
        + "multi_select ids[] | user id | catalog uid | "
        + "tree uid | etc. Endpoint: "
        + "GET /company/custom-properties.",
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
      const props = await propsCache.getOrFetch(
        "company:all",
        () => get<Obj[]>("/company/custom-properties"),
      );
      return jsonResult(
        (props as Obj[]).map(
          (p) => simplifyProperty(p, v),
        ),
      );
    }),
  );
}
