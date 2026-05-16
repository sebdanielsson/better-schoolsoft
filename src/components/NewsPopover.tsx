import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.tsx";

/** Decode HTML entities (&eacute;, &bull;, &ndash;, &amp; …) using a throwaway textarea. */
function decodeEntities(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

function renderDescription(raw: string): ReactNode {
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

/* Same palette as NewsPage. */
const CATEGORY_COLORS: Record<string, string> = {
  "Student Care": "#16a34a",
  Administration: "#2563eb",
  "Info from Teachers": "#8b5cf6",
  "Career Councellor": "#f59e0b",
  "Academic Coordinator": "#ec4899",
};

function categoryColor(cat: string | undefined): string {
  if (!cat) return "#64748b";
  return CATEGORY_COLORS[cat] ?? "#0ea5e9";
}

export interface NewsPopoverData {
  title: string;
  description?: string;
  dateLabel?: string;
  categoryLabel?: string;
  authorName?: string;
  authorPicture?: string | null;
  hasAttachment?: boolean;
}

interface Props {
  open: boolean;
  data: NewsPopoverData | null;
  onClose: () => void;
}

export default function NewsPopover({ open, data, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open || !data) return null;

  const catColor = categoryColor(data.categoryLabel);

  return createPortal(
    <div
      className="news-popover-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-popover-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="news-popover-panel" ref={panelRef} tabIndex={-1}>
        <button type="button" className="news-popover-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M5 5l10 10M15 5L5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="news-popover-header">
          {data.authorName && (
            <Avatar name={data.authorName} picture={data.authorPicture ?? null} size={44} />
          )}
          <div className="news-popover-header-text">
            <div className="news-popover-meta">
              {data.authorName && <span className="news-popover-author">{data.authorName}</span>}
              {data.categoryLabel && (
                <span
                  className="news-popover-category"
                  style={{ background: `${catColor}1f`, color: catColor }}
                >
                  {data.categoryLabel}
                </span>
              )}
              {data.dateLabel && <span className="news-popover-date">· {data.dateLabel}</span>}
              {data.hasAttachment && (
                <span className="news-popover-attach" aria-label="Has attachment">
                  📎
                </span>
              )}
            </div>
            <h2 id="news-popover-title" className="news-popover-title">
              {data.title.trim()}
            </h2>
          </div>
        </div>

        {data.description && data.description.trim() !== "" ? (
          <div className="news-popover-prose">{renderDescription(data.description)}</div>
        ) : (
          <div className="news-popover-empty">No body text.</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
