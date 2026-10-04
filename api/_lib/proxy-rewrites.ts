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

/** Query parameter the Vercel rewrite uses to hand the proxied path to the
 *  function (vercel.json: /schoolsoft/:path* -> /api/schoolsoft?…=:path*).
 *  A plain file-system route can't do it: outside Next.js, Vercel treats
 *  `api/x/[...path].ts` as a single-segment route. */
export const PROXY_PATH_PARAM = "__proxy_path";

/** Map an incoming request URL to the upstream URL, or null if the result
 *  would not be on the upstream origin. Accepts both shapes: the rewritten
 *  `/api/schoolsoft?__proxy_path=a/b` and the dev-style `/schoolsoft/a/b`. */
export function upstreamUrlFor(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const fromParam = url.searchParams.get(PROXY_PATH_PARAM);
  url.searchParams.delete(PROXY_PATH_PARAM);
  const path =
    fromParam !== null
      ? "/" + fromParam.replace(/^\/+/, "")
      : url.pathname.replace(/^\/schoolsoft(?=\/|$)/, "") || "/";
  /* Resolve against the upstream and insist on its origin, so no crafted
   * path ("@evil.example", "//evil.example", "\\evil") can retarget us. */
  let target: URL;
  try {
    target = new URL(path + url.search, UPSTREAM_ORIGIN);
  } catch {
    /* e.g. "/\\[": backslashes count as slashes, leaving an invalid host. */
    return null;
  }
  return target.origin === UPSTREAM_ORIGIN ? target.href : null;
}

/** Upstream path shapes the SPA actually calls (see `src/api/schoolsoft.ts`),
 *  (the school list lives under the pseudo-school `internal/`), plus `files/` for the download redirects `rewriteLocation` keeps on our
 *  origin. Everything else — the React webview, JSP admin pages, arbitrary
 *  probing — is refused, so the proxy isn't a general relay to SchoolSoft. */
const ALLOWED_PATH =
  /^\/(?:files\/|[a-z0-9][a-z0-9-]*\/(?:eva\/api\/|eva-apps\/auth\/|rest-api\/|jsp\/student\/|files\/))/;

/** True when the upstream URL's path is one the SPA uses. */
export function isAllowedUpstreamPath(upstreamUrl: string): boolean {
  return ALLOWED_PATH.test(new URL(upstreamUrl).pathname);
}

/** Reject requests a browser tells us came from another site.
 *
 *  Every proxied call is a same-origin `fetch()` from the SPA, so modern
 *  browsers send `Sec-Fetch-Site: same-origin`. Older browsers without Fetch
 *  Metadata fall back to the `Origin` header. A request carrying neither is
 *  let through: that's a non-browser client, which can forge both anyway and
 *  is the WAF rate limit's job. */
export function isSameOriginRequest(headers: Headers, requestUrl: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = headers.get("origin");
  if (origin !== null) return origin === new URL(requestUrl).origin;
  return true;
}

/** Proxy-local route (never forwarded) that ends our copy of the cookie
 *  session: `POST /schoolsoft/<school>/__logout`. */
export const LOGOUT_PATH = /^\/([a-z0-9][a-z0-9-]*)\/__logout$/;

/** `Set-Cookie` values expiring every cookie the browser sent.
 *
 *  SchoolSoft has no logout or revoke endpoint (the official app only clears
 *  local state), but the cookies `rewriteCookiePath` planted on our origin are
 *  HttpOnly, so the SPA can't drop them itself. The request doesn't say which
 *  path each cookie was scoped to, so each name is expired on both shapes
 *  upstream uses: `Path=/<school>` and `Path=/`, re-scoped under the mount. */
export function logoutCookies(cookieHeader: string | null, school: string): string[] {
  const names = new Set(
    (cookieHeader ?? "")
      .split(";")
      .map((c) => c.split("=")[0]!.trim())
      .filter((n) => /^[!#$%&'*+\-.^`|~\w]+$/.test(n)),
  );
  const out: string[] = [];
  for (const name of names) {
    for (const path of [`${MOUNT}/${school}`, `${MOUNT}/`]) {
      out.push(`${name}=; Path=${path}; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
    }
  }
  return out;
}
