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
