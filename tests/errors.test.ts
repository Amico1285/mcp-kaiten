import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  jsonResult, textResult, formatApiError,
  handleTool,
} from "../src/utils/errors.js";

describe("jsonResult", () => {
  it("serializes data to JSON text", () => {
    const r = jsonResult({ id: 1, name: "test" });
    assert.equal(r.content.length, 1);
    assert.equal(r.content[0].type, "text");
    const parsed = JSON.parse(r.content[0].text);
    assert.equal(parsed.id, 1);
  });

  it("truncates large responses", () => {
    const big = "x".repeat(200_000);
    const r = jsonResult(big);
    assert.ok(
      r.content[0].text.includes("TRUNCATED"),
    );
    assert.ok(
      r.content[0].text.length < 200_000,
    );
  });
});

describe("textResult", () => {
  it("wraps string in content array", () => {
    const r = textResult("done");
    assert.equal(r.content[0].text, "done");
  });
});

describe("formatApiError", () => {
  it("formats Error instance", () => {
    const r = formatApiError(new Error("fail"));
    assert.equal(r.content[0].text, "fail");
    assert.equal(r.isError, true);
  });

  it("formats non-Error", () => {
    const r = formatApiError("string error");
    assert.equal(
      r.content[0].text, "string error",
    );
  });
});

describe("handleTool", () => {
  it("passes through successful result", async () => {
    const handler = handleTool(async () => {
      return textResult("ok");
    });
    const r = await handler({});
    assert.equal(r.content[0].text, "ok");
    assert.equal(
      (r as { isError?: boolean }).isError,
      undefined,
    );
  });

  it("catches errors and returns formatted",
    async () => {
      const handler = handleTool(async () => {
        throw new Error("boom");
      });
      const r = await handler({});
      assert.equal(r.content[0].text, "boom");
      assert.equal(
        (r as { isError: boolean }).isError, true,
      );
    },
  );
});
