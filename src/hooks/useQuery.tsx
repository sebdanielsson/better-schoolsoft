import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import {
  fetchQuery,
  getQueryEntry,
  isStale,
  subscribeQuery,
  type QueryEntry,
} from "../lib/query-cache.ts";

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | undefined;
  /** True only when there is no data yet. Background refreshes keep showing the
   *  cached data, so they don't flip this. */
  loading: boolean;
  /** True while any fetch, including a background refresh, is in flight. */
  fetching: boolean;
  refetch: () => Promise<T | undefined>;
}

const NO_KEY = "\u0000none";
const noopSubscribe = () => () => {};

/** Read `key` from the query cache, fetching with `fn` when missing or older
 *  than `staleMs`. Pass `key: null` while prerequisites (session, child) are
 *  still loading.
 *
 *  `fn` is read through a ref, so callers can pass an inline closure without
 *  re-triggering the fetch. The key must therefore capture every input `fn`
 *  depends on. */
export function useQuery<T>(
  key: string | null,
  fn: () => Promise<T>,
  { staleMs = 60_000 }: { staleMs?: number } = {},
): QueryResult<T> {
  const fnRef = useRef(fn);
  /* Layout effect so the ref is current before the fetch effect below runs. */
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  const subscribe = useCallback(
    (cb: () => void) => (key ? subscribeQuery(key, cb) : noopSubscribe()),
    [key],
  );
  const entry: QueryEntry<T> = useSyncExternalStore(subscribe, () =>
    getQueryEntry<T>(key ?? NO_KEY),
  );

  /* Re-run when the entry is invalidated (updatedAt drops to 0), so pages
   * already on screen pick up changes after a mutation. A failed fetch leaves
   * updatedAt alone, so errors don't retry in a loop. */
  const updatedAt = entry.updatedAt;
  useEffect(() => {
    if (!key) return;
    const current = getQueryEntry<T>(key);
    if (current.promise || !isStale(current, staleMs)) return;
    /* Errors land in the entry; nothing to do with the rejection here. */
    fetchQuery(key, () => fnRef.current()).catch(() => {});
  }, [key, staleMs, updatedAt]);

  const refetch = useCallback(async () => {
    if (!key) return undefined;
    return fetchQuery(key, () => fnRef.current()).catch(() => undefined);
  }, [key]);

  return {
    data: entry.data,
    error: entry.error,
    loading: entry.data === undefined && !entry.error,
    fetching: entry.promise !== undefined,
    refetch,
  };
}
