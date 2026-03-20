import { z } from "zod";

export type Obj = Record<string, unknown>;

export function optionalInt(desc: string) {
  return z.number().int().optional().describe(desc);
}

export const paginationSchema = {
  limit: z.number().int().min(1).max(100)
    .default(20)
    .describe("Max results"),
  offset: z.number().int().min(0).default(0)
    .describe("Offset for pagination"),
};

export const conditionSchema = z.number().int()
  .min(1).max(2).default(1)
  .describe("1=active, 2=archived");

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
