/** Date helpers for the mock data. Everything is relative to the moment mock
 *  mode starts, so the preview always shows "this week". */

import { addDays, isoWeek, isoWeekYear, mondayOf } from "../lib/dates.ts";

const pad = (n: number) => String(n).padStart(2, "0");

/** `days` from today at `hh:mm` local time. */
export function at(days: number, hh = 0, mm = 0): Date {
  const d = addDays(new Date(), days);
  d.setHours(hh, mm, 0, 0);
  return d;
}

/** Day `dayId` (1 = Monday … 7 = Sunday) of the week `weekOffset` weeks
 *  from this one, at `hh:mm`. */
export function weekday(weekOffset: number, dayId: number, hh = 0, mm = 0): Date {
  const d = addDays(mondayOf(new Date()), weekOffset * 7 + dayId - 1);
  d.setHours(hh, mm, 0, 0);
  return d;
}

/** Monday of ISO week `week` in `year` (local midnight). */
export function mondayOfWeek(week: number, year = isoWeekYear(new Date())): Date {
  const jan4 = new Date(year, 0, 4);
  return addDays(mondayOf(jan4), (week - 1) * 7);
}

/** Offset in weeks between ISO week `week` and the current week. Endpoints
 *  that send only a week number mean that week of the current school year
 *  (week 27 to week 26), as the absence page assumes. */
export function weekOffset(week: number, year?: number): number {
  const now = new Date();
  const thisMonday = mondayOf(now);
  let y = year;
  if (y === undefined) {
    let startYear = now.getFullYear();
    if (thisMonday < mondayOfWeek(27, startYear)) startYear -= 1;
    y = week >= 27 ? startYear : startYear + 1;
  }
  return Math.round((mondayOfWeek(week, y).getTime() - thisMonday.getTime()) / (7 * 86_400_000));
}

export { isoWeek, isoWeekYear };

/** `YYYY-MM-DD` */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** `HH:mm` */
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** `YYYY-MM-DD HH:mm`, the subject-room grid format. */
export const local = (d: Date) => `${ymd(d)} ${hm(d)}`;
/** `YYYY-MM-DDTHH:mm`, the web calendar format. */
export const localT = (d: Date) => `${ymd(d)}T${hm(d)}`;
/** `YYYY-MM-DDTHH:mm:ss` */
export const localTs = (d: Date) => `${localT(d)}:00`;
/** Eva timestamps are ISO with an offset. */
export const iso = (d: Date) => d.toISOString();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `12 Oct 09:18`, the "friendly" format several web endpoints return. */
export const friendly = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${hm(d)}`;
/** `Mon 12 Oct`, used in pre-formatted subtitles. */
export const shortDay = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
