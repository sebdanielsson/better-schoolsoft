/** Pure helpers for absence reporting. Kept framework-free for `node --test`. */

import { ABSENCE_STATUS, LESSON_STATUS, type AbsenceLesson } from "../api/schoolsoft.ts";

const SCHOOL_TZ = "Europe/Stockholm";

/** Offset of `tz` from UTC at instant `utcMs`, in ms (e.g. +2h in CEST). */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Epoch millis of 00:00 on the given calendar date in Swedish time. This is
 *  the `{date}` the full-day absence endpoint expects; computing it in the
 *  school's zone rather than the browser's keeps a traveller's report on the
 *  right day. */
export function schoolMidnightMs(year: number, monthIndex: number, day: number): number {
  const naive = Date.UTC(year, monthIndex, day);
  /* Two passes: the offset at the naive guess can differ from the offset at
   * the true instant only across a DST switch, and one correction settles it. */
  let guess = naive - tzOffsetMs(naive, SCHOOL_TZ);
  guess = naive - tzOffsetMs(guess, SCHOOL_TZ);
  return guess;
}

/** Epoch millis for "HH:mm" on the given date, in Swedish time. */
export function schoolTimeMs(year: number, monthIndex: number, day: number, hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  const minutes = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  return schoolMidnightMs(year, monthIndex, day) + minutes * 60_000;
}

/** Monday 00:00 (local) of the ISO week containing `d`. */
export function mondayOf(d: Date): Date {
  const day = d.getDay() || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** A full day can be reported only before its first lesson starts, matching
 *  the official app. A day with no lessons cannot be reported at all. */
export function canReportFullDay(day: Date, lessons: AbsenceLesson[], nowMs: number): boolean {
  if (lessons.length === 0) return false;
  return lessons.every(
    (l) => schoolTimeMs(day.getFullYear(), day.getMonth(), day.getDate(), l.startTime) > nowMs,
  );
}

/** True once the lesson's end time has passed (Swedish time). */
export function lessonEnded(day: Date, lesson: AbsenceLesson, nowMs: number): boolean {
  return schoolTimeMs(day.getFullYear(), day.getMonth(), day.getDate(), lesson.endTime) <= nowMs;
}

/** A lesson can be reported until it ends, while the teacher has not taken
 *  attendance and it is not cancelled — the official app's rules. */
export function canReportLesson(
  day: Date,
  lesson: AbsenceLesson,
  fullDayReported: boolean,
  nowMs: number,
): boolean {
  if (fullDayReported || lesson.hasAbsenceReportForLesson) return false;
  if (lessonEnded(day, lesson, nowMs)) return false;
  return lesson.lessonStatus === LESSON_STATUS.UNREPORTED;
}

/** A guardian's own lesson report can be withdrawn until the lesson ends or
 *  attendance is taken. */
export function canWithdrawLesson(day: Date, lesson: AbsenceLesson, nowMs: number): boolean {
  return (
    lesson.hasAbsenceReportForLesson &&
    lesson.lessonStatus === LESSON_STATUS.UNREPORTED &&
    !lessonEnded(day, lesson, nowMs)
  );
}

export type AttendanceTone = "present" | "absent" | "explained" | "reported" | "pending" | "muted";

export interface AttendanceLabel {
  label: string;
  tone: AttendanceTone;
}

/** What actually happened in a lesson, from the guardian's point of view. */
export function lessonAttendance(lesson: AbsenceLesson, ended = true): AttendanceLabel {
  if (lesson.lessonStatus === LESSON_STATUS.CANCELLED) return { label: "Cancelled", tone: "muted" };
  switch (lesson.lessonStatusStudent) {
    case ABSENCE_STATUS.ATTENDANCE:
      return lesson.nrOfMinutesAbsent > 0
        ? { label: `Present, ${lesson.nrOfMinutesAbsent} min late`, tone: "explained" }
        : { label: "Present", tone: "present" };
    case ABSENCE_STATUS.ABSENT:
      return { label: "Absent", tone: "absent" };
    case ABSENCE_STATUS.EXPLAINED_ABSENCE:
      return { label: "Explained absence", tone: "explained" };
    case ABSENCE_STATUS.PRE_REPORTED_ABSENCE:
      return { label: "Reported by guardian", tone: "reported" };
    case ABSENCE_STATUS.APPLICATION_OF_LEAVE_APPROVED:
      return { label: "Approved leave", tone: "reported" };
    default:
      return lesson.hasAbsenceReportForLesson
        ? { label: "Reported by guardian", tone: "reported" }
        : lesson.lessonStatus === LESSON_STATUS.REPORTED
          ? { label: "Registered", tone: "present" }
          : ended
            ? { label: "Not registered", tone: "pending" }
            : { label: "Upcoming", tone: "pending" };
  }
}

/* Keys carry the ISO week-year: week numbers alone repeat every year. Each
 * week's keys share a prefix ending in ":" so week 1 never matches week 10. */
export const absenceKeys = {
  permissions: (prefix: string) => `${prefix}absence:permissions`,
  weekPrefix: (prefix: string, year: number, week: number) => `${prefix}absence:${year}-w${week}:`,
  week: (prefix: string, year: number, week: number) =>
    `${absenceKeys.weekPrefix(prefix, year, week)}summary`,
  day: (prefix: string, year: number, week: number, dayId: number) =>
    `${absenceKeys.weekPrefix(prefix, year, week)}day${dayId}`,
};

/** Monday of ISO week `week` in ISO week-year `year`. */
export function mondayOfIsoWeek(year: number, week: number): Date {
  /* ISO week 1 is the week containing 4 January. */
  return addDays(mondayOf(new Date(year, 0, 4)), (week - 1) * 7);
}

/** The absence endpoint takes a bare week number, so it can only address one
 *  school year. Mirror the web app's week picker (w27 … w26): navigation is
 *  limited to the school year containing `today`, where each number is
 *  unambiguous. Returns the first and last Monday. */
export function schoolYearWeeks(today: Date): { first: Date; last: Date } {
  const thisMonday = mondayOf(today);
  let startYear = today.getFullYear();
  if (thisMonday < mondayOfIsoWeek(startYear, 27)) startYear -= 1;
  return {
    first: mondayOfIsoWeek(startYear, 27),
    last: mondayOfIsoWeek(startYear + 1, 26),
  };
}
