/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countBySection,
  fromAssessments,
  fromAssignments,
  fromBookings,
  fromMessages,
  fromNews,
  fromPlannings,
  fromResults,
  relativeTime,
  sortNotifications,
} from "./notifications.ts";
import type {
  EvaMessageInbox,
  EvaNewsItem,
  HolisticAssessmentRow,
  SubjectRoomAssignmentRow,
  SubjectRoomPlanningRow,
  SubjectRoomResultRow,
  TimebookingSummary,
} from "../api/schoolsoft.ts";

const sender = { id: 5, firstName: "Ada", lastName: "Teacher", picture: "" };

void test("only unread items become notifications, with routes that open them", () => {
  const msgs: EvaMessageInbox[] = [
    { id: 1, subject: "Read", message: "", isRead: true, sender, date: "", hasFiles: false },
    {
      id: 2,
      subject: "",
      message: "",
      isRead: false,
      sender,
      date: "2026-10-01T08:00:00Z",
      hasFiles: false,
    },
  ];
  assert.deepEqual(
    fromMessages(msgs).map((n) => [n.key, n.title, n.subtitle, n.href]),
    [["message:2", "(no subject)", "Ada Teacher", "/messages?message=2"]],
  );

  const news = [
    {
      id: 7,
      title: " Läslov ",
      description: "",
      creDate: "2026-10-08T14:07:17.000+00:00",
      read: false,
      category: "Info",
      author: { id: 1, name: "Principal", picture: "" },
    },
    { id: 8, title: "Old", description: "", creDate: "", read: true },
  ] as EvaNewsItem[];
  assert.deepEqual(
    fromNews(news).map((n) => [n.key, n.title, n.subtitle, n.href]),
    [["news:7", "Läslov", "Principal · Info", "/news?item=7"]],
  );

  const bookings: TimebookingSummary[] = [
    {
      timebookingId: 44,
      name: "SPM",
      status: "BOOKED",
      isRead: false,
      creDate: "2026-10-07T07:20:16.000+00:00",
      teacher: { fName: "M", lName: "W" },
    },
  ];
  assert.equal(fromBookings(bookings)[0]?.href, "/bookings/44");
});

void test("subject-room rows map to assignment, result and planning routes", () => {
  const a = [
    {
      assignmentId: 3,
      activityId: 1,
      title: "Test",
      subjects: [{ name: "English" }],
      assignmentType: "Assessment",
      teacher: "T",
      publishDate: "2026-10-05 21:55",
      read: false,
    },
    {
      assignmentId: 4,
      activityId: 1,
      title: "Seen",
      subjects: [],
      assignmentType: "",
      teacher: "",
      publishDate: "",
      read: true,
    },
  ] as unknown as SubjectRoomAssignmentRow[];
  assert.deepEqual(
    fromAssignments(a).map((n) => [n.key, n.subtitle, n.href]),
    [["assignment:3", "English · Assessment · T", "/assignments/3"]],
  );
  const r = [
    {
      assignmentId: 9,
      activityId: 2,
      title: "Prov",
      subjects: [{ name: "SO" }],
      assignmentType: "Assessment",
      teacher: "G",
      publishDate: "2026-10-11 11:33",
      read: false,
    },
  ] as unknown as SubjectRoomResultRow[];
  assert.equal(fromResults(r)[0]?.href, "/assignments/9");
  const p = [
    {
      planningPartId: 20,
      planningId: 10,
      activityId: 2,
      planningTitle: "",
      planningPartTitle: " ",
      subjects: [],
      teacher: "",
      startDate: "",
      endDate: "",
      publishDate: "",
      status: "ONGOING",
      read: false,
    },
  ] as unknown as SubjectRoomPlanningRow[];
  assert.deepEqual(
    fromPlannings(p).map((n) => [n.title, n.href]),
    [["Planning", "/plannings/10/20"]],
  );
});

void test("assessments only count when published and unread", () => {
  const rows = [
    {
      title: "A",
      subTitle: "",
      color: "",
      subjectWarning: false,
      updatedAt: "2025-12-12 09:18",
      friendlyUpdatedAt: "",
      holisticAssessmentId: 1,
      published: true,
      read: false,
    },
    {
      title: "B",
      subTitle: "",
      color: "",
      subjectWarning: false,
      updatedAt: "",
      friendlyUpdatedAt: "",
      holisticAssessmentId: 2,
      published: false,
      read: false,
    },
    {
      title: "C",
      subTitle: "",
      color: "",
      subjectWarning: false,
      updatedAt: "",
      friendlyUpdatedAt: "",
      holisticAssessmentId: 0,
      published: true,
      read: false,
    },
  ] as HolisticAssessmentRow[];
  assert.deepEqual(
    fromAssessments(rows).map((n) => n.key),
    ["assessment:1"],
  );
});

void test("sorting is newest first and section counts group subject-room kinds", () => {
  const items = sortNotifications([
    ...fromResults([
      {
        assignmentId: 1,
        activityId: 1,
        title: "",
        assignmentType: "",
        teacher: "",
        publishDate: "2026-10-11 11:33",
        read: false,
      },
    ] as unknown as SubjectRoomResultRow[]),
    ...fromAssignments([
      {
        assignmentId: 2,
        activityId: 1,
        title: "",
        assignmentType: "",
        teacher: "",
        publishDate: "2026-10-05 21:55",
        read: false,
      },
    ] as unknown as SubjectRoomAssignmentRow[]),
    ...fromNews([
      { id: 3, title: "", description: "", creDate: "2026-10-08T14:07:17Z", read: false },
    ] as EvaNewsItem[]),
  ]);
  assert.deepEqual(
    items.map((i) => i.key),
    ["result:1", "news:3", "assignment:2"],
  );
  assert.deepEqual(countBySection(items), { "/subjects": 2, "/news": 1 });
});

void test("relativeTime", () => {
  const now = new Date(2026, 9, 11, 12, 0).getTime();
  assert.equal(relativeTime(0, now), "");
  assert.equal(relativeTime(now - 30_000, now), "Just now");
  assert.equal(relativeTime(now - 5 * 60_000, now), "5 min ago");
  assert.equal(relativeTime(now - 3 * 3_600_000, now), "3 h ago");
  assert.equal(relativeTime(now - 26 * 3_600_000, now), "Yesterday");
  assert.equal(relativeTime(now - 4 * 86_400_000, now), "4 days ago");
  /* Calendar days, not 24-hour blocks. */
  const justAfterMidnight = new Date(2026, 9, 11, 0, 1).getTime();
  assert.equal(
    relativeTime(new Date(2026, 9, 9, 23, 59).getTime(), justAfterMidnight),
    "2 days ago",
  );
  assert.equal(relativeTime(new Date(2026, 9, 10, 0, 0).getTime(), justAfterMidnight), "Yesterday");
  /* The 25-hour day when DST ends (in zones that have it): still today. */
  assert.match(
    relativeTime(new Date(2026, 9, 25, 0, 30).getTime(), new Date(2026, 9, 25, 23, 45).getTime()),
    /^2[34] h ago$/,
  );
});
