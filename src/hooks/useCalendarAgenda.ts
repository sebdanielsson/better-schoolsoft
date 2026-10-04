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

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Eva's "next calendar event" tile, which comes from school news rather
 *  than the web calendar, in the calendar feeds' shape. */
function evaEventToItem(e: EvaCalendarEvent): CalendarItem {
  const start = e.fromDate.slice(0, 16);
  return {
    name: e.title,
    description: e.description,
    startDate: start,
    endDate: (e.toDate ?? e.fromDate).slice(0, 16),
    allDay: !start.includes("T"),
    category: "event",
    typeName: e.eventTypeInfo,
  };
}

interface AgendaData {
  /** Child + range the data was loaded for; nothing else is ever shown. */
  key: string;
  items: CalendarItem[];
}

/** Everything the web calendar's agenda shows for the child in focus between
 *  `from` (inclusive) and `to` (exclusive), minus lessons: school events,
 *  bookings, subject-room tests and homework, and Eva's next-event tile.
 *  `items` is null while loading; `error` is set when nothing could load. */
export function useCalendarAgenda(
  from: Date,
  to: Date,
): { items: CalendarItem[] | null; error: string | null } {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child, loading: heroLoading } = useHeroData();
  const studentId = child?.studentId ?? null;
  const orgId = child?.schools[0]?.orgId ?? session?.orgId ?? null;
  const key = `${orgId}:${studentId}@${isoDate(from)}..${isoDate(to)}`;

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
          fetchCalendarAgenda(school, isoDate(from), isoDate(addDays(to, -1))),
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
  }, [session, getEvaToken, parentUserId, studentId, orgId, from, to, key]);

  const current = data?.key === key ? data : null;
  const noAccount = !heroLoading && (!parentUserId || !studentId);
  const failed = noAccount
    ? "Couldn't load your account details. Reload the page to try again."
    : error?.key === key && !current
      ? error.message
      : null;

  return { items: current?.items ?? null, error: failed };
}
