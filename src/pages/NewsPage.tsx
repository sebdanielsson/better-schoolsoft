import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import { fetchEvaNews, fetchEvaParent, type EvaNewsItem } from "../api/schoolsoft.ts";
import Avatar from "../components/Avatar.tsx";

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

  if (loading) return <div className="loading">Loading news…</div>;

  return (
    <div className="news-page">
      <div className="page-header">
        <h2>News</h2>
        <span className="page-subtitle">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {categories.length > 0 && (
        <div className="news-filter">
          <button
            type="button"
            className={`news-chip ${selectedCategory === null ? "is-active" : ""}`}
            onClick={() => {
              setSelectedCategory(null);
            }}
          >
            All <span className="news-chip-count">{items.length}</span>
          </button>
          {categories.map(([cat, n]) => (
            <button
              key={cat}
              type="button"
              className={`news-chip ${selectedCategory === cat ? "is-active" : ""}`}
              style={
                selectedCategory === cat
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
              {cat} <span className="news-chip-count">{n}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">No news in this category.</div>
      ) : (
        <ul className="news-feed">
          {filtered.map((n) => {
            const isOpen = expanded.has(n.id);
            const decoded = decodeEntities(n.description ?? "").trim();
            const preview = decoded.slice(0, 180);
            const hasMore = decoded.length > preview.length;
            return (
              <li key={n.id} className={`news-card ${n.read ? "is-read" : "is-unread"}`}>
                <Avatar
                  name={n.author?.name ?? "School"}
                  picture={n.author?.picture || null}
                  size={32}
                />
                <div className="news-card-body">
                  <div className="news-card-meta">
                    <span className="news-card-author">{n.author?.name ?? "School"}</span>
                    {n.category && (
                      <span
                        className="news-card-category"
                        style={{
                          background: categoryColor(n.category) + "1f",
                          color: categoryColor(n.category),
                        }}
                      >
                        {n.category}
                      </span>
                    )}
                    <span className="news-card-date">· {formatRelativeDate(n.creDate)}</span>
                    {n.hasAttachment && <span className="news-card-attach">📎</span>}
                    {!n.read && <span className="news-card-dot" aria-label="Unread" />}
                  </div>
                  <h3 className="news-card-title">{n.title.trim()}</h3>
                  {decoded && (
                    <div className="news-card-text">
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
                      className="news-card-toggle"
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
