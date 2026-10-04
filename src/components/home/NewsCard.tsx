import { useState } from "react";
import type { EvaNewsItem } from "../../api/schoolsoft.ts";
import Avatar from "../Avatar.tsx";
import NewsPopover, { type NewsPopoverData } from "../NewsPopover.tsx";
import { Skeleton } from "../ui/skeleton.tsx";
import { formatDate } from "../../lib/dates.ts";
import { decodeEntities } from "../../lib/text.ts";
import { cn } from "../../lib/utils.ts";
import { DashboardCard, Empty } from "./DashboardCard.tsx";

const NEWS_CATEGORY_COLORS: Record<string, string> = {
  "Student Care": "#16a34a",
  Administration: "#2563eb",
  "Info from Teachers": "#8b5cf6",
  "Career Councellor": "#f59e0b",
  "Academic Coordinator": "#ec4899",
};

function newsCategoryColor(cat: string): string {
  return NEWS_CATEGORY_COLORS[cat] ?? "#0ea5e9";
}

/** Preview text: take the first 5 non-empty lines so posts that open with a one-line
 *  greeting (e.g. "Kära vårdnadshavare,") still show meaningful content underneath. */
function previewText(s: string | undefined): string {
  if (!s) return "";
  return decodeEntities(s)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 5)
    .join("\n");
}

const newsListClass = "flex list-none flex-col gap-2.5";
const newsItemClass =
  "grid grid-cols-[auto_1fr] items-start gap-2.5 rounded-md border border-slate-200 bg-white px-3.5 py-3";
const newsMetaRowClass =
  "mb-0.5 flex min-h-[1.1rem] flex-wrap items-center gap-1.5 text-[0.75rem] leading-[1.3] text-slate-500";
const newsTitleClass = "mb-0.5 min-h-[1.3em] text-[0.95rem] font-semibold leading-[1.3]";
const newsDescClass =
  "min-h-[calc(1.45em*5)] overflow-hidden whitespace-pre-line text-[0.85rem] leading-[1.45] text-slate-500 [-webkit-box-orient:vertical] [-webkit-line-clamp:5] [display:-webkit-box]";
const newsSkelBarClass = "h-[0.85em] rounded-[4px] shrink-0";

/** The three latest news posts; clicking one opens it in a popover. */
export default function NewsCard({ loading, news }: { loading: boolean; news: EvaNewsItem[] }) {
  const [openNews, setOpenNews] = useState<NewsPopoverData | null>(null);

  return (
    <DashboardCard title="Latest news" accent="purple" linkTo="/news" linkLabel="More news →">
      {loading ? (
        <NewsSkeletonList count={3} />
      ) : news.length === 0 ? (
        <Empty>No recent news.</Empty>
      ) : (
        <ul className={newsListClass}>
          {news.slice(0, 3).map((n) => {
            const cat = n.category;
            const created = new Date(n.creDate).getTime();
            const author = n.author?.name ?? "School";
            return (
              <li key={n.id} className={newsItemClass}>
                <Avatar name={author} picture={n.author?.picture || null} size={32} />
                <button
                  type="button"
                  className="min-w-0 cursor-pointer bg-transparent p-0 text-left"
                  onClick={() => {
                    setOpenNews({
                      title: n.title,
                      description: n.description,
                      dateLabel: formatDate(created, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      }),
                      categoryLabel: cat,
                      authorName: author,
                      authorPicture: n.author?.picture || null,
                      hasAttachment: n.hasAttachment ?? false,
                    });
                  }}
                >
                  <div className="min-w-0">
                    <div className={newsMetaRowClass}>
                      <span className="font-semibold text-slate-900">{author}</span>
                      {cat && (
                        <span
                          className="rounded-full px-2 py-px text-[0.7rem] leading-[1.4] font-semibold tracking-[0.01em]"
                          style={{
                            background: `${newsCategoryColor(cat)}1f`,
                            color: newsCategoryColor(cat),
                          }}
                        >
                          {cat}
                        </span>
                      )}
                      <span className="whitespace-nowrap">
                        {formatDate(created, { month: "short", day: "numeric" })}
                      </span>
                      {n.hasAttachment && (
                        <span className="text-[0.8rem]" aria-label="Has attachment">
                          📎
                        </span>
                      )}
                    </div>
                    <div className={newsTitleClass}>{n.title.trim()}</div>
                    <div className={newsDescClass}>{previewText(n.description)}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <NewsPopover
        open={!!openNews}
        data={openNews}
        onClose={() => {
          setOpenNews(null);
        }}
      />
    </DashboardCard>
  );
}

function NewsSkeletonList({ count }: { count: number }) {
  return (
    <ul className={newsListClass} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className={cn(newsItemClass, "pointer-events-none")}>
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0">
            {/* Use the real layout classes so paddings/margins line up exactly with the
             * loaded state — skeleton bars stand in for the text but the boxes match. */}
            <div className={newsMetaRowClass}>
              <Skeleton className={cn(newsSkelBarClass, "w-24")} />
              <Skeleton className="h-[calc(0.7rem*1.4+0.1rem)] w-16 shrink-0 rounded-full" />
              <Skeleton className={cn(newsSkelBarClass, "w-12")} />
            </div>
            <div className={newsTitleClass}>
              <Skeleton className={cn(newsSkelBarClass, "w-4/5")} />
            </div>
            <div className={cn(newsDescClass, "!block flex !flex-col justify-between")}>
              <Skeleton className={cn(newsSkelBarClass, "w-full")} />
              <Skeleton className={cn(newsSkelBarClass, "w-11/12")} />
              <Skeleton className={cn(newsSkelBarClass, "w-5/6")} />
              <Skeleton className={cn(newsSkelBarClass, "w-full")} />
              <Skeleton className={cn(newsSkelBarClass, "w-3/4")} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
