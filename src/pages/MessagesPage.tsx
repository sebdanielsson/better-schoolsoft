import { useEffect, useMemo, useRef, useState } from "react";
import { MailOpen, Paperclip, PenSquare, RotateCcw, Search, Send, Trash2 } from "lucide-react";
import { useSchoolsoftContext, type SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.tsx";
import {
  fetchEvaAttachment,
  fetchEvaMessage,
  fetchEvaMessages,
  fetchEvaMessagingAllowAll,
  moveEvaMessages,
  setEvaMessageRead,
  type EvaMessageAttachment,
  type EvaMessageDetail,
  type EvaMessageFolder,
  type EvaMessageMove,
} from "../api/schoolsoft.ts";
import { filterMessages, messageKeys, safeDownloadName, senderName } from "../lib/messages.ts";
import { getQueryEntry, invalidateQueries, setQueryData } from "../lib/query-cache.ts";
import Avatar from "../components/Avatar.tsx";
import ComposeMessageDialog, { type ComposeTarget } from "../components/ComposeMessageDialog.tsx";
import ConfirmDialog, { btnPrimaryClass } from "../components/ConfirmDialog.tsx";
import { ErrorBanner } from "../components/DashCard.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

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
const toolbarBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[0.82rem] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60";

const FOLDERS: { id: EvaMessageFolder; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "bin", label: "Trash" },
];

