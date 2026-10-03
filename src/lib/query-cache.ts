/** Stale-while-revalidate cache for page data.
 *
 *  Pages used to fetch in a bare `useEffect`, so every navigation back to a
 *  page showed a skeleton and refetched from scratch. With this cache, a
 *  revisit renders the last result instantly and refreshes it in the
 *  background once it is older than `staleMs`. Concurrent requests for the same
 *  key share one in-flight promise, so two components that need the same list
 *  cost one round trip.
 *
 *  Entries are session-scoped: keys are not qualified by account, so the cache
 *  registers with `session-caches` and is dropped on logout or account switch.
 *
 *  Framework-free on purpose so it can be unit tested under `node --test`; the
 *  React binding lives in `hooks/useQuery.tsx`. */

import { registerSessionCache } from "./session-caches.ts";

export interface QueryEntry<T> {
  data: T | undefined;
  error: Error | undefined;
  /** `Date.now()` of the last successful fetch; 0 if never fetched. */
  updatedAt: number;
  /** In-flight fetch, shared by every caller of the same key. */
  promise: Promise<T> | undefined;
}

type Listener = () => void;

const entries = new Map<string, QueryEntry<unknown>>();
const listeners = new Map<string, Set<Listener>>();
/** Bumped on `clearQueryCache` so a fetch that started before a logout cannot
 *  write its result into the next session's cache. */
let generation = 0;

const EMPTY: QueryEntry<never> = Object.freeze({
  data: undefined,
  error: undefined,
  updatedAt: 0,
  promise: undefined,
});

function notify(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const l of set) l();
}

function setEntry(key: string, entry: QueryEntry<unknown>): void {
  entries.set(key, entry);
  notify(key);
}

/** Current snapshot for `key`. Returns a stable object until the entry changes,
 *  as `useSyncExternalStore` requires. */
export function getQueryEntry<T>(key: string): QueryEntry<T> {
  return (entries.get(key) as QueryEntry<T> | undefined) ?? EMPTY;
}

export function subscribeQuery(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

export function isStale(entry: QueryEntry<unknown>, staleMs: number, now = Date.now()): boolean {
  return entry.updatedAt === 0 || now - entry.updatedAt >= staleMs;
}

/** Fetch `key` with `fn`, deduplicating against an in-flight fetch for the same
 *  key. Keeps previous data visible while refetching; on failure the previous
 *  data is kept and `error` is set. */
export function fetchQuery<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const current = getQueryEntry<T>(key);
  if (current.promise) return current.promise;

  const startedIn = generation;
  const promise = fn().then(
    (data) => {
      if (startedIn === generation) {
        setEntry(key, { data, error: undefined, updatedAt: Date.now(), promise: undefined });
      }
      return data;
    },
    (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      if (startedIn === generation) {
        const prev = getQueryEntry<T>(key);
        setEntry(key, { ...prev, error, promise: undefined });
      }
      throw error;
    },
  );
  setEntry(key, { ...current, promise });
  return promise;
}

/** Overwrite the cached data for `key`, e.g. after a mutation whose response
 *  already contains the new state. */
export function setQueryData<T>(key: string, data: T): void {
  setEntry(key, { data, error: undefined, updatedAt: Date.now(), promise: undefined });
}

/** Mark every entry whose key starts with `prefix` as stale so the next read
 *  refetches. Data stays visible in the meantime. */
export function invalidateQueries(prefix: string): void {
  for (const [key, entry] of entries) {
    if (key.startsWith(prefix)) setEntry(key, { ...entry, updatedAt: 0 });
  }
}

export function clearQueryCache(): void {
  generation++;
  const keys = [...entries.keys()];
  entries.clear();
  for (const key of keys) notify(key);
}

registerSessionCache(clearQueryCache);
