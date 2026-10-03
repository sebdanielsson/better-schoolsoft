import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, HelpCircle, Paperclip } from "lucide-react";
import { useSchoolsoftContext, type SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.tsx";
import { useNow } from "../hooks/useNow.ts";
import {
  fetchEvaNewsDetail,
  fetchEvaNewsFeed,
  markEvaNewsRead,
  saveEvaNewsResponse,
  setEvaNewsArchived,
  type EvaNewsFeed,
  type EvaNewsItem,
} from "../api/schoolsoft.ts";
import { getQueryEntry, invalidateQueries, setQueryData } from "../lib/query-cache.ts";
import Avatar from "../components/Avatar.tsx";
import AttachmentLink, { AttachmentImage } from "../components/AttachmentLink.tsx";
import { ErrorBanner } from "../components/DashCard.tsx";
import { btnPrimaryClass } from "../components/ConfirmDialog.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";
import { safeHttpUrl } from "../lib/safe-url.ts";

/** Decode HTML entities (&eacute;, &bull;, &ndash;, &amp; …) using a throwaway textarea. */
function decodeEntities(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** Render a description: decode HTML entities, preserve newlines, linkify URLs. */
function renderDescription(raw: string): React.ReactNode {
  const decoded = decodeEntities(raw).replace(/\r\n/g, "\n");
  const parts = decoded.split(URL_RE);
  return parts.map((p, i) => {
    // split() with a capturing group puts the matches at odd indices, so only those can be
    // links. Checking the index first keeps new URL() off the plain-text segments, where it
    // would throw on every one, and sidesteps URL_RE.test() being stateful (/g advances
    // lastIndex between calls, so repeated input alternates).
    const href = i % 2 === 1 ? safeHttpUrl(p) : undefined;
    return href ? (
      <a key={i} href={href} target="_blank" rel="noreferrer">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    );
  });
}

function formatRelativeDate(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const diffDays = Math.floor((Date.now() - ms) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    year: diffDays > 200 ? "numeric" : undefined,
    month: "short",
    day: "numeric",
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  "Student Care": "#16a34a",
  Administration: "#2563eb",
  "Info from Teachers": "#8b5cf6",
  "Career Councellor": "#f59e0b",
  "Academic Coordinator": "#ec4899",
};

function categoryColor(cat?: string): string {
  if (!cat) return "#64748b";
  return CATEGORY_COLORS[cat] ?? "#0ea5e9";
}

const CHIP_BASE =
  "inline-flex items-center gap-[0.45rem] rounded-full px-[0.9rem] py-[0.4rem] text-[0.85rem] font-[inherit] cursor-pointer transition-colors";
const CHIP_INACTIVE = "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50";
const CHIP_ACTIVE = "bg-blue-600 border border-blue-600 text-white";
const CHIP_COUNT_BASE =
  "inline-flex items-center justify-center min-w-[1.4em] h-[1.4em] px-[0.35em] rounded-full text-[0.72rem] font-semibold";
const CHIP_COUNT_INACTIVE = "bg-slate-900/10";
const CHIP_COUNT_ACTIVE = "bg-white/25";

const FEEDS: { id: EvaNewsFeed; label: string; empty: string }[] = [
  { id: "current", label: "Current", empty: "No current news." },
  { id: "old", label: "Older", empty: "No older news." },
  {
    id: "archived",
    label: "Archived",
    empty: "Nothing archived. Archive news you're done with to tidy the feed.",
  },
];

const newsKeys = {
  feed: (prefix: string, feed: EvaNewsFeed) => `${prefix}news:${feed}`,
  feeds: (prefix: string) => `${prefix}news:`,
  detail: (prefix: string, id: number) => `${prefix}newsitem:${id}`,
};

/** A question can be answered until the end of its `toDate`. */
function answerOpen(toDate: string | undefined, now: number): boolean {
  if (!toDate) return true;
  const ms = new Date(toDate).getTime();
  return Number.isNaN(ms) || ms + 86_400_000 > now;
}

export default function NewsPage() {
  const ctx = useSchoolsoftContext();
  const [feed, setFeed] = useState<EvaNewsFeed>("current");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const list = useQuery(ctx && newsKeys.feed(ctx.keyPrefix, feed), async () =>
    fetchEvaNewsFeed(
      ctx!.school,
      await ctx!.token(),
      ctx!.parentUserId,
      ctx!.orgId,
      ctx!.studentId,
      feed,
    ),
  );
  const items = useMemo(() => list.data ?? [], [list.data]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of items) {
      const c = n.category?.trim() || "Other";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter((n) => (n.category?.trim() || "Other") === selectedCategory);
  }, [items, selectedCategory]);

  const unanswered = items.filter((n) => n.response && !n.newsConfirm).length;

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">News</h2>
        {list.data && (
          <span className="text-[0.85rem] text-slate-500">
            {items.length} {items.length === 1 ? "item" : "items"}
            {unanswered > 0 &&
              ` · ${unanswered} ${unanswered === 1 ? "question" : "questions"} to answer`}
          </span>
        )}
      </div>

      <div role="group" aria-label="News feeds" className="mb-4 flex gap-1.5">
        {FEEDS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={feed === f.id}
            onClick={() => {
              setFeed(f.id);
              setSelectedCategory(null);
              setExpanded(new Set());
            }}
            className={cn(
              "rounded-full border px-[0.85rem] py-[0.35rem] text-[0.82rem] font-medium transition-colors",
              feed === f.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.error && <ErrorBanner>{list.error.message}</ErrorBanner>}

      {!ctx || list.loading ? (
        <NewsSkeleton />
      ) : (
        <>
          {categories.length > 1 && (
            <div className="sticky top-16 z-[5] mb-5 flex flex-wrap gap-[0.4rem] bg-slate-50 py-2">
              <button
                type="button"
                aria-pressed={selectedCategory === null}
                className={cn(CHIP_BASE, selectedCategory === null ? CHIP_ACTIVE : CHIP_INACTIVE)}
                onClick={() => setSelectedCategory(null)}
              >
                All{" "}
                <span
                  className={cn(
                    CHIP_COUNT_BASE,
                    selectedCategory === null ? CHIP_COUNT_ACTIVE : CHIP_COUNT_INACTIVE,
                  )}
                >
                  {items.length}
                </span>
              </button>
              {categories.map(([cat, n]) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    className={cn(CHIP_BASE, active ? CHIP_ACTIVE : CHIP_INACTIVE)}
                    style={
                      active
                        ? {
                            background: categoryColor(cat),
                            borderColor: categoryColor(cat),
                            color: "#fff",
                          }
                        : { borderColor: categoryColor(cat) + "55" }
                    }
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}{" "}
                    <span
                      className={cn(
                        CHIP_COUNT_BASE,
                        active ? CHIP_COUNT_ACTIVE : CHIP_COUNT_INACTIVE,
                      )}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
              {items.length === 0
                ? FEEDS.find((f) => f.id === feed)?.empty
                : "No news in this category."}
            </div>
          ) : (
            <ul className="flex list-none flex-col gap-[0.85rem]">
              {filtered.map((n) => (
                <NewsItem
                  key={n.id}
                  ctx={ctx}
                  item={n}
                  feed={feed}
                  open={expanded.has(n.id)}
                  onToggle={() => toggleExpanded(n.id)}
                  onArchived={() => {
                    invalidateQueries(newsKeys.feeds(ctx.keyPrefix));
                    void list.refetch();
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function NewsItem({
  ctx,
  item: n,
  feed,
  open,
  onToggle,
  onArchived,
}: {
  ctx: SchoolsoftContext;
  item: EvaNewsItem;
  feed: EvaNewsFeed;
  open: boolean;
  onToggle: () => void;
  onArchived: () => void;
}) {
  const detail = useQuery(open ? newsKeys.detail(ctx.keyPrefix, n.id) : null, async () =>
    fetchEvaNewsDetail(ctx.school, await ctx.token(), ctx.parentUserId, ctx.orgId, n.id),
  );
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  /* Expanding an unread item marks it read on the server, like opening it in
   * the official app. Patch the cached feed so the blue rule goes away. */
  const markRead = open && !n.read;
  useEffect(() => {
    if (!markRead) return;
    void (async () => {
      try {
        await markEvaNewsRead(ctx.school, await ctx.token(), ctx.parentUserId, ctx.orgId, n.id);
        const key = newsKeys.feed(ctx.keyPrefix, feed);
        const rows = getQueryEntry<EvaNewsItem[]>(key).data;
        if (rows)
          setQueryData(
            key,
            rows.map((r) => (r.id === n.id ? { ...r, read: true } : r)),
          );
      } catch {
        /* not worth surfacing */
      }
    })();
  }, [ctx, feed, n.id, markRead]);

  async function toggleArchive() {
    setArchiving(true);
    setArchiveError(null);
    try {
      await setEvaNewsArchived(
        ctx.school,
        await ctx.token(),
        ctx.parentUserId,
        n.id,
        feed !== "archived",
      );
      onArchived();
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "Could not update the item.");
    } finally {
      setArchiving(false);
    }
  }

  const decoded = decodeEntities(n.description ?? "").trim();
  const preview = decoded.slice(0, 180);
  const expandable =
    decoded.length > preview.length || !!n.hasAttachment || !!n.response || !!n.newsConfirm;
  const d = detail.data;
  const images = d?.attachments?.filter((a) => a.type === "IMAGE") ?? [];
  const files = d?.attachments?.filter((a) => a.type !== "IMAGE") ?? [];
  const needsAnswer = !!n.response && !n.newsConfirm;

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_1fr] gap-4 rounded-lg border border-slate-200 bg-white px-[1.1rem] py-4 shadow-sm transition-shadow hover:shadow-md",
        "border-l-[3px]",
        n.read ? "border-l-slate-200" : "border-l-blue-600",
      )}
    >
      <Avatar name={n.author?.name ?? "School"} picture={n.author?.picture || null} size={32} />
      <div className="min-w-0">
        <div className="mb-[0.3rem] flex flex-wrap items-center gap-[0.45rem] text-xs text-slate-500">
          <span className="font-semibold text-slate-900">{n.author?.name ?? "School"}</span>
          {n.category && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide"
              style={{
                background: categoryColor(n.category) + "1f",
                color: categoryColor(n.category),
              }}
            >
              {n.category}
            </span>
          )}
          <span>· {formatRelativeDate(n.creDate)}</span>
          {n.hasAttachment && <Paperclip className="h-3.5 w-3.5" aria-label="Has attachments" />}
          {needsAnswer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
              <HelpCircle className="h-3 w-3" aria-hidden="true" /> Question to answer
            </span>
          )}
          {!n.read && (
            <span className="ml-auto h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />
          )}
        </div>
        <h3 className="mb-[0.45rem] text-[1.05rem] leading-tight font-bold tracking-tight">
          {n.title.trim()}
        </h3>
        {decoded && (
          <div className="text-[0.92rem] leading-relaxed break-words whitespace-pre-wrap text-slate-900 [&_a]:break-all">
            {open ? (
              renderDescription(n.description)
            ) : (
              <>
                {preview}
                {decoded.length > preview.length && "…"}
              </>
            )}
          </div>
        )}

        {open && (
          <div className="mt-3 flex flex-col gap-3">
            {detail.loading && <Skeleton className="h-6 w-48 rounded-sm" />}
            {detail.error && <ErrorBanner>{detail.error.message}</ErrorBanner>}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((a) => (
                  <AttachmentImage key={a.fileId} ctx={ctx} attachment={a} />
                ))}
              </div>
            )}
            {(files.length > 0 || images.length > 0) && (
              <ul className="flex flex-col gap-1">
                {[...files, ...images].map((a) => (
                  <li key={a.fileId}>
                    <AttachmentLink ctx={ctx} attachment={a} />
                  </li>
                ))}
              </ul>
            )}
            {(n.response || n.newsConfirm) && d && (
              <NewsQuestion ctx={ctx} item={n} question={d.responseLabel} />
            )}
          </div>
        )}

        {archiveError && <p className="mt-2 text-sm text-red-700">{archiveError}</p>}
        <div className="mt-2 flex items-center gap-4">
          {expandable && (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-blue-600 hover:underline"
              onClick={onToggle}
            >
              {open ? "Show less" : "Read more"}
            </button>
          )}
          {feed !== "old" && (
            <button
              type="button"
              disabled={archiving}
              onClick={() => void toggleArchive()}
              className="inline-flex items-center gap-1 text-[0.8rem] text-slate-500 hover:text-slate-800 disabled:opacity-60"
            >
              {feed === "archived" ? (
                <>
                  <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" /> Move back to news
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Archive
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function NewsQuestion({
  ctx,
  item,
  question,
}: {
  ctx: SchoolsoftContext;
  item: EvaNewsItem;
  question: string | undefined;
}) {
  const now = useNow().getTime();
  const answered = item.newsConfirm?.responseText ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const open = answerOpen(item.toDate, now);
  const value = draft ?? answered;

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await saveEvaNewsResponse(
        ctx.school,
        await ctx.token(),
        ctx.parentUserId,
        item.id,
        value.trim(),
      );
      setStatus("Your answer was sent.");
      /* Keep showing what was sent until the refetched feed carries it. */
      invalidateQueries(newsKeys.feeds(ctx.keyPrefix));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not send your answer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2.5">
      {question?.trim() && (
        <div className="mb-1.5 text-[0.9rem] font-semibold text-slate-900">{question}</div>
      )}
      {answered && draft === null && (
        <div className="text-[0.88rem] text-slate-700">
          <span className="font-semibold">You replied:</span> {answered}
        </div>
      )}
      {open ? (
        <>
          <textarea
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Write your answer here"
            className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
            aria-label="Your answer"
          />
          <div className="mt-1.5 flex items-center justify-end gap-3">
            {status && <span className="text-[0.8rem] text-slate-600">{status}</span>}
            <button
              type="button"
              className={btnPrimaryClass}
              disabled={saving || value.trim() === "" || value === answered}
              onClick={() => void save()}
            >
              {saving ? "Sending…" : answered ? "Update answer" : "Send answer"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-1 text-[0.8rem] text-slate-500">The time to answer has passed.</div>
      )}
    </div>
  );
}

function NewsSkeleton() {
  return (
    <ul className="flex flex-col gap-[0.85rem]" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-4 rounded-lg border border-slate-200 bg-white px-[1.1rem] py-4"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3 w-40 rounded-sm" />
            <Skeleton className="mt-2 h-4 w-64 rounded-sm" />
            <Skeleton className="mt-2 h-3 w-full rounded-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}
