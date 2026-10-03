import { useMemo } from "react";
import { sanitizeStaffHtml } from "../lib/sanitize-html.ts";
import { cn } from "../lib/utils.ts";

/* Typography for teacher-authored rich text. Keeps the established look for
 * paragraphs, lists and links, and gives the rest of what SchoolSoft's editor
 * produces (headings, tables, images, quotes) a matching style instead of
 * browser defaults. */
const richTextClass = cn(
  "text-[0.95rem] leading-[1.55] break-words text-slate-800",
  "[&_p]:mb-2 [&_p:empty]:hidden [&_p:last-child]:mb-0",
  "[&_a]:break-all [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-700",
  "[&_li]:my-0.5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-[1.15rem] [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[1.08rem] [&_h2]:font-bold",
  "[&_:is(h1,h2,h3,h4):first-child]:mt-0 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:font-semibold",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600",
  "[&_hr]:my-4 [&_hr]:border-slate-200",
  "[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md",
  "[&_table]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_table]:text-[0.88rem]",
  "[&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
  "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-[0.85em] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-50 [&_pre]:p-3",
);

/** Render staff-authored HTML. Always sanitized here, so callers can't
 *  forget; pass the raw upstream string. */
export default function StaffHtml({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeStaffHtml(html), [html]);
  if (!clean.trim()) return null;
  return (
    <div className={cn(richTextClass, className)} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
