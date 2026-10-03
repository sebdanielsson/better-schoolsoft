/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canReportFullDay,
  canReportLesson,
  canWithdrawLesson,
  lessonAttendance,
  mondayOf,
  schoolMidnightMs,
  schoolTimeMs,
} from "./absence.ts";
import type { AbsenceLesson } from "../api/schoolsoft.ts";

void test("schoolMidnightMs is Swedish midnight in summer and winter time", () => {
  /* 2026-09-30 00:00 CEST (UTC+2) = 2026-09-29T22:00Z */
  assert.equal(new Date(schoolMidnightMs(2026, 8, 30)).toISOString(), "2026-09-29T22:00:00.000Z");
  /* 2026-12-01 00:00 CET (UTC+1) = 2026-11-30T23:00Z */
  assert.equal(new Date(schoolMidnightMs(2026, 11, 1)).toISOString(), "2026-11-30T23:00:00.000Z");
  /* Day after the October switch back to CET. */
  assert.equal(new Date(schoolMidnightMs(2026, 9, 26)).toISOString(), "2026-10-25T23:00:00.000Z");
});

void test("schoolTimeMs adds the wall-clock time", () => {
  assert.equal(
    new Date(schoolTimeMs(2026, 8, 30, "08:30")).toISOString(),
    "2026-09-30T06:30:00.000Z",
  );
});

void test("mondayOf returns the ISO week's Monday", () => {
  const sat = new Date(2026, 9, 3);
  assert.equal(mondayOf(sat).getDate(), 28);
  const sun = new Date(2026, 9, 4);
  assert.equal(mondayOf(sun).getDate(), 28);
  const mon = new Date(2026, 8, 28);
  assert.equal(mondayOf(mon).getDate(), 28);
});

const lesson = (extra: Partial<AbsenceLesson> = {}): AbsenceLesson => ({
  lessonId: 1,
  subject: "Ma",
  startTime: "08:30",
  endTime: "09:30",
  lessonStatus: 1,
  lessonStatusStudent: 0,
  hasAbsenceReportForLesson: false,
  comment: "",
  nrOfMinutesAbsent: 0,
  ...extra,
});

void test("canReportFullDay only before the first lesson starts", () => {
  const day = new Date(2026, 8, 30);
  const lessons = [lesson({ startTime: "08:30" }), lesson({ startTime: "10:00" })];
  const before = schoolTimeMs(2026, 8, 30, "08:00");
  const during = schoolTimeMs(2026, 8, 30, "09:00");
  assert.equal(canReportFullDay(day, lessons, before), true);
  assert.equal(canReportFullDay(day, lessons, during), false);
  assert.equal(canReportFullDay(day, [], before), false);
});

void test("lesson report rules follow attendance state and time", () => {
  const day = new Date(2026, 8, 30);
  const morning = schoolTimeMs(2026, 8, 30, "07:00");
  const after = schoolTimeMs(2026, 8, 30, "09:30");
  assert.equal(canReportLesson(day, lesson(), false, morning), true);
  assert.equal(canReportLesson(day, lesson(), false, after), false);
  assert.equal(canReportLesson(day, lesson(), true, morning), false);
  assert.equal(canReportLesson(day, lesson({ lessonStatus: 2 }), false, morning), false);
  assert.equal(canReportLesson(day, lesson({ lessonStatus: 3 }), false, morning), false);
  assert.equal(
    canReportLesson(day, lesson({ hasAbsenceReportForLesson: true }), false, morning),
    false,
  );
  const reported = lesson({ hasAbsenceReportForLesson: true });
  assert.equal(canWithdrawLesson(day, reported, morning), true);
  assert.equal(canWithdrawLesson(day, reported, after), false);
  assert.equal(
    canWithdrawLesson(day, lesson({ hasAbsenceReportForLesson: true, lessonStatus: 2 }), morning),
    false,
  );
});

void test("lessonAttendance labels", () => {
  assert.equal(
    lessonAttendance(lesson({ lessonStatus: 2, lessonStatusStudent: 1 })).tone,
    "present",
  );
  assert.equal(
    lessonAttendance(lesson({ lessonStatus: 2, lessonStatusStudent: 2 })).tone,
    "absent",
  );
  assert.equal(lessonAttendance(lesson({ lessonStatus: 3 })).label, "Cancelled");
  assert.equal(lessonAttendance(lesson()).tone, "pending");
  assert.equal(lessonAttendance(lesson({ hasAbsenceReportForLesson: true })).tone, "reported");
  assert.match(
    lessonAttendance(lesson({ lessonStatus: 2, lessonStatusStudent: 1, nrOfMinutesAbsent: 5 }))
      .label,
    /late/,
  );
});
