/** Decode HTML entities (&eacute;, &bull;, &ndash;, &amp; …) using a throwaway
 *  textarea. A textarea's content is never parsed as markup, so this yields
 *  plain text and can't execute anything. Outside a DOM it's the identity. */
export function decodeEntities(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}
