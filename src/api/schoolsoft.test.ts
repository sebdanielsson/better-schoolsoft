// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bitmaskToWeeks, isTokenExpired, isoWeek } from "./schoolsoft.ts";

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
