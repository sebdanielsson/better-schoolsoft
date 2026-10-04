/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agenda,
  inWeek,
  isLongRunning,
  lastIncludedMs,
  lessonStartMs,
  nextEntries,
  toLocalStamp,
  lessonAbsence,
  scheduleLessonToLesson,
  scheduleLessonsForDate,
  toWeekItems,
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

void test("isLongRunning flags entries spanning more than a week", () => {
  const { allWeek } = weekItems(
    [
      {
        name: "Term project",
        startDate: "2026-08-18",
        endDate: "2026-12-19T00:00",
        allDay: true,
        category: "test",
      },
      {
        name: "Week homework",
        startDate: "2026-10-02T00:00",
        endDate: "2026-10-08T00:00",
        allDay: true,
        category: "test",
      },
      {
        name: "Exactly a week",
        startDate: "2026-10-05T00:00",
        endDate: "2026-10-12T00:00",
        allDay: true,
        category: "test",
      },
    ],
    new Date(2026, 9, 5),
  );
  assert.deepEqual(
    allWeek.map((i) => [i.title, isLongRunning(i)]),
    [
      ["Term project", true],
      ["Week homework", false],
      ["Exactly a week", false],
    ],
  );
});

void test("isLongRunning counts calendar days, so a week across DST is not long", () => {
  /* 19 → 26 Oct 2026 spans the 25 Oct clock change in Europe: 7 calendar
   * days but 7 days + 1 h of elapsed time. */
  const item = (start: Date, end: Date) => ({
    key: "k",
    kind: "test" as const,
    title: "t",
    start: start.getTime(),
    end: end.getTime(),
    allDay: true,
  });
  assert.equal(isLongRunning(item(new Date(2026, 9, 19), new Date(2026, 9, 26))), false);
  assert.equal(isLongRunning(item(new Date(2026, 9, 19), new Date(2026, 9, 27))), true);
});

void test("inWeek checks both the ISO week and the ISO year", () => {
  assert.equal(inWeek("2026-10-05T08:30", 41, 2026), true);
  assert.equal(inWeek("2027-10-04T08:30", 40, 2026), false, "same week number, next year");
  assert.equal(inWeek("2026-12-31T08:30", 53, 2026), true);
  assert.equal(inWeek("2027-01-01", 53, 2026), true, "1 Jan 2027 belongs to ISO 2026-W53");
});

void test("lessonStartMs orders lessons among calendar items", () => {
  const l = scheduleLessonToLesson(lesson({ startDate: "2026-10-05T08:30" }));
  assert.equal(lessonStartMs(l), new Date(2026, 9, 5, 8, 30).getTime());
});

void test("lastIncludedMs treats a midnight end as the previous day", () => {
  const item = (start: Date, end: Date) => ({
    key: "k",
    kind: "test" as const,
    title: "t",
    start: start.getTime(),
    end: end.getTime(),
    allDay: true,
  });
  const span = item(new Date(2026, 8, 25), new Date(2026, 9, 1));
  assert.equal(new Date(lastIncludedMs(span)).getDate(), 30, "ends Wed 30 Sep, not Thu 1 Oct");
  const point = item(new Date(2026, 9, 1), new Date(2026, 9, 1));
  assert.equal(
    new Date(lastIncludedMs(point)).toDateString(),
    new Date(point.end).toDateString(),
    "zero-length all-day keeps its date",
  );
  assert.ok(lastIncludedMs(point) > point.end, "…and covers the whole day");
  const timed = item(new Date(2026, 9, 1, 9), new Date(2026, 9, 1, 10));
  assert.equal(lastIncludedMs(timed), timed.end);
});

void test("weekItems keeps a timed entry ending at midnight in its day column", () => {
  const { allWeek, byDay } = weekItems(
    [
      {
        name: "Evening event",
        startDate: "2026-10-05T18:00",
        endDate: "2026-10-06T00:00",
        allDay: false,
        category: "event",
      },
    ],
    new Date(2026, 9, 5),
  );
  assert.deepEqual(
    byDay[1]!.map((i) => i.title),
    ["Evening event"],
  );
  assert.equal(allWeek.length, 0);
});

void test("agenda lists ongoing entries, then upcoming ones by start day", () => {
  const from = new Date(2026, 9, 4, 15, 0); /* Sunday afternoon */
  const to = new Date(2026, 10, 29);
  const entry = (over: Partial<CalendarItem>): CalendarItem => ({
    name: "x",
    startDate: "2026-10-09T09:50",
    endDate: "2026-10-09T10:45",
    allDay: false,
    category: "test",
    ...over,
  });
  const { ongoing, days } = agenda(
    toWeekItems([
      entry({
        name: "Term task",
        allDay: true,
        startDate: "2026-08-18T00:00",
        endDate: "2026-12-19T00:00",
      }),
      entry({ name: "Kemi - provet", activity: "KE" }),
      entry({ name: "Kemi - provet", activity: "KE", activityId: 2 }),
      entry({
        name: "Booking",
        category: "timeBooking",
        startDate: "2026-10-09T08:00",
        endDate: "2026-10-09T08:20",
      }),
      entry({ name: "Earlier today", startDate: "2026-10-04T08:00", endDate: "2026-10-04T09:00" }),
      entry({
        name: "Finished",
        allDay: true,
        startDate: "2026-09-25T00:00",
        endDate: "2026-10-04T00:00",
      }),
      entry({ name: "Too late", startDate: "2026-12-01T09:00", endDate: "2026-12-01T10:00" }),
      entry({
        name: "Unit",
        category: "planning",
        startDate: "2026-08-21",
        endDate: "2026-10-23T12:00",
      }),
    ]),
    from,
    to,
  );
  assert.deepEqual(
    ongoing.map((i) => i.title),
    ["Term task"],
  );
  assert.deepEqual(
    days.map((d) => [new Date(d.day).getDate(), d.items.map((i) => i.title)]),
    [
      [4, ["Earlier today"]],
      [9, ["Booking", "Kemi - provet"]],
    ],
    "today's earlier entries still count; duplicates, plannings and out-of-range entries are dropped",
  );
  assert.equal(days[1]!.items[1]!.subject, "Chemistry");
});

