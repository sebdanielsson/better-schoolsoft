import { Link } from "react-router-dom";
import { CalendarClock, ClipboardCheck, Star } from "lucide-react";
import { formatDate, formatTime, sameLocalDate } from "../lib/dates.ts";
import { lastIncludedMs, type WeekItem } from "../lib/schedule.ts";
import { cn } from "../lib/utils.ts";

/** How each kind is named in lists. */
export const KIND_LABEL: Record<WeekItem["kind"], string> = {
  test: "Test / homework",
  booking: "Booking",
  event: "Event",
};

export const ITEM_STYLE: Record<WeekItem["kind"], { icon: typeof Star; className: string }> = {
  test: { icon: ClipboardCheck, className: "border-rose-200 bg-rose-50 text-rose-900" },
  booking: { icon: CalendarClock, className: "border-sky-200 bg-sky-50 text-sky-900" },
  event: { icon: Star, className: "border-green-200 bg-green-50 text-green-900" },
};

/** A test, booking or school event. Timed ones show their time; the week
 *  strip shows the date span instead. Tests link to their subject. */
export default function CalendarItemChip({
  item,
  spanLabel,
}: {
  item: WeekItem;
  spanLabel?: boolean;
}) {
  const { icon: Icon, className } = ITEM_STYLE[item.kind];
  const lastDay = lastIncludedMs(item);
  const when = spanLabel
    ? sameLocalDate(new Date(item.start), new Date(lastDay))
      ? formatDate(item.start)
      : `${formatDate(item.start)} – ${formatDate(lastDay)}`
    : `${formatTime(item.start)}–${formatTime(item.end)}`;
  const body = (
    <>
      <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-[0.82rem] leading-tight font-semibold">{item.title}</span>
        <span className="block text-[0.72rem] opacity-80">
          {when}
          {item.detail && ` · ${item.detail}`}
        </span>
      </span>
    </>
  );
  const chipClass = cn(
    "flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-inherit no-underline",
    className,
  );
  if (item.kind === "test" && item.activityId) {
    return (
      <Link to={`/subjects/${item.activityId}`} className={cn(chipClass, "hover:brightness-95")}>
        {body}
      </Link>
    );
  }
  if (item.kind === "booking") {
    return (
      <Link to="/bookings" className={cn(chipClass, "hover:brightness-95")}>
        {body}
      </Link>
    );
  }
  return <div className={chipClass}>{body}</div>;
}