export default function MessagesPage() {
  const ctx = useSchoolsoftContext();
  const [folder, setFolder] = useState<EvaMessageFolder>("inbox");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compose, setCompose] = useState<ComposeTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allowAll = useQuery(
    ctx && messageKeys.allowAll(ctx.keyPrefix),
    async () => fetchEvaMessagingAllowAll(ctx!.school, await ctx!.token(), ctx!.orgId),
    { staleMs: 10 * 60_000 },
  );
  const list = useQuery(ctx && messageKeys.folder(ctx.keyPrefix, folder), async () => {
    const rows = await fetchEvaMessages(
      ctx!.school,
      await ctx!.token(),
      ctx!.parentUserId,
      ctx!.orgId,
      folder,
    );
    return [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });
  const detail = useQuery(
    ctx && selectedId !== null ? messageKeys.detail(ctx.keyPrefix, selectedId) : null,
    async () =>
      fetchEvaMessage(ctx!.school, await ctx!.token(), ctx!.parentUserId, ctx!.orgId, selectedId!),
  );

  const rows = useMemo(() => filterMessages(list.data ?? [], query), [list.data, query]);
  const unreadCount = useMemo(() => (list.data ?? []).filter((m) => !m.isRead).length, [list.data]);

  /* Select the newest message once per folder visit, on wide screens only —
   * on a phone that would skip straight past the list. Only once, so that
   * closing a message (e.g. after "Mark unread") doesn't reopen it. */
  const firstId = rows[0]?.id;
  const autoSelected = useRef<EvaMessageFolder | null>(null);
  useEffect(() => {
    if (autoSelected.current === folder || firstId === undefined) return;
    autoSelected.current = folder;
    if (window.matchMedia("(min-width: 768px)").matches) setSelectedId(firstId);
  }, [firstId, folder]);

  /* Opening an unread message marks it read on the server, like the official
   * app. Patch the cached list so the dot disappears without a refetch. */
  const openedUnread =
    folder === "inbox" && detail.data && !detail.data.isRead ? detail.data.id : null;
  useEffect(() => {
    if (!ctx || openedUnread === null) return;
    void (async () => {
      try {
        await setEvaMessageRead(
          ctx.school,
          await ctx.token(),
          ctx.parentUserId,
          ctx.orgId,
          openedUnread,
          true,
        );
        patchRead(ctx, openedUnread, true);
      } catch {
        /* A failed read marker is not worth an error banner. */
      }
    })();
  }, [ctx, openedUnread]);

  async function act(
    fn: (c: SchoolsoftContext, token: string) => Promise<void>,
    after?: () => void,
  ) {
    if (!ctx) return;
    setBusy(true);
    setActionError(null);
    try {
      await fn(ctx, await ctx.token());
      after?.();
      invalidateQueries(messageKeys.lists(ctx.keyPrefix));
      void list.refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function move(kind: EvaMessageMove, id: number) {
    return act(
      (c, t) => moveEvaMessages(c.school, t, c.parentUserId, c.orgId, kind, [id]),
      () => {
        setSelectedId(null);
        setConfirmDelete(false);
      },
    );
  }

  const d = detail.data;
  const canCompose = allowAll.data === true;
  const canReply = !!d && folder === "inbox" && !d.sentByUser && (canCompose || d.replyTo);
  const hasSelection = selectedId !== null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Messages</h2>
        <div className="flex items-center gap-3">
          {list.data && (
            <span className="text-[0.85rem] text-slate-500">
              {list.data.length} {list.data.length === 1 ? "message" : "messages"}
              {folder === "inbox" && unreadCount > 0 && ` · ${unreadCount} unread`}
            </span>
          )}
          {canCompose && (
            <button
              type="button"
              className={cn(btnPrimaryClass, "inline-flex items-center gap-1.5")}
              onClick={() => setCompose({ kind: "new" })}
            >
              <PenSquare className="h-4 w-4" aria-hidden="true" />
              New message
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Folders" className="flex gap-1.5">
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={folder === f.id}
              onClick={() => {
                setFolder(f.id);
                setSelectedId(null);
                setActionError(null);
              }}
              className={cn(
                "rounded-full border px-[0.85rem] py-[0.35rem] text-[0.82rem] font-medium transition-colors",
                folder === f.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">Search messages</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages"
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-sm"
          />
        </label>
      </div>

      {list.error && <ErrorBanner>{list.error.message}</ErrorBanner>}
      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}

      {!ctx || list.loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
          {query
            ? "No messages match your search."
            : folder === "bin"
              ? "Trash is empty."
              : "No messages."}
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
            {rows.map((m) => {
              const isSelected = selectedId === m.id;
              const isUnread = folder === "inbox" && !m.isRead;
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
                      setActionError(null);
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
                      <Paperclip
                        className="h-4 w-4 self-center text-slate-400"
                        aria-label="Has attachments"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={cn("md:sticky md:top-24", !hasSelection && "hidden md:block")}>
            {detail.loading && hasSelection ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : detail.error ? (
              <ErrorBanner>{detail.error.message}</ErrorBanner>
            ) : !d ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-16 text-center text-slate-500">
                Select a message to read it.
              </div>
            ) : (
              <article className="rounded-lg border border-slate-200 bg-white px-7 py-6 shadow-sm">
                <button
                  type="button"
                  className="mb-3 inline-block cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[0.85rem] font-semibold text-blue-600 md:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  ← Back to {FOLDERS.find((f) => f.id === folder)?.label.toLowerCase()}
                </button>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {canReply && (
                    <button
                      type="button"
                      className={toolbarBtn}
                      onClick={() => setCompose({ kind: "reply", original: d })}
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" /> Reply
                    </button>
                  )}
                  {folder === "inbox" && (
                    <button
                      type="button"
                      className={toolbarBtn}
                      disabled={busy}
                      onClick={() =>
                        void act(
                          (c, t) =>
                            setEvaMessageRead(c.school, t, c.parentUserId, c.orgId, d.id, false),
                          () => {
                            setSelectedId(null);
                            patchRead(ctx!, d.id, false, { detail: false });
                            invalidateQueries(messageKeys.detail(ctx!.keyPrefix, d.id));
                          },
                        )
                      }
                    >
                      <MailOpen className="h-3.5 w-3.5" aria-hidden="true" /> Mark unread
                    </button>
                  )}
                  {folder !== "bin" && (
                    <button
                      type="button"
                      className={toolbarBtn}
                      disabled={busy}
                      onClick={() =>
                        void move(folder === "sent" ? "remove-sent" : "remove-inbox", d.id)
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Move to trash
                    </button>
                  )}
                  {folder === "bin" && (
                    <>
                      <button
                        type="button"
                        className={toolbarBtn}
                        disabled={busy}
                        onClick={() => void move("restore", d.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore
                      </button>
                      <button
                        type="button"
                        className={toolbarBtn}
                        disabled={busy}
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete forever
                      </button>
                    </>
                  )}
                </div>
                <MessageBody ctx={ctx!} message={d} />
              </article>
            )}
          </div>
        </div>
      )}

      {ctx && compose && (
        <ComposeMessageDialog
          ctx={ctx}
          target={compose}
          sentLabel={compose.kind === "reply" ? formatExactDate(compose.original.date) : ""}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null);
            invalidateQueries(messageKeys.lists(ctx.keyPrefix));
            void list.refetch();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this message for good?"
        confirmLabel="Delete forever"
        danger
        busy={busy}
        error={actionError}
        onConfirm={() => selectedId !== null && void move("delete", selectedId)}
        onClose={() => setConfirmDelete(false)}
      >
        It can't be restored afterwards.
      </ConfirmDialog>
    </div>
  );
}

/** Patch the cached inbox and detail so read state updates instantly. */
function patchRead(
  ctx: SchoolsoftContext,
  id: number,
  read: boolean,
  { detail = true }: { detail?: boolean } = {},
) {
  const listKey = messageKeys.folder(ctx.keyPrefix, "inbox");
  const rows = getQueryEntry<{ id: number; isRead: boolean }[]>(listKey).data;
  if (rows)
    setQueryData(
      listKey,
      rows.map((m) => (m.id === id ? { ...m, isRead: read } : m)),
    );
  if (!detail) return;
  const detailKey = messageKeys.detail(ctx.keyPrefix, id);
  const det = getQueryEntry<EvaMessageDetail>(detailKey).data;
  if (det) setQueryData(detailKey, { ...det, isRead: read });
}

function MessageBody({ ctx, message: d }: { ctx: SchoolsoftContext; message: EvaMessageDetail }) {
  const recipients = d.recipients
    .map((r) => r.name ?? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim())
    .filter(Boolean);
  return (
    <>
      <header className="mb-4 flex items-center gap-[0.9rem] border-b border-slate-200 pb-4">
        <Avatar name={senderName(d.sender)} picture={d.sender.picture || null} size={32} />
        <div className="min-w-0">
          <div className="text-base font-bold">{senderName(d.sender)}</div>
          <div className="mt-[0.15rem] text-[0.8rem] text-slate-500">{formatExactDate(d.date)}</div>
        </div>
      </header>
      <h3 className="mb-[0.9rem] text-[1.2rem] font-bold tracking-[-0.01em]">
        {d.subject || "(no subject)"}
      </h3>
      {d.message && (
        <div className="text-[0.95rem] leading-[1.6] break-words whitespace-pre-wrap text-slate-900">
          {d.message}
        </div>
      )}
      {d.attachments.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className={SECTION_LABEL}>Attachments</div>
          <ul className="mt-[0.45rem] flex list-none flex-col gap-[0.3rem]">
            {d.attachments.map((a, i) => (
              <li key={a.fileId ?? i}>
                <AttachmentLink ctx={ctx} attachment={a} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {recipients.length > 0 && (
        <div className="mt-4 text-[0.85rem] text-slate-500">
          <span className={SECTION_LABEL}>To: </span>
          {recipients.join(", ")}
        </div>
      )}
    </>
  );
}

function AttachmentLink({
  ctx,
  attachment,
}: {
  ctx: SchoolsoftContext;
  attachment: EvaMessageAttachment;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  async function download() {
    setState("loading");
    try {
      const blob = await fetchEvaAttachment(ctx.school, await ctx.token(), attachment.fileId);
      /* Always save, never open inline: a blob URL shares our origin, so an
       * HTML attachment opened in a tab could read the stored session. */
      const url = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = safeDownloadName(attachment.name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
    } catch {
      setState("error");
    }
  }
  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1.5 text-[0.9rem] text-blue-600 hover:underline disabled:opacity-60"
    >
      <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
      {attachment.name || "Attachment"}
      {state === "loading" && <span className="text-slate-500"> · downloading…</span>}
      {state === "error" && <span className="text-red-700"> · download failed</span>}
    </button>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex max-w-[380px] flex-col gap-[0.35rem]" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-lg border border-slate-200 bg-white px-[0.85rem] py-[0.7rem]"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-32 rounded-sm" />
            <Skeleton className="mt-2 h-3 w-48 rounded-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}
