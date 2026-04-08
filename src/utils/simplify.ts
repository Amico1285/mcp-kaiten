import { z } from "zod";

import { getBaseUrl } from "../config.js";
import type { Obj } from "./schemas.js";

export type Verbosity = "raw" | "min" | "normal" | "max";

export function asV(verbosity: string): Verbosity {
  return verbosity as Verbosity;
}

export const verbositySchema = z
  .enum(["raw", "min", "normal", "max"])
  .default("min")
  .describe("Detail: raw|min(default)|normal|max");

type SimplifyFns = {
  min: (o: Obj) => Obj;
  normal: (o: Obj) => Obj;
  max?: (o: Obj) => Obj;
};

function dispatch(
  obj: Obj,
  fns: SimplifyFns,
  v: Verbosity,
): Obj {
  if (v === "raw") return obj;
  if (v === "max") return (fns.max ?? fns.normal)(obj);
  if (v === "normal") return fns.normal(obj);
  return fns.min(obj);
}

function nested(obj: Obj, key: string): Obj | undefined {
  const val = obj[key];
  return val && typeof val === "object"
    ? val as Obj
    : undefined;
}

function cardUrl(card: Obj): string {
  const base = getBaseUrl().replace("/api/latest", "");
  const spaceId =
    card.space_id
    ?? nested(card, "board")?.space_id
    ?? "";
  return `${base}/space/${spaceId}/card/${card.id}`;
}

// ── Cards ──────────────────────────────────

const cardFns: SimplifyFns = {
  min: (c) => ({
    id: c.id,
    title: c.title,
    url: cardUrl(c),
    board_title: nested(c, "board")?.title ?? null,
    column_title: nested(c, "column")?.title ?? null,
    owner_name: nested(c, "owner")?.full_name ?? null,
    updated: c.updated,
    asap: c.asap ?? false,
    blocked: !!c.blocked,
  }),
  normal: (c) => ({
    id: c.id,
    title: c.title,
    url: cardUrl(c),
    created: c.created,
    updated: c.updated,
    state: c.state,
    condition: c.condition,
    owner_id: nested(c, "owner")?.id ?? null,
    owner_name: nested(c, "owner")?.full_name ?? null,
    board_id: c.board_id,
    board_title: nested(c, "board")?.title ?? null,
    column_id: c.column_id,
    column_title: nested(c, "column")?.title ?? null,
    lane_id: c.lane_id,
    lane_title: nested(c, "lane")?.title ?? null,
    type_id: c.type_id,
    type_name: nested(c, "type")?.name ?? null,
    tags: Array.isArray(c.tags)
      ? (c.tags as Obj[]).map((t) => t.name)
      : [],
    members: Array.isArray(c.members)
      ? (c.members as Obj[]).map(
        (m) => m.full_name ?? m.username,
      )
      : [],
    asap: c.asap ?? false,
    blocked: !!c.blocked,
    archived: !!c.archived,
    size: c.size ?? null,
    due_date: c.due_date ?? null,
  }),
  max: (c) => ({
    ...cardFns.normal(c),
    description: c.description ?? null,
    children: Array.isArray(c.children)
      ? (c.children as Obj[]).map(
        (ch) => cardFns.min(ch),
      )
      : [],
    checklists: c.checklists ?? [],
    blockers: c.blockers ?? [],
    external_links: c.external_links ?? [],
    properties: c.properties ?? {},
    sort_order: c.sort_order,
    comments_total: c.comments_total ?? 0,
  }),
};

export function simplifyCard(
  card: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(card, cardFns, v);
}

// ── Users ──────────────────────────────────

const userFns: SimplifyFns = {
  min: (u) => ({
    id: u.id,
    full_name: u.full_name,
  }),
  normal: (u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    username: u.username,
    activated: u.activated,
  }),
};

export function simplifyUser(
  user: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(user, userFns, v);
}

// ── Spaces ─────────────────────────────────

const spaceFns: SimplifyFns = {
  min: (s) => ({
    id: s.id,
    title: s.title,
  }),
  normal: (s) => ({
    id: s.id,
    title: s.title,
    archived: s.archived ?? false,
    access: s.access ?? null,
    company_id: s.company_id ?? null,
    sort_order: s.sort_order ?? null,
  }),
  // Kaiten /spaces/{id} response carries quite a lot of
  // metadata (settings, hidden card type uids, paths, …).
  // verbosity=max should expose all of it; the actual list
  // of boards is fetched separately via kaiten_list_boards.
  max: (s) => ({
    id: s.id,
    uid: s.uid ?? null,
    title: s.title,
    archived: s.archived ?? false,
    access: s.access ?? null,
    for_everyone_access_role_id:
      s.for_everyone_access_role_id ?? null,
    entity_type: s.entity_type ?? null,
    path: s.path ?? null,
    sort_order: s.sort_order ?? null,
    parent_entity_uid: s.parent_entity_uid ?? null,
    company_id: s.company_id ?? null,
    allowed_card_type_ids:
      s.allowed_card_type_ids ?? null,
    hidden_card_type_uids:
      s.hidden_card_type_uids ?? null,
    external_id: s.external_id ?? null,
    settings: s.settings ?? null,
    created: s.created ?? null,
    updated: s.updated ?? null,
  }),
};

