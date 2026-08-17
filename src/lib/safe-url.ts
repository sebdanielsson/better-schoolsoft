/* URL guards for values that end up in `href` or `location.assign()`.
 *
 * News text comes from SchoolSoft and school slugs come from the login form, so both are
 * untrusted. Today they're constrained implicitly — the link regex only matches `https?://`,
 * and the SchoolSoft links are built from a hardcoded `https://sms.schoolsoft.se` prefix — but
 * that safety lives in a regex several lines away from the `href`, which is exactly the kind of
 * guarantee that quietly stops holding when someone edits the regex. These make it explicit. */

/** The one slug shape SchoolSoft uses; anything else can't reach a URL path. */
const SCHOOL_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Return `raw` only if it parses as an absolute http(s) URL, otherwise `undefined`.
 * Rejects `javascript:`, `data:`, and anything unparseable, so the result is safe as an `href`.
 */
export function safeHttpUrl(raw: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }
  return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
}

/** True when `slug` is safe to interpolate into a SchoolSoft URL path. */
export function isSchoolSlug(slug: string): boolean {
  return SCHOOL_SLUG_RE.test(slug);
}

/**
 * Build a `https://sms.schoolsoft.se/<school>/<path>` URL, or `undefined` if the slug is bad or
 * the result isn't a well-formed SchoolSoft URL. Parses rather than concatenates, so a caller
 * passing a path with whitespace or a stray scheme can't produce an odd href.
 */
export function schoolSoftUrl(school: string, path: string): string | undefined {
  if (!isSchoolSlug(school)) return undefined;
  const href = safeHttpUrl(`https://sms.schoolsoft.se/${school}/${path.replace(/^\/+/, "")}`);
  if (!href) return undefined;
  return new URL(href).hostname === "sms.schoolsoft.se" ? href : undefined;
}
