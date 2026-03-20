import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.KAITEN_API_TOKEN = "test";
process.env.KAITEN_URL = "https://test.kaiten.ru";
process.env.KAITEN_CACHE_TTL_MS = "100";

import {
  spacesCache, boardsCache, usersCache,
  invalidateAllCaches,
} from "../src/utils/cache.js";

describe("TtlCache", () => {
  beforeEach(() => invalidateAllCaches());

  it("returns undefined for missing key", () => {
    assert.equal(
      spacesCache.get("missing"), undefined,
    );
  });

  it("stores and retrieves value", () => {
    spacesCache.set("k1", { id: 1 });
    assert.deepEqual(
      spacesCache.get("k1"), { id: 1 },
    );
  });

  it("expires after TTL", async () => {
    spacesCache.set("k2", "data");
    await new Promise(
      (r) => setTimeout(r, 150),
    );
    assert.equal(spacesCache.get("k2"), undefined);
  });

  it("invalidate clears all entries", () => {
    spacesCache.set("a", 1);
    spacesCache.set("b", 2);
    spacesCache.invalidate();
    assert.equal(spacesCache.get("a"), undefined);
    assert.equal(spacesCache.get("b"), undefined);
  });

  it("invalidateAllCaches clears all stores", () => {
    spacesCache.set("s", 1);
    boardsCache.set("b", 2);
    usersCache.set("u", 3);
    invalidateAllCaches();
    assert.equal(spacesCache.get("s"), undefined);
    assert.equal(boardsCache.get("b"), undefined);
    assert.equal(usersCache.get("u"), undefined);
  });

  it("getOrFetch caches the result", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return [{ id: 1 }];
    };

    const r1 = await spacesCache.getOrFetch(
      "spaces", fetcher,
    );
    const r2 = await spacesCache.getOrFetch(
      "spaces", fetcher,
    );
    assert.deepEqual(r1, [{ id: 1 }]);
    assert.deepEqual(r2, [{ id: 1 }]);
    assert.equal(calls, 1);
  });
});
