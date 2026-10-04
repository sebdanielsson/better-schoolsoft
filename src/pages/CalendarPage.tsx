import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useNow } from "../hooks/useNow.ts";
import { useShowLongRunning } from "../hooks/useShowLongRunning.ts";
import { useCalendarAgenda } from "../hooks/useCalendarAgenda.ts";
import { ITEM_STYLE, KIND_LABEL } from "../components/CalendarItemChip.tsx";
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

/** Upcoming tests and homework, bookings and school events — the web
 *  calendar's feeds minus the lessons, which the Schedule page shows. */
export default function CalendarPage() {
  const now = useNow();
  /* Keyed on the day, so the minute clock doesn't rebuild the range. */
  const today = startOfDay(now).getTime();
  const from = useMemo(() => new Date(today), [today]);
  const [weeks, setWeeks] = useState(RANGE_WEEKS);
  const to = useMemo(() => addDays(from, weeks * 7), [from, weeks]);

  const { items, incomplete, error: failed } = useCalendarAgenda(from, to);
  const [showLong, setShowLong] = useShowLongRunning();

  const { ongoing, days } = useMemo(
    () => agenda(toWeekItems(items ?? []), from, to, now),
    [items, from, to, now],
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
        {items && (
          <span className="text-[0.85rem] text-slate-500">
            {upcomingCount} upcoming{ongoing.length > 0 && ` · ${ongoing.length} ongoing`}
          </span>
        )}
      </div>

      {failed ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {failed}
        </div>
      ) : !items ? (
        <div className="px-8 py-16 text-center text-[0.95rem] text-slate-500">
          Loading calendar…
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {incomplete && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Some calendar sources couldn't be loaded, so this list may be incomplete.
            </div>
          )}
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
              {incomplete
                ? `Nothing found in the next ${weeks} weeks from the sources that loaded.`
                : `Nothing coming up in the next ${weeks} weeks.`}
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
          {/* Events have no page to link to, so their details live here. */}
          {item.kind === "event" && item.description && (
            <p className="mt-1.5 text-[0.88rem] leading-snug text-slate-700">{item.description}</p>
          )}
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
