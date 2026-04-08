import { randomUUID } from "node:crypto";
import { getConfig } from "./config.js";
import { logger } from "./utils/logger.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RETRYABLE_STATUSES = new Set(
  [408, 429, 500, 502, 503, 504],
);
const IDEMPOTENT_METHODS = new Set(
  ["POST", "PATCH", "PUT"],
);

export class KaitenApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(
      `Kaiten API ${status}${hint(status, url)}: ${body}`,
    );
    this.name = "KaitenApiError";
  }
}

// Map Kaiten URL patterns to family-specific recovery tools.
// First match wins. The fallback at the end covers everything
// not in the table. Patterns are anchored on the resource segment
// (e.g. /cards/{id}/comments) so that nested paths route to the
// nearest list tool.
//
// Used by hint() for 404/403 messages so that the LLM is told
// which list tool to call to verify the offending ID, instead of
// the previous static "kaiten_search_cards or kaiten_list_spaces"
// which was wrong for almost every non-card resource.
const RECOVERY_TOOLS: Array<[RegExp, string]> = [
  [/\/cards\/\d+\/comments\b/, "kaiten_get_card_comments"],
  [
    /\/cards\/\d+\/checklists\b/,
    "kaiten_get_checklist or kaiten_get_card(verbosity=max)",
  ],
  [/\/cards\/\d+\/files\b/, "kaiten_list_files"],
  [/\/cards\/\d+\/time-logs\b/, "kaiten_get_card_timelogs"],
  [/\/cards\/\d+\/tags\b/, "kaiten_list_card_tags"],
  [/\/cards\/\d+\/children\b/, "kaiten_list_subtasks"],
  [/\/cards\/\d+\/members\b/, "kaiten_list_card_members"],
  [/\/cards\/\d+\/blockers\b/, "kaiten_list_card_blockers"],
  [
    /\/cards\b/,
    "kaiten_search_cards or kaiten_get_card",
  ],
  [/\/users\/\d+\/time-logs\b/, "kaiten_get_user_timelogs"],
  [/\/spaces\/\d+\/boards\b/, "kaiten_list_boards"],
  [/\/spaces\/\d+\/users\b/, "kaiten_list_space_users"],
  [/\/spaces\b/, "kaiten_list_spaces"],
  [/\/boards\/\d+\/columns\b/, "kaiten_list_columns"],
  [/\/boards\/\d+\/lanes\b/, "kaiten_list_lanes"],
  [/\/boards\b/, "kaiten_list_boards"],
  [/\/checklists\/\d+\/items\b/, "kaiten_get_checklist"],
  [/\/card-types\b/, "kaiten_list_card_types"],
  [
    /\/company\/custom-properties\b/,
    "kaiten_list_custom_properties",
  ],
  [/\/user-roles\b/, "kaiten_list_company_roles"],
  [/\/users\b/, "kaiten_list_users"],
  [/\/tags\b/, "kaiten_list_workspace_tags"],
];

function recoveryToolFor(url: string): string {
  for (const [pattern, tool] of RECOVERY_TOOLS) {
    if (pattern.test(url)) return tool;
  }
  return "the relevant kaiten_list_* / kaiten_search_cards tool";
}

function hint(status: number, url: string): string {
  const recovery = recoveryToolFor(url);
  switch (status) {
    case 401:
      return " (token expired or invalid). "
        + "Regenerate at Profile → API Key";
    case 403:
      // Kaiten returns 403 for both genuine permission denials
      // AND non-existent IDs. Surface both possibilities so the
      // LLM picks the right recovery path instead of always
      // suggesting "fix permissions".
      return " (access denied or ID not found). "
        + `Check space/board permissions, OR verify the ID via ${recovery}`;
    case 404:
      return ` (not found). Verify the ID via ${recovery}`;
    case 409:
      return " (conflict). Resource was modified "
        + "concurrently, re-read and retry";
    case 422:
      return " (validation error). "
        + "Check required fields and value formats";
    case 429:
      return " (rate limited). Retry in a moment";
    case 502:
      return " (server unavailable). "
        + "Check VPN connection and host availability";
    case 503:
      return " (service unavailable). "
        + "Kaiten may be under maintenance";
    default: return "";
  }
}

function shouldRetry(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function getRetryDelay(
  attempt: number,
  resp?: Response,
): number {
  const retryAfter = resp?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  const jitter = Math.random() * 500;
  return BASE_DELAY_MS * Math.pow(2, attempt) + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<T> {
  const cfg = getConfig();

  let url = `${cfg.baseUrl}${path}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${cfg.token}`,
    "Content-Type": "application/json",
  };

  if (IDEMPOTENT_METHODS.has(method)) {
    headers["X-Idempotency-Key"] = randomUUID();
  }

  let lastError: Error | undefined;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    const ac = new AbortController();
    const timer = setTimeout(
      () => ac.abort(), cfg.requestTimeoutMs,
    );

    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });

      if (resp.ok) {
        const result = resp.status === 204
          ? {} as T
          : await resp.json() as T;
        clearTimeout(timer);
        logger.debug(
          `${method} ${path} → ${resp.status}`,
        );
        return result;
      }

      const text = await resp.text();
      clearTimeout(timer);

      if (
        attempt < MAX_RETRIES
        && shouldRetry(resp.status)
      ) {
        const delay = getRetryDelay(attempt, resp);
        logger.warn(
          `Retry ${attempt + 1}/${MAX_RETRIES}`
          + ` ${method} ${path} → ${resp.status}`
          + ` (wait ${Math.round(delay)}ms)`,
        );
        await sleep(delay);
        continue;
      }

      throw new KaitenApiError(
        resp.status, text, url,
      );
    } catch (error) {
      clearTimeout(timer);

      if (error instanceof KaitenApiError) {
        throw error;
      }

      const isTimeout =
        error instanceof DOMException
        && error.name === "AbortError";

      if (attempt < MAX_RETRIES) {
        const delay = getRetryDelay(attempt);
        const reason = isTimeout
          ? "timeout" : "network error";
        logger.warn(
          `Retry ${attempt + 1}/${MAX_RETRIES}`
          + ` ${method} ${path} → ${reason}`
          + ` (wait ${Math.round(delay)}ms)`,
        );
        await sleep(delay);
        lastError = error as Error;
        continue;
      }

      if (isTimeout) {
        throw new KaitenApiError(
          0,
          `Request timed out after `
          + `${cfg.requestTimeoutMs}ms`,
          url,
        );
      }

      throw lastError ?? error;
    }
  }

  throw lastError
    ?? new Error("Unexpected retry loop exit");
}

export function get<T>(
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  return request<T>("GET", path, undefined, query);
}

export function post<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>("POST", path, body);
}

export function patch<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function put<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>("PUT", path, body);
}

export function del<T = void>(
  path: string,
): Promise<T> {
  return request<T>("DELETE", path);
}

export async function uploadFile<T>(
  path: string,
  fileName: string,
  contentBase64: string,
  contentType: string,
): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.baseUrl}${path}`;

  const buf = Buffer.from(contentBase64, "base64");
  const blob = new Blob([buf], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.token}`,
    },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new KaitenApiError(resp.status, text, url);
  }

  return resp.json() as Promise<T>;
}
