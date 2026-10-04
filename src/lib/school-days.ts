import { addDays, isoDay, startOfDay } from "./dates.ts";

/** The school day a card should land on by default — today during school
 *  hours, otherwise the next Mon–Fri. */
export function activeSchoolDayFor(now: Date): Date {
  if (isoDay(now) <= 5 && now.getHours() < 17) return startOfDay(now);
  return nextSchoolDay(now);
}

/** Next Mon–Fri after the given date (Fri→Mon, Sat→Mon, Sun→Mon). */
export function nextSchoolDay(d: Date): Date {
  const idx = isoDay(d);
  return addDays(startOfDay(d), idx >= 5 ? 8 - idx : 1);
}

/** Previous Mon–Fri before the given date (Mon→Fri, Sat→Fri, Sun→Fri). */
export function prevSchoolDay(d: Date): Date {
  const back: Record<number, number> = { 1: 3, 6: 1, 7: 2 };
  return addDays(startOfDay(d), -(back[isoDay(d)] ?? 1));
}
