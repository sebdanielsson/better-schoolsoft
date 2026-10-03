import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { useSchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.tsx";
import { fetchEvaTimebookingStartpage } from "../api/schoolsoft.ts";
import { bookingKeys, toDate } from "../lib/bookings.ts";

/** Upcoming booked meeting, full width above the dashboard grid. Renders
 *  nothing when there is none, which is most of the time. */
export default function NextBookingCard() {
  const ctx = useSchoolsoftContext();
  const next = useQuery(ctx && bookingKeys.startpage(ctx.keyPrefix), async () =>
    fetchEvaTimebookingStartpage(
      ctx!.school,
      await ctx!.token(),
      ctx!.parentUserId,
      ctx!.studentId,
      ctx!.orgId,
    ),
  );
  const b = next.data;
  if (!b) return null;

  const start = toDate(b.startTime);
  const end = toDate(b.endTime);
  const when = start
    ? `${start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}${end ? `–${end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}`
    : "";

  return (
    <Link
      to={`/bookings/${b.timebookingId}`}
      className="flex items-center gap-3 rounded-[18px] border border-l-4 border-slate-200 border-l-green-600 bg-gradient-to-r from-green-50 to-white px-5 py-3.5 text-inherit no-underline shadow transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-lg md:col-span-12"
    >
      <CalendarClock className="h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[0.7rem] font-bold tracking-[0.08em] text-green-700 uppercase">
          Next booking
        </div>
        <div className="truncate text-[0.95rem] font-semibold">
          {b.name}
          {b.teacherName ? (
            <span className="font-normal text-slate-500"> · {b.teacherName}</span>
          ) : null}
        </div>
        {when && <div className="text-[0.82rem] text-slate-600">{when}</div>}
      </div>
    </Link>
  );
}
