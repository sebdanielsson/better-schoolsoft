import { type ReactNode } from "react";
import Avatar from "./Avatar.tsx";
import { Dialog, DialogContent } from "./ui/dialog.tsx";
import { safeHttpUrl } from "../lib/safe-url.ts";

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
  return parts.map((p, i) => {
    // split() with a capturing group puts the matches at odd indices, so only those can be
    // links. Checking the index first keeps new URL() off the plain-text segments, where it
    // would throw on every one.
    const href = i % 2 === 1 ? safeHttpUrl(p) : undefined;
    return href ? (
      <a
        key={i}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
      >
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    );
  });
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
  if (!data) return null;

  const catColor = categoryColor(data.categoryLabel);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-3rem)] max-w-[680px] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 text-slate-900 sm:max-w-[680px]"
        aria-labelledby="news-popover-title"
      >
        <div className="flex shrink-0 items-start gap-[0.85rem] border-b border-slate-200 pt-6 pr-[3.25rem] pb-[1.1rem] pl-7">
          {data.authorName && (
            <Avatar name={data.authorName} picture={data.authorPicture ?? null} size={44} />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-[0.4rem] flex flex-wrap items-center gap-[0.45rem] text-[0.8rem] leading-[1.3] text-slate-500">
              {data.authorName && (
                <span className="font-semibold text-slate-900">{data.authorName}</span>
              )}
              {data.categoryLabel && (
                <span
                  className="rounded-full px-[0.55rem] py-[0.1rem] text-[0.72rem] font-semibold tracking-[0.01em]"
                  style={{ background: `${catColor}1f`, color: catColor }}
                >
                  {data.categoryLabel}
                </span>
              )}
              {data.dateLabel && <span className="whitespace-nowrap">· {data.dateLabel}</span>}
              {data.hasAttachment && (
                <span className="text-[0.85rem]" aria-label="Has attachment">
                  📎
                </span>
              )}
            </div>
            <h2
              id="news-popover-title"
              className="m-0 text-[1.4rem] leading-[1.3] font-bold tracking-[-0.01em] break-words text-slate-900"
            >
              {data.title.trim()}
            </h2>
          </div>
        </div>

        {data.description && data.description.trim() !== "" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-7 text-[0.98rem] leading-[1.65] break-words whitespace-pre-wrap text-slate-900">
            {renderDescription(data.description)}
          </div>
        ) : (
          <div className="p-7 text-center text-sm text-slate-500 italic">No body text.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
