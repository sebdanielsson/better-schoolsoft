import { Link } from "react-router-dom";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useSchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.ts";
import {
  fetchEvaTimebookings,
  fetchEvaTimebookingsEnabled,
  type TimebookingSummary,
} from "../api/schoolsoft.ts";
import {
  bookingKeys,
  formatBookingDay,
  sortBookings,
  statusChipClass,
  statusMeta,
} from "../lib/bookings.ts";
import { ErrorBanner, UnreadDot } from "../components/DashCard.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

export default function BookingsPage() {
  const ctx = useSchoolsoftContext();
  const enabled = useQuery(
    ctx && bookingKeys.enabled(ctx.keyPrefix),
    async () => fetchEvaTimebookingsEnabled(ctx!.school, await ctx!.token(), ctx!.orgId),
    { staleMs: 10 * 60_000 },
  );
  const list = useQuery(ctx && bookingKeys.list(ctx.keyPrefix), async () =>
    fetchEvaTimebookings(
      ctx!.school,
      await ctx!.token(),
      ctx!.parentUserId,
      ctx!.studentId,
      ctx!.orgId,
    ),
  );

  const rows = list.data ? sortBookings(list.data) : undefined;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Bookings</h2>
        {rows && rows.length > 0 && (
          <span className="text-[0.85rem] text-slate-500">{rows.length} active</span>
        )}
      </div>

      {list.error && <ErrorBanner>{list.error.message}</ErrorBanner>}

      {enabled.data === false ? (
        <EmptyState>Your school doesn't use time bookings.</EmptyState>
      ) : !ctx || list.loading ? (
        <SkeletonList />
      ) : !rows || rows.length === 0 ? (
        <EmptyState>
          No active bookings. When a teacher invites you to book a meeting, such as a development
          talk, it shows up here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((b) => (
            <BookingRow key={b.timebookingId} booking={b} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BookingRow({ booking }: { booking: TimebookingSummary }) {
  const meta = statusMeta(booking.status);
  const teacher = booking.teacher
    ? `${booking.teacher.fName} ${booking.teacher.lName}`.trim()
    : undefined;
  const when =
    booking.status === "BOOKED" && booking.studentBookedDate
      ? `Booked for ${formatBookingDay(booking.studentBookedDate)}`
      : booking.firstTimebookingTime
        ? `${formatBookingDay(booking.firstTimebookingTime)}${
            booking.lastTimebookingTime &&
            formatBookingDay(booking.lastTimebookingTime) !==
              formatBookingDay(booking.firstTimebookingTime)
              ? ` – ${formatBookingDay(booking.lastTimebookingTime)}`
              : ""
          }`
        : undefined;

  return (
    <li>
      <Link
        to={`/bookings/${booking.timebookingId}`}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
      >
        <CalendarClock className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.95rem] font-semibold">{booking.name}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
                statusChipClass[meta.tone],
              )}
            >
              {meta.label}
            </span>
            {!booking.isRead && <UnreadDot />}
          </div>
          <div className="mt-0.5 truncate text-[0.82rem] text-slate-500">
            {[teacher, when].filter(Boolean).join(" · ")}
            {booking.status === "AVAILABLE" && booking.bookableTo
              ? ` · book by ${formatBookingDay(booking.bookableTo)}`
              : ""}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
      {children}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <Skeleton className="h-4 w-40 rounded-sm" />
          <Skeleton className="mt-2 h-3 w-64 rounded-sm" />
        </li>
      ))}
    </ul>
  );
}
