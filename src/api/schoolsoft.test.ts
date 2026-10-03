/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bitmaskToWeeks,
  bootstrapSchoolsoftSession,
  cookieSessionFocus,
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
