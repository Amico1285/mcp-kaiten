import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.KAITEN_API_TOKEN = "test-token";
process.env.KAITEN_URL = "https://test.kaiten.ru";
process.env.KAITEN_REQUEST_TIMEOUT_MS = "2000";

import { KaitenApiError } from "../src/client.js";

describe("KaitenApiError", () => {
  it("includes status and hint in message", () => {
    const err = new KaitenApiError(
      401, "Unauthorized", "https://x/api/latest/y",
    );
    assert.ok(err.message.includes("401"));
    assert.ok(
      err.message.includes("token expired"),
    );
    assert.equal(err.status, 401);
    assert.equal(err.name, "KaitenApiError");
  });

  it("hint for 404", () => {
    const err = new KaitenApiError(
      404, "Not Found", "/cards/999",
    );
    assert.ok(err.message.includes("not found"));
  });

  it("hint for 502", () => {
    const err = new KaitenApiError(
      502, "Bad Gateway", "/spaces",
    );
    assert.ok(
      err.message.includes("server unavailable"),
    );
  });

  it("no hint for unknown status", () => {
    const err = new KaitenApiError(
      418, "Teapot", "/tea",
    );
    assert.ok(!err.message.includes("("));
  });

  it("hint for 429", () => {
    const err = new KaitenApiError(
      429, "Too Many", "/cards",
    );
    assert.ok(
      err.message.includes("rate limited"),
    );
  });

  it("timeout error with status 0", () => {
    const err = new KaitenApiError(
      0, "Request timed out after 10000ms", "/x",
    );
    assert.equal(err.status, 0);
    assert.ok(
      err.message.includes("timed out"),
    );
  });
});
