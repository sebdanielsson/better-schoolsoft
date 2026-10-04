import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { useNow } from "../hooks/useNow.ts";
import { useShowLongRunning } from "../hooks/useShowLongRunning.ts";
import {
  bootstrapSchoolsoftSession,
  fetchCalendarAgenda,
  fetchCalendarPsEntities,
  fetchCalendarTimeBookings,
  fetchEvaNextCalendarEvent,
  type CalendarItem,
  type EvaCalendarEvent,
} from "../api/schoolsoft.ts";
import { ITEM_STYLE } from "../components/CalendarItemChip.tsx";
import { addDays, formatDate, formatTime, sameLocalDate, startOfDay } from "../lib/dates.ts";
import {
  agenda,
  isLongRunning,
  lastIncludedMs,
  toWeekItems,
  type WeekItem,
} from "../lib/schedule.ts";
import { cn } from "../lib/utils.ts";

/** How far ahead the agenda looks, and how much "Show more" adds. */
const RANGE_WEEKS = 8;

const KIND_LABEL: Record<WeekItem["kind"], string> = {
  test: "Test / homework",
  booking: "Booking",
  event: "Event",
};

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

/** Upcoming tests and homework, bookings and school events — the web
 *  calendar's feeds minus the lessons, which the Schedule page shows. */
export default function CalendarPage() {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child, loading: heroLoading } = useHeroData();
  const studentId = child?.studentId ?? null;
  const orgId = child?.schools[0]?.orgId ?? session?.orgId ?? null;

  const now = useNow();
  const from = useMemo(() => startOfDay(now), [now]);
  const [weeks, setWeeks] = useState(RANGE_WEEKS);
  const to = useMemo(() => addDays(from, weeks * 7), [from, weeks]);
  const key = `${orgId}:${studentId}@${isoDate(from)}+${weeks}`;

  const [data, setData] = useState<AgendaData | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [showLong, setShowLong] = useShowLongRunning();

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

  const { ongoing, days } = useMemo(
    () => agenda(toWeekItems(current?.items ?? []), from, to),
    [current, from, to],
  );
  const longCount = ongoing.filter(isLongRunning).length;
  const shownOngoing = showLong ? ongoing : ongoing.filter((it) => !isLongRunning(it));
  const upcomingCount = days.reduce((n, d) => n + d.items.length, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
          <p className="text-sm text-slate-500">
            Tests, homework, bookings and school events · next {weeks} weeks
          </p>
        </div>
        {current && (
          <span className="text-[0.85rem] text-slate-500">
            {upcomingCount} upcoming{ongoing.length > 0 && ` · ${ongoing.length} ongoing`}
          </span>
        )}
      </div>

      {failed ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {failed}
        </div>
      ) : !current ? (
        <div className="px-8 py-16 text-center text-[0.95rem] text-slate-500">
          Loading calendar…
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {ongoing.length > 0 && (
            <section>
              <div className="mb-[0.65rem] flex items-center justify-between gap-3">
                <h3 className="text-[0.82rem] font-bold tracking-[0.05em] text-slate-500 uppercase">
                  Ongoing
                </h3>
                {longCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLong(!showLong)}
                    aria-pressed={showLong}
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
                  >
                    {showLong ? "Hide long-running" : `Show ${longCount} long-running`}
                  </button>
                )}
              </div>
              {shownOngoing.length > 0 ? (
                <ul className="flex list-none flex-col gap-[0.65rem]">
                  {shownOngoing.map((it) => (
                    <AgendaRow key={it.key} item={it} />
                  ))}
                </ul>
              ) : (
                <p className="text-[0.85rem] text-slate-500">Only long-running items.</p>
              )}
            </section>
          )}

          {days.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
              Nothing coming up in the next {weeks} weeks.
            </div>
          ) : (
            days.map(({ day, items }) => (
              <section key={day}>
                <h3 className="mb-[0.65rem] text-[0.82rem] font-bold tracking-[0.05em] text-slate-500 uppercase">
                  {sameLocalDate(new Date(day), now) && "Today · "}
                  {formatDate(day, { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <ul className="flex list-none flex-col gap-[0.65rem]">
                  {items.map((it) => (
                    <AgendaRow key={it.key} item={it} />
                  ))}
                </ul>
              </section>
            ))
          )}

          <button
            type="button"
            onClick={() => setWeeks((w) => w + RANGE_WEEKS)}
            className="self-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-blue-600 hover:text-blue-700"
          >
            Show {RANGE_WEEKS} more weeks
          </button>
        </div>
      )}
    </div>
  );
}

/** One entry: when it is, what kind, and where it leads. Tests link to
 *  their subject, bookings to the bookings page. */
function AgendaRow({ item }: { item: WeekItem }) {
  const { icon: Icon, className } = ITEM_STYLE[item.kind];
  const lastDay = lastIncludedMs(item);
  const multiDay = !sameLocalDate(new Date(item.start), new Date(lastDay));
  const href =
    item.kind === "test" && item.activityId
      ? `/subjects/${item.activityId}`
      : item.kind === "booking"
        ? "/bookings"
        : null;
  const meta = [KIND_LABEL[item.kind], item.subject, item.detail].filter(Boolean).join(" · ");

  const body = (
    <>
      <div className="-mr-1 border-r border-dashed border-slate-200 pt-0.5 pr-4 text-center">
        {multiDay ? (
          <div className="text-[0.78rem] font-semibold text-blue-600">
            {formatDate(item.start, { day: "numeric", month: "short" })}
            <br />–{formatDate(lastDay, { day: "numeric", month: "short" })}
          </div>
        ) : item.allDay ? (
          <div className="text-[0.85rem] font-bold text-blue-600">All day</div>
        ) : (
          <>
            <div className="text-[0.95rem] font-bold text-blue-600">{formatTime(item.start)}</div>
            {item.end > item.start && (
              <div className="mt-1 text-[0.75rem] text-slate-500">{formatTime(item.end)}</div>
            )}
          </>
        )}
      </div>
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn("mt-0.5 rounded-md border p-1", className)}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-base leading-snug font-semibold">{item.title}</div>
          <div className="mt-0.5 text-[0.82rem] text-slate-500">{meta}</div>
        </div>
      </div>
    </>
  );
  const rowClass =
    "grid grid-cols-[80px_1fr] gap-4 rounded-lg border border-slate-200 bg-white px-[1.1rem] py-3.5 text-inherit no-underline shadow-[var(--shadow-sm)] transition-all";
  return (
    <li>
      {href ? (
        <Link
          to={href}
          className={cn(rowClass, "hover:-translate-y-px hover:shadow-[var(--shadow)]")}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}
