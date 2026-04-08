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
  // verbosity=max exposes persistable user profile fields that
  // an LLM may legitimately want (lang/timezone for scheduling
  // hints, default_space_id for drill-down, avatar URLs for
  // UI surfaces). Deliberately excludes the giant base64
  // `avatar_uploaded_default_url` blob present in raw — use
  // verbosity=raw if you actually need that payload.
  max: (u) => ({
    id: u.id,
    uid: u.uid ?? null,
    full_name: u.full_name,
    email: u.email,
    username: u.username,
    activated: u.activated,
    virtual: u.virtual ?? false,
    lang: u.lang ?? null,
    timezone: u.timezone ?? null,
    theme: u.theme ?? null,
    company_id: u.company_id ?? null,
    default_space_id: u.default_space_id ?? null,
    avatar_type: u.avatar_type ?? null,
    avatar_url: u.avatar_url ?? null,
    avatar_initials_url: u.avatar_initials_url ?? null,
    created: u.created ?? null,
    updated: u.updated ?? null,
  }),
};

export function simplifyUser(
  user: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(user, userFns, v);
}

// ── Roles ──────────────────────────────────
//
// /user-roles returns global company role definitions —
// NOT per-space, NOT per-user. The previous inline mapper
// in users.ts read a phantom `r.space_id` that never exists
// in the response. Factored out here so that both `min` and
// `normal` emit real fields only (CC-11).

const roleFns: SimplifyFns = {
  min: (r) => ({
    id: r.id,
    name: r.name,
  }),
  normal: (r) => ({
    id: r.id,
    name: r.name,
    uid: r.uid ?? null,
    company_id: r.company_id ?? null,
    created: r.created ?? null,
    updated: r.updated ?? null,
  }),
};

