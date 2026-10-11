/** Subject rooms, the weekly timetable, assignments, plannings, results and
 *  holistic assessments for the mock school. Invented content only; see
 *  `people.ts`. Both children share this data (and the bookings in
 *  `comms.ts`): the mock is about exercising the UI, not modelling two
 *  timetables. Absence reports are kept per child (`routes.ts`). */

import type {
  AssignmentRow,
  AssignmentView,
  CalendarItem,
  ConnectedAssignment,
  ConnectedPlanning,
  HolisticAssessmentRow,
  PlanningRow,
  ScheduleLesson,
  SubjectRoom,
  SubjectRoomAssignmentRow,
  SubjectRoomInformation,
  SubjectRoomPlanningRow,
  SubjectRoomResultRow,
  SubjectRoomTeacher,
} from "../api/schoolsoft.ts";
import { fullName, T } from "./people.ts";
import { at, friendly, hm, local, localT, localTs, shortDay, weekday } from "./time.ts";

/* ---------- Subject rooms ---------- */

interface Room {
  activityId: number;
  subject: string;
  /** Short code as the timetable shows it. */
  code: string;
  color: string;
  teacher: number;
}

export const ROOMS: Room[] = [
  { activityId: 900701, subject: "Mathematics", code: "Ma", color: "#adff9e", teacher: T.lind },
  { activityId: 900702, subject: "English", code: "En", color: "#b5d8e6", teacher: T.okafor },
  { activityId: 900703, subject: "Swedish", code: "Sv", color: "#91a6ed", teacher: T.berg },
  { activityId: 900704, subject: "Science", code: "No", color: "#34c451", teacher: T.lind },
  { activityId: 900705, subject: "History", code: "Hi", color: "#f0ff8f", teacher: T.berg },
  { activityId: 900706, subject: "Music", code: "Mu", color: "#f7beed", teacher: T.haddad },
  {
    activityId: 900707,
    subject: "Physical Education",
    code: "Idh",
    color: "#fcd34d",
    teacher: T.novak,
  },
  { activityId: 900708, subject: "Art", code: "Bl", color: "#e6b8b8", teacher: T.sato },
];

