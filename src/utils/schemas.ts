import { z } from "zod";

export type Obj = Record<string, unknown>;

// Accept both numeric and string integers — some MCP clients
// serialise numeric params as strings, which would otherwise
// fail strict z.number() validation.
export function intId(desc: string) {
  return z.coerce.number().int().describe(desc);
}

export function optionalInt(desc: string) {
  return z.coerce.number().int().optional().describe(desc);
}

// Like intId() but rejects 0 and negative values at the schema
// layer, before they hit the API. Use for any "real" Kaiten ID
// (cardId, boardId, spaceId, etc.). Do NOT use for roleId —
// the system "Employee" role legitimately has id -1.
export function positiveId(desc: string) {
  return z.coerce.number().int().positive().describe(desc);
}

export function optionalPositiveId(desc: string) {
  return z.coerce.number().int().positive()
    .optional().describe(desc);
}

// MCP clients (notably Claude Code) serialize booleans as
// strings ("true"/"false"), and z.coerce.boolean() is broken
// for that case (Boolean("false") === true). Wrap z.boolean()
// in a preprocess that recognises both real booleans and the
// string forms.
function coerceBool(v: unknown): unknown {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

export const boolish = z.preprocess(
  coerceBool, z.boolean(),
);

export function boolishWithDefault(d: boolean) {
  return z.preprocess(coerceBool, z.boolean().default(d));
}

// Schema slot for fields that used to exist but were
// removed because the underlying API doesn't support them
// the way the field name implies. Accepts only `undefined`
// — any other value yields a custom validation error with
// a hint pointing at the correct replacement.
export function removedField(msg: string) {
  return z.any().superRefine((val, ctx) => {
    if (val !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: msg,
      });
    }
  });
}

// ISO 8601 date-only validator (YYYY-MM-DD). Catches empty
// strings and garbage like "tomorrow" before they reach the
// Kaiten API, which would otherwise return an opaque 500.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isoDate(desc: string) {
  return z.string().regex(
    ISO_DATE_RE,
    "Expected ISO 8601 date in YYYY-MM-DD format",
  ).describe(desc);
}

export function optionalIsoDate(desc: string) {
  return z.string().regex(
    ISO_DATE_RE,
    "Expected ISO 8601 date in YYYY-MM-DD format",
  ).optional().describe(desc);
}

// ISO 8601 datetime validator. Accepts both date-only and
// full datetime forms (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS[.fff][Z|±hh:mm]).
// Use for filter/timestamp params where Kaiten accepts either form.
const ISO_DATETIME_RE
  = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
export function isoDateTime(desc: string) {
  return z.string().regex(
    ISO_DATETIME_RE,
    "Expected ISO 8601 datetime "
    + "(YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)",
  ).describe(desc);
}

export function optionalIsoDateTime(desc: string) {
  return z.string().regex(
    ISO_DATETIME_RE,
    "Expected ISO 8601 datetime "
    + "(YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)",
  ).optional().describe(desc);
}

// Handler-level guard: throw a friendly explanatory error if
// an update_* tool was called with no field values to patch.
// Without this, Kaiten returns a confusing 403 ("access denied")
// for empty PATCH bodies on /cards, or leaks raw schema noise
// like "'.text', '.checklist_id', '.anyOf'" for /checklists items.
//
// `toolName` shows up in the error so the LLM knows which call
// to retry. `allowedFields` is the human-readable list of valid
// field names from that tool's schema.
export function requireSomeFields(
  body: Obj,
  toolName: string,
  allowedFields: readonly string[],
): void {
  if (Object.keys(body).length === 0) {
    throw new Error(
      `${toolName} requires at least one field to update. `
      + `Available fields: ${allowedFields.join(", ")}.`,
    );
  }
}

export const paginationSchema = {
  limit: z.coerce.number().int().min(1).max(100)
    .default(20)
    .describe("Max results"),
  offset: z.coerce.number().int().min(0).default(0)
    .describe("Offset for pagination"),
};

export const conditionSchema = z.coerce.number().int()
  .min(1).max(3).default(1)
  .describe("1=active, 2=archived, 3=all");

export function buildOptionalBody(
  pairs: [string, unknown][],
): Obj {
  const body: Obj = {};
  for (const [key, val] of pairs) {
    if (val !== undefined) body[key] = val;
  }
  return body;
}

export function addOptionalParams(
  q: Record<string, string>,
  pairs: [string, string | number | boolean
    | undefined][],
): void {
  for (const [key, val] of pairs) {
    if (val !== undefined) q[key] = String(val);
  }
}
