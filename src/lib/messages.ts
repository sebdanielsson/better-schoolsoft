/** Pure helpers for the messages page. Kept framework-free for `node --test`. */

import type { EvaMessageDetail, EvaMessageInbox, EvaMessageSender } from "../api/schoolsoft.ts";

export function senderName(s: EvaMessageSender): string {
  if (s.id === -1) return "SchoolSoft";
  return [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || "Unknown";
}

/** Case- and accent-insensitive match on sender, subject and preview. */
export function filterMessages(rows: EvaMessageInbox[], query: string): EvaMessageInbox[] {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const q = fold(query.trim());
  if (!q) return rows;
  return rows.filter((m) => fold(`${senderName(m.sender)} ${m.subject} ${m.message}`).includes(q));
}

/** Reply body in the same shape the official app sends, so the thread reads
 *  the same for staff in SchoolSoft whichever client the guardian used. */
export function buildReplyBody(
  reply: string,
  original: EvaMessageDetail,
  sentLabel: string,
): string {
  return (
    `${reply}\r\n\r\n` +
    `Från: ${senderName(original.sender)}  \r\n` +
    `Skickat: ${sentLabel} \r\n` +
    `Rubrik: ${original.subject} \r\n\r\n` +
    original.message
  );
}

/** Strip path separators and control characters from a server-supplied file
 *  name before using it as a download name. */
export function safeDownloadName(name: string | undefined, fallback = "attachment"): string {
  const cleaned = (name ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 200);
  return cleaned || fallback;
}

export const messageKeys = {
  allowAll: (prefix: string) => `${prefix}messages:allowAll`,
  teachers: (prefix: string) => `${prefix}teachers`,
  folder: (prefix: string, folder: string) => `${prefix}messages:${folder}`,
  detail: (prefix: string, id: number) => `${prefix}message:${id}`,
  lists: (prefix: string) => `${prefix}messages:`,
};