const room = (activityId: number) => ROOMS.find((r) => r.activityId === activityId)!;
const [MA, EN, SV, NO, HI, MU, IDH, BL] = ROOMS.map((r) => r.activityId) as [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const subjectRooms: SubjectRoom[] = ROOMS.map((r) => ({
  activityId: r.activityId,
  subject: r.subject,
  groupNames: ["4B"],
  color: r.color,
  isSubjectRoom: true,
  hiddenForStudents: false,
}));

export function roomTeachers(activityId: number): SubjectRoomTeacher[] {
  const r = room(activityId);
  const [first, ...rest] = fullName(r.teacher).split(" ");
  return [{ id: r.teacher, firstName: first ?? "", lastName: rest.join(" "), role: "Teacher" }];
}

export function roomInformation(activityId: number): SubjectRoomInformation[] {
  if (activityId === MA) {
    return [
      {
        id: 900901,
        information:
          "<p>We practise times tables for ten minutes every morning. Please bring a <strong>calculator</strong> on Thursdays.</p>",
        createdBy: fullName(T.lind),
        createdById: T.lind,
        updatedAt: friendly(at(-12, 8, 5)),
      },
    ];
  }
  if (activityId === EN) {
    return [
      {
        id: 900902,
        information:
          "<p>Reading goal this term: one chapter book a month. Ask the class library for tips.</p>",
        createdBy: fullName(T.okafor),
        createdById: T.okafor,
        updatedAt: friendly(at(-20, 13, 40)),
      },
    ];
  }
  return [];
}

/* ---------- Timetable ---------- */

interface Slot {
  day: number;
  start: string;
  end: string;
  room: number;
  location: string;
}

const SLOTS: Slot[] = [
  { day: 1, start: "08:15", end: "09:00", room: MA, location: "Room 12" },
  { day: 1, start: "09:15", end: "10:00", room: SV, location: "Room 12" },
  { day: 1, start: "10:20", end: "11:05", room: EN, location: "Room 14" },
  { day: 1, start: "12:30", end: "13:30", room: IDH, location: "Gym" },
  { day: 2, start: "08:15", end: "09:00", room: NO, location: "Lab 2" },
  { day: 2, start: "09:15", end: "10:00", room: MA, location: "Room 12" },
  { day: 2, start: "10:20", end: "11:05", room: HI, location: "Room 12" },
  { day: 2, start: "12:30", end: "13:15", room: MU, location: "Music room" },
  { day: 3, start: "08:15", end: "09:00", room: EN, location: "Room 14" },
  { day: 3, start: "09:15", end: "10:00", room: SV, location: "Room 12" },
  { day: 3, start: "10:20", end: "11:50", room: BL, location: "Art studio" },
  { day: 4, start: "08:15", end: "09:00", room: MA, location: "Room 12" },
  { day: 4, start: "09:15", end: "10:00", room: NO, location: "Lab 2" },
  { day: 4, start: "10:20", end: "11:05", room: SV, location: "Room 12" },
  { day: 4, start: "12:30", end: "13:30", room: IDH, location: "Gym" },
  { day: 5, start: "08:15", end: "09:00", room: EN, location: "Room 14" },
  { day: 5, start: "09:15", end: "10:00", room: MA, location: "Room 12" },
  { day: 5, start: "10:20", end: "11:05", room: HI, location: "Room 12" },
];

const time = (d: Date, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
};

/** A stable lesson id per week and slot, shared by the timetable and the
 *  absence views. */
export const lessonId = (weekOff: number, slotIndex: number) =>
  920000 + (weekOff + 50) * 100 + slotIndex;

export function scheduleWeek(weekOff: number): ScheduleLesson[] {
  return SLOTS.map((s, i) => {
    const day = weekday(weekOff, s.day);
    const r = room(s.room);
    return {
      allDay: false,
      category: "lesson",
      dayId: s.day - 1,
      description: r.subject,
      editable: false,
      endDate: localT(time(day, s.end)),
      eventColor: r.color,
      eventId: lessonId(weekOff, i),
      name: r.code,
      room: s.location,
      roomBooking: false,
      startDate: localT(time(day, s.start)),
      status: 2,
      studentLessonStatus: null,
      teacher: fullName(r.teacher),
      teachingGroup: "4B",
    };
  });
}

/** Lessons on day `dayId` (0 = Monday) of a week, for the absence views. */
export function lessonsOn(weekOff: number, dayId: number) {
  return SLOTS.map((s, i) => ({ s, i }))
    .filter(({ s }) => s.day === dayId + 1)
    .map(({ s, i }) => ({
      id: lessonId(weekOff, i),
      subject: room(s.room).subject,
      start: time(weekday(weekOff, s.day), s.start),
      end: time(weekday(weekOff, s.day), s.end),
    }));
}

/** Eva's "current lesson" / "next lesson" tiles for today. */
export function lessonTile(which: "current" | "next") {
  const now = new Date();
  const today = (now.getDay() || 7) as number;
  const lessons = SLOTS.filter((s) => s.day === today).map((s) => ({
    s,
    start: time(now, s.start),
    end: time(now, s.end),
  }));
  const pick =
    which === "current"
      ? lessons.find((l) => l.start <= now && now < l.end)
      : lessons.find((l) => l.start > now);
  if (!pick) return null;
  const r = room(pick.s.room);
  return {
    lessonId: 1,
    subjectName: r.subject,
    groupName: "4B",
    teacherName: fullName(r.teacher),
    location: pick.s.location,
    startTime: `1970-01-01 ${hm(pick.start)}:00.0`,
    endTime: `1970-01-01 ${hm(pick.end)}:00.0`,
  };
}

/* ---------- Assignments and results ---------- */

export interface Assignment {
  id: number;
  room: number;
  title: string;
  type: "Homework" | "Test" | "Assignment";
  publish: Date;
  start: Date;
  due: Date;
  description: string;
  handIn: "DIGITAL" | "PHYSICAL" | null;
  submitted: boolean;
  result: { review: string; comment: string; published: Date } | null;
  materials: { fileId: number; fileName: string }[];
  planningPart: number | null;
  /** Mutable: opening the assignment / its result marks them read. */
  read: boolean;
  resultRead: boolean;
}

export function createAssignments(): Assignment[] {
  return [
    {
      id: 900401,
      room: MA,
      title: "Fractions practice, sheet 3",
      type: "Homework",
      publish: at(-2, 14, 10),
      start: at(-2, 14, 10),
      due: at(2, 8, 0),
      description:
        "<p>Complete questions 1–12 on the sheet. Show how you worked out each answer.</p><ul><li>Use pictures if that helps</li><li>Bring the sheet to class</li></ul>",
      handIn: "PHYSICAL",
      submitted: false,
      result: null,
      materials: [{ fileId: 900451, fileName: "Fractions sheet 3.pdf" }],
      planningPart: 900601,
      read: false,
      resultRead: true,
    },
    {
      id: 900402,
      room: EN,
      title: "Book report: an animal story",
      type: "Assignment",
      publish: at(-6, 9, 0),
      start: at(-6, 9, 0),
      due: at(6, 16, 0),
      description:
        "<p>Read a book about an animal and write half a page about it. Who is the main character, and what happens to them?</p>",
      handIn: "DIGITAL",
      submitted: false,
      result: null,
      materials: [],
      planningPart: null,
      read: true,
      resultRead: true,
    },
    {
      id: 900403,
      room: SV,
      title: "Spelling words, list 7",
      type: "Homework",
      publish: at(-9, 10, 0),
      start: at(-9, 10, 0),
      due: at(-2, 8, 0),
      description:
        "<p>Practise the ten words on list 7. We'll have a short check on the due date.</p>",
      handIn: null,
      submitted: true,
      result: {
        review: "9 of 10 correct",
        comment: "Well done! Watch the double consonants.",
        published: at(-1, 15, 20),
      },
      materials: [],
      planningPart: null,
      read: true,
      resultRead: true,
    },
    {
      id: 900404,
      room: NO,
      title: "Quiz: plants and animals",
      type: "Test",
      publish: at(-3, 12, 0),
      start: weekday(1, 2, 8, 15),
      due: weekday(1, 2, 9, 0),
      description:
        "<p>A short quiz on what plants need to grow and how animals adapt to winter. Use the planning page to revise.</p>",
      handIn: null,
      submitted: false,
      result: null,
      materials: [],
      planningPart: 900603,
      read: false,
      resultRead: true,
    },
    {
      id: 900405,
      room: HI,
      title: "Vikings timeline",
      type: "Assignment",
      publish: at(-21, 9, 30),
      start: at(-21, 9, 30),
      due: at(-7, 16, 0),
      description: "<p>Make a timeline with at least five events from the Viking Age.</p>",
      handIn: "DIGITAL",
      submitted: true,
      result: {
        review: "Meets the goals",
        comment: "A clear and colourful timeline. Next time, add a sentence about each event.",
        published: at(0, 7, 45),
      },
      materials: [],
      planningPart: null,
      read: true,
      resultRead: false,
    },
    {
      id: 900406,
      room: EN,
      title: "Weekly words, week list",
      type: "Homework",
      publish: at(-1, 15, 0),
      start: at(-1, 15, 0),
      due: weekday(1, 1, 8, 0),
      description: "<p>Learn the meaning and spelling of this week's ten words.</p>",
      handIn: null,
      submitted: false,
      result: null,
      materials: [],
      planningPart: null,
      read: true,
      resultRead: true,
    },
  ];
}

function submissionStatus(a: Assignment): AssignmentRow["submissionStatus"] {
  const expired = a.due.getTime() < Date.now();
  if (a.submitted) return expired ? "EXPIRED_SUBMITTED" : "SUBMITTED";
  return expired ? "EXPIRED_NOT_SUBMITTED" : "NOT_SUBMITTED";
}

const subjects = (activityId: number) => {
  const r = room(activityId);
  return [{ name: r.subject, color: r.color }];
};

export function assignmentRow(a: Assignment): AssignmentRow {
  return {
    activityId: a.room,
    id: a.id,
    read: a.read,
    resultReportStatus: a.result ? "REPORTED" : "NOT_REPORTED",
    sortDate: local(a.due),
    subTitle: `Due ${shortDay(a.due)} ${hm(a.due)}, ${a.type}, ${room(a.room).subject}`,
    submissionStatus: submissionStatus(a),
    title: a.title,
  };
}

export function roomAssignmentRow(a: Assignment): SubjectRoomAssignmentRow {
  return {
    subjects: subjects(a.room),
    assignmentId: a.id,
    activityId: a.room,
    title: a.title,
    assignmentType: a.type,
    submissionStatus: submissionStatus(a),
    submissionDate: local(a.due),
    resultReportStatus: a.result ? "REPORTED" : "NOT_REPORTED",
    startDate: local(a.start),
    endDate: local(a.due),
    publishDate: local(a.publish),
    teacher: fullName(room(a.room).teacher),
    status: a.due.getTime() < Date.now() ? "EXPIRED" : "ONGOING",
    read: a.read,
  };
}

export function roomResultRow(a: Assignment): SubjectRoomResultRow | null {
  if (!a.result) return null;
  return {
    subjects: subjects(a.room),
    assignmentId: a.id,
    activityId: a.room,
    title: a.title,
    assignmentType: a.type,
    teacher: fullName(room(a.room).teacher),
    publishDate: local(a.result.published),
    read: a.resultRead,
  };
}

export function assignmentView(a: Assignment): AssignmentView {
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    subTitle: `${shortDay(a.start)} ${hm(a.start)} – ${shortDay(a.due)} ${hm(a.due)}`,
    subjectNames: room(a.room).subject,
    description: a.description,
    publishDate: friendly(a.publish),
    integrationType: null,
    contents: [],
  };
}

