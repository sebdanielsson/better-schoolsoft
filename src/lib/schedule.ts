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
  /** Long subject name for tests ("Chemistry"), when the code is known. */
  subject?: string;
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
/** Map the calendar feeds to display entries: plannings dropped (multi-week;
 *  the Plannings card covers them), and the same entry listed once per
 *  teaching group collapsed. Unsorted. */
export function toWeekItems(items: CalendarItem[]): WeekItem[] {
  const out: WeekItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const kind = kindOf(it.category);
    if (!kind) continue;
    /* Deduplicate on what the user sees: the same test is often listed
     * once per teaching group, with different entity and subject ids. */
    const key = `${kind}:${it.name.trim()}:${it.startDate}:${it.endDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = localMs(it.startDate);
    const subject = it.activity ? expandSubjectCode(it.activity) : undefined;
    out.push({
      key,
      kind,
      title: it.name.trim(),
      detail: it.typeName || it.teacher || undefined,
      start,
      end: Math.max(start, localMs(it.endDate)),
      allDay: it.allDay,
      activityId: it.activityId || undefined,
      subject: subject && subject !== it.activity ? subject : undefined,
    });
  }
  return out;
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
  for (const item of toWeekItems(items)) {
    if (!overlaps(item, weekStart, weekEnd)) continue;
    const startDate = new Date(item.start);
    /* Exclusive end: 09:00 → next day 00:00 covers only the first day. */
    const singleDay = sameLocalDate(startDate, new Date(lastIncludedMs(item)));
    if (!item.allDay && singleDay) {
      const day = isoDay(startDate);
      if (day <= 5) byDay[day]!.push(item);
    } else {
      allWeek.push(item);
    }
  }
  for (const list of [allWeek, ...Object.values(byDay)]) list.sort((a, b) => a.start - b.start);
  return { allWeek, byDay };
}

/** True when the entry covers any instant in [from, to). An entry ending
 *  exactly at `from` (e.g. at midnight) finished before it. */
function overlaps(item: WeekItem, from: number, to: number): boolean {
  const endsBefore = item.end < from || (item.end === from && item.end > item.start);
  return !endsBefore && item.start < to;
}

/** Upcoming entries for the Calendar page: those already under way at
 *  `from` (ongoing), then the ones starting in [from, to) grouped by the
 *  local day they start, in order. */
export function agenda(
  items: WeekItem[],
  from: Date,
  to: Date,
): { ongoing: WeekItem[]; days: Array<{ day: number; items: WeekItem[] }> } {
  const fromMs = startOfDay(from).getTime();
  const toMs = to.getTime();
  const ongoing: WeekItem[] = [];
  const byDay = new Map<number, WeekItem[]>();
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    if (!overlaps(item, fromMs, toMs)) continue;
    if (item.start < fromMs) {
      ongoing.push(item);
      continue;
    }
    const day = startOfDay(new Date(item.start)).getTime();
    const list = byDay.get(day) ?? [];
    list.push(item);
    byDay.set(day, list);
  }
  return { ongoing, days: [...byDay].map(([day, list]) => ({ day, items: list })) };
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

/** The next `n` entries for the Home card: starting today or later, not yet
 *  over, and not long-running (those would sit at the top all term). */
export function nextEntries(items: WeekItem[], now: Date, n: number): WeekItem[] {
  const today = startOfDay(now).getTime();
  return items
    .filter((it) => it.start >= today && lastIncludedMs(it) >= now.getTime() && !isLongRunning(it))
    .sort((a, b) => a.start - b.start)
    .slice(0, n);
}
