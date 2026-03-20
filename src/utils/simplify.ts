import { z } from "zod";

import { getBaseUrl } from "../config.js";

type Obj = Record<string, unknown>;

export type Verbosity = "raw" | "min" | "normal" | "max";

export const verbositySchema = z
  .enum(["raw", "min", "normal", "max"])
  .default("min")
  .describe(
    "Response detail level: "
    + "raw=full API response, "
    + "min=compact (default, saves context), "
    + "normal=useful fields, "
    + "max=normal + description/HTML",
  );

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
    archived: s.archived,
    boards: Array.isArray(s.boards)
      ? (s.boards as Obj[]).map((b) => ({
        id: b.id,
        title: b.title,
      }))
      : [],
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
    space_id: b.space_id,
    archived: b.archived,
  }),
};

export function simplifyBoard(
  board: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(board, boardFns, v);
}

// ── Comments ───────────────────────────────

const commentFns: SimplifyFns = {
  min: (c) => ({
    id: c.id,
    author_name: nested(c, "author")?.full_name ?? null,
    created: c.created,
  }),
  normal: (c) => ({
    id: c.id,
    text: c.text,
    created: c.created,
    updated: c.updated,
    author_id: nested(c, "author")?.id ?? null,
    author_name: nested(c, "author")?.full_name ?? null,
  }),
};

export function simplifyComment(
  comment: Obj, v: Verbosity = "min",
): Obj {
  return dispatch(comment, commentFns, v);
}

// ── Time-logs ──────────────────────────────

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
      nested(l, "author")?.id ?? l.user_id ?? null,
    author_name:
      nested(l, "author")?.full_name ?? null,
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