export function assignmentSections(a: Assignment) {
  const out: { id: number; type: string }[] = [];
  if (a.handIn) out.push({ id: a.id + 10_000, type: "SUBMISSION" });
  if (a.result) out.push({ id: a.id + 20_000, type: "RESULTREPORT" });
  if (a.materials.length > 0) out.push({ id: a.id + 30_000, type: "MATERIAL" });
  return out;
}

export function assignmentSubmission(a: Assignment) {
  return {
    allowLateHandIn: true,
    closeDate: "",
    description: a.handIn === "PHYSICAL" ? "Hand in on paper in class." : null,
    expireDate: localT(a.due),
    groupHandIn: false,
    handInType: a.handIn ?? "PHYSICAL",
    plagiarismCheck: false,
    submissionStatus: {
      groupSubmissionId: -1,
      studentSubmissionId: a.id + 40_000,
      submitted: a.submitted,
    },
  };
}

export function assignmentAssessment(a: Assignment) {
  return {
    review: a.result?.review ?? "",
    studentComment: "",
    teacherComment: a.result?.comment ?? "",
    assessedCriteriaTabs: [],
    assessmentPartialMoments: [],
  };
}

export function calendarEntries(list: Assignment[]): CalendarItem[] {
  return list
    .filter((a) => a.type !== "Assignment")
    .map((a) => ({
      name: a.title,
      startDate: localT(a.type === "Test" ? a.start : a.due),
      endDate: localT(a.due),
      allDay: false,
      category: "test",
      typeName: a.type,
      activityId: a.room,
      activity: room(a.room).code,
      entityId: a.id,
    }));
}

