/** Unread-item model for the notification center. Pure and framework-free so
 *  it can be tested under `node --test`; fetching and mark-as-read live in
 *  `hooks/useNotifications.ts`.
 *
 *  How each kind is marked read on the server (verified against the live API
 *  unless noted):
 *  - message:    PUT  …/message-recipient/read-date
 *  - news:       PUT  …/news/read/{id}
 *  - booking:    POST …/timebooking-read/{id}
 *  - assignment: GET  rest-api/parent/ps/assignments/{id}/view (side effect)
 *  - result:     GET  rest-api/parent/ps/assignment/{id}/assessment (side effect)
 *  - planning:   GET  rest-api/parent/ps/planning_parts/{id}/view (side effect;
 *                the web app refreshes unread counts after it)
 *  - assessment: GET  rest-api/parent/holistic_assessment/{id} (side effect;
 *                inferred — the web app has no other call) */

import type {
  EvaMessageInbox,
  EvaNewsItem,
  HolisticAssessmentRow,
  SubjectRoomAssignmentRow,
  SubjectRoomPlanningRow,
  SubjectRoomResultRow,
  TimebookingSummary,
} from "../api/schoolsoft.ts";
import { parseLocalDateTime } from "./subject-rooms.ts";

/** Every notification query key starts with this, so any mark-read anywhere
 *  in the app can refresh the center with one `invalidateQueries` call. */
export const NOTIFICATIONS_KEY = "notif:";

export type NotificationKind =
  | "message"
  | "news"
  | "booking"
  | "assignment"
  | "result"
  | "planning"
  | "assessment";

export interface NotificationItem {
  /** Unique across kinds, e.g. "result:136214". */
  key: string;
  kind: NotificationKind;
  /** Id the mark-read call needs. */
  id: number;
  title: string;
  /** Who/what it is about: sender, subject, teacher… */
  subtitle: string;
  /** Epoch millis for sorting and "2h ago"; 0 if unknown. */
  time: number;
  /** In-app route that opens the item (and marks it read there). */
  href: string;
}

/** Section of the app each kind belongs to, for the nav-pill badges. */
const SECTION_OF: Record<NotificationKind, string> = {
  message: "/messages",
  news: "/news",
  booking: "/bookings",
  assignment: "/subjects",
  result: "/subjects",
  planning: "/subjects",
  assessment: "/assessments",
};

export const KIND_LABEL: Record<NotificationKind, string> = {
  message: "Message",
  news: "News",
  booking: "Booking",
  assignment: "Assignment",
  result: "Result",
  planning: "Planning",
  assessment: "Assessment",
};

function isoTime(s: string | null | undefined): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function localTime(s: string | null | undefined): number {
  return parseLocalDateTime(s)?.getTime() ?? 0;
}

function subjectName(row: { subjects?: { name: string }[] }): string {
  return (row.subjects ?? []).map((s) => s.name).join(", ");
}

const join = (...parts: (string | undefined | null)[]) =>
  parts.filter((p) => p && p.trim()).join(" · ");

export function fromMessages(rows: EvaMessageInbox[]): NotificationItem[] {
  return rows
    .filter((m) => !m.isRead)
    .map((m) => ({
      key: `message:${m.id}`,
      kind: "message",
      id: m.id,
      title: m.subject || "(no subject)",
      subtitle:
        m.sender.id === -1
          ? "SchoolSoft"
          : join(`${m.sender.firstName ?? ""} ${m.sender.lastName ?? ""}`.trim()),
      time: isoTime(m.date),
      href: `/messages?message=${m.id}`,
    }));
}

export function fromNews(rows: EvaNewsItem[]): NotificationItem[] {
  return rows
    .filter((n) => !n.read)
    .map((n) => ({
      key: `news:${n.id}`,
      kind: "news",
      id: n.id,
      title: n.title.trim(),
      subtitle: join(n.author?.name, n.category),
      time: isoTime(n.creDate),
      href: `/news?item=${n.id}`,
    }));
}

export function fromBookings(rows: TimebookingSummary[]): NotificationItem[] {
  return rows
    .filter((b) => !b.isRead)
    .map((b) => ({
      key: `booking:${b.timebookingId}`,
      kind: "booking",
      id: b.timebookingId,
      title: b.name,
      subtitle: join(b.teacher ? `${b.teacher.fName} ${b.teacher.lName}`.trim() : undefined),
      time: isoTime(b.creDate),
      href: `/bookings/${b.timebookingId}`,
    }));
}

export function fromAssignments(rows: SubjectRoomAssignmentRow[]): NotificationItem[] {
  return rows
    .filter((r) => r.read === false)
    .map((r) => ({
      key: `assignment:${r.assignmentId}`,
      kind: "assignment",
      id: r.assignmentId,
      title: r.title,
      subtitle: join(subjectName(r), r.assignmentType, r.teacher),
      time: localTime(r.publishDate),
      href: `/assignments/${r.assignmentId}`,
    }));
}

export function fromResults(rows: SubjectRoomResultRow[]): NotificationItem[] {
  return rows
    .filter((r) => r.read === false)
    .map((r) => ({
      key: `result:${r.assignmentId}`,
      kind: "result",
      id: r.assignmentId,
      title: r.title,
      subtitle: join(subjectName(r), r.teacher),
      time: localTime(r.publishDate),
      href: `/assignments/${r.assignmentId}`,
    }));
}

export function fromPlannings(rows: SubjectRoomPlanningRow[]): NotificationItem[] {
  return rows
    .filter((r) => r.read === false)
    .map((r) => ({
      key: `planning:${r.planningPartId}`,
      kind: "planning",
      id: r.planningPartId,
      title: r.planningPartTitle.trim() || r.planningTitle.trim() || "Planning",
      subtitle: join(subjectName(r), r.teacher),
      time: localTime(r.publishDate),
      href: `/plannings/${r.planningId}/${r.planningPartId}`,
    }));
}

export function fromAssessments(rows: HolisticAssessmentRow[]): NotificationItem[] {
  return rows
    .filter((r) => r.published && !r.read && r.holisticAssessmentId > 0)
    .map((r) => ({
      key: `assessment:${r.holisticAssessmentId}`,
      kind: "assessment",
      id: r.holisticAssessmentId,
      title: r.title,
      subtitle: r.subTitle,
      time: localTime(r.updatedAt),
      href: `/assessments/${r.holisticAssessmentId}`,
    }));
}

/** Newest first; ties keep a stable order by key. */
export function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => b.time - a.time || a.key.localeCompare(b.key));
}

/** Unread count per section route, for badges on the section nav. */
export function countBySection(items: NotificationItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    const s = SECTION_OF[i.kind];
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then a date. */
export function relativeTime(time: number, now: number): string {
  if (!time) return "";
  const diff = now - time;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  /* Calendar days, so 23:59 two days ago isn't "Yesterday". Rounding absorbs
   * the 23 and 25 hour days around DST changes; on the 25 hour day an item
   * can be 24 h old and still from today. */
  const d = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(time).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (h < 24 || d === 0) return `${h} h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
