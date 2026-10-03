/** Header rewrites shared by the Vercel proxy function and the Vite dev proxy,
 *  so both mount https://sms.schoolsoft.se under `/schoolsoft` identically.
 *  Lives under `api/_lib` because Vercel does not turn `_`-prefixed paths into
 *  routes. */

const UPSTREAM_ORIGIN = "https://sms.schoolsoft.se";
const MOUNT = "/schoolsoft";

/** Re-scope an upstream `Set-Cookie` onto our own origin.
 *
 *  Two rewrites are needed:
 *  - `Path=/<school>` becomes `Path=/schoolsoft/<school>` so the browser sends
 *    the cookie back on our proxied requests rather than only on paths that
 *    exist on sms.schoolsoft.se.
 *  - `Domain=` is dropped entirely. Upstream scopes cookies to its own domain,
 *    which never matches the SPA's origin, so the browser would reject the
 *    cookie outright. Without the attribute the cookie becomes host-only on our
 *    origin, which is what we want. */
export function rewriteCookiePath(cookie: string): string {
  return cookie.replace(/(\bPath=)(\/[^;]*)/i, "$1/schoolsoft$2").replace(/;\s*Domain=[^;]*/i, "");
}

/** Keep upstream redirects on our origin.
 *
 *  SchoolSoft answers some requests (e.g. attachment downloads) with a 303 to
 *  an absolute `https://sms.schoolsoft.se/files/...` URL. Followed as-is, the
 *  browser leaves our origin and the request dies on CORS. Absolute URLs on the
 *  upstream origin and root-relative paths are moved under the `/schoolsoft`
 *  mount; anything pointing at another host is left alone. */
export function rewriteLocation(location: string): string {
  /* Upstream sometimes emits its own origin as plain http. */
  for (const origin of [UPSTREAM_ORIGIN, UPSTREAM_ORIGIN.replace("https:", "http:")]) {
    if (location.startsWith(origin + "/") || location === origin) {
      return MOUNT + (location.slice(origin.length) || "/");
    }
  }
  if (location.startsWith("/") && !location.startsWith("//") && !location.startsWith(MOUNT + "/")) {
    return MOUNT + location;
  }
  return location;
}

/** Headers added to every proxied response. Upstream content is served from
 *  our origin, where the Eva token lives in localStorage; if SchoolSoft ever
 *  serves an uploaded HTML/SVG file inline, a sandboxed, script-less document
 *  can't reach it. The SPA only reads these responses with fetch(), which the
 *  CSP doesn't affect. */
export const PROXY_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "sandbox; default-src 'none'",
  "X-Content-Type-Options": "nosniff",
};
