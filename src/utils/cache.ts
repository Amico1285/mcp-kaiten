import { getConfig } from "../config.js";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    const ttl = getConfig().cacheTtlMs;
    if (ttl <= 0) return;

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  async getOrFetch<R extends T>(
    key: string,
    fetcher: () => Promise<R>,
  ): Promise<R> {
    const hit = this.get(key) as R | undefined;
    if (hit !== undefined) return hit;

    const data = await fetcher();
    this.set(key, data);
    return data;
  }

  invalidate(): void {
    this.store.clear();
  }
}

export const spacesCache = new TtlCache<unknown>();
export const boardsCache = new TtlCache<unknown>();
export const usersCache = new TtlCache<unknown>();

export function invalidateAllCaches(): void {
  spacesCache.invalidate();
  boardsCache.invalidate();
  usersCache.invalidate();
}
