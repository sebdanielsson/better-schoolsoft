/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acquireCookieFocus,
  bitmaskToWeeks,
  bootstrapSchoolsoftSession,
  cookieSessionFocus,
  fetchHolisticAssessments,
  isTokenExpired,
  isoWeek,
} from "./schoolsoft.ts";
import { clearSessionCaches } from "../lib/session-caches.ts";

void test("bitmaskToWeeks decodes low bits", () => {
  assert.deepEqual(bitmaskToWeeks(0), []);
  assert.deepEqual(bitmaskToWeeks(0b1), [1]);
  assert.deepEqual(bitmaskToWeeks(0b1011), [1, 2, 4]);
});

/* Regression: the old implementation tested `bitmask & (1 << i)`. Bitwise
 * operators coerce to int32 and `1 << 32` wraps to 1, so week 33 was reported
 * whenever week 1 was set and weeks 33+ could never be decoded on their own. */
void test("bitmaskToWeeks reaches weeks beyond bit 31", () => {
  assert.deepEqual(bitmaskToWeeks(2 ** 32), [33]);
  assert.deepEqual(bitmaskToWeeks(2 ** 52), [53]);
});

void test("bitmaskToWeeks does not alias high weeks onto low ones", () => {
  /* Week 1 alone must not imply week 33. */
  assert.deepEqual(bitmaskToWeeks(1), [1]);
  /* Both set means both reported, not one. */
  assert.deepEqual(bitmaskToWeeks(1 + 2 ** 32), [1, 33]);
});

void test("bitmaskToWeeks covers a full-year mask", () => {
  const allWeeks = 2 ** 53 - 1;
  assert.equal(bitmaskToWeeks(allWeeks).length, 53);
});

/* Regression: comparisons against NaN are always false, so an unparseable
 * expiry previously reported the token as still valid and it was sent anyway. */
void test("isTokenExpired treats an unreadable date as expired", () => {
  for (const bad of ["", "not-a-date", "0000-00-00 00:00:00.0"]) {
    assert.equal(isTokenExpired(bad), true, `should be expired: ${JSON.stringify(bad)}`);
  }
});

void test("isTokenExpired reads SchoolSoft's timestamp format", () => {
  assert.equal(isTokenExpired("2000-01-01 00:00:00.0"), true);
  assert.equal(isTokenExpired("2099-01-01 00:00:00.0"), false);
});

void test("isTokenExpired applies the five-minute safety margin", () => {
  /* SchoolSoft's timestamps carry no zone and parse as local time, so build the
   * expected strings from local components rather than toISOString. */
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.0`;

  const inTwoMinutes = new Date(Date.now() + 2 * 60_000);
  const inTenMinutes = new Date(Date.now() + 10 * 60_000);

  assert.equal(isTokenExpired(fmt(inTwoMinutes)), true, "inside the margin — refresh");
  assert.equal(isTokenExpired(fmt(inTenMinutes)), false, "outside the margin — still usable");
});

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
