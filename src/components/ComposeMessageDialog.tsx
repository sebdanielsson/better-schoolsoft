import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.tsx";
import {
  fetchEvaTeachers,
  sendEvaMessage,
  type EvaMessageDetail,
  type EvaTeacher,
} from "../api/schoolsoft.ts";
import { buildReplyBody, messageKeys, senderName } from "../lib/messages.ts";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.tsx";
import { btnPrimaryClass, btnSecondaryClass } from "./ConfirmDialog.tsx";
import { cn } from "../lib/utils.ts";

export type ComposeTarget = { kind: "new" } | { kind: "reply"; original: EvaMessageDetail };

const MAX_SUBJECT = 200;
const MAX_BODY = 10_000;

/** Write a new message to staff, or reply to one. Sending needs an explicit
 *  second click ("Send now") because a message can't be recalled. */
export default function ComposeMessageDialog({
  ctx,
  target,
  sentLabel,
  onClose,
  onSent,
}: {
  ctx: SchoolsoftContext;
  target: ComposeTarget;
  /** Human-readable send time of the original, quoted in replies. */
  sentLabel: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const teachers = useQuery(
    messageKeys.teachers(ctx.keyPrefix),
    async () => fetchEvaTeachers(ctx.school, await ctx.token(), ctx.orgId),
    { staleMs: 30 * 60_000 },
  );

  const isReply = target.kind === "reply";
  const replyRecipient = useMemo(() => {
    if (target.kind !== "reply") return undefined;
    return teachers.data?.find((t) => t.teacherId === target.original.sender.id);
  }, [target, teachers.data]);

  const [picked, setPicked] = useState<EvaTeacher[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(isReply ? target.original.subject : "");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipients = isReply ? (replyRecipient ? [replyRecipient] : []) : picked;
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !teachers.data) return [];
    return teachers.data
      .filter((t) => !picked.some((p) => p.teacherId === t.teacherId))
      .filter((t) => `${t.fname} ${t.lname}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, teachers.data, picked]);

  const ready = recipients.length > 0 && subject.trim() !== "" && body.trim() !== "";

  async function send() {
    setSending(true);
    setError(null);
    try {
      await sendEvaMessage(ctx.school, await ctx.token(), ctx.parentUserId, ctx.orgId, {
        subject: subject.trim(),
        messageBody:
          target.kind === "reply"
            ? buildReplyBody(body.trim(), target.original, sentLabel)
            : body.trim(),
        recipients,
      });
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The message could not be sent.");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !sending) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-3rem)] gap-0 overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 sm:max-w-[560px]">
        <DialogTitle className="font-sans text-lg font-bold tracking-[-0.01em] normal-case">
          {isReply ? "Reply" : "New message"}
        </DialogTitle>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500">To</div>
            {isReply ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                {replyRecipient
                  ? `${replyRecipient.fname} ${replyRecipient.lname}`
                  : teachers.loading
                    ? "Looking up recipient…"
                    : `${senderName(target.original.sender)} can't receive replies here.`}
              </div>
            ) : (
              <>
                {picked.length > 0 && (
                  <ul className="mb-1.5 flex flex-wrap gap-1.5">
                    {picked.map((t) => (
                      <li
                        key={t.teacherId}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-0.5 pr-1 pl-2.5 text-[0.82rem] text-blue-800"
                      >
                        {t.fname} {t.lname}
                        <button
                          type="button"
                          aria-label={`Remove ${t.fname} ${t.lname}`}
                          className="rounded-full p-0.5 hover:bg-blue-100"
                          onClick={() =>
                            setPicked((p) => p.filter((x) => x.teacherId !== t.teacherId))
                          }
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={teachers.loading ? "Loading staff…" : "Search staff by name"}
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  aria-label="Search recipients"
                />
                {matches.length > 0 && (
                  <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200">
                    {matches.map((t) => (
                      <li key={t.teacherId}>
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-50"
                          onClick={() => {
                            setPicked((p) => [...p, t]);
                            setSearch("");
                          }}
                        >
                          {t.fname} {t.lname}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <label>
            <div className="mb-1 text-xs font-semibold text-slate-500">Subject</div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={MAX_SUBJECT}
              className="w-full rounded-md border border-slate-200 px-3 py-2"
            />
          </label>

          <label>
            <div className="mb-1 text-xs font-semibold text-slate-500">Message</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY}
              rows={8}
              className="w-full rounded-md border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          {confirming && (
            <span className="mr-auto text-[0.82rem] text-slate-600">
              Send to {recipients.map((r) => `${r.fname} ${r.lname}`).join(", ")}?
            </span>
          )}
          <button
            type="button"
            className={btnSecondaryClass}
            disabled={sending}
            onClick={() => (confirming ? setConfirming(false) : onClose())}
          >
            {confirming ? "Back" : "Cancel"}
          </button>
          <button
            type="button"
            className={cn(btnPrimaryClass)}
            disabled={!ready || sending}
            onClick={() => (confirming ? void send() : setConfirming(true))}
          >
            {sending ? "Sending…" : confirming ? "Send now" : "Send"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
