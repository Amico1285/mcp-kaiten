import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function runInSubprocess(
  env: Record<string, string>,
  code: string,
): string {
  const script =
    `import("../src/config.js").then(m=>{${code}})`;
  const result = execFileSync(
    "node",
    [
      "--import", "tsx",
      "--eval", script,
      "--input-type=module",
    ],
    {
      cwd: import.meta.dirname,
      env: { ...process.env, ...env },
      encoding: "utf-8",
      timeout: 5000,
    },
  );
  return result.trim();
}

describe("config", () => {
  const BASE_ENV = {
    KAITEN_API_TOKEN: "test-token-123",
    KAITEN_URL: "https://test.kaiten.ru",
  };

  it("parses minimal valid env", () => {
    const out = runInSubprocess(
      BASE_ENV,
      `const c=m.getConfig();`
      + `console.log(JSON.stringify({`
      + `t:c.token,b:c.baseUrl,`
      + `d:c.defaultSpaceId,`
      + `r:c.requestTimeoutMs,`
      + `c:c.cacheTtlMs}))`,
    );
    const c = JSON.parse(out);
    assert.equal(c.t, "test-token-123");
    assert.equal(
      c.b,
      "https://test.kaiten.ru/api/latest",
    );
    assert.equal(c.d, undefined);
    assert.equal(c.r, 10_000);
    assert.equal(c.c, 300_000);
  });

  it("strips trailing slashes from URL", () => {
    const out = runInSubprocess(
      {
        ...BASE_ENV,
        KAITEN_URL: "https://test.kaiten.ru///",
      },
      `console.log(m.getBaseUrl())`,
    );
    assert.equal(
      out,
      "https://test.kaiten.ru/api/latest",
    );
  });

  it("parses optional env vars", () => {
    const out = runInSubprocess(
      {
        ...BASE_ENV,
        KAITEN_DEFAULT_SPACE_ID: "42",
        KAITEN_REQUEST_TIMEOUT_MS: "5000",
        KAITEN_CACHE_TTL_MS: "0",
      },
      `const c=m.getConfig();`
      + `console.log(JSON.stringify({`
      + `d:c.defaultSpaceId,`
      + `r:c.requestTimeoutMs,`
      + `c:c.cacheTtlMs}))`,
    );
    const c = JSON.parse(out);
    assert.equal(c.d, 42);
    assert.equal(c.r, 5000);
    assert.equal(c.c, 0);
  });

  it("ignores invalid KAITEN_DEFAULT_SPACE_ID",
    () => {
      const out = runInSubprocess(
        {
          ...BASE_ENV,
          KAITEN_DEFAULT_SPACE_ID: "not-a-number",
        },
        `console.log(`
        + `String(m.getDefaultSpaceId()))`,
      );
      assert.equal(out, "undefined");
    },
  );

  it("getBaseUrl / getDefaultSpaceId helpers", () => {
    const out = runInSubprocess(
      {
        ...BASE_ENV,
        KAITEN_DEFAULT_SPACE_ID: "7",
      },
      `console.log(JSON.stringify({`
      + `b:m.getBaseUrl(),`
      + `d:m.getDefaultSpaceId()}))`,
    );
    const c = JSON.parse(out);
    assert.equal(
      c.b,
      "https://test.kaiten.ru/api/latest",
    );
    assert.equal(c.d, 7);
  });

  it("exits on missing KAITEN_API_TOKEN", () => {
    assert.throws(
      () => runInSubprocess(
        { KAITEN_URL: "https://x.ru" },
        `m.getConfig()`,
      ),
      (err: { status?: number }) => {
        return err.status !== 0;
      },
    );
  });

  it("exits on missing KAITEN_URL", () => {
    assert.throws(
      () => runInSubprocess(
        { KAITEN_API_TOKEN: "tok" },
        `m.getConfig()`,
      ),
      (err: { status?: number }) => {
        return err.status !== 0;
      },
    );
  });
});
