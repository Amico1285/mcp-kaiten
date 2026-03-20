import { z } from "zod";

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
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, val] of pairs) {
    if (val !== undefined) body[key] = val;
  }
  return body;
}

export function addOptionalParams(
  q: Record<string, string>,
  str: [string, string | undefined][],
  num: [string, number | undefined][],
  bool: [string, boolean | undefined][],
): void {
  for (const [key, val] of str) {
    if (val !== undefined) q[key] = val;
  }
  for (const [key, val] of num) {
    if (val !== undefined) q[key] = String(val);
  }
  for (const [key, val] of bool) {
    if (val !== undefined) q[key] = String(val);
  }
}
