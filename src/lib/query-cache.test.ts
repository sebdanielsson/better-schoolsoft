/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearQueryCache,
  fetchQuery,
  getQueryEntry,
  invalidateQueries,
  isStale,
  setQueryData,
  subscribeQuery,
} from "./query-cache.ts";
import { clearSessionCaches } from "./session-caches.ts";

void test("stores fetched data", async () => {
  clearQueryCache();
  assert.equal(await fetchQuery("a", () => Promise.resolve(1)), 1);
  const entry = getQueryEntry<number>("a");
  assert.equal(entry.data, 1);
  assert.equal(entry.promise, undefined);
  assert.ok(entry.updatedAt > 0);
});

void test("deduplicates concurrent fetches for the same key", async () => {
  clearQueryCache();
  let calls = 0;
  const fn = () => {
    calls++;
    return Promise.resolve("x");
  };
  const [a, b] = await Promise.all([fetchQuery("k", fn), fetchQuery("k", fn)]);
  assert.equal(a, "x");
  assert.equal(b, "x");
  assert.equal(calls, 1);
});

void test("keeps previous data when a refetch fails", async () => {
  clearQueryCache();
  await fetchQuery("k", () => Promise.resolve("old"));
  await assert.rejects(() => fetchQuery("k", () => Promise.reject(new Error("boom"))), /boom/);
  const entry = getQueryEntry<string>("k");
  assert.equal(entry.data, "old");
  assert.equal(entry.error?.message, "boom");
});

void test("a successful refetch clears the error", async () => {
  clearQueryCache();
  await assert.rejects(() => fetchQuery("k", () => Promise.reject(new Error("boom"))));
  await fetchQuery("k", () => Promise.resolve(2));
  assert.equal(getQueryEntry("k").error, undefined);
});

void test("snapshot identity is stable until the entry changes", async () => {
  clearQueryCache();
  await fetchQuery("k", () => Promise.resolve(1));
  assert.equal(getQueryEntry("k"), getQueryEntry("k"));
});

void test("notifies subscribers on change and stops after unsubscribe", async () => {
  clearQueryCache();
  let hits = 0;
  const off = subscribeQuery("k", () => {
    hits++;
  });
  await fetchQuery("k", () => Promise.resolve(1));
  /* One notification when the fetch starts, one when it settles. */
  assert.equal(hits, 2);
  off();
  setQueryData("k", 2);
  assert.equal(hits, 2);
});

void test("isStale respects staleMs and never-fetched entries", () => {
  assert.equal(isStale(getQueryEntry("never"), 1000), true);
  const entry = { data: 1, error: undefined, updatedAt: 1000, promise: undefined };
  assert.equal(isStale(entry, 500, 1400), false);
  assert.equal(isStale(entry, 500, 1500), true);
});

void test("invalidateQueries marks matching keys stale but keeps data", () => {
  clearQueryCache();
  setQueryData("rooms:1", "a");
  setQueryData("other", "b");
  invalidateQueries("rooms:");
  assert.equal(getQueryEntry("rooms:1").updatedAt, 0);
  assert.equal(getQueryEntry("rooms:1").data, "a");
  assert.ok(getQueryEntry("other").updatedAt > 0);
});

void test("a fetch that settles after a clear does not repopulate the cache", async () => {
  clearQueryCache();
  let resolve!: (v: string) => void;
  const pending = fetchQuery("k", () => new Promise<string>((r) => (resolve = r)));
  clearQueryCache();
  resolve("stale session data");
  await pending;
  assert.equal(getQueryEntry("k").data, undefined);
});

void test("is cleared with the other session caches on logout", () => {
  setQueryData("k", 1);
  clearSessionCaches();
  assert.equal(getQueryEntry("k").data, undefined);
});
