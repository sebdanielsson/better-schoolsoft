/** Request handlers for mock mode. Paths are matched after
 *  `/schoolsoft/<school>`; anything without a route is answered with a 404
 *  by `index.ts`, never forwarded. Writes change the in-memory state, so
 *  read markers, bookings, absence reports and messages behave within a
 *  page load and reset on reload. */

import {
  ABSENCE_STATUS,
  LESSON_STATUS,
  type AbsenceDay,
  type AbsenceWeek,
} from "../api/schoolsoft.ts";
import {
  bookingCalendar,
  bookingDetail,
  bookingStartpage,
  bookingSummary,
  createBookings,
  createMessages,
  createNews,
  LIBRARY_FILE_ID,
  LIBRARY_PAGE,
  lunchWeek,
  messageRow,
  newsDetail,
  newsFeed,
  nextCalendarEvent,
  SCHOOL_PAGE,
  schoolEvents,
} from "./comms.ts";
import {
  initialProfile,
  parent,
  PARENT_ID,
  schoolList,
  staffDetail,
  staffAsTeacher,
  staffGroups,
  teachers,
} from "./people.ts";
import {
  assessmentRows,
  assessmentSubject,
  assessmentTeacher,
  assignmentAssessment,
  assignmentRow,
  assignmentSections,
  assignmentSubmission,
  assignmentView,
  calendarEntries,
  connectedAssignments,
  connectedPlannings,
  createAssessments,
  createAssignments,
  createPlannings,
  lessonsOn,
  lessonTile,
  planningRows,
  roomAssignmentRow,
  roomInformation,
  roomPlanningRows,
  roomResultRow,
  roomTeachers,
  scheduleWeek,
  subjectRooms,
} from "./school.ts";
import { at, friendly, hm, iso, isoWeek, localT, weekday, weekOffset, ymd } from "./time.ts";

export interface MockRequest {
  method: string;
  /** Path after `/schoolsoft/<school>`, without the query. */
  path: string;
  query: URLSearchParams;
  body: unknown;
}

type Handler = (m: RegExpExecArray, req: MockRequest) => Response;

