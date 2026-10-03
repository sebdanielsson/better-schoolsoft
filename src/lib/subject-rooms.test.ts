/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignmentWhen,
  parseLocalDateTime,
  partitionAssignments,
  safeHexColor,
  sortPlannings,
  sortResults,
} from "./subject-rooms.ts";
import type {
  SubjectRoomAssignmentRow,
  SubjectRoomPlanningRow,
  SubjectRoomResultRow,
} from "../api/schoolsoft.ts";

void test("parseLocalDateTime reads date-time and date-only strings as local time", () => {
  const dt = parseLocalDateTime("2026-10-05 11:05");
  assert.ok(dt);
  assert.deepEqual(
    [dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes()],
    [2026, 9, 5, 11, 5],
  );
  const d = parseLocalDateTime("2026-10-09");
  assert.equal(d?.getHours(), 0);
  assert.equal(parseLocalDateTime(""), null);
  assert.equal(parseLocalDateTime("not a date"), null);
});

void test("safeHexColor only accepts hex colours", () => {
  assert.equal(safeHexColor("#adff9e"), "#adff9e");
  assert.equal(safeHexColor("#ABC"), "#ABC");
  assert.equal(safeHexColor(""), "#94a3b8");
  assert.equal(safeHexColor("red;background:url(x)"), "#94a3b8");
  assert.equal(safeHexColor("#12345g", "#000"), "#000");
});

function assignment(id: number, start: string, end: string): SubjectRoomAssignmentRow {
  return {
    assignmentId: id,
    activityId: 1,
    title: `a${id}`,
    assignmentType: "Hemläxa",
    submissionStatus: "NO_STATUS",
    submissionDate: "",
    resultReportStatus: "NOT_REPORTED",
    startDate: start,
    endDate: end,
    publishDate: "",
    teacher: "",
    status: "ONGOING",
    read: true,
  };
}

void test("partitionAssignments splits on end date and orders each side", () => {
  const now = new Date(2026, 9, 3, 12, 0);
  const { upcoming, past } = partitionAssignments(
    [
      assignment(1, "2026-09-01 08:00", "2026-09-01 09:00"),
      assignment(2, "2026-11-05 14:10", "2026-11-05 15:15"),
      assignment(3, "2026-10-05 10:15", "2026-10-05 11:05"),
      assignment(4, "2026-09-20 08:00", "2026-09-20 09:00"),
      assignment(5, "2026-09-01 08:00", "2026-12-01 09:00"),
    ],
    now,
  );
  assert.deepEqual(
    upcoming.map((a) => a.assignmentId),
    [5, 3, 2],
  );
  assert.deepEqual(
    past.map((a) => a.assignmentId),
    [4, 1],
  );
});

function planning(id: number, start: string, end: string): SubjectRoomPlanningRow {
  return {
    planningPartId: id,
    planningId: id,
    activityId: 1,
    planningTitle: "",
    planningPartTitle: `p${id}`,
    teacher: "",
    startDate: start,
    endDate: end,
    publishDate: "",
    status: "ONGOING",
    read: true,
  };
}

void test("sortPlannings puts current first, then upcoming, then finished", () => {
  const now = new Date(2026, 9, 3);
  const sorted = sortPlannings(
    [
      planning(1, "2026-09-04", "2026-09-30"),
      planning(2, "2026-09-24", "2026-10-23"),
      planning(3, "2026-11-01", "2026-11-30"),
      planning(4, "2026-09-24", "2026-10-09"),
      planning(5, "2026-08-01", "2026-08-30"),
      planning(6, "2026-10-03", "2026-10-03"),
    ],
    now,
  );
  assert.deepEqual(
    sorted.map((p) => p.planningPartId),
    [6, 4, 2, 3, 1, 5],
  );
});

void test("sortResults orders by publish date, newest first", () => {
  const r = (id: number, publishDate: string): SubjectRoomResultRow => ({
    assignmentId: id,
    activityId: 1,
    title: "",
    assignmentType: "",
    teacher: "",
    publishDate,
    read: true,
  });
  assert.deepEqual(
    sortResults([r(1, "2026-09-04 10:11"), r(2, "2026-09-29 14:51"), r(3, "2026-09-07 13:57")]).map(
      (x) => x.assignmentId,
    ),
    [2, 3, 1],
  );
});

void test("assignmentWhen shows the start while ahead, the due date once started", () => {
  const now = new Date(2026, 9, 3, 12, 0);
  assert.doesNotMatch(
    assignmentWhen({ startDate: "2026-10-05 10:15", endDate: "2026-10-05 11:05" }, now),
    /^due/,
  );
  assert.match(
    assignmentWhen({ startDate: "2026-08-18 00:00", endDate: "2026-12-19 00:00" }, now),
    /^due /,
  );
});
