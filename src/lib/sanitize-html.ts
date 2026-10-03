/** Sanitizer for HTML authored by school staff (assignment and planning
 *  descriptions, subject-room information), backed by DOMPurify.
 *
 *  It matters: the output goes through `dangerouslySetInnerHTML`, and the app
 *  keeps the Eva refresh token in localStorage, so a single successful
 *  injection is durable account takeover rather than a one-off popup.
 *
 *  DOMPurify does the heavy lifting (event handlers, mXSS, namespace
 *  confusion, DOM clobbering). On top of its defaults we keep this app's
 *  stricter policy: no styles or forms at all, and links limited to
 *  http(s)/mailto/tel. */

import createDOMPurify, { type DOMPurify } from "dompurify";

/** Elements removed outright, beyond DOMPurify's defaults. `style` tags can
 *  restyle the whole app; forms can post anywhere. */
const FORBID_TAGS = [
  "style",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "base",
  "link",
  "meta",
  "noscript",
];

const FORBID_ATTR = ["srcdoc", "formaction", "action", "ping"];

/** Attributes holding URLs, re-checked with `isUnsafeUrl` after DOMPurify as
 *  a second, independent guard. */
const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "poster",
  "background",
  "cite",
  "longdesc",
  "data",
  "xlink:href",
]);
const URL_LIST_ATTRIBUTES = new Set(["srcset"]);

function splitUrlList(value: string): string[] {
  return value
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0] ?? "")
    .filter((c) => c.length > 0);
}

const SAFE_SCHEME = /^(?:https?|mailto|tel):/;

/** Same allowlist as `SAFE_SCHEME`, in DOMPurify's form: an allowed scheme,
 *  or a value with no scheme at all (relative path, `#anchor`, `?query`). */
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/** True if `value` carries a scheme we don't want to hand to the browser.
 *
 *  The check normalizes before matching because browsers ignore ASCII
 *  whitespace and C0 control characters while resolving a scheme — `java\tscript:`
 *  and `java\nscript:` both reach the same sink as `javascript:`, but a naive
 *  `/^\s*javascript:/` test misses them since the control character sits inside
 *  the word rather than in front of it.
 *
 *  Scheme-less values (relative paths, `#anchor`, `?query`) have no scheme to
 *  abuse and are left alone. Everything with a scheme must be on the allowlist,
 *  so `data:`, `blob:`, `vbscript:` and friends are rejected without needing to
 *  be enumerated. */
export function isUnsafeUrl(value: string): boolean {
  // oxlint-disable-next-line no-control-regex -- matching C0 controls is the security behaviour
  const normalized = value.replace(/[\u0000- \u007f]/g, "").toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*:/.test(normalized)) return false;
  return !SAFE_SCHEME.test(normalized);
}

let purifier: DOMPurify | null = null;
let purifierWindow: unknown = null;

/** One configured DOMPurify instance per window. Built lazily so the module
 *  can be imported where no DOM exists yet (tests install one first). */
function getPurifier(): DOMPurify | null {
  const win = (globalThis as { window?: unknown }).window;
  if (!win) return null;
  if (purifier && purifierWindow === win) return purifier;
  const p = createDOMPurify(win as Window & typeof globalThis);
  if (!p.isSupported) return null;
  p.addHook("uponSanitizeAttribute", (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (URL_ATTRIBUTES.has(name) && isUnsafeUrl(data.attrValue)) data.keepAttr = false;
    if (URL_LIST_ATTRIBUTES.has(name) && splitUrlList(data.attrValue).some(isUnsafeUrl)) {
      data.keepAttr = false;
    }
  });
  p.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  purifier = p;
  purifierWindow = win;
  return p;
}

export function sanitizeStaffHtml(html: string): string {
  const p = getPurifier();
  /* No DOM means nothing can render the markup either; fail closed. */
  if (!p) return "";
  return p.sanitize(html, {
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_ATTR: ["target"],
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
  });
}