export const json = (data: unknown, status = 200) =>
  new Response(data === null ? "" : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
export const ok = () => new Response(null, { status: 204 });
const notFound = () => new Response("Not found", { status: 404 });
const file = (name: string) =>
  new Response(`This is a mock file standing in for "${name}".\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
const html = (body: string) =>
  new Response(`<html><body>${body}</body></html>`, {
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });

/** Fresh mutable state; one per page load. */
function createState() {
  return {
    profile: { ...initialProfile },
    news: createNews(),
    messages: createMessages(),
    bookings: createBookings(),
    assignments: createAssignments(),
    plannings: createPlannings(),
    assessments: createAssessments(),
    absence: {
      /** `YYYY-MM-DD` of reported full days. */
      fullDays: new Set<string>(),
      /** Lesson id → guardian comment of reported lessons. */
      lessons: new Map<number, string>(),
      /** Lessons the school marked as explained absence (history). */
      explained: new Set<string>([ymd(weekday(-1, 3))]),
      weekComments: new Map<number, string>(),
    },
  };
}

const num = (v: unknown) => Number(v);
const bodyOf = <T>(req: MockRequest) => (req.body ?? {}) as T;

export function createRoutes(): [method: string, pattern: RegExp, handler: Handler][] {
  const s = createState();

  const assignment = (id: number) => s.assignments.find((a) => a.id === id);
  const part = (id: number) =>
    s.plannings
      .flatMap((p) => p.parts.map((x) => ({ planning: p, part: x })))
      .find((x) => x.part.id === id);
  const planning = (id: number) => s.plannings.find((p) => p.id === id);
  const assessment = (id: number) => s.assessments.find((a) => a.id === id);
  const booking = (id: number) => s.bookings.find((b) => b.id === id);
  const news = (id: number) => s.news.find((n) => n.item.id === id);
  const message = (id: number) => s.messages.find((m) => m.detail.id === id);

  function absenceWeek(week: number): AbsenceWeek {
    const off = weekOffset(week);
    const today = ymd(new Date());
    return {
      studentAbsenceDays: [0, 1, 2, 3, 4].map((dayId) => {
        const date = ymd(weekday(off, dayId + 1));
        const lessons = lessonsOn(off, dayId);
        const reported = lessons.filter((l) => s.absence.lessons.has(l.id)).length;
        const full = s.absence.fullDays.has(date);
        const explained = s.absence.explained.has(date);
        const status = full
          ? ABSENCE_STATUS.PRE_REPORTED_ABSENCE
          : explained
            ? ABSENCE_STATUS.EXPLAINED_ABSENCE
            : reported > 0
              ? ABSENCE_STATUS.PRE_REPORTED_ABSENCE
              : date < today
                ? ABSENCE_STATUS.ATTENDANCE
                : ABSENCE_STATUS.NO_STATUS;
        return {
          dayId,
          status,
          hasAbsenceReportFullDay: full,
          nrOfLessonsAbsent: full || explained ? lessons.length : reported,
        };
      }),
      parentComment: s.absence.weekComments.get(week) ?? "",
    };
  }

  function absenceDay(week: number, dayId: number): AbsenceDay {
    const off = weekOffset(week);
    const date = ymd(weekday(off, dayId + 1));
    const full = s.absence.fullDays.has(date);
    const explained = s.absence.explained.has(date);
    const now = Date.now();
    return {
      dayId,
      hasAbsenceReportFullDay: full,
      absenceStatusFullDay: full
        ? ABSENCE_STATUS.PRE_REPORTED_ABSENCE
        : explained
          ? ABSENCE_STATUS.EXPLAINED_ABSENCE
          : ABSENCE_STATUS.NO_STATUS,
      lessons: lessonsOn(off, dayId).map((l) => {
        const ended = l.end.getTime() <= now;
        const reported = s.absence.lessons.has(l.id);
        const absent = full || explained || reported;
        return {
          lessonId: l.id,
          subject: l.subject,
          startTime: hm(l.start),
          endTime: hm(l.end),
          lessonStatus: ended ? LESSON_STATUS.REPORTED : LESSON_STATUS.UNREPORTED,
          lessonStatusStudent: explained
            ? ABSENCE_STATUS.EXPLAINED_ABSENCE
            : full || reported
              ? ABSENCE_STATUS.PRE_REPORTED_ABSENCE
              : ended
                ? ABSENCE_STATUS.ATTENDANCE
                : ABSENCE_STATUS.NO_STATUS,
          hasAbsenceReportForLesson: reported,
          comment: s.absence.lessons.get(l.id) ?? "",
          nrOfMinutesAbsent: absent
            ? Math.round((l.end.getTime() - l.start.getTime()) / 60_000)
            : 0,
        };
      }),
    };
  }

  const ABSENCE = String.raw`^/eva/api/v1/schools/\d+/student/\d+/parent/\d+/student-absence/week/(\d+)`;
  const TIMEBOOKINGS = String.raw`^/eva/api/v1/parents/\d+/students/\d+/schools/\d+/timebookings`;
  const MESSAGES = String.raw`^/eva/api/v1/parent/\d+/schools/\d+`;
  const PS = String.raw`^/rest-api/parent/ps`;
  const ROOM = String.raw`^/rest-api/parent/ps/subjectroom`;
  const HA = String.raw`^/rest-api/parent/holistic_assessment`;
  const r = (src: string) => new RegExp(`${src}$`);

  return [
    /* ---------- Sign-in and session ---------- */
    [
      "POST",
      r("^/rest-api/login/token"),
      () =>
        json({
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          type: "Bearer",
          expires: 3600,
        }),
    ],
    ["GET", r("^/eva-apps/auth/login/parent"), () => ok()],
    ["POST", r("^/__logout"), () => ok()],
    ["GET", r("^/rest-api/login/schoollist"), () => json(schoolList)],
    [
      "GET",
      r("^/rest-api/parameters"),
      () =>
        json({ useFunctionPS: true, useGuardian: true, useLunchMenu: true, useTimebooking: true }),
    ],

    /* ---------- Parent, profile, children ---------- */
    ["GET", r("^/eva/api/v1/parent"), () => json(parent)],
    ["GET", r(String.raw`^/eva/api/v1/parent/\d+/profile`), () => json(s.profile)],
    [
      "PUT",
      r(String.raw`^/eva/api/v1/parent/\d+/profile/(address|personal|contact|notPublish)`),
      (m, req) => {
        /* notPublish sends `{ active }`; the others send profile fields. */
        const body = bodyOf<Record<string, unknown>>(req);
        if (m[1] === "notPublish") s.profile.notPublish = body.active === true;
        else Object.assign(s.profile, body);
        return ok();
      },
    ],
    [
      "GET",
      r(String.raw`^/eva/api/v1/schools/\d+/parameters/parent/profile/allow-[a-z-]+`),
      () => json(true),
    ],
    [
      "GET",
      r("^/eva/api/v1/resource/(?!attachment/).+"),
      () => notFound() /* initials instead of photos */,
    ],

    /* ---------- Lunch, lessons, staff ---------- */
    [
      "GET",
      r(String.raw`^/eva/api/v1/schools/\d+/lunchmenu/(\d+)`),
      (m) => json(lunchWeek(num(m[1]))),
    ],
    [
      "GET",
      r(String.raw`^/eva/api/v1/schools/\d+/student/\d+/lessons/week/\d+/day/\d+/(current|next)`),
      (m) => json(lessonTile(m[1] as "current" | "next")),
    ],
    ["GET", r(String.raw`^/eva/api/v1/schools/\d+/staff`), () => json(staffGroups)],
    [
      "GET",
      r(String.raw`^/eva/api/v1/schools/\d+/staff/(\d+)`),
      (m) => {
        const d = staffDetail(num(m[1]));
        return d ? json(d) : notFound();
      },
    ],

    /* ---------- News ---------- */
    [
      "GET",
      r(String.raw`^/eva/api/v2/parent/\d+/schools/\d+/news(?:/(old|archived))?`),
      (m) => json(newsFeed(s.news, m[1] ?? "current")),
    ],
    [
      "GET",
      r(String.raw`^/eva/api/v2/parent/\d+/schools/\d+/news/(\d+)`),
      (m) => {
        const n = news(num(m[1]));
        return n ? json(newsDetail(n)) : notFound();
      },
    ],
    [
      "PUT",
      r(String.raw`^/eva/api/v1/parent/\d+/schools/\d+/news/read/(\d+)`),
      (m) => {
        const n = news(num(m[1]));
        if (!n) return notFound();
        n.item.read = true;
        return ok();
      },
    ],
    [
      "POST",
      r(String.raw`^/eva/api/v1/parent/\d+/news-hidden/(\d+)`),
      (m) => {
        const n = news(num(m[1]));
        if (!n) return notFound();
        n.archived = true;
        return ok();
      },
    ],
    [
      "DELETE",
      r(String.raw`^/eva/api/v1/parent/\d+/news-hidden/(\d+)`),
      (m) => {
        const n = news(num(m[1]));
        if (!n) return notFound();
        n.archived = false;
        return ok();
      },
    ],
    [
      "PUT",
      r(String.raw`^/eva/api/v1/parent/\d+/newsconfirm/(\d+)`),
      (m, req) => {
        const n = news(num(m[1]));
        if (!n?.question) return notFound();
        n.item.newsConfirm = {
          responseText: String(bodyOf<{ responseText?: string }>(req).responseText ?? ""),
          confirmDate: iso(new Date()),
        };
        return ok();
      },
    ],
    [
      "GET",
      r(String.raw`^/eva/api/v1/parent/\d+/schools/\d+/news/calendarevent/next`),
      () => json(nextCalendarEvent()),
    ],
    [
      "GET",
      r(String.raw`^/eva/api/v1/resource/attachment/(\d+)`),
      (m) => {
        const id = num(m[1]);
        const name =
          s.news.flatMap((n) => n.attachments).find((a) => a.fileId === id)?.name ??
          s.messages.flatMap((x) => x.detail.attachments).find((a) => a.fileId === id)?.name;
        return name ? file(name) : notFound();
      },
    ],

    /* ---------- Messages ---------- */
    [
      "GET",
      r(`${MESSAGES}/messages/(inbox|sent|bin)`),
      (m) =>
        json(
          s.messages
            .filter((x) => x.folder === m[1])
            .map(messageRow)
            .sort((a, b) => b.date.localeCompare(a.date)),
        ),
    ],
    [
      "GET",
      r(`${MESSAGES}/messages/(\\d+)`),
      (m) => {
        const x = message(num(m[1]));
        return x ? json(x.detail) : notFound();
      },
    ],
    [
      "PUT",
      r(`${MESSAGES}/message-recipient/(read-date|un-read)`),
      (m, req) => {
        const x = message(num(bodyOf<{ messageId?: number }>(req).messageId));
        if (!x) return notFound();
        x.detail.isRead = m[1] === "read-date";
        return ok();
      },
    ],
    [
      "PUT",
      r(`${MESSAGES}/messages/(remove-inbox|remove-sent|restore|delete)`),
      (m, req) => {
        const ids = new Set(Array.isArray(req.body) ? (req.body as number[]) : []);
        for (const x of s.messages.filter((y) => ids.has(y.detail.id))) {
          if (m[1] === "restore") x.folder = x.origin;
          else if (m[1] === "delete") s.messages.splice(s.messages.indexOf(x), 1);
          else x.folder = "bin";
        }
        return ok();
      },
    ],
    [
      "POST",
      r(`${MESSAGES}/messages`),
      (_m, req) => {
        const b = bodyOf<{
          subject?: string;
          messageBody?: string;
          recipients?: { teacherId: number; fname: string; lname: string }[];
        }>(req);
        const id = Math.max(...s.messages.map((x) => x.detail.id), 900200) + 1;
        s.messages.push({
          folder: "sent",
          origin: "sent",
          detail: {
            id,
            subject: b.subject ?? "",
            message: b.messageBody ?? "",
            sender: {
              id: PARENT_ID,
              firstName: parent.firstName,
              lastName: parent.lastName,
              picture: "",
            },
            replyTo: false,
            isRead: true,
            date: iso(new Date()),
            recipients: (b.recipients ?? []).map((t) => ({
              id: t.teacherId,
              firstName: t.fname,
              lastName: t.lname,
            })),
            attachments: [],
            sentByUser: true,
          },
        });
        return ok();
      },
    ],
    ["GET", r(String.raw`^/eva/api/v1/schools/\d+/teachers`), () => json(teachers)],
    [
      "GET",
      r(String.raw`^/eva/api/v1/schools/\d+/teachers/(\d+)`),
      (m) => {
        /* Any staff member can be a reply recipient, not only teachers. */
        const t = staffAsTeacher(num(m[1]));
        return t ? json(t) : notFound();
      },
    ],
    [
      "GET",
      r(String.raw`^/eva/api/v1/schools/\d+/parameters/message-usage-level-allow-all`),
      () => json(true),
    ],

    /* ---------- Bookings ---------- */
    ["GET", r(String.raw`^/eva/api/v1/schools/\d+/parameters/time-bookings`), () => json(true)],
    ["GET", r(TIMEBOOKINGS), () => json(s.bookings.map(bookingSummary))],
    ["GET", r(`${TIMEBOOKINGS}/startpage`), () => json(bookingStartpage(s.bookings))],
    [
      "GET",
      r(`${TIMEBOOKINGS}/(\\d+)`),
      (m) => {
        const b = booking(num(m[1]));
        return b ? json(bookingDetail(b)) : notFound();
      },
    ],
    [
      "POST",
      r(String.raw`^/eva/api/v1/parent/\d+/timebooking-read/(\d+)`),
      (m) => {
        const b = booking(num(m[1]));
        if (!b) return notFound();
        b.isRead = true;
        return ok();
      },
    ],
    [
      "PUT",
      r(
        String.raw`^/eva/api/v1/schools/\d+/parents/\d+/students/\d+/timebookingtimes/(reserve|confirm|cancel)`,
      ),
      (m, req) => {
        const key = bodyOf<{ timebookingid?: number; sequence?: number }>(req);
        const b = booking(num(key.timebookingid));
        const slot = b?.times.find((t) => t.seq === key.sequence);
        if (!b || !slot) return notFound();
        if (m[1] === "reserve") {
          if (slot.takenByOther || b.held !== null) return new Response(null, { status: 409 });
          b.held = slot.seq;
          b.confirmed = true;
        } else if (m[1] === "confirm") {
          if (b.held !== slot.seq) return new Response(null, { status: 409 });
          b.confirmed = true;
        } else {
          if (b.held !== slot.seq) return new Response(null, { status: 409 });
          b.held = null;
          b.confirmed = false;
        }
        return ok();
      },
    ],

    /* ---------- Absence ---------- */
    [
      "GET",
      r(
        String.raw`^/eva/api/v1/schools/\d+/parameters/(report-absence-parent|student-absence-allow-parent-comment-absence|student-absence-allow-parent-change-absence)`,
      ),
      () => json(true),
    ],
    ["GET", r(String.raw`^/eva/api/v1/student/\d+/school/\d+/is-pre-school`), () => json(false)],
    ["GET", r(ABSENCE), (m) => json(absenceWeek(num(m[1])))],
    ["GET", r(`${ABSENCE}/day/(\\d)`), (m) => json(absenceDay(num(m[1]), num(m[2])))],
    [
      "PUT",
      r(`${ABSENCE}/day/(\\d)/date/(\\d+)`),
      (m) => {
        s.absence.fullDays.add(ymd(weekday(weekOffset(num(m[1])), num(m[2]) + 1)));
        return ok();
      },
    ],
    [
      "DELETE",
      r(`${ABSENCE}/day/(\\d)/date/(\\d+)`),
      (m) => {
        s.absence.fullDays.delete(ymd(weekday(weekOffset(num(m[1])), num(m[2]) + 1)));
        return ok();
      },
    ],
    [
      "POST",
      r(`${ABSENCE}/lesson/(\\d+)`),
      (m) => {
        s.absence.lessons.set(num(m[2]), s.absence.lessons.get(num(m[2])) ?? "");
        return ok();
      },
    ],
    [
      "DELETE",
      r(`${ABSENCE}/lesson/(\\d+)`),
      (m) => {
        s.absence.lessons.delete(num(m[2]));
        return ok();
      },
    ],
    [
      "POST",
      r(`${ABSENCE}/comment`),
      (m, req) => {
        s.absence.weekComments.set(
          num(m[1]),
          String(bodyOf<{ comment?: string }>(req).comment ?? ""),
        );
        return ok();
      },
    ],
    [
      "POST",
      r(`${ABSENCE}/lesson/(\\d+)/comment`),
      (m, req) => {
        s.absence.lessons.set(num(m[2]), String(bodyOf<{ comment?: string }>(req).comment ?? ""));
        return ok();
      },
    ],

    /* ---------- Timetable and web calendar ---------- */
    [
      "GET",
      r(String.raw`^/rest-api/parent/calendar/lessons/week/(\d+)`),
      (m) => json(scheduleWeek(weekOffset(num(m[1])))),
    ],
    [
      "GET",
      r(String.raw`^/rest-api/parent/calendar/event/year/(\d+)/week/(\d+)`),
      (m) => {
        const off = weekOffset(num(m[2]), num(m[1]));
        const from = localT(weekday(off, 1));
        const to = localT(weekday(off, 8));
        return json(schoolEvents().filter((e) => e.endDate >= from && e.startDate < to));
      },
    ],
    [
      "GET",
      r("^/rest-api/parent/calendar/event/agenda"),
      (_m, req) => {
        const from = req.query.get("start_date") ?? "";
        const to = req.query.get("end_date") ?? "9999";
        return json(
          schoolEvents().filter(
            (e) => e.endDate.slice(0, 10) >= from && e.startDate.slice(0, 10) <= to,
          ),
        );
      },
    ],
    ["GET", r("^/rest-api/parent/calendar/timebookings"), () => json(bookingCalendar(s.bookings))],
    [
      "GET",
      r("^/rest-api/parent/calendar/subject_room/ps_entities"),
      () => json(calendarEntries(s.assignments)),
    ],

    /* ---------- Assignments ---------- */
    [
      "GET",
      r(`${PS}/assignments/start-page`),
      (_m, req) => {
        const off = weekOffset(
          num(req.query.get("week") ?? isoWeek()),
          num(req.query.get("year") ?? undefined) || undefined,
        );
        const from = weekday(off, 1);
        const to = weekday(off, 8);
        return json(s.assignments.filter((a) => a.due >= from && a.due < to).map(assignmentRow));
      },
    ],
    [
      "GET",
      r(`${PS}/assignments/(\\d+)/view`),
      (m) => {
        const a = assignment(num(m[1]));
        if (!a) return notFound();
        a.read = true; /* opening it marks it read, as upstream */
        return json(assignmentView(a));
      },
    ],
    [
      "GET",
      r(`${PS}/assignments/(\\d+)/sections`),
      (m) => {
        const a = assignment(num(m[1]));
        return a ? json(assignmentSections(a)) : notFound();
      },
    ],
    [
      "GET",
      r(`${PS}/assignments/(\\d+)/connected_plannings`),
      (m) => {
        const a = assignment(num(m[1]));
        return a ? json(connectedPlannings(s.plannings, a)) : notFound();
      },
    ],
    [
      "GET",
      r(`${PS}/submission/(\\d+)`),
      (m) => {
        /* Called with the SUBMISSION section id, not the assignment id. */
        const a = assignment(num(m[1]) - 10_000);
        return a ? json(assignmentSubmission(a)) : notFound();
      },
    ],
    [
      "GET",
      r(`${PS}/assignment/(\\d+)/assessment`),
      (m) => {
        const a = assignment(num(m[1]));
        if (!a) return notFound();
        a.resultRead = true;
        return json(assignmentAssessment(a));
      },
    ],
    [
      "GET",
      r(`${PS}/material/(\\d+)/file`),
      (m) => {
        const a = assignment(num(m[1]) - 30_000);
        return json(a?.materials ?? []);
      },
    ],

    /* ---------- Plannings ---------- */
    [
      "GET",
      r(`${PS}/planning_parts/start-page`),
      (_m, req) =>
        json(
          planningRows(
            s.plannings,
            weekOffset(
              num(req.query.get("week") ?? isoWeek()),
              num(req.query.get("year") ?? undefined) || undefined,
            ),
          ),
        ),
    ],
    [
      "GET",
      r(`${PS}/plannings/(\\d+)/view`),
      (m) => {
        const p = planning(num(m[1]));
        return p
          ? json({
              title: p.title,
              subjectNames: subjectRooms.find((x) => x.activityId === p.room)?.subject ?? "",
              contents: [],
            })
          : notFound();
      },
    ],
    [
      "GET",
      r(`${PS}/plannings/(\\d+)/planning_parts/tabs`),
      (m) => {
        const p = planning(num(m[1]));
        return p
          ? json(p.parts.map((x, i) => ({ id: x.id, order: i + 1, title: x.title })))
          : notFound();
      },
    ],
    [
      "GET",
      r(`${PS}/planning_parts/(\\d+)/view`),
      (m) => {
        const x = part(num(m[1]));
        if (!x) return notFound();
        x.part.read = true;
        return json({
          title: x.part.title,
          subtitle: `${ymd(x.part.start)} – ${ymd(x.part.end)}`,
          description: x.part.description,
          publishDate: friendly(x.part.publish),
        });
      },
    ],
    [
      "GET",
      r(`${PS}/planning_parts/(\\d+)/connected_assignments`),
      (m) => json(connectedAssignments(s.assignments, num(m[1]))),
    ],

    /* ---------- Subject rooms ---------- */
    ["GET", r(`${ROOM}/all`), () => json(subjectRooms)],
    ["GET", r(`${ROOM}/assignments/grid/rows`), () => json(s.assignments.map(roomAssignmentRow))],
    [
      "GET",
      r(`${ROOM}/results/grid/rows`),
      () => json(s.assignments.map(roomResultRow).filter(Boolean)),
    ],
    ["GET", r(`${ROOM}/plannings/grid/rows`), () => json(roomPlanningRows(s.plannings))],
    [
      "GET",
      r(`${ROOM}/(\\d+)`),
      (m) => {
        const room = subjectRooms.find((x) => x.activityId === num(m[1]));
        return room ? json(room) : notFound();
      },
    ],
    [
      "GET",
      r(`${ROOM}/(\\d+)/unread_entities`),
      (m) => {
        const id = num(m[1]);
        const assignments = s.assignments.filter((a) => a.room === id && !a.read).length;
        const results = s.assignments.filter(
          (a) => a.room === id && a.result && !a.resultRead,
        ).length;
        const plannings = s.plannings
          .filter((p) => p.room === id)
          .flatMap((p) => p.parts)
          .filter((p) => !p.read).length;
        return json({ assignments, results, plannings, sum: assignments + results + plannings });
      },
    ],
    ["GET", r(`${ROOM}/(\\d+)/teachers`), (m) => json(roomTeachers(num(m[1])))],
    ["GET", r(`${ROOM}/(\\d+)/information`), (m) => json(roomInformation(num(m[1])))],
    [
      "GET",
      r(`${ROOM}/(\\d+)/assignments/grid/rows`),
      (m) => json(s.assignments.filter((a) => a.room === num(m[1])).map(roomAssignmentRow)),
    ],
    [
      "GET",
      r(`${ROOM}/(\\d+)/results/grid/rows`),
      (m) =>
        json(
          s.assignments
            .filter((a) => a.room === num(m[1]))
            .map(roomResultRow)
            .filter(Boolean),
        ),
    ],
    [
      "GET",
      r(`${ROOM}/(\\d+)/plannings/grid/rows`),
      (m) => json(roomPlanningRows(s.plannings.filter((p) => p.room === num(m[1])))),
    ],

    /* ---------- Holistic assessments ---------- */
    ["GET", r(`${HA}/rows`), () => json(assessmentRows(s.assessments))],
    [
      "GET",
      r(`${HA}/(\\d+)`),
      (m) => {
        const a = assessment(num(m[1]));
        if (!a) return notFound();
        a.read = true;
        return json({
          id: a.id,
          activityName: assessmentSubject(a),
          groupName: "4B",
          studentName: parent.children[0]!.firstName,
          studentId: parent.children[0]!.studentId,
          publishDate: friendly(a.updated),
          publishStatus: "PUBLISHED",
        });
      },
    ],
    [
      "GET",
      r(`${HA}/(\\d+)/sections/published`),
      (m) => {
        const a = assessment(num(m[1]));
        if (!a) return notFound();
        return json(
          a.warning ? ["KNOWLEDGE_DEVELOPMENT", "SUBJECT_WARNING"] : ["KNOWLEDGE_DEVELOPMENT"],
        );
      },
    ],
    [
      "GET",
      r(`${HA}/(\\d+)/knowledge_development/view`),
      (m) => {
        const a = assessment(num(m[1]));
        if (!a) return notFound();
        return json({
          value: a.level,
          supportMeasures: a.supportMeasures,
          updatedByInfo: `Last updated ${friendly(a.updated)} by ${assessmentTeacher(a)}`,
        });
      },
    ],
    [
      "GET",
      r(`${HA}/(\\d+)/subject_warning`),
      (m) => {
        const a = assessment(num(m[1]));
        if (!a?.warning) return json(null);
        return json({
          active: true,
          comment: a.warning,
          createdAt: friendly(a.updated),
          holisticAssessmentId: a.id,
          lastUpdatedAt: friendly(a.updated),
          lastUpdatedBy: assessmentTeacher(a),
          published: true,
          publishedAt: friendly(a.updated),
        });
      },
    ],
    [
      "GET",
      r(`${HA}/(\\d+)/subject_warning/confirm`),
      (m) => {
        const a = assessment(num(m[1]));
        if (!a) return notFound();
        return json({
          hasConfirmed: a.confirmed,
          confirmedAt: a.confirmed
            ? friendly(at(0, new Date().getHours(), new Date().getMinutes()))
            : "",
          name: a.confirmed ? `${parent.firstName} ${parent.lastName}` : "",
        });
      },
    ],
    [
      "POST",
      r(`${HA}/(\\d+)/subject_warning/confirm`),
      (m) => {
        const a = assessment(num(m[1]));
        if (!a) return notFound();
        a.confirmed = true;
        return ok();
      },
    ],

    /* ---------- Server-rendered pages ---------- */
    ["GET", r("^/jsp/student/right_student_school.jsp"), () => html(SCHOOL_PAGE)],
    ["GET", r("^/jsp/student/right_student_library.jsp"), () => html(LIBRARY_PAGE)],
    [
      "GET",
      r("^/jsp/student/right_student_library_download.jsp"),
      (_m, req) =>
        num(req.query.get("requestid") ?? "") === LIBRARY_FILE_ID
          ? file("Absence policy.pdf")
          : notFound(),
    ],
  ];
}
