/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCachedStaffDetail, preloadStaffDetail } from "./staff-cache.ts";
import { clearSessionCaches } from "./session-caches.ts";

void test("staff details are cached per org, since teacherId is only unique within one", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((url: string) => {
    const org = /schools\/(\d+)\/staff/.exec(String(url))?.[1];
    return Promise.resolve(
      new Response(JSON.stringify({ teacherId: 7, firstName: `org${org}`, roles: [] }), {
        status: 200,
      }),
    );
  }) as typeof fetch;
  try {
    clearSessionCaches();
    await preloadStaffDetail("s", "t", 21, 7);
    await preloadStaffDetail("s", "t", 42, 7);
    assert.equal(getCachedStaffDetail(21, 7)?.firstName, "org21");
    assert.equal(getCachedStaffDetail(42, 7)?.firstName, "org42");
    clearSessionCaches();
    assert.equal(getCachedStaffDetail(21, 7), undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});

void test("a staff fetch that settles after logout does not refill the cache", async () => {
  const realFetch = globalThis.fetch;
  let release!: () => void;
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      release = () =>
        resolve(new Response(JSON.stringify({ teacherId: 7, firstName: "old" }), { status: 200 }));
    })) as typeof fetch;
  try {
    clearSessionCaches();
    const pending = preloadStaffDetail("s", "t", 21, 7);
    await new Promise((r) => setTimeout(r, 0));
    clearSessionCaches();
    release();
    await pending;
    assert.equal(getCachedStaffDetail(21, 7), undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});
