import type {
  CalendarItem,
  Lesson,
  ScheduleLesson,
  StudentLessonStatus,
} from "../api/schoolsoft.ts";
import { addDays, isoDay, isoWeek, isoWeekYear, sameLocalDate, startOfDay } from "./dates.ts";
import { expandSubjectCode } from "./subject-codes.ts";

/** Map a `ScheduleLesson` from the rest-api schedule onto the `Lesson` shape
 *  the lesson rows render.
 *  - Standard Skolverket subject codes ("Ma", "SO", …) expanded to long names.
 *  - Teacher fields come back as "A,B" without a space — normalize so the row
 *    reads "A, B" cleanly.
 *  - `startTime`/`endTime` become "YYYY-MM-DD HH:MM:SS.0", the shape
 *    `formatLessonTime` and `lessonDayIndex` read.
 *  - Cancellation and absence follow the SchoolSoft web calendar: `status`
 *    3 is struck through, and see `lessonAbsence`. */
export function scheduleLessonToLesson(l: ScheduleLesson): Lesson {
  const name = expandSubjectCode(l.name);
  return {
    id: l.eventId,
    subjectId: l.eventId,
    startTime: `${l.startDate.replace("T", " ")}:00.0`,
    endTime: `${l.endDate.replace("T", " ")}:00.0`,
    groupName: name,
    subjectName: name,
    teacherName: l.teacher ? l.teacher.replace(/,\s*/g, ", ") : undefined,
    location: l.room || undefined,
    cancelled: l.status === 3 || undefined,
    absence: lessonAbsence(l.studentLessonStatus),
    color: /^#[0-9a-f]{6}$/i.test(l.eventColor) ? l.eventColor : undefined,
  };
}

/** The web calendar's absence marker: nothing when unreported, present
 *  (`status` 0) or `statusType` 1; "approved absence" for `statusType` 3 and
 *  4; an absence icon for anything else. */
export function lessonAbsence(
  s: StudentLessonStatus | null | undefined,
): "approved" | "unapproved" | undefined {
  if (!s || s.status === 0 || s.statusType === 1) return undefined;
  return s.statusType === 3 || s.statusType === 4 ? "approved" : "unapproved";
}

/** The lessons (not other calendar categories) on `date`, in start order. */
export function scheduleLessonsForDate(scheduleLessons: ScheduleLesson[], date: Date): Lesson[] {
  return scheduleLessons
    .filter((l) => l.category === "lesson")
    .filter((l) => sameLocalDate(new Date(l.startDate), date))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(scheduleLessonToLesson);
}

export type CalendarItemKind = "test" | "booking" | "event";

/** A calendar entry placed on the schedule. */
export interface WeekItem {
  key: string;
  kind: CalendarItemKind;
  title: string;
  /** "Assessment", "Hemläxa", the booking teacher, … */
  detail?: string;
  /** Epoch ms. */
  start: number;
  end: number;
  allDay: boolean;
  /** Subject room to link a test to. */
  activityId?: number;
}

/** True for entries spanning more than a week (term projects, standing
 *  assessments), which the week strip can hide. Counted in calendar days so
 *  a DST change inside the span doesn't tip an exact week over. */
export function isLongRunning(item: WeekItem): boolean {
  const days = Math.round(
    (startOfDay(new Date(item.end)).getTime() - startOfDay(new Date(item.start)).getTime()) /
      86_400_000,
  );
  return days > 7;
}

/** Parse SchoolSoft's zone-less "YYYY-MM-DD[THH:mm]" as local time. */
function localMs(s: string): number {
  const [d, t = "00:00"] = s.split("T");
  const [y, m, day] = (d ?? "").split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, day ?? 1, h ?? 0, min ?? 0).getTime();
}

function kindOf(category: string): CalendarItemKind | null {
  if (category === "planning") return null; /* multi-week; the Plannings card covers these */
  if (category === "test") return "test";
  if (category === "timeBooking") return "booking";
  return "event";
}

/** The week's non-lesson entries, split the way the schedule shows them:
 *  timed entries in their weekday's column (1–5), all-day and multi-day ones
 *  in a strip across the week. Plannings and weekend-only entries are left
 *  out. */
export function weekItems(
  items: CalendarItem[],
  monday: Date,
): { allWeek: WeekItem[]; byDay: Record<number, WeekItem[]> } {
  const weekStart = startOfDay(monday).getTime();
  const weekEnd = addDays(startOfDay(monday), 5).getTime(); /* Saturday 00:00 */
  const allWeek: WeekItem[] = [];
  const byDay: Record<number, WeekItem[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const seen = new Set<string>();
  for (const it of items) {
    const kind = kindOf(it.category);
    if (!kind) continue;
    const start = localMs(it.startDate);
    const end = Math.max(start, localMs(it.endDate));
    /* Ending at Monday 00:00 means it finished last week. */
    const endsBefore = end < weekStart || (end === weekStart && end > start);
    if (endsBefore || start >= weekEnd) continue;
    /* Deduplicate on what the user sees: the same test is often listed
     * once per teaching group, with different entity ids. */
    const key = `${kind}:${it.name.trim()}:${it.startDate}:${it.endDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item: WeekItem = {
      key,
      kind,
      title: it.name.trim(),
      detail: it.typeName || it.teacher || undefined,
      start,
      end,
      allDay: it.allDay,
      activityId: it.activityId || undefined,
    };
    const startDate = new Date(start);
    const singleDay = sameLocalDate(startDate, new Date(end));
    if (!it.allDay && singleDay) {
      const day = isoDay(startDate);
      if (day <= 5) byDay[day]!.push(item);
    } else {
      allWeek.push(item);
    }
  }
  for (const list of [allWeek, ...Object.values(byDay)]) list.sort((a, b) => a.start - b.start);
  return { allWeek, byDay };
}

/** True when a zone-less SchoolSoft date falls in ISO week `week` of ISO
 *  week-year `year`. */
export function inWeek(date: string, week: number, year: number): boolean {
  const d = new Date(localMs(date));
  return isoWeek(d) === week && isoWeekYear(d) === year;
}

/** A lesson's start as epoch ms, for ordering it among calendar items. */
export function lessonStartMs(l: Lesson): number {
  return localMs(l.startTime.slice(0, 16).replace(" ", "T"));
}

/** The last instant an entry covers, for labelling its date span. A span
 *  that ends exactly at midnight ends the day before (as `weekItems`
 *  already assumes); timed entries and zero-length ones keep their end. */
export function lastIncludedMs(item: WeekItem): number {
  const end = new Date(item.end);
  const atMidnight = end.getHours() === 0 && end.getMinutes() === 0;
  return atMidnight && item.end > item.start ? item.end - 1 : item.end;
}
