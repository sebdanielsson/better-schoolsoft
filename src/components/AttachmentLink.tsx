import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import type { SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { fetchEvaAttachment, type EvaMessageAttachment } from "../api/schoolsoft.ts";
import { saveBlob } from "../lib/download.ts";

/** Downloads an Eva attachment on click (saved, never opened inline). */
export default function AttachmentLink({
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
      saveBlob(blob, attachment.name);
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
      className="inline-flex items-center gap-1.5 text-left text-[0.9rem] text-blue-600 hover:underline disabled:opacity-60"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {attachment.name || "Attachment"}
      {state === "loading" && <span className="text-slate-500"> · downloading…</span>}
      {state === "error" && <span className="text-red-700"> · download failed</span>}
    </button>
  );
}

const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Inline preview for image attachments; the download link stays available
 *  for anything that isn't a plain raster image. */
export function AttachmentImage({
  ctx,
  attachment,
}: {
  ctx: SchoolsoftContext;
  attachment: EvaMessageAttachment;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await fetchEvaAttachment(ctx.school, await ctx.token(), attachment.fileId);
        if (cancelled) return;
        /* Raster formats only. An SVG is a document, and as a same-origin
         * blob URL ("open image in new tab") its script would run. */
        const type = blob.type.split(";")[0]?.trim().toLowerCase() ?? "";
        if (!RASTER_TYPES.has(type)) return;
        url = URL.createObjectURL(new Blob([blob], { type }));
        setSrc(url);
      } catch {
        /* Fall back to nothing; the download link is still there. */
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ctx, attachment.fileId]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={attachment.name || ""}
      className="max-h-80 max-w-full rounded-md border border-slate-200 object-contain"
    />
  );
}