export function simplifySpace(
  space: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(space, spaceFns, v);
}

// ── Boards ─────────────────────────────────

const boardFns: SimplifyFns = {
  min: (b) => ({
    id: b.id,
    title: b.title,
  }),
  normal: (b) => ({
    id: b.id,
    title: b.title,
    description: b.description ?? null,
    default_card_type_id: b.default_card_type_id ?? null,
    archived: b.archived ?? false,
    created: b.created ?? null,
    updated: b.updated ?? null,
  }),
  // Full board metadata: useful when an LLM needs to see
  // both the board attributes AND the inline columns/lanes
  // without making three round-trips.
  max: (b) => ({
    id: b.id,
    title: b.title,
    description: b.description ?? null,
    default_card_type_id: b.default_card_type_id ?? null,
    email_key: b.email_key ?? null,
    external_id: b.external_id ?? null,
    move_parents_to_done: b.move_parents_to_done ?? false,
    default_tags: b.default_tags ?? null,
    first_image_is_cover:
      b.first_image_is_cover ?? false,
    reset_lane_spent_time:
      b.reset_lane_spent_time ?? false,
    backward_moves_enabled:
      b.backward_moves_enabled ?? false,
    hide_done_policies: b.hide_done_policies ?? false,
    hide_done_policies_in_done_column:
      b.hide_done_policies_in_done_column ?? false,
    automove_cards: b.automove_cards ?? false,
    auto_assign_enabled: b.auto_assign_enabled ?? false,
    cell_wip_limits: b.cell_wip_limits ?? null,
    card_properties: b.card_properties ?? null,
    columns: Array.isArray(b.columns)
      ? (b.columns as Obj[]).map(
        (c) => simplifyColumn(c),
      )
      : null,
    lanes: Array.isArray(b.lanes)
      ? (b.lanes as Obj[]).map((l) => simplifyLane(l))
      : null,
    archived: b.archived ?? false,
    created: b.created ?? null,
    updated: b.updated ?? null,
  }),
};

export function simplifyBoard(
  board: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(board, boardFns, v);
}

// ── Comments ───────────────────────────────

// Some comment endpoints (notably create_comment /
// update_comment) return the author as flat fields
// (`author_id`, `author.full_name` may be missing) instead
// of a nested `author` object the way get_card_comments
// does. Fall back through both shapes so simplify never
// reports `author_name: null` when the data is actually
// present.
const commentFns: SimplifyFns = {
  min: (c) => ({
    id: c.id,
    author_name:
      nested(c, "author")?.full_name
      ?? c.author_name
      ?? null,
    created: c.created,
  }),
  normal: (c) => ({
    id: c.id,
    text: c.text,
    created: c.created,
    updated: c.updated,
    author_id:
      nested(c, "author")?.id
      ?? c.author_id
      ?? null,
    author_name:
      nested(c, "author")?.full_name
      ?? c.author_name
      ?? null,
  }),
};

export function simplifyComment(
  comment: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(comment, commentFns, v);
}

// ── Time-logs ──────────────────────────────

// Same shape inconsistency as comments: get_card_timelogs
// nests `author`, but create/update_timelog return
// `author_id` / `author_name` as flat fields. Fall back
// through both so verbosity=normal never silently shows
// `author_name: null`.
const timelogFns: SimplifyFns = {
  min: (l) => ({
    id: l.id,
    card_id: l.card_id,
    time_spent: l.time_spent,
    for_date: l.for_date,
  }),
  normal: (l) => ({
    id: l.id,
    card_id: l.card_id,
    time_spent: l.time_spent,
    comment: l.comment ?? null,
    for_date: l.for_date,
    created: l.created,
    updated: l.updated,
    author_id:
      nested(l, "author")?.id
      ?? l.author_id
      ?? l.user_id
      ?? null,
    author_name:
      nested(l, "author")?.full_name
      ?? l.author_name
      ?? null,
  }),
};

export function simplifyTimelog(
  log: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(log, timelogFns, v);
}

// ── Columns ────────────────────────────────

export function simplifyColumn(
  col: Obj, v: Verbosity = "min",
): Obj {
  if (v === "raw") return col;
  return {
    id: col.id,
    title: col.title,
    sort_order: col.sort_order,
    col_type: col.type ?? col.col_type,
  };
}

// ── Lanes ──────────────────────────────────

export function simplifyLane(
  lane: Obj, v: Verbosity = "min",
): Obj {
  if (v === "raw") return lane;
  return {
    id: lane.id,
    title: lane.title,
    sort_order: lane.sort_order,
    condition: lane.condition,
  };
}

// ── Generic list helper ────────────────────

export function simplifyList<T extends Obj>(
  items: unknown,
  fn: (item: T, v: Verbosity) => Obj,
  v: Verbosity = "min",
): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((item: T) => fn(item, v));
}
