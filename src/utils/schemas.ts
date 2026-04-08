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
