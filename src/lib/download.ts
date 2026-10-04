import { safeDownloadName } from "./messages.ts";

/** Save a fetched file to disk. The blob is re-typed as an opaque byte
 *  stream and handed to an `<a download>`, so the browser saves it instead of
 *  rendering it: a blob URL shares our origin, and an HTML file opened in a
 *  tab could otherwise read the stored session. */
export function saveBlob(blob: Blob, name: string | undefined): void {
  const url = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = safeDownloadName(name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
