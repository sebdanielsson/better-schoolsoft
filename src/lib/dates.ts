/** Local-calendar date helpers shared by the week- and day-navigating views.
 *  "Local" is the browser's zone; Swedish wall-clock maths lives in
 *  `absence.ts`. */

/** ISO week number for a Date (1–53). */
export function isoWeek(d: Date = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** ISO week-numbering year for a Date — usually equal to the calendar year,
 *  but differs in early Jan / late Dec when an ISO week straddles years. */
export function isoWeekYear(d: Date = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  return date.getUTCFullYear();
}

/** ISO day-of-week (Mon=1 … Sun=7). */
export function isoDay(d: Date = new Date()): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Local midnight of `d`. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** True when `a` and `b` fall on the same local calendar day. */
export function sameLocalDate(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Monday 00:00 (local) of the ISO week containing `d`. */
export function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (isoDay(d) - 1));
}

/** `d` moved by `n` calendar days, keeping its time of day (DST-safe). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

/** "29 Sep – 5 Oct" for the week starting on `monday`. */
export function formatWeekRange(monday: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString(undefined, opts)} – ${addDays(monday, 6).toLocaleDateString(undefined, opts)}`;
}

/** "Mon, 6 Oct" by default; pass `opts` for another shape. */
export function formatDate(ms: number, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString(
    undefined,
    opts ?? { weekday: "short", month: "short", day: "numeric" },
  );
}

/** 24-hour "HH:MM". */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "Today", "Tomorrow", "Yesterday", "In 3 days", else a short date. */
export function relativeDay(ms: number, now: Date = new Date()): string {
  const diff = Math.round(
    (startOfDay(new Date(ms)).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return formatDate(ms);
}
