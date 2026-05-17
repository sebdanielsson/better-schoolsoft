/** Minimal sanitizer for HTML content authored by school staff (assignment
 *  and planning descriptions). Strips scripts, event handlers, and javascript:
 *  URLs; everything else passes through. NOT a substitute for DOMPurify in a
 *  hostile context — this is a defense-in-depth pass on data we already trust
 *  upstream from SchoolSoft's editor. */
export function sanitizeStaffHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const el of Array.from(doc.querySelectorAll("script,style,iframe,object,embed"))) {
    el.remove();
  }

  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "src") && /^\s*javascript:/i.test(value)) {
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