export function simplifyRole(
  role: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(role, roleFns, v);
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
  // Intentionally a strict superset of normal; raw remains
  // the only passthrough with unlisted debug/back-office
  // fields the LLM doesn't usually need.
  max: (s) => ({
    id: s.id,
    uid: s.uid ?? null,
    title: s.title,
    key: s.key ?? null,
    archived: s.archived ?? false,
    access: s.access ?? null,
    "protected": s["protected"] ?? false,
    for_everyone_access_role_id:
      s.for_everyone_access_role_id ?? null,
    entity_type: s.entity_type ?? null,
    path: s.path ?? null,
    sort_order: s.sort_order ?? null,
    parent_entity_uid: s.parent_entity_uid ?? null,
    company_id: s.company_id ?? null,
    users_count: s.users_count ?? null,
    allowed_card_type_ids:
      s.allowed_card_type_ids ?? null,
    hidden_card_type_uids:
      s.hidden_card_type_uids ?? null,
    icon_type: s.icon_type ?? null,
    icon_value: s.icon_value ?? null,
    icon_color: s.icon_color ?? null,
    external_id: s.external_id ?? null,
    import_uid: s.import_uid ?? null,
    author_uid: s.author_uid ?? null,
    work_calendar_id: s.work_calendar_id ?? null,
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

// ── Author enrichment (comments / timelogs) ───
//
// POST/PATCH endpoints for comments and timelogs return only
// `author_id` — never the name and never a nested `author`
// object. When the author is the API caller (which is the
// common case for create/update), we substitute the cached
// current-user `full_name` so downstream consumers don't see
// `author_name: null` for things they just wrote themselves.
function pickAuthorId(obj: Obj): unknown {
  return nested(obj, "author")?.id
    ?? obj.author_id
    ?? obj.user_id;
}

function pickAuthorName(obj: Obj): unknown {
  return nested(obj, "author")?.full_name
    ?? obj.author_name;
}

export function enrichAuthor(
  obj: Obj, currentUser?: Obj | null,
): Obj {
  if (!currentUser) return obj;
  if (pickAuthorName(obj)) return obj;
  if (pickAuthorId(obj) !== currentUser.id) return obj;
  return { ...obj, author_name: currentUser.full_name };
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
  // verbosity=max surfaces everything useful for an audit
  // trail without the avatar bloat: who logged it (author),
  // which company role was booked against (role_id/role_name),
  // who later touched it (updater_id), and the external uid
  // for cross-ref. enrichAuthor is still applied BEFORE this
  // simplifier runs at the call site — we only read the shape
  // it leaves behind.
  max: (l) => ({
    id: l.id,
    uid: l.uid ?? null,
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
    user_id:
      nested(l, "user")?.id
      ?? l.user_id
      ?? null,
    updater_id:
      nested(l, "updater")?.id
      ?? l.updater_id
      ?? null,
    role_id:
      nested(l, "role")?.id
      ?? l.role_id
      ?? null,
    role_name:
      nested(l, "role")?.name
      ?? l.role_name
      ?? null,
  }),
};

export function simplifyTimelog(
  log: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(log, timelogFns, v);
}

// ── Columns ────────────────────────────────
//
// min/normal retain the historical 4-field shape so existing
// consumers see zero diff. max exposes the WIP/archive/rules
// metadata that lives on the raw column, plus a `board_id`
// cross-ref: the raw /boards/{id}/columns response does not
// carry board_id on each column (it's implicit in the URL),
// so callers can pass the owning board id explicitly via the
// optional 3rd arg (see spaces.ts list_columns handler).
const columnFns: SimplifyFns = {
  min: (c) => ({
    id: c.id,
    title: c.title,
    sort_order: c.sort_order,
    col_type: c.type ?? c.col_type,
  }),
  normal: (c) => ({
    id: c.id,
    title: c.title,
    sort_order: c.sort_order,
    col_type: c.type ?? c.col_type,
  }),
  max: (c) => ({
    id: c.id,
    uid: c.uid ?? null,
    title: c.title,
    sort_order: c.sort_order,
    col_type: c.type ?? c.col_type,
    condition: c.condition ?? null,
    color: c.color ?? null,
    wip_limit: c.wip_limit ?? null,
    archive_after_days: c.archive_after_days ?? null,
    rules: c.rules ?? null,
    board_id: c.board_id ?? null,
    created: c.created ?? null,
    updated: c.updated ?? null,
  }),
};

export function simplifyColumn(
  col: Obj, v: Verbosity = "min", boardId?: number,
): Obj {
  const out = dispatch(col, columnFns, v);
  // Only override board_id at max. min/normal intentionally
  // omit the field, and raw must be passed through untouched.
  if (
    v === "max"
    && boardId !== undefined
    && out
    && typeof out === "object"
  ) {
    (out as Obj).board_id = boardId;
  }
  return out;
}

// ── Lanes ──────────────────────────────────
//
// min/normal retain the historical 4-field shape. max adds
// the `default` flag (important: the "unnamed" default lane
// is identified by this flag, not an empty title — see
// list_lanes description), cell_wip_limits, external_id,
// uid and timestamps.
const laneFns: SimplifyFns = {
  min: (l) => ({
    id: l.id,
    title: l.title,
    sort_order: l.sort_order,
    condition: l.condition,
  }),
  normal: (l) => ({
    id: l.id,
    title: l.title,
    sort_order: l.sort_order,
    condition: l.condition,
  }),
  max: (l) => ({
    id: l.id,
    uid: l.uid ?? null,
    title: l.title,
    sort_order: l.sort_order,
    condition: l.condition,
    default: l.default ?? false,
    external_id: l.external_id ?? null,
    cell_wip_limits: l.cell_wip_limits ?? null,
    created: l.created ?? null,
    updated: l.updated ?? null,
  }),
};

export function simplifyLane(
  lane: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(lane, laneFns, v);
}

// ── Card types ─────────────────────────────
//
// /card-types is a global-per-company endpoint; the types
// Bug/Feature/Story etc. are shared across every board. min
// is intentionally terse ({id, name}) because that's the
// historical shape list_card_types emitted inline before
// this dispatch existed. normal adds the display attributes
// an LLM needs to pick one type; max surfaces the full type
// definition including card_properties / suggest_fields.
const cardTypeFns: SimplifyFns = {
  min: (t) => ({
    id: t.id,
    name: t.name,
  }),
  normal: (t) => ({
    id: t.id,
    name: t.name,
    color: t.color ?? null,
    letter: t.letter ?? null,
    archived: t.archived ?? false,
  }),
  max: (t) => ({
    id: t.id,
    uid: t.uid ?? null,
    name: t.name,
    color: t.color ?? null,
    letter: t.letter ?? null,
    archived: t.archived ?? false,
    locked: t.locked ?? false,
    properties: t.properties ?? null,
    card_properties: t.card_properties ?? null,
    suggest_fields: t.suggest_fields ?? null,
    description_template: t.description_template ?? null,
    company_id: t.company_id ?? null,
    author: t.author ?? null,
    created: t.created ?? null,
    updated: t.updated ?? null,
  }),
};

export function simplifyCardType(
  cardType: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(cardType, cardTypeFns, v);
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
