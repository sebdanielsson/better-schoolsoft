/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lessonAbsence,
  scheduleLessonToLesson,
  scheduleLessonsForDate,
  weekItems,
} from "./schedule.ts";
import {
  formatLessonTime,
  lessonDayIndex,
  type CalendarItem,
  type ScheduleLesson,
} from "../api/schoolsoft.ts";

const lesson = (over: Partial<ScheduleLesson>): ScheduleLesson => ({
  allDay: false,
  category: "lesson",
  dayId: 1,
  description: "",
  editable: false,
  endDate: "2026-10-05T09:00",
  eventColor: "",
  eventId: 1,
  name: "Ma",
  room: "",
  roomBooking: false,
  startDate: "2026-10-05T08:00",
  status: 0,
  studentLessonStatus: null,
  teacher: "A,B",
  teachingGroup: "",
  ...over,
});

void test("scheduleLessonToLesson yields the shape the lesson helpers read", () => {
  const l = scheduleLessonToLesson(lesson({}));
  assert.equal(formatLessonTime(l.startTime), "08:00");
  assert.equal(formatLessonTime(l.endTime!), "09:00");
  assert.equal(lessonDayIndex(l.startTime), 1, "2026-10-05 is a Monday");
  assert.equal(l.subjectName, "Mathematics");
  assert.equal(l.teacherName, "A, B");
  assert.equal(l.location, undefined, "an empty room is no location");
});

void test("scheduleLessonsForDate keeps that day's lessons, in order", () => {
  const rows = scheduleLessonsForDate(
    [
      lesson({ eventId: 2, startDate: "2026-10-05T10:00", endDate: "2026-10-05T11:00" }),
      lesson({ eventId: 1 }),
      lesson({ eventId: 3, startDate: "2026-10-06T08:00", endDate: "2026-10-06T09:00" }),
      lesson({ eventId: 4, category: "event" }),
    ],
    new Date(2026, 9, 5),
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    [1, 2],
  );
});

void test("lessons carry cancellation, absence and colour like the web calendar", () => {
  const l = scheduleLessonToLesson(
    lesson({
      status: 3,
      eventColor: "#e5a6f0",
      studentLessonStatus: {
        absence: 1,
        comment: "",
        lessonId: 1,
        name: "Giltig frånvaro",
        reason: "",
        status: 2,
        statusType: 3,
        week: 41,
      },
    }),
  );
  assert.equal(l.cancelled, true);
  assert.equal(l.absence, "approved");
  assert.equal(l.color, "#e5a6f0");
  const plain = scheduleLessonToLesson(lesson({ status: 2, eventColor: "not-a-colour" }));
  assert.equal(plain.cancelled, undefined);
  assert.equal(plain.absence, undefined);
  assert.equal(plain.color, undefined);
});

void test("lessonAbsence mirrors the web calendar's markers", () => {
  const s = (status: number, statusType: number) => ({
    absence: 0,
    comment: "",
    lessonId: 1,
    name: "",
    reason: "",
    status,
    statusType,
    week: 1,
  });
  assert.equal(lessonAbsence(null), undefined);
  assert.equal(lessonAbsence(s(0, 0)), undefined, "present");
  assert.equal(lessonAbsence(s(2, 1)), undefined, "statusType 1 shows nothing");
  assert.equal(lessonAbsence(s(2, 3)), "approved");
  assert.equal(lessonAbsence(s(2, 4)), "approved");
  assert.equal(lessonAbsence(s(2, 2)), "unapproved");
});

void test("weekItems puts timed entries in their day and spans in the week strip", () => {
  const monday = new Date(2026, 9, 5);
  const item = (over: Partial<CalendarItem>): CalendarItem => ({
    name: "x",
    startDate: "2026-10-07T09:50",
    endDate: "2026-10-07T10:45",
    allDay: false,
    category: "test",
    ...over,
  });
  const { allWeek, byDay } = weekItems(
    [
      item({ name: "Kemi - provet", typeName: "Assessment", activityId: 7 }),
      item({
        name: "Homework",
        allDay: true,
        startDate: "2026-10-02T00:00",
        endDate: "2026-10-08T00:00",
      }),
      item({
        name: "SPM",
        category: "timeBooking",
        teacher: "Ms M",
        startDate: "2026-10-09T13:00",
        endDate: "2026-10-09T13:25",
      }),
      item({
        name: "Unit",
        category: "planning",
        startDate: "2026-08-21",
        endDate: "2026-10-23T12:00",
      }),
      item({ name: "Last week", startDate: "2026-09-30T09:00", endDate: "2026-09-30T10:00" }),
      item({
        name: "Ended Monday 00:00",
        allDay: true,
        startDate: "2026-09-28",
        endDate: "2026-10-05T00:00",
      }),
      item({ name: "Saturday", startDate: "2026-10-10T10:00", endDate: "2026-10-10T11:00" }),
      item({ name: "Kemi - provet", typeName: "Assessment", activityId: 7, entityId: 2 }),
    ],
    monday,
  );
  assert.deepEqual(
    byDay[3]!.map((i) => [i.title, i.kind, i.detail, i.activityId]),
    [["Kemi - provet", "test", "Assessment", 7]],
    "timed test on Wednesday; the per-group duplicate (other entityId) is dropped",
  );
  assert.deepEqual(
    byDay[5]!.map((i) => [i.title, i.kind, i.detail]),
    [["SPM", "booking", "Ms M"]],
  );
  assert.deepEqual(
    allWeek.map((i) => i.title),
    ["Homework"],
  );
});
