import { type ReactNode } from "react";
import Avatar from "./Avatar.tsx";
import { Dialog, DialogContent } from "./ui/dialog.tsx";

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
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
      >
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
        className="p-0 gap-0 rounded-2xl bg-white text-slate-900 max-w-[680px] sm:max-w-[680px] max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden"
        aria-labelledby="news-popover-title"
      >
        <div className="flex items-start gap-[0.85rem] pt-6 pr-[3.25rem] pb-[1.1rem] pl-7 border-b border-slate-200 shrink-0">
          {data.authorName && (
            <Avatar name={data.authorName} picture={data.authorPicture ?? null} size={44} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-[0.45rem] text-[0.8rem] text-slate-500 leading-[1.3] mb-[0.4rem]">
              {data.authorName && (
                <span className="font-semibold text-slate-900">{data.authorName}</span>
              )}
              {data.categoryLabel && (
                <span
                  className="px-[0.55rem] py-[0.1rem] rounded-full text-[0.72rem] font-semibold tracking-[0.01em]"
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
              className="text-[1.4rem] font-bold leading-[1.3] tracking-[-0.01em] m-0 text-slate-900 break-words"
            >
              {data.title.trim()}
            </h2>
          </div>
        </div>

        {data.description && data.description.trim() !== "" ? (
          <div className="text-[0.98rem] leading-[1.65] text-slate-900 whitespace-pre-wrap break-words px-7 pt-5 pb-7 overflow-y-auto flex-1 min-h-0">
            {renderDescription(data.description)}
          </div>
        ) : (
          <div className="p-7 text-slate-500 text-sm italic text-center">No body text.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
