import { get } from "../client.js";
import type { Obj } from "./schemas.js";

// Kaiten's server resolves many child resources (comments, files,
// timelogs, tags, children, checklists, checklist items) by child
// ID alone and ignores the parent in the URL path. Effect: a wrong
// parentId + real childId silently operates on the true owner.
// LLM sees success, writes back "done", the mutation landed on the
// wrong card. This preflight refuses the mutation before it lands.
//
// The brief originally asked for a `GET /cards/{cardId}/<res>/{id}`
// single-child fetch that reads `card_id` from the response. Live
// probes (2026-04-08) show this doesn't work:
//   - `GET /cards/{cardId}/comments/{commentId}` → 405 (no single GET)
//   - `GET /cards/{cardId}/time-logs/{logId}`    → 405 (no single GET)
//   - `GET /cards/{cardId}/checklists/{checklistId}` → 200 but
//        silently returns the REAL checklist for a wrong cardId
//        (this is the CC-1 bug itself) and its response body does
//        NOT include a `card_id` field, so there's nothing to check.
//
// The one thing that IS authoritative is parent-scoped list
// endpoints: they filter by parent (they'd be useless otherwise).
// So the preflight fetches a pool of candidates scoped to the
// expected parent and looks for the child's id. If it isn't in
// the pool, the pair is mismatched and we throw.
//
// Fails closed: if the pool fetch errors (404/403/timeout), the
// error propagates — the mutation never runs on a failed lookup.
export async function assertChildBelongsToParent(opts: {
  toolName: string;
  childId: number;
  // Human-readable descriptors for the error message — e.g.
  // "comment 80149294" / "card 63094270". The LLM is the
  // consumer; naming both IDs lets it recover by listing the
  // real parent or correcting the wrong id.
  childDescriptor: string;
  parentDescriptor: string;
  // Returns the authoritative pool of candidate children for
  // the expected parent. For most resources this is
  // `() => get<Obj[]>(/cards/${cardId}/<resource>)`. For
  // checklists, where the card-scoped list endpoint doesn't
  // exist, the caller fetches `/cards/{cardId}` and returns
  // the inline `checklists` array.
  fetchPool: () => Promise<Obj[]>;
}): Promise<Obj> {
  const pool = await opts.fetchPool();
  const match = pool.find((item) => item.id === opts.childId);
  if (!match) {
    throw new Error(
      `${opts.toolName}: ${opts.childDescriptor} does not belong `
      + `to ${opts.parentDescriptor}. `
      + `Verify the pair before retrying.`,
    );
  }
  return match;
}