void test("nextEntries picks the next upcoming, unfinished, short entries", () => {
  const now = new Date(2026, 9, 5, 12, 0);
  const entry = (
    name: string,
    startDate: string,
    endDate: string,
    allDay = false,
  ): CalendarItem => ({
    name,
    startDate,
    endDate,
    allDay,
    category: "test",
  });
  const picked = nextEntries(
    toWeekItems([
      entry("Later", "2026-10-20T09:00", "2026-10-20T10:00"),
      entry("Done this morning", "2026-10-05T08:00", "2026-10-05T09:00"),
      entry("This afternoon", "2026-10-05T13:00", "2026-10-05T14:00"),
      entry("All day today", "2026-10-05", "2026-10-06T00:00", true),
      entry("Term task", "2026-10-05", "2026-12-19T00:00", true),
      entry("Started last week", "2026-09-30T00:00", "2026-10-07T00:00", true),
      entry("Tomorrow", "2026-10-06T08:30", "2026-10-06T09:30"),
      entry("Beyond range", "2026-10-05T12:30", "2026-10-05T12:45"),
    ]).map((i) =>
      i.title === "Beyond range" ? { ...i, start: new Date(2026, 11, 1).getTime() } : i,
    ),
    now,
    new Date(2026, 10, 30),
    3,
  );
  assert.deepEqual(
    picked.map((i) => i.title),
    ["All day today", "This afternoon", "Tomorrow"],
  );
});

void test("toLocalStamp converts zoned timestamps to local time", () => {
  const d = new Date("2026-10-04T22:00:00Z");
  const p = (n: number) => String(n).padStart(2, "0");
  const local = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  assert.equal(toLocalStamp("2026-10-04T22:00:00Z"), local);
  assert.equal(toLocalStamp("2026-10-04T22:00:00.000Z"), local);
  assert.equal(toLocalStamp("2026-10-05T00:00:00+02:00"), local, "same instant, other offset");
  assert.equal(toLocalStamp("2026-10-05T09:30:00"), "2026-10-05T09:30", "zone-less passes through");
  assert.equal(toLocalStamp("2026-10-05"), "2026-10-05", "date-only passes through");
});

void test("agenda drops prior-day entries that have already ended from Ongoing", () => {
  const now = new Date(2026, 9, 5, 15, 0);
  const { ongoing } = agenda(
    toWeekItems([
      {
        name: "Ended at nine",
        startDate: "2026-10-04T18:00",
        endDate: "2026-10-05T09:00",
        allDay: false,
        category: "event",
      },
      {
        name: "Still running",
        startDate: "2026-10-04T18:00",
        endDate: "2026-10-05T18:00",
        allDay: false,
        category: "event",
      },
    ]),
    startOfDayLocal(now),
    new Date(2026, 10, 30),
    now,
  );
  assert.deepEqual(
    ongoing.map((i) => i.title),
    ["Still running"],
  );
});

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

void test("nextEntries ignores entries starting at or after the range end", () => {
  const now = new Date(2026, 9, 5, 12, 0);
  const picked = nextEntries(
    toWeekItems([
      {
        name: "In range",
        startDate: "2026-10-06T08:30",
        endDate: "2026-10-06T09:30",
        allDay: false,
        category: "test",
      },
      {
        name: "Past the range",
        startDate: "2026-12-07T08:30",
        endDate: "2026-12-07T09:30",
        allDay: false,
        category: "test",
      },
    ]),
    now,
    new Date(2026, 10, 30),
    10,
  );
  assert.deepEqual(
    picked.map((i) => i.title),
    ["In range"],
  );
});

void test("nextEntries keeps a zero-length all-day entry for its whole day", () => {
  const now = new Date(2026, 9, 5, 15, 0);
  const picked = nextEntries(
    toWeekItems([
      {
        name: "Sports day",
        startDate: "2026-10-05",
        endDate: "2026-10-05",
        allDay: true,
        category: "event",
      },
      {
        name: "Timed, over",
        startDate: "2026-10-05T09:00",
        endDate: "2026-10-05T09:00",
        allDay: false,
        category: "event",
      },
    ]),
    now,
    new Date(2026, 10, 30),
    3,
  );
  assert.deepEqual(
    picked.map((i) => i.title),
    ["Sports day"],
  );
});

void test("toWeekItems keeps descriptions as plain text", () => {
  const [item] = toWeekItems([
    {
      name: "Trip",
      description: "Bring <b>lunch</b>  &amp; water",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      allDay: true,
      category: "event",
    },
  ]);
  /* No DOM in node tests, so only tags are stripped (entities decode in the
   * browser; text.test.ts covers that with jsdom). */
  assert.equal(item!.description?.startsWith("Bring lunch"), true);
  assert.equal(item!.description?.includes("<"), false);
});
