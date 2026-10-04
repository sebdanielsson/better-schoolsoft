/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acquireCookieFocus,
  bootstrapSchoolsoftSession,
  cookieSessionFocus,
  endCookieSession,
  fetchHolisticAssessments,
  fetchScheduleLessons,
} from "./schoolsoft.ts";
import { clearSessionCaches } from "../lib/session-caches.ts";
import { isoWeek } from "../lib/dates.ts";

void test("isoWeek matches known ISO week numbers", () => {
  assert.equal(isoWeek(new Date(2026, 0, 1)), 1);
  assert.equal(isoWeek(new Date(2026, 11, 31)), 53);
});

void test("bootstrapSchoolsoftSession runs re-focus exchanges one at a time", async () => {
  const realFetch = globalThis.fetch;
  const order: string[] = [];
  const pending: Array<() => void> = [];
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    const child = (init!.headers as Record<string, string>).childInFocus!;
    order.push(`start ${child}`);
    return new Promise<Response>((resolve) => {
      pending.push(() => {
        order.push(`end ${child}`);
        resolve(new Response(null, { status: 200 }));
      });
    });
  }) as typeof fetch;
  try {
    clearSessionCaches();
    const a = bootstrapSchoolsoftSession("s", "t", 1, 2, 100);
    const b = bootstrapSchoolsoftSession("s", "t", 1, 2, 200);
    await Promise.resolve();
    /* B must not start before A has finished. */
    assert.deepEqual(order, ["start 100"]);
    pending.shift()!();
    await a;
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(order, ["start 100", "end 100", "start 200"]);
    pending.shift()!();
    await b;
  } finally {
    globalThis.fetch = realFetch;
  }
});

void test("cookieSessionFocus changes on every re-focus, even back to the same child", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response(null, { status: 200 }))) as typeof fetch;
  try {
    clearSessionCaches();
    await bootstrapSchoolsoftSession("s", "t", 1, 2, 100);
    const first = cookieSessionFocus();
    await bootstrapSchoolsoftSession("s", "t", 1, 2, 100);
    assert.equal(cookieSessionFocus(), first, "same focus reuses the token");
    await bootstrapSchoolsoftSession("s", "t", 1, 2, 200);
    await bootstrapSchoolsoftSession("s", "t", 1, 2, 100);
    assert.notEqual(cookieSessionFocus(), first, "A → B → A yields a new token");
  } finally {
    globalThis.fetch = realFetch;
  }
});

void test("acquireCookieFocus returns the awaited exchange's token, not a queued sibling's", async () => {
  const realFetch = globalThis.fetch;
  const pending: Array<() => void> = [];
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      pending.push(() => resolve(new Response(null, { status: 200 })));
    })) as typeof fetch;
  try {
    clearSessionCaches();
    const forA = acquireCookieFocus("s", "t", 1, 2, 100);
    /* The guardian switches to B before A's exchange has finished. */
    const switchToB = bootstrapSchoolsoftSession("s", "t", 1, 2, 200);
    await new Promise((r) => setTimeout(r, 0));
    pending.shift()!();
    const tokenA = await forA;
    /* A's caller must not see B's token as its own. */
    assert.notEqual(tokenA, cookieSessionFocus());
    await new Promise((r) => setTimeout(r, 0));
    pending.shift()!();
    await switchToB;
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* Upstream drops the cookie session after an idle timeout and answers 401;
 * the request should re-mint cookies for the same focus and retry once. */
void test("cookie requests re-bootstrap the same focus after a 401 and retry", async () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let expired = false;
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    if (url.includes("/eva-apps/auth/login/parent")) {
      calls.push(`bootstrap ${(init!.headers as Record<string, string>).token}`);
      expired = false;
      return Promise.resolve(new Response(null, { status: 200 }));
    }
    calls.push("rows");
    return Promise.resolve(
      expired ? new Response(null, { status: 401 }) : new Response("[1]", { status: 200 }),
    );
  }) as typeof fetch;
  try {
    clearSessionCaches();
    await bootstrapSchoolsoftSession("s", "old", 1, 2, 100);
    const focus = cookieSessionFocus();
    /* A later caller hands in a fresh token; renewal must use it. */
    await bootstrapSchoolsoftSession("s", "new", 1, 2, 100);
    expired = true;
    const [a, b] = await Promise.all([
      fetchHolisticAssessments("s"),
      fetchHolisticAssessments("s"),
    ]);
    assert.deepEqual(a, [1]);
    assert.deepEqual(b, [1]);
    assert.deepEqual(
      calls.filter((c) => c.startsWith("bootstrap")),
      ["bootstrap old", "bootstrap new"],
    );
    assert.equal(cookieSessionFocus(), focus, "renewal keeps the focus token");
  } finally {
    globalThis.fetch = realFetch;
    clearSessionCaches();
  }
});

void test("cookie requests give up after one failed renewal", async () => {
  const realFetch = globalThis.fetch;
  let bootstraps = 0;
  globalThis.fetch = ((url: string) => {
    if (url.includes("/eva-apps/auth/login/parent")) {
      bootstraps++;
      return Promise.resolve(new Response(null, { status: bootstraps === 1 ? 200 : 500 }));
    }
    return Promise.resolve(new Response(null, { status: 401 }));
  }) as typeof fetch;
  try {
    clearSessionCaches();
    await bootstrapSchoolsoftSession("s", "t", 1, 2, 100);
    await assert.rejects(fetchHolisticAssessments("s"), /\(401\)/);
    assert.equal(bootstraps, 2);
    assert.equal(cookieSessionFocus(), null, "a failed renewal isn't cached");
  } finally {
    globalThis.fetch = realFetch;
    clearSessionCaches();
  }
});

/* A request sent with the expired cookie whose 401 lands after another
 * request already renewed must reuse that renewal, not mint again. */
void test("a late 401 after a finished renewal retries without re-minting", async () => {
  const realFetch = globalThis.fetch;
  let bootstraps = 0;
  let expired = false;
  let releaseSlow: (() => void) | null = null;
  globalThis.fetch = ((url: string) => {
    if (url.includes("/eva-apps/auth/login/parent")) {
      bootstraps++;
      expired = false;
      return Promise.resolve(new Response(null, { status: 200 }));
    }
    const status = expired ? 401 : 200;
    const res = () => (status === 200 ? new Response("[1]") : new Response(null, { status }));
    if (url.includes("/lessons/week/") && !releaseSlow) {
      return new Promise<Response>((resolve) => {
        releaseSlow = () => resolve(res());
      });
    }
    return Promise.resolve(res());
  }) as typeof fetch;
  try {
    clearSessionCaches();
    await bootstrapSchoolsoftSession("s", "t", 1, 2, 100);
    expired = true;
    /* The schedule request is sent while expired; its 401 is held back. */
    const slow = fetchScheduleLessons("s", 1);
    await fetchHolisticAssessments("s");
    assert.equal(bootstraps, 2, "the fast request renewed once");
    releaseSlow!();
    assert.deepEqual(await slow, [1]);
    assert.equal(bootstraps, 2, "the late 401 reused that renewal");
  } finally {
    globalThis.fetch = realFetch;
    clearSessionCaches();
  }
});

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
