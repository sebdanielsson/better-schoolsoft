/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite.
 *
 * Kept apart from schoolsoft.test.ts: logging out blocks cookie mints for the
 * rest of the page's (here: the process's) life, which would break the other
 * tests. Order matters within this file. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapSchoolsoftSession, endCookieSession } from "./schoolsoft.ts";
import { clearSessionCaches } from "../lib/session-caches.ts";

/* A mint still in flight at logout would re-plant the session cookie if its
 * response landed after the expiry, so the expiry must wait for it. */
void test("endCookieSession expires cookies only after in-flight mints settle", async () => {
  const realFetch = globalThis.fetch;
  const order: string[] = [];
  let releaseMint: (() => void) | null = null;
  globalThis.fetch = ((url: string) => {
    if (url.includes("/eva-apps/auth/login/parent")) {
      order.push("mint start");
      return new Promise<Response>((resolve) => {
        releaseMint = () => {
          order.push("mint end");
          resolve(new Response(null, { status: 200 }));
        };
      });
    }
    order.push(url.endsWith("/__logout") ? "logout" : url);
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;
  try {
    clearSessionCaches();
    const mint = bootstrapSchoolsoftSession("s", "t", 1, 2, 100);
    await Promise.resolve();
    const logout = endCookieSession("s");
    clearSessionCaches();
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(order, ["mint start"], "logout waits for the mint");
    releaseMint!();
    await mint;
    await logout;
    assert.deepEqual(order, ["mint start", "mint end", "logout"]);
  } finally {
    globalThis.fetch = realFetch;
    clearSessionCaches();
  }
});

/* An effect that resumes after logout (e.g. from awaiting getEvaToken) must
 * not mint, or it would plant the session cookie again after __logout. */
void test("no cookie mint starts after logout", async () => {
  const realFetch = globalThis.fetch;
  let mints = 0;
  globalThis.fetch = (() => {
    mints++;
    return Promise.resolve(new Response(null, { status: 200 }));
  }) as typeof fetch;
  try {
    await endCookieSession("s");
    mints = 0;
    clearSessionCaches();
    await assert.rejects(bootstrapSchoolsoftSession("s", "t", 1, 2, 100), /Signed out/);
    assert.equal(mints, 0);
  } finally {
    globalThis.fetch = realFetch;
    clearSessionCaches();
  }
});