/* ---------- Plannings ---------- */

export interface PlanningPart {
  id: number;
  title: string;
  start: Date;
  end: Date;
  publish: Date;
  description: string;
  read: boolean;
}

export interface Planning {
  id: number;
  room: number;
  title: string;
  parts: PlanningPart[];
}

export function createPlannings(): Planning[] {
  return [
    {
      id: 900501,
      room: MA,
      title: "Fractions and decimals",
      parts: [
        {
          id: 900601,
          title: "Part 1: what is a fraction?",
          start: at(-14),
          end: at(7),
          publish: at(-15, 16, 0),
          description:
            "<p>We will learn to:</p><ul><li>show fractions with pictures and on a number line</li><li>compare fractions with the same denominator</li></ul>",
          read: true,
        },
        {
          id: 900602,
          title: "Part 2: decimals",
          start: at(8),
          end: at(28),
          publish: at(-1, 17, 30),
          description: "<p>Tenths and hundredths, and how they relate to fractions.</p>",
          read: false,
        },
      ],
    },
    {
      id: 900502,
      room: NO,
      title: "Living things through the year",
      parts: [
        {
          id: 900603,
          title: "Plants and animals in winter",
          start: at(-10),
          end: at(10),
          publish: at(-11, 12, 0),
          description:
            "<p>How do plants and animals get through the winter? We will go outside and look for signs every Wednesday.</p>",
          read: true,
        },
      ],
    },
  ];
}

