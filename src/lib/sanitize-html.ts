/** Minimal sanitizer for HTML content authored by school staff (assignment
 *  and planning descriptions). Strips scripts, event handlers, and unsafe URL
 *  schemes; everything else passes through. NOT a substitute for DOMPurify in a
 *  hostile context — this is a defense-in-depth pass on data we already trust
 *  upstream from SchoolSoft's editor.
 *
 *  It still matters: the output goes through `dangerouslySetInnerHTML`, and the
 *  app keeps the Eva refresh token in localStorage, so a single successful
 *  injection is durable account takeover rather than a one-off popup. */

/** Elements removed outright. Beyond the obvious script hosts this includes
 *  `base` (rehomes every relative URL on the page), `meta` (an http-equiv
 *  refresh inside body is honored and forces navigation), `link` (can pull in
 *  external stylesheets), and `form`/`noscript`. */
const FORBIDDEN_ELEMENTS =
  "script,style,iframe,object,embed,base,link,meta,form,noscript,frame,frameset";

/** Attributes that resolve to a URL and therefore need a scheme check. */
const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "srcset",
  "action",
  "formaction",
  "poster",
  "ping",
  "background",
  "cite",
  "longdesc",
  "data",
  "xlink:href",
]);

/** Attributes dropped unconditionally — they embed a whole document. */
const FORBIDDEN_ATTRIBUTES = new Set(["srcdoc"]);

const SAFE_SCHEME = /^(?:https?|mailto|tel):/;

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
  // oxlint-disable-next-line no-control-regex -- matching C0 controls is the point
  const normalized = value.replace(/[\u0000-\u0020\u007f]/g, "").toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*:/.test(normalized)) return false;
  return !SAFE_SCHEME.test(normalized);
}

export function sanitizeStaffHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const el of Array.from(doc.querySelectorAll(FORBIDDEN_ELEMENTS))) {
    el.remove();
  }

  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || FORBIDDEN_ATTRIBUTES.has(name)) {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRIBUTES.has(name) && isUnsafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }

  return doc.body.innerHTML;
}
