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

  if (loading) return <div className="loading">Loading inbox…</div>;

  return (
    <div className="messages-page">
      <div className="page-header">
        <h2>Messages</h2>
        <span className="page-subtitle">
          {inbox.length} {inbox.length === 1 ? "message" : "messages"}
          {unreadCount > 0 && ` · ${unreadCount} unread`}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {inbox.length === 0 ? (
        <div className="empty-state">No messages.</div>
      ) : (
        <div className={`messages-layout ${selectedId !== null ? "has-selection" : ""}`}>
          <ul className="messages-list">
            {inbox.map((m) => (
              <li
                key={m.id}
                className={`messages-item ${!m.isRead ? "is-unread" : ""} ${
                  selectedId === m.id ? "is-selected" : ""
                }`}
              >
                <button
                  type="button"
                  className="messages-item-btn"
                  onClick={() => {
                    setSelectedId(m.id);
                  }}
                >
                  <Avatar
                    name={senderName(m.sender)}
                    picture={m.sender.picture || null}
                    size={32}
                  />
                  <div className="messages-item-body">
                    <div className="messages-item-top">
                      <span className="messages-item-sender">{senderName(m.sender)}</span>
                      <span className="messages-item-date">{formatRelativeDate(m.date)}</span>
                    </div>
                    <div className="messages-item-subject">{m.subject || "(no subject)"}</div>
                    <div className="messages-item-preview">{m.message}</div>
                  </div>
                  {!m.isRead && <span className="messages-item-dot" aria-label="Unread" />}
                  {m.hasFiles && (
                    <span className="messages-item-paperclip" aria-label="Has attachments">
                      📎
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="messages-detail">
            {detailLoading ? (
              <div className="card-loading">Loading message…</div>
            ) : !detail ? (
              <div className="messages-detail-empty">Select a message to read it.</div>
            ) : (
              <article className="messages-detail-card">
                <button
                  type="button"
                  className="messages-back"
                  onClick={() => {
                    setSelectedId(null);
                  }}
                >
                  ← Back to inbox
                </button>
                <header className="messages-detail-header">
                  <Avatar
                    name={senderName(detail.sender)}
                    picture={detail.sender.picture || null}
                    size={32}
                  />
                  <div className="messages-detail-from">
                    <div className="messages-detail-sender">{senderName(detail.sender)}</div>
                    <div className="messages-detail-date">{formatExactDate(detail.date)}</div>
                  </div>
                </header>
                <h3 className="messages-detail-subject">{detail.subject || "(no subject)"}</h3>
                {detail.message && <div className="messages-detail-body">{detail.message}</div>}
                {detail.attachments.length > 0 && (
                  <div className="messages-detail-attachments">
                    <div className="messages-attach-label">Attachments</div>
                    <ul className="messages-attach-list">
                      {detail.attachments.map((a, i) => (
                        <li key={a.id ?? i} className="messages-attach-item">
                          📎 {a.name ?? `Attachment ${i + 1}`}
                          {typeof a.size === "number" && (
                            <span className="messages-attach-size">
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
                  <div className="messages-detail-recipients">
                    <span className="messages-recipients-label">To: </span>
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
