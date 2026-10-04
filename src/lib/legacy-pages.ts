/** Parsers for the few SchoolSoft guardian pages that only exist as
 *  server-rendered JSP (school information, files & links).
 *
 *  Input is parsed with `DOMParser`, which builds an inert document: scripts
 *  don't run and nothing is fetched. Only plain text and vetted values leave
 *  this module — links must be http(s), downloads must be a numeric request
 *  id — so no upstream markup reaches the page. `DOMParser` is read at call
 *  time so tests can install happy-dom's. */

import { safeHttpUrl } from "./safe-url.ts";

export interface LibraryLink {
  kind: "link";
  title: string;
  description: string;
  href: string;
}

export interface LibraryFile {
  kind: "file";
  title: string;
  description: string;
  /** `requestid` for right_student_library_download.jsp. */
  requestId: number;
  fileName: string;
  /** As shown by SchoolSoft, e.g. "123 KB". */
  size: string;
}

export type LibraryItem = LibraryLink | LibraryFile;

export interface LibraryCategory {
  section: string;
  category: string;
  items: LibraryItem[];
}

export interface SchoolInfoRow {
  label: string;
  /** One entry per line; addresses span several. */
  lines: string[];
  /** Set when the value is a website link. */
  href?: string;
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Decode a JSP response body. These pages are served as ISO-8859-1, which
 *  `Response.text()` would misread as UTF-8. */
export function decodeLegacyBody(bytes: ArrayBuffer, contentType: string | null): string {
  const charset = /charset=([^;]+)/i
    .exec(contentType ?? "")?.[1]
    ?.trim()
    .toLowerCase();
  const label = !charset || charset === "iso-8859-1" ? "windows-1252" : charset;
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function parseLibrary(html: string): LibraryCategory[] {
  const doc = parse(html);
  const out: LibraryCategory[] = [];
  for (const box of doc.querySelectorAll(".h2_container")) {
    const section = text(box.querySelector(".h2"));
    let category = "";
    const content = box.querySelector("[id$='_content']") ?? box;
    for (const node of content.children) {
      if (node.classList.contains("h3_bold")) {
        category = text(node);
        continue;
      }
      if (node.tagName !== "TABLE") continue;
      const items: LibraryItem[] = [];
      for (const cell of node.querySelectorAll("td")) {
        const item = parseLibraryCell(cell);
        if (item) items.push(item);
      }
      if (items.length) out.push({ section, category, items });
    }
  }
  return out;
}

function parseLibraryCell(cell: Element): LibraryItem | null {
  const download = cell.querySelector("a[href*='right_student_library_download.jsp']");
  if (download) {
    const m = /[?&]requestid=(\d+)/.exec(download.getAttribute("href") ?? "");
    if (!m) return null;
    const fileName = (download.getAttribute("title") ?? text(download)).trim();
    const heading = text(cell.querySelector(".heading_bold"));
    const description = [...cell.querySelectorAll(":scope > div:not(.heading_bold)")]
      .map(text)
      .filter(Boolean)
      .join("\n");
    const size =
      /\(([^)]*\b[KMG]?B)\)/i.exec(cell.textContent ?? "")?.[1]?.replace(/\s+/g, " ") ?? "";
    return {
      kind: "file",
      title: heading || fileName,
      description,
      requestId: Number(m[1]),
      fileName,
      size,
    };
  }
  const link = cell.querySelector("a[href]");
  const href = link ? safeHttpUrl(link.getAttribute("href") ?? "") : undefined;
  if (!link || !href) return null;
  return {
    kind: "link",
    title: text(link),
    description: [...cell.querySelectorAll(":scope > div")].map(text).filter(Boolean).join("\n"),
    href,
  };
}

export function parseSchoolInfo(html: string): SchoolInfoRow[] {
  const doc = parse(html);
  const rows: SchoolInfoRow[] = [];
  for (const tr of doc.querySelectorAll(".formtable tr")) {
    const [labelCell, valueCell] = tr.querySelectorAll("td");
    const label = text(labelCell);
    const value = text(valueCell);
    const a = valueCell?.querySelector("a[href]");
    const href = a ? safeHttpUrl(a.getAttribute("href") ?? "") : undefined;
    if (label) {
      rows.push({ label, lines: value ? [value] : [], ...(href ? { href } : {}) });
    } else if (value && rows.length) {
      /* Continuation row: the address spreads over several unlabeled rows. */
      rows[rows.length - 1]!.lines.push(value);
    }
  }
  return rows.filter((r) => r.lines.length > 0);
}
