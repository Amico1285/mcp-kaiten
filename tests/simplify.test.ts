import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.KAITEN_API_TOKEN = "test";
process.env.KAITEN_URL = "https://test.kaiten.ru";

import {
  simplifyCard, simplifyUser, simplifySpace,
  simplifyBoard, simplifyComment, simplifyTimelog,
  simplifyColumn, simplifyLane, simplifyList,
} from "../src/utils/simplify.js";

const CARD = {
  id: 123,
  title: "Test card",
  created: "2026-01-01",
  updated: "2026-03-01",
  state: 2,
  condition: 1,
  board_id: 10,
  column_id: 20,
  lane_id: 30,
  type_id: 40,
  asap: true,
  blocked: false,
  archived: false,
  size: 5,
  due_date: "2026-04-01",
  description: "<p>Desc</p>",
  checklists: [{ name: "CL" }],
  blockers: [],
  external_links: [],
  properties: {},
  sort_order: 1,
  comments_total: 3,
  space_id: 99,
  board: { title: "Board", space_id: 99 },
  column: { title: "In Progress" },
  lane: { title: "Lane 1" },
  owner: { id: 7, full_name: "Ivan" },
  type: { name: "Bug" },
  tags: [{ name: "urgent" }],
  members: [
    { full_name: "Ivan" },
    { username: "petya" },
  ],
  extra_field: "should be dropped",
};

describe("simplifyCard", () => {
  it("min — 9 fields", () => {
    const r = simplifyCard(CARD, "min");
    assert.equal(r.id, 123);
    assert.equal(r.title, "Test card");
    assert.equal(r.board_title, "Board");
    assert.equal(r.column_title, "In Progress");
    assert.equal(r.owner_name, "Ivan");
    assert.equal(r.asap, true);
    assert.equal(r.blocked, false);
    assert.ok(
      (r.url as string).includes("/card/123"),
    );
    assert.equal(
      Object.keys(r).length, 9,
    );
  });

  it("normal — includes tags, members", () => {
    const r = simplifyCard(CARD, "normal");
    assert.deepEqual(r.tags, ["urgent"]);
    assert.deepEqual(
      r.members, ["Ivan", "petya"],
    );
    assert.equal(r.lane_title, "Lane 1");
    assert.equal(r.type_name, "Bug");
    assert.equal(r.size, 5);
    assert.equal(
      (r as Record<string, unknown>)
        .extra_field,
      undefined,
    );
  });

  it("max — includes description, checklists",
    () => {
      const r = simplifyCard(CARD, "max");
      assert.equal(r.description, "<p>Desc</p>");
      assert.deepEqual(
        r.checklists, [{ name: "CL" }],
      );
      assert.equal(r.comments_total, 3);
    },
  );

  it("raw — returns original object", () => {
    const r = simplifyCard(CARD, "raw");
    assert.equal(r.extra_field, "should be dropped");
  });
});

describe("simplifyUser", () => {
  const USER = {
    id: 1, full_name: "Ivan",
    email: "i@x.ru", username: "ivan",
    activated: true, extra: "x",
  };

  it("min — id + full_name", () => {
    const r = simplifyUser(USER, "min");
    assert.equal(Object.keys(r).length, 2);
  });

  it("normal — includes email, username", () => {
    const r = simplifyUser(USER, "normal");
    assert.equal(r.email, "i@x.ru");
    assert.equal(r.activated, true);
  });
});

describe("simplifySpace", () => {
  const SPACE = {
    id: 1, title: "S", archived: false,
    boards: [{ id: 10, title: "B", extra: 1 }],
  };

  it("min — id + title", () => {
    const r = simplifySpace(SPACE, "min");
    assert.equal(Object.keys(r).length, 2);
  });

  it("normal — includes boards summary", () => {
    const r = simplifySpace(SPACE, "normal");
    const boards = r.boards as { id: number }[];
    assert.equal(boards.length, 1);
    assert.equal(boards[0].id, 10);
    assert.equal(
      (boards[0] as Record<string, unknown>).extra,
      undefined,
    );
  });
});

describe("simplifyBoard", () => {
  it("normal — includes space_id", () => {
    const r = simplifyBoard(
      { id: 1, title: "B", space_id: 5,
        archived: false },
      "normal",
    );
    assert.equal(r.space_id, 5);
  });
});

describe("simplifyComment", () => {
  const COMMENT = {
    id: 1, text: "Hello", created: "2026-01-01",
    updated: "2026-01-02",
    author: { id: 7, full_name: "Ivan" },
  };

  it("min — id, author_name, created", () => {
    const r = simplifyComment(COMMENT, "min");
    assert.equal(r.author_name, "Ivan");
    assert.equal(Object.keys(r).length, 3);
  });

  it("normal — includes text", () => {
    const r = simplifyComment(COMMENT, "normal");
    assert.equal(r.text, "Hello");
    assert.equal(r.author_id, 7);
  });
});

describe("simplifyTimelog", () => {
  const LOG = {
    id: 1, card_id: 10, time_spent: 60,
    for_date: "2026-03-01", comment: "work",
    created: "2026-03-01", updated: "2026-03-01",
    author: { id: 7, full_name: "Ivan" },
  };

  it("min — 4 fields", () => {
    const r = simplifyTimelog(LOG, "min");
    assert.equal(Object.keys(r).length, 4);
    assert.equal(r.time_spent, 60);
  });

  it("normal — includes author", () => {
    const r = simplifyTimelog(LOG, "normal");
    assert.equal(r.author_name, "Ivan");
    assert.equal(r.comment, "work");
  });
});

describe("simplifyColumn / simplifyLane", () => {
  it("column — id, title, sort_order, type", () => {
    const r = simplifyColumn(
      { id: 1, title: "C", sort_order: 0,
        type: 1, extra: "x" },
      "min",
    );
    assert.equal(r.col_type, 1);
    assert.equal(
      (r as Record<string, unknown>).extra,
      undefined,
    );
  });

  it("lane — id, title, sort_order, condition",
    () => {
      const r = simplifyLane(
        { id: 1, title: "L", sort_order: 0,
          condition: 1 },
        "normal",
      );
      assert.equal(r.condition, 1);
    },
  );
});

describe("simplifyList", () => {
  it("maps array through simplify fn", () => {
    const items = [
      { id: 1, full_name: "A", extra: "x" },
      { id: 2, full_name: "B", extra: "y" },
    ];
    const result = simplifyList(
      items, simplifyUser, "min",
    ) as Record<string, unknown>[];
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 1);
    assert.equal(
      (result[0] as Record<string, unknown>).extra,
      undefined,
    );
  });

  it("returns non-array as-is", () => {
    const result = simplifyList(
      "not-array", simplifyUser, "min",
    );
    assert.equal(result, "not-array");
  });
});
