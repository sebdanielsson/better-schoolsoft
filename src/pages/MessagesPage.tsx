import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchEvaInbox,
  fetchEvaMessage,
  fetchEvaParent,
  type EvaMessageDetail,
  type EvaMessageInbox,
  type EvaMessageSender,
} from "../api/schoolsoft.ts";
import Avatar from "../components/Avatar.tsx";
import { cn } from "../lib/utils.ts";

function senderName(s: EvaMessageSender): string {
  if (s.id === -1) return "SchoolSoft";
  return [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || "Unknown";
}

function formatRelativeDate(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const diffMs = Date.now() - ms;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    year: days > 200 ? "numeric" : undefined,
    month: "short",
    day: "numeric",
  });
}

function formatExactDate(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* Shared Tailwind class fragments used in multiple spots below. */
const TRUNCATE_LINE = "overflow-hidden text-ellipsis whitespace-nowrap";
const SECTION_LABEL = "text-xs font-bold uppercase tracking-[0.05em] text-slate-500";

export default function MessagesPage() {
  const { session, getEvaToken } = useAuth();
  const [inbox, setInbox] = useState<EvaMessageInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(session?.userId ?? null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EvaMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("Sign in via SchoolSoft to load your inbox");
        let uid = session.userId;
        if (!uid) {
          const parent = await fetchEvaParent(session.school, token);
          uid = parent.userId;
        }
        if (cancelled) return;
        setUserId(uid);
        const list = await fetchEvaInbox(session.school, token, uid, session.orgId);
        if (cancelled) return;
        /* Server appears to return newest-first already, but sort just in case. */
        const sorted = [...list].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setInbox(sorted);
        if (sorted.length > 0) setSelectedId(sorted[0]!.id);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load inbox");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken]);

  useEffect(() => {
    if (!session || !userId || selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);

    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("Authentication expired");
        const d = await fetchEvaMessage(session.school, token, userId, session.orgId, selectedId);
        if (!cancelled) {
          setDetail(d);
          /* Optimistically mark the list row as read once we open it. */
          setInbox((prev) => prev.map((m) => (m.id === selectedId ? { ...m, isRead: true } : m)));
        }
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setError(e instanceof Error ? e.message : "Failed to load message");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, userId, selectedId]);

  const unreadCount = useMemo(() => inbox.filter((m) => !m.isRead).length, [inbox]);

  if (loading)
    return (
      <div className="px-8 py-16 text-center text-[0.95rem] text-slate-500">Loading inbox…</div>
    );

  const hasSelection = selectedId !== null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Messages</h2>
        <span className="text-[0.85rem] text-slate-500">
          {inbox.length} {inbox.length === 1 ? "message" : "messages"}
          {unreadCount > 0 && ` · ${unreadCount} unread`}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {inbox.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
          No messages.
        </div>
      ) : (
        <div
          data-selection={hasSelection}
          className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(280px,360px)_1fr] lg:grid-cols-[minmax(280px,380px)_1fr]"
        >
          <ul
            className={cn(
              "flex max-h-[calc(100dvh-220px)] list-none flex-col gap-[0.35rem] overflow-y-auto pr-1",
              hasSelection && "hidden md:flex",
            )}
          >
            {inbox.map((m) => {
              const isSelected = selectedId === m.id;
              const isUnread = !m.isRead;
              return (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-lg border border-slate-200 bg-white transition-[border-color,box-shadow] duration-[120ms]",
                    isSelected && "border-blue-600 bg-blue-50",
                    isUnread && "border-l-[3px] border-l-blue-600",
                  )}
                >
                  <button
                    type="button"
                    className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 border-0 bg-transparent px-[0.85rem] py-[0.7rem] text-left font-[inherit] text-slate-900"
                    onClick={() => {
                      setSelectedId(m.id);
                    }}
                  >
                    <Avatar
                      name={senderName(m.sender)}
                      picture={m.sender.picture || null}
                      size={32}
                    />
                    <div className="min-w-0">
                      <div className="mb-[0.15rem] flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "text-[0.9rem] font-semibold",
                            TRUNCATE_LINE,
                            isUnread && "font-bold",
                          )}
                        >
                          {senderName(m.sender)}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {formatRelativeDate(m.date)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "mb-[0.1rem] text-[0.88rem] font-medium",
                          TRUNCATE_LINE,
                          isUnread && "font-bold",
                        )}
                      >
                        {m.subject || "(no subject)"}
                      </div>
                      <div className="[display:-webkit-box] overflow-hidden text-[0.82rem] leading-[1.35] text-ellipsis text-slate-500 [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [line-clamp:2]">
                        {m.message}
                      </div>
                    </div>
                    {isUnread && (
                      <span
                        className="h-[9px] w-[9px] self-center rounded-full bg-blue-600"
                        aria-label="Unread"
                      />
                    )}
                    {m.hasFiles && (
                      <span
                        className="self-center text-[0.85rem] text-slate-500"
                        aria-label="Has attachments"
                      >
                        📎
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={cn("md:sticky md:top-24", !hasSelection && "hidden md:block")}>
            {detailLoading ? (
              <div className="py-4 text-sm text-slate-500">Loading message…</div>
            ) : !detail ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-16 text-center text-slate-500">
                Select a message to read it.
              </div>
            ) : (
              <article className="rounded-lg border border-slate-200 bg-white px-7 py-6 shadow-sm">
                <button
                  type="button"
                  className="mb-3 inline-block cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[0.85rem] font-semibold text-blue-600 md:hidden"
                  onClick={() => {
                    setSelectedId(null);
                  }}
                >
                  ← Back to inbox
                </button>
                <header className="mb-4 flex items-center gap-[0.9rem] border-b border-slate-200 pb-4">
                  <Avatar
                    name={senderName(detail.sender)}
                    picture={detail.sender.picture || null}
                    size={32}
                  />
                  <div className="min-w-0">
                    <div className="text-base font-bold">{senderName(detail.sender)}</div>
                    <div className="mt-[0.15rem] text-[0.8rem] text-slate-500">
                      {formatExactDate(detail.date)}
                    </div>
                  </div>
                </header>
                <h3 className="mb-[0.9rem] text-[1.2rem] font-bold tracking-[-0.01em]">
                  {detail.subject || "(no subject)"}
                </h3>
                {detail.message && (
                  <div className="text-[0.95rem] leading-[1.6] break-words whitespace-pre-wrap text-slate-900">
                    {detail.message}
                  </div>
                )}
                {detail.attachments.length > 0 && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className={SECTION_LABEL}>Attachments</div>
                    <ul className="mt-[0.45rem] flex list-none flex-col gap-[0.3rem]">
                      {detail.attachments.map((a, i) => (
                        <li key={a.id ?? i} className="text-[0.9rem]">
                          📎 {a.name ?? `Attachment ${i + 1}`}
                          {typeof a.size === "number" && (
                            <span className="text-[0.82rem] text-slate-500">
                              {" · "}
                              {(a.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.recipients.length > 0 && (
                  <div className="mt-4 text-[0.85rem] text-slate-500">
                    <span className={SECTION_LABEL}>To: </span>
                    {detail.recipients.map((r) => `${r.firstName} ${r.lastName}`.trim()).join(", ")}
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