const span = (p: PlanningPart) => `${shortDay(p.start)} – ${shortDay(p.end)}`;

export function planningRows(list: Planning[], weekOff: number): PlanningRow[] {
  const from = weekday(weekOff, 1);
  const to = weekday(weekOff, 8);
  return list.flatMap((pl) =>
    pl.parts
      .filter((p) => p.start < to && p.end >= from)
      .map((p) => ({
        activityId: pl.room,
        id: p.id,
        planningId: pl.id,
        read: p.read,
        subTitle: `${span(p)} Planning, ${room(pl.room).subject}`,
        title: `${pl.title}: ${p.title}`,
      })),
  );
}

export function roomPlanningRows(list: Planning[]): SubjectRoomPlanningRow[] {
  return list.flatMap((pl) =>
    pl.parts.map((p) => ({
      subjects: subjects(pl.room),
      planningPartId: p.id,
      planningId: pl.id,
      activityId: pl.room,
      planningTitle: pl.title,
      planningPartTitle: p.title,
      teacher: fullName(room(pl.room).teacher),
      startDate: local(p.start),
      endDate: local(p.end),
      publishDate: local(p.publish),
      status: p.end.getTime() < Date.now() ? "EXPIRED" : "ONGOING",
      read: p.read,
    })),
  );
}

export function connectedPlannings(list: Planning[], a: Assignment): ConnectedPlanning[] {
  return list.flatMap((pl) =>
    pl.parts
      .filter((p) => p.id === a.planningPart)
      .map((p) => ({
        id: p.id,
        title: `${pl.title}: ${p.title}`,
        subTitle: span(p),
        planningId: pl.id,
        read: p.read,
        sortDate: local(p.start),
      })),
  );
}

export function connectedAssignments(list: Assignment[], partId: number): ConnectedAssignment[] {
  return list
    .filter((a) => a.planningPart === partId)
    .map((a) => ({
      id: a.id,
      title: a.title,
      subTitle: `Due ${local(a.due)} | ${a.type}`,
      planningId: null,
      read: a.read,
      sortDate: null,
    }));
}

/* ---------- Holistic assessments ---------- */

export interface Assessment {
  id: number;
  room: number;
  level: string;
  warning: string | null;
  supportMeasures: string;
  updated: Date;
  read: boolean;
  confirmed: boolean;
}

export function createAssessments(): Assessment[] {
  return [
    {
      id: 900801,
      room: MA,
      level: "Is working towards acceptable knowledge",
      warning:
        "Robin needs more practice with written subtraction across tens. We'll work on it in class; ten minutes of practice at home a few times a week would help.",
      supportMeasures: "Extra practice in a small group on Fridays.",
      updated: at(-1, 16, 40),
      read: false,
      confirmed: false,
    },
    {
      id: 900802,
      room: EN,
      level: "Has more than acceptable knowledge",
      warning: null,
      supportMeasures: "",
      updated: at(-30, 10, 5),
      read: true,
      confirmed: false,
    },
    {
      id: 900803,
      room: SV,
      level: "Has acceptable knowledge",
      warning: null,
      supportMeasures: "",
      updated: at(-30, 10, 20),
      read: true,
      confirmed: false,
    },
  ];
}

export function assessmentRows(list: Assessment[]): HolisticAssessmentRow[] {
  const published: HolisticAssessmentRow[] = list.map((a) => ({
    title: room(a.room).subject,
    subTitle: a.warning ? "Subject warning" : a.level,
    color: room(a.room).color,
    subjectWarning: a.warning !== null,
    updatedAt: localTs(a.updated),
    friendlyUpdatedAt: friendly(a.updated),
    holisticAssessmentId: a.id,
    published: true,
    read: a.read,
  }));
  const unpublished = [MU, BL].map((id) => ({
    title: room(id).subject,
    subTitle: "No assessment published",
    color: "#757575",
    subjectWarning: false,
    updatedAt: "-",
    friendlyUpdatedAt: "-",
    holisticAssessmentId: -1,
    published: false,
    read: false,
  }));
  return [...published, ...unpublished];
}

export const assessmentSubject = (a: Assessment) => {
  const r = room(a.room);
  return `${r.subject} (${r.code.toUpperCase()})`;
};

export const assessmentTeacher = (a: Assessment) => fullName(room(a.room).teacher);
