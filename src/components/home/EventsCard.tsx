import type { EvaCalendarEvent } from "../../api/schoolsoft.ts";
import { formatTime, relativeDay } from "../../lib/dates.ts";
import { DashboardCard, Empty, cardLoadingClass } from "./DashboardCard.tsx";

/** The next calendar event — Eva exposes only the one, as a tile. */
export default function EventsCard({
  loading,
  nextEvent,
}: {
  loading: boolean;
  nextEvent: EvaCalendarEvent | null;
}) {
  return (
    <DashboardCard
      title="Upcoming events"
      accent="green"
      linkTo="/calendar"
      linkLabel="Full calendar →"
    >
      {loading ? (
        <div className={cardLoadingClass}>Loading…</div>
      ) : !nextEvent ? (
        <Empty>Nothing scheduled.</Empty>
      ) : (
        <ul className="flex list-none flex-col gap-1.5">
          <li className="grid grid-cols-[90px_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
            <div>
              <div className="text-[0.82rem] leading-[1.1] font-bold text-green-600">
                {relativeDay(new Date(nextEvent.fromDate).getTime())}
              </div>
              <div className="mt-0.5 text-[0.72rem] text-slate-500">
                {formatTime(new Date(nextEvent.fromDate).getTime())}
              </div>
            </div>
            <div>
              <div className="text-[0.92rem] font-semibold">{nextEvent.title}</div>
              {nextEvent.eventTypeInfo && (
                <div className="mt-0.5 text-[0.78rem] text-slate-500">
                  {nextEvent.eventTypeInfo}
                </div>
              )}
            </div>
          </li>
        </ul>
      )}
    </DashboardCard>
  );
}
