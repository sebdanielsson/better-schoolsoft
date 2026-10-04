/** Pure helpers for the bookings pages. Kept framework-free for `node --test`. */

import type {
  TimebookingDetail,
  TimebookingStatus,
  TimebookingSummary,
  TimebookingTime,
} from "../api/schoolsoft.ts";
import { parseLocalDateTime } from "./subject-rooms.ts";

/** Booking timestamps arrive as epoch millis, ISO strings, or SchoolSoft's
 *  local "YYYY-MM-DD HH:mm". Returns null for anything else. */
export function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseLocalDateTime(value);
}

export type StatusTone = "action" | "done" | "info" | "muted";

export const STATUS_META: Record<string, { label: string; tone: StatusTone; order: number }> = {
  NEEDS_CONFIRMATION: { label: "Confirm proposed time", tone: "action", order: 0 },
  AVAILABLE: { label: "Times available", tone: "action", order: 1 },
  BOOKED: { label: "Booked", tone: "done", order: 2 },
  FOR_INFORMATION: { label: "For information", tone: "info", order: 3 },
  NOT_AVAILABLE: { label: "No times available", tone: "muted", order: 4 },
};

/** Tailwind classes for the status chip, by tone. */
export const statusChipClass: Record<StatusTone, string> = {
  action: "bg-blue-50 text-blue-700",
  done: "bg-green-50 text-green-700",
  info: "bg-sky-50 text-sky-700",
  muted: "bg-slate-100 text-slate-500",
};

export function statusMeta(status: TimebookingStatus) {
  return STATUS_META[status] ?? { label: status, tone: "muted" as const, order: 5 };
}

/** Bookings that need the guardian's attention first, then booked ones by
 *  their booked date, then the rest. */
export function sortBookings(rows: TimebookingSummary[]): TimebookingSummary[] {
  const when = (r: TimebookingSummary) =>
    toDate(r.studentBookedDate ?? r.firstTimebookingTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) => {
    const d = statusMeta(a.status).order - statusMeta(b.status).order;
    return d !== 0 ? d : when(a) - when(b);
  });
}

/** The slot this student holds (booked or proposed by the teacher), if any. */
export function studentSlot(detail: TimebookingDetail): TimebookingTime | undefined {
  for (const day of detail.timebookingDates ?? []) {
    for (const t of day.timebookingTimes ?? []) {
      if (t.bookedByStudent) return t;
    }
  }
  return undefined;
}

export function sameSlot(a: TimebookingTime | undefined, b: TimebookingTime | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.timebookingTimeKey.timebookingid === b.timebookingTimeKey.timebookingid &&
    a.timebookingTimeKey.sequence === b.timebookingTimeKey.sequence
  );
}

/** A slot can be picked when the booking is open, the slot is free, and the
 *  student does not already hold a time. */
export function isSelectable(detail: TimebookingDetail, slot: TimebookingTime): boolean {
  if (detail.onlyStudent) return false;
  if (detail.bookable === false) return false;
  if (detail.status !== "AVAILABLE") return false;
  return !slot.booked && !slot.bookedByStudent;
}

export function formatSlotTime(slot: TimebookingTime): string {
  const start = toDate(slot.startTime);
  const end = toDate(slot.endTime);
  const t = (d: Date | null, raw: string | number) =>
    d ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : String(raw);
  return `${t(start, slot.startTime)}–${t(end, slot.endTime)}`;
}

export function formatBookingDay(value: string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return value === null || value === undefined ? "" : String(value);
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export const bookingKeys = {
  enabled: (prefix: string) => `${prefix}timebookings:enabled`,
  list: (prefix: string) => `${prefix}timebookings`,
  detail: (prefix: string, id: number) => `${prefix}timebooking:${id}`,
  startpage: (prefix: string) => `${prefix}timebookings:startpage`,
};
