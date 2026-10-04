import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.tsx";
import { useHeroData } from "./useHeroData.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchCalendarAgenda,
  fetchCalendarPsEntities,
  fetchCalendarTimeBookings,
  fetchEvaNextCalendarEvent,
  type CalendarItem,
  type EvaCalendarEvent,
} from "../api/schoolsoft.ts";
import { addDays } from "../lib/dates.ts";
import { toLocalStamp } from "../lib/schedule.ts";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Eva's "next calendar event" tile, which comes from school news rather
 *  than the web calendar, in the calendar feeds' shape. */
function evaEventToItem(e: EvaCalendarEvent): CalendarItem {
  const start = toLocalStamp(e.fromDate);
  return {
    name: e.title,
    description: e.description,
    startDate: start,
    endDate: toLocalStamp(e.toDate ?? e.fromDate),
    allDay: !start.includes("T"),
    category: "event",
    typeName: e.eventTypeInfo,
  };
}

interface AgendaData {
  /** Child + range the data was loaded for; nothing else is ever shown. */
  key: string;
  items: CalendarItem[];
  /** Some feeds failed, so an empty or short list may be missing entries. */
  incomplete: boolean;
}

/** Everything the web calendar's agenda shows for the child in focus between
 *  `from` (inclusive) and `to` (exclusive), minus lessons: school events,
 *  bookings, subject-room tests and homework, and Eva's next-event tile.
 *  `items` is null while loading; `error` is set when nothing could load. */
export function useCalendarAgenda(
  from: Date,
  to: Date,
): { items: CalendarItem[] | null; incomplete: boolean; error: string | null } {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child, loading: heroLoading } = useHeroData();
  const studentId = child?.studentId ?? null;
  const orgId = child?.schools[0]?.orgId ?? session?.orgId ?? null;
  /* Strings, not the Date objects: callers derive dates from a clock that
   * ticks every minute, and the feeds should reload only when the day or
   * range actually changes. */
  const fromDay = isoDate(from);
  const lastDay = isoDate(addDays(to, -1));
  const key = `${orgId}:${studentId}@${fromDay}..${lastDay}`;

  const [data, setData] = useState<AgendaData | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!session || !parentUserId || !studentId || !orgId) return;
    let cancelled = false;
    const school = session.school;

    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("You are signed out. Sign in again to continue.");
        /* The calendar feeds read the cookie session's child in focus. */
        await bootstrapSchoolsoftSession(school, token, parentUserId, orgId, studentId);
        const results = await Promise.allSettled([
          fetchCalendarAgenda(school, fromDay, lastDay),
          fetchCalendarTimeBookings(school),
          fetchCalendarPsEntities(school),
          fetchEvaNextCalendarEvent(school, token, parentUserId, orgId, studentId).then((e) =>
            e ? [evaEventToItem(e)] : [],
          ),
        ]);
        if (cancelled) return;
        /* Each feed is optional, but if every one failed there's nothing
         * trustworthy to show. */
        if (results.every((r) => r.status === "rejected")) {
          throw (results[0] as PromiseRejectedResult).reason;
        }
        setData({
          key,
          items: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
          incomplete: results.some((r) => r.status === "rejected"),
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setData((prev) => (prev?.key === key ? null : prev));
          setError({ key, message: e instanceof Error ? e.message : "Failed to load calendar" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, studentId, orgId, fromDay, lastDay, key]);

  const current = data?.key === key ? data : null;
  const noAccount = !heroLoading && (!parentUserId || !studentId);
  const failed = noAccount
    ? "Couldn't load your account details. Reload the page to try again."
    : error?.key === key && !current
      ? error.message
      : null;

  return { items: current?.items ?? null, incomplete: current?.incomplete ?? false, error: failed };
}
