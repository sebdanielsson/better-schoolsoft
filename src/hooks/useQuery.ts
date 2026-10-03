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

  /* Fetch whenever nothing is in flight and the entry is stale, without a
   * standing error. Depending on this flag (rather than on updatedAt) also
   * covers an invalidation that abandoned the very first fetch: the promise
   * is cleared, the flag flips back to true, and the effect runs again. An
   * error keeps the flag false, so failures don't retry in a loop. */
  const needsFetch = !!key && !entry.promise && !entry.error && isStale(entry, staleMs);
  useEffect(() => {
    if (!key || !needsFetch) return;
    /* Errors land in the entry; nothing to do with the rejection here. */
    fetchQuery(key, () => fnRef.current()).catch(() => {});
  }, [key, needsFetch]);

  /* On mount (or key change) also retry an entry that previously failed, so
   * navigating back to a page recovers from a transient error. Runs once per
   * mount, so it can't loop. */
  useEffect(() => {
    if (!key) return;
    const current = getQueryEntry<T>(key);
    if (current.error && !current.promise && isStale(current, staleMs)) {
      fetchQuery(key, () => fnRef.current()).catch(() => {});
    }
  }, [key, staleMs]);

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
