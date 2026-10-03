/** Pure helpers for the subject room pages. Kept framework-free for `node --test`. */

import type {
  SubjectRoomAssignmentRow,
  SubjectRoomPlanningRow,
  SubjectRoomResultRow,
} from "../api/schoolsoft.ts";
import type { SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";

/** Parse SchoolSoft's local "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" into a Date in
 *  the browser's zone. `Date.parse` on that shape is implementation-defined
 *  (Safari reads the space-separated form as invalid), so parse explicitly. */
export function parseLocalDateTime(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Teacher-picked subject colours arrive as free text. Only let through a
 *  plain hex colour so nothing else can reach a `style` attribute. */
export function safeHexColor(value: string | null | undefined, fallback = "#94a3b8"): string {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback;
}

function time(s: string): number {
  return parseLocalDateTime(s)?.getTime() ?? 0;
}

/** Split assignments into upcoming (soonest first) and past (most recent
 *  first). "Upcoming" means the end date has not passed yet, which is what a
 *  guardian cares about; the server's `status` flag lags on the day itself. */
export function partitionAssignments(
  rows: SubjectRoomAssignmentRow[],
  now: Date = new Date(),
): { upcoming: SubjectRoomAssignmentRow[]; past: SubjectRoomAssignmentRow[] } {
  const nowMs = now.getTime();
  const upcoming: SubjectRoomAssignmentRow[] = [];
  const past: SubjectRoomAssignmentRow[] = [];
  for (const r of rows) {
    const end = time(r.endDate || r.startDate);
    (end >= nowMs ? upcoming : past).push(r);
  }
  upcoming.sort((a, b) => time(a.startDate) - time(b.startDate));
  past.sort((a, b) => time(b.endDate || b.startDate) - time(a.endDate || a.startDate));
  return { upcoming, past };
}

/** Plannings that are running now first (ending soonest), then upcoming, then
 *  finished ones (most recent first). */
export function sortPlannings(
  rows: SubjectRoomPlanningRow[],
  now: Date = new Date(),
): SubjectRoomPlanningRow[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const rank = (r: SubjectRoomPlanningRow) => {
    const start = time(r.startDate);
    const end = time(r.endDate);
    if (end < today) return 2;
    if (start > today) return 1;
    return 0;
  };
  return [...rows].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 2) return time(b.endDate) - time(a.endDate);
    if (ra === 1) return time(a.startDate) - time(b.startDate);
    return time(a.endDate) - time(b.endDate);
  });
}

export function sortResults(rows: SubjectRoomResultRow[]): SubjectRoomResultRow[] {
  return [...rows].sort((a, b) => time(b.publishDate) - time(a.publishDate));
}

/** "Tue 5 Oct, 10:15" style label; date only when there is no time part. */
export function formatRoomDate(s: string, withTime = true): string {
  const d = parseLocalDateTime(s);
  if (!d) return s;
  /* Midnight is how SchoolSoft encodes "no particular time" on due dates. */
  const hasTime = withTime && /\d{2}:\d{2}/.test(s) && !/ 00:00/.test(s);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/* Query-cache keys shared by the list and detail pages, so opening a subject
 * from the list renders from cache without another round trip. */
export const subjectRoomKeys = {
  all: (ctx: SchoolsoftContext) => `${ctx.keyPrefix}subjectrooms`,
  room: (ctx: SchoolsoftContext, id: number) => `${ctx.keyPrefix}subjectroom:${id}`,
  teachers: (ctx: SchoolsoftContext, id: number) => `${ctx.keyPrefix}subjectroom:${id}:teachers`,
  assignments: (ctx: SchoolsoftContext, id: number) =>
    `${ctx.keyPrefix}subjectroom:${id}:assignments`,
  results: (ctx: SchoolsoftContext, id: number) => `${ctx.keyPrefix}subjectroom:${id}:results`,
  plannings: (ctx: SchoolsoftContext, id: number) => `${ctx.keyPrefix}subjectroom:${id}:plannings`,
  information: (ctx: SchoolsoftContext, id: number) => `${ctx.keyPrefix}subjectroom:${id}:info`,
};

/** When-label for an assignment row: its start while that is still ahead,
 *  otherwise its due date — a task that opened in August and is due in
 *  December should read "due Fri 18 Dec", not "Tue 18 Aug". */
export function assignmentWhen(
  row: Pick<SubjectRoomAssignmentRow, "startDate" | "endDate">,
  now: Date = new Date(),
): string {
  const start = parseLocalDateTime(row.startDate);
  if (start && start.getTime() > now.getTime()) return formatRoomDate(row.startDate);
  return row.endDate ? `due ${formatRoomDate(row.endDate)}` : formatRoomDate(row.startDate);
}
