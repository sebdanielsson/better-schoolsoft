/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeSchoolDayFor, nextSchoolDay, prevSchoolDay } from "./school-days.ts";
import { relativeDay } from "./dates.ts";

/* 2026-10-05 is a Monday. */
const day = (d: number, h = 9) => new Date(2026, 9, d, h);
const date = (d: Date) => d.getDate();

void test("nextSchoolDay skips the weekend", () => {
  assert.equal(date(nextSchoolDay(day(5))), 6, "Mon → Tue");
  assert.equal(date(nextSchoolDay(day(9))), 12, "Fri → Mon");
  assert.equal(date(nextSchoolDay(day(10))), 12, "Sat → Mon");
  assert.equal(date(nextSchoolDay(day(11))), 12, "Sun → Mon");
});

void test("prevSchoolDay skips the weekend", () => {
  assert.equal(date(prevSchoolDay(day(6))), 5, "Tue → Mon");
  assert.equal(date(prevSchoolDay(day(12))), 9, "Mon → Fri");
  assert.equal(date(prevSchoolDay(day(10))), 9, "Sat → Fri");
  assert.equal(date(prevSchoolDay(day(11))), 9, "Sun → Fri");
});

void test("activeSchoolDayFor rolls over after school hours and on weekends", () => {
  assert.equal(date(activeSchoolDayFor(day(5, 9))), 5);
  assert.equal(date(activeSchoolDayFor(day(5, 17))), 6);
  assert.equal(date(activeSchoolDayFor(day(9, 18))), 12);
  assert.equal(date(activeSchoolDayFor(day(10, 9))), 12);
  assert.equal(activeSchoolDayFor(day(5, 9)).getHours(), 0, "midnight, not the current time");
});

void test("relativeDay counts calendar days, not 24-hour spans", () => {
  const now = day(5, 23);
  assert.equal(relativeDay(day(6, 1).getTime(), now), "Tomorrow");
  assert.equal(relativeDay(day(5, 0).getTime(), now), "Today");
  assert.equal(relativeDay(day(4, 23).getTime(), now), "Yesterday");
  assert.equal(relativeDay(day(8).getTime(), now), "In 3 days");
});
