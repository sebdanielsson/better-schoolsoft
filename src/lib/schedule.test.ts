/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleLessonToLesson, scheduleLessonsForDate } from "./schedule.ts";
import { formatLessonTime, lessonDayIndex, type ScheduleLesson } from "../api/schoolsoft.ts";

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
