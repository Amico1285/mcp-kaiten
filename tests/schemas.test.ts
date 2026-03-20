import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildOptionalBody, addOptionalParams,
} from "../src/utils/schemas.js";

describe("buildOptionalBody", () => {
  it("includes only defined values", () => {
    const body = buildOptionalBody([
      ["title", "Test"],
      ["description", undefined],
      ["size", 0],
      ["asap", false],
    ]);
    assert.deepEqual(body, {
      title: "Test",
      size: 0,
      asap: false,
    });
  });

  it("returns empty object for all undefined",
    () => {
      const body = buildOptionalBody([
        ["a", undefined],
        ["b", undefined],
      ]);
      assert.deepEqual(body, {});
    },
  );
});

describe("addOptionalParams", () => {
  it("adds string, number, boolean params", () => {
    const q: Record<string, string> = {};
    addOptionalParams(
      q,
      [["query", "test"], ["empty", undefined]],
      [["board_id", 42], ["skip", undefined]],
      [["asap", true], ["archived", undefined]],
    );
    assert.deepEqual(q, {
      query: "test",
      board_id: "42",
      asap: "true",
    });
  });

  it("handles all undefined gracefully", () => {
    const q: Record<string, string> = {};
    addOptionalParams(
      q,
      [["a", undefined]],
      [["b", undefined]],
      [["c", undefined]],
    );
    assert.deepEqual(q, {});
  });
});
