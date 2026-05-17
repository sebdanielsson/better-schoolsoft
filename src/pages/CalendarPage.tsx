import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchCalendar,
  fetchEvaNextCalendarEvent,
  fetchEvaParent,
  type CalendarEvent,
} from "../api/schoolsoft.ts";

interface UnifiedEvent {
  id: string;
  start: number;
  end?: number;
  title: string;
  description?: string;
  typeInfo?: string;
}

function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateHeading(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function legacyToUnified(e: CalendarEvent): UnifiedEvent {
  return {
    id: `legacy-${e.id}`,
    start: e.eventStart,
    end: e.eventEnd,
    title: e.title,
    description: e.description,
    typeInfo: e.eventTypeInfo,
  };
}

export default function CalendarPage() {
  const { session, getToken, getEvaToken } = useAuth();
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"eva" | "legacy" | "empty">("empty");

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load(): Promise<void> {
      /* Try Eva first. */
      const evaToken = await getEvaToken().catch(() => null);
      if (evaToken) {
        try {
          const parent = await fetchEvaParent(session!.school, evaToken);
          const studentId = parent.children[0]?.studentId;
          const orgId = parent.children[0]?.schools[0]?.orgId ?? session!.orgId;
          if (studentId) {
            const next = await fetchEvaNextCalendarEvent(
              session!.school,
              evaToken,
              parent.userId,
              orgId,
              studentId,
            );
            if (!cancelled) {
              if (next) {
                const start = new Date(next.fromDate).getTime();
                const end = next.toDate ? new Date(next.toDate).getTime() : undefined;
                setEvents([
                  {
                    id: `eva-${next.newsId ?? start}`,
                    start,
                    end,
                    title: next.title,
                    description: next.description,
                    typeInfo: next.eventTypeInfo,
                  },
                ]);
                setSource("eva");
              } else {
                setEvents([]);
                setSource("eva");
              }
            }
            return;
          }
        } catch {
          /* fall through to legacy */
        }
      }
      /* Legacy /api/notices. */
      try {
        const token = await getToken();
        if (!token) throw new Error("No session token");
        const list = await fetchCalendar(session!.school, token, session!.orgId, 60);
        if (!cancelled) {
          setEvents(list.map(legacyToUnified));
          setSource(list.length ? "legacy" : "empty");
        }
      } catch (e) {
        if (!cancelled) {
          setEvents([]);
          setSource("empty");
          /* The legacy notices endpoint returns 410 Gone for some schools. We don't surface
           * that as an error since the page works (just with limited data). */
          if (e instanceof Error && !e.message.includes("(401)") && !e.message.includes("(410)")) {
            setError(e.message);
          }
        }
      }
    }

    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [session, getToken, getEvaToken]);

  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedEvent[]>();
    for (const e of [...events].sort((a, b) => a.start - b.start)) {
      const key = dateKey(e.start);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [events]);

  if (loading)
    return (
      <div className="py-16 px-8 text-center text-slate-500 text-[0.95rem]">Loading calendar…</div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
        <span className="text-[0.85rem] text-slate-500">
          {events.length} event{events.length === 1 ? "" : "s"}
          {source === "eva" && events.length > 0 && " · next upcoming"}
          {source === "legacy" && " · next 60 days"}
        </span>
      </div>

      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="py-12 px-8 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
          <p>
            {source === "eva"
              ? "No upcoming events. SchoolSoft's modern API only exposes the next calendar event as a tile — the full list isn't available as JSON."
              : "No calendar events available."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([key, dayEvents]) => (
            <div key={key}>
              <div className="mb-[0.65rem] text-[0.82rem] font-bold uppercase tracking-[0.05em] text-slate-500">
                {formatDateHeading(dayEvents[0]!.start)}
              </div>
              <ul className="flex list-none flex-col gap-[0.65rem]">
                {dayEvents.map((event) => (
                  <li
                    key={event.id}
                    className="grid grid-cols-[80px_1fr] gap-4 rounded-lg border border-slate-200 bg-white px-[1.1rem] py-4 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow)]"
                  >
                    <div className="-mr-1 border-r border-dashed border-slate-200 pr-4 pt-0.5 text-center">
                      <div className="text-[0.95rem] font-bold text-blue-600">
                        {formatTime(event.start)}
                      </div>
                      {event.end != null && (
                        <div className="mt-1 text-[0.75rem] text-slate-500">
                          {formatTime(event.end)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-base font-semibold">{event.title}</div>
                      {event.typeInfo && (
                        <div className="text-[0.82rem] text-slate-500">{event.typeInfo}</div>
                      )}
                      {event.description && (
                        <div className="mt-1.5 text-[0.88rem] leading-snug text-slate-900">
                          {event.description}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
