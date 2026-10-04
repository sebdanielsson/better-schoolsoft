/** Decode HTML entities (&eacute;, &bull;, &ndash;, &amp; …) using a throwaway
 *  textarea. A textarea's content is never parsed as markup, so this yields
 *  plain text and can't execute anything. Outside a DOM it's the identity. */
/** Plain text from a staff-written HTML snippet: tags dropped, entities
 *  decoded, whitespace collapsed. Parsed into an inert document (scripts
 *  never run there). Outside a DOM it strips tags only. */
export function htmlToText(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  /* A space before every tag keeps adjacent blocks ("<p>a</p><p>b</p>")
   * from running together; script/style content isn't text at all. */
  const doc = new DOMParser().parseFromString(html.replace(/</g, " <"), "text/html");
  for (const el of doc.querySelectorAll("script, style, template")) el.remove();
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function decodeEntities(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}
