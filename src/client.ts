import { getToken, getBaseUrl, getConfig } from "./config.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RETRYABLE_STATUSES = new Set(
  [408, 429, 500, 502, 503, 504],
);

export class KaitenApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(
      `Kaiten API ${status}${hint(status)}: ${body}`,
    );
    this.name = "KaitenApiError";
  }
}

function hint(status: number): string {
  switch (status) {
    case 401: return " (token expired or invalid)";
    case 403: return " (access denied)";
    case 404: return " (not found)";
    case 409: return " (conflict)";
    case 422: return " (validation error)";
    case 429: return " (rate limited, retry later)";
    case 502: return " (server unavailable)";
    case 503: return " (service unavailable)";
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
  const token = getToken();
  const base = getBaseUrl();
  const { requestTimeoutMs } = getConfig();

  let url = `${base}${path}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let lastError: Error | undefined;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    const ac = new AbortController();
    const timer = setTimeout(
      () => ac.abort(), requestTimeoutMs,
    );

    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });

      clearTimeout(timer);

      if (resp.ok) {
        if (resp.status === 204) return {} as T;
        return await resp.json() as T;
      }

      const text = await resp.text();

      if (
        attempt < MAX_RETRIES
        && shouldRetry(resp.status)
      ) {
        const delay = getRetryDelay(attempt, resp);
        console.error(
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
        console.error(
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
          + `${requestTimeoutMs}ms`,
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

export function del<T = void>(
  path: string,
): Promise<T> {
  return request<T>("DELETE", path);
}
