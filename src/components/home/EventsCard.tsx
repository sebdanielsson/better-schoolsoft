import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useNow } from "../../hooks/useNow.ts";
import { useCalendarAgenda } from "../../hooks/useCalendarAgenda.ts";
import { ITEM_STYLE, KIND_LABEL } from "../CalendarItemChip.tsx";
import { addDays, formatTime, relativeDay, startOfDay } from "../../lib/dates.ts";
import { nextEntries, toWeekItems, type WeekItem } from "../../lib/schedule.ts";
import { cn } from "../../lib/utils.ts";
import { DashboardCard, Empty, cardLoadingClass } from "./DashboardCard.tsx";

const SHOWN = 3;
/** Far enough ahead to find three entries without loading the whole term. */
const LOOKAHEAD_WEEKS = 8;

/** The next few tests, bookings and school events, from the same feeds as
 *  the Calendar page. */
export default function EventsCard() {
  const now = useNow();
  /* Keyed on the day, so the minute clock doesn't rebuild the range. */
  const today = startOfDay(now).getTime();
  const from = useMemo(() => new Date(today), [today]);
  const to = useMemo(() => addDays(from, LOOKAHEAD_WEEKS * 7), [from]);
  const { items, incomplete, error } = useCalendarAgenda(from, to);
  const next = useMemo(
    () => nextEntries(toWeekItems(items ?? []), now, to, SHOWN),
    [items, now, to],
  );

  return (
    <DashboardCard
      title="Upcoming events"
      accent="green"
      linkTo="/calendar"
      linkLabel="Full calendar →"
    >
      {error ? (
        <Empty>Couldn't load the calendar.</Empty>
      ) : !items ? (
        <div className={cardLoadingClass}>Loading…</div>
      ) : next.length === 0 ? (
        <Empty>
          {incomplete
            ? "Couldn't load all calendar sources."
            : `Nothing coming up in the next ${LOOKAHEAD_WEEKS} weeks.`}
        </Empty>
      ) : (
        <ul className="flex list-none flex-col gap-1.5">
          {next.map((it) => (
            <EventRow key={it.key} item={it} />
          ))}
          {incomplete && (
            <li className="text-[0.75rem] text-amber-700">
              Some calendar sources couldn't be loaded.
            </li>
          )}
        </ul>
      )}
    </DashboardCard>
  );
}

function EventRow({ item }: { item: WeekItem }) {
  const { icon: Icon, className } = ITEM_STYLE[item.kind];
  const href =
    item.kind === "test" && item.activityId
      ? `/subjects/${item.activityId}`
      : item.kind === "booking"
        ? "/bookings"
        : null;
  const meta = [KIND_LABEL[item.kind], item.subject ?? item.detail].filter(Boolean).join(" · ");
  const body = (
    <>
      <div>
        <div className="text-[0.82rem] leading-[1.1] font-bold text-green-600">
          {relativeDay(item.start)}
        </div>
        <div className="mt-0.5 text-[0.72rem] text-slate-500">
          {item.allDay ? "All day" : formatTime(item.start)}
        </div>
      </div>
      <div className="flex min-w-0 items-start gap-2">
        <span className={cn("mt-0.5 rounded border p-0.5", className)}>
          <Icon className="h-3 w-3" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[0.92rem] font-semibold">{item.title}</div>
          <div className="mt-0.5 truncate text-[0.78rem] text-slate-500">{meta}</div>
        </div>
      </div>
    </>
  );
  const rowClass =
    "grid grid-cols-[90px_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-inherit no-underline";
  return (
    <li>
      {href ? (
        <Link to={href} className={cn(rowClass, "transition-colors hover:border-slate-300")}>
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}
