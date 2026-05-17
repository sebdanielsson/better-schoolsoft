import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import { fetchEvaNews, fetchEvaParent, type EvaNewsItem } from "../api/schoolsoft.ts";
import Avatar from "../components/Avatar.tsx";
import { cn } from "../lib/utils.ts";

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
  return parts.map((p, i) =>
    URL_RE.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
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

export default function NewsPage() {
  const { session, getEvaToken } = useAuth();
  const [items, setItems] = useState<EvaNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("Sign in via SchoolSoft to load the news feed");
        const parent = await fetchEvaParent(session.school, token);
        const studentId = parent.children[0]?.studentId;
        const orgId = parent.children[0]?.schools[0]?.orgId ?? session.orgId;
        if (!studentId) throw new Error("No student linked to this account");
        const list = await fetchEvaNews(session.school, token, parent.userId, orgId, studentId);
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load news");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of items) {
      const c = n.category ?? "Other";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter((n) => (n.category ?? "Other") === selectedCategory);
  }, [items, selectedCategory]);

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading)
    return (
      <div className="py-16 px-8 text-center text-slate-500 text-[0.95rem]">Loading news…</div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight">News</h2>
        <span className="text-[0.85rem] text-slate-500">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {categories.length > 0 && (
        <div className="sticky top-16 z-[5] mb-5 flex flex-wrap gap-[0.4rem] bg-slate-50 py-2">
          <button
            type="button"
            aria-pressed={selectedCategory === null}
            className={cn(CHIP_BASE, selectedCategory === null ? CHIP_ACTIVE : CHIP_INACTIVE)}
            onClick={() => {
              setSelectedCategory(null);
            }}
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
                onClick={() => {
                  setSelectedCategory(cat);
                }}
              >
                {cat}{" "}
                <span
                  className={cn(CHIP_COUNT_BASE, active ? CHIP_COUNT_ACTIVE : CHIP_COUNT_INACTIVE)}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-12 px-8 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
          No news in this category.
        </div>
      ) : (
        <ul className="flex list-none flex-col gap-[0.85rem]">
          {filtered.map((n) => {
            const isOpen = expanded.has(n.id);
            const decoded = decodeEntities(n.description ?? "").trim();
            const preview = decoded.slice(0, 180);
            const hasMore = decoded.length > preview.length;
            return (
              <li
                key={n.id}
                className={cn(
                  "grid grid-cols-[auto_1fr] gap-4 rounded-lg border border-slate-200 bg-white px-[1.1rem] py-4 shadow-sm transition-shadow hover:shadow-md",
                  "border-l-[3px]",
                  n.read ? "border-l-slate-200" : "border-l-blue-600",
                )}
              >
                <Avatar
                  name={n.author?.name ?? "School"}
                  picture={n.author?.picture || null}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="mb-[0.3rem] flex flex-wrap items-center gap-[0.45rem] text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">
                      {n.author?.name ?? "School"}
                    </span>
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
                    {n.hasAttachment && <span className="text-sm">📎</span>}
                    {!n.read && (
                      <span
                        className="ml-auto h-2 w-2 rounded-full bg-blue-600"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <h3 className="mb-[0.45rem] text-[1.05rem] font-bold leading-tight tracking-tight">
                    {n.title.trim()}
                  </h3>
                  {decoded && (
                    <div className="whitespace-pre-wrap break-words text-[0.92rem] leading-relaxed text-slate-900 [&_a]:break-all">
                      {isOpen ? (
                        renderDescription(n.description)
                      ) : (
                        <>
                          {preview}
                          {hasMore && "…"}
                        </>
                      )}
                    </div>
                  )}
                  {hasMore && (
                    <button
                      type="button"
                      className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-blue-600 hover:underline"
                      onClick={() => {
                        toggleExpanded(n.id);
                      }}
                    >
                      {isOpen ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
