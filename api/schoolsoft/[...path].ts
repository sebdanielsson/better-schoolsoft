/** Edge-function proxy to https://sms.schoolsoft.se.
 *
 * Mirrors the Vite dev proxy in vite.config.ts, with one important addition:
 * upstream sets cookies with `Path=/<school>` (or `Path=/`), which won't
 * match our `/schoolsoft/<school>/...` mount on the SPA's origin. We prepend
 * `/schoolsoft` to every Set-Cookie `Path` attribute so the browser sends
 * the cookies back on subsequent proxied requests. School-agnostic.
 */
export const config = { runtime: "edge" };

const UPSTREAM = "https://sms.schoolsoft.se";

/* Headers we should not forward to the upstream:
 *  - host / connection / content-length: fetch sets these itself; passing
 *    them through can confuse the upstream's request validation.
 *  - x-vercel-* / x-forwarded-* / x-real-ip: Vercel-injected request
 *    metadata that's not meaningful to SchoolSoft and that some servers
 *    treat as a sign of an unwanted relay.
 */
const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "x-vercel-id",
  "x-vercel-forwarded-for",
  "x-vercel-ip-country",
  "x-vercel-ip-country-region",
  "x-vercel-ip-city",
  "x-vercel-ip-latitude",
  "x-vercel-ip-longitude",
  "x-vercel-ip-timezone",
  "x-vercel-deployment-url",
  "x-vercel-proxy-signature",
  "x-vercel-proxy-signature-ts",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
]);

export default async function handler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const upstreamPath = url.pathname.replace(/^\/schoolsoft/, "");
    const upstreamUrl = `${UPSTREAM}${upstreamPath}${url.search}`;

    /* Copy only the headers we want to forward. Don't try to set Host —
     * fetch derives it from the URL, and many runtimes treat Host as a
     * forbidden header that silently no-ops or throws when set explicitly. */
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (!STRIP_HEADERS.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    /* Only attach a body for methods that actually have one. Several of our
     * POSTs (the OAuth code/refresh exchange, subject-warning confirm) carry
     * everything in the query string and send no body — passing an empty
     * stream with `duplex: "half"` makes the Edge runtime reject the request
     * with a 500. */
    const contentLength = request.headers.get("content-length");
    const hasBody =
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      contentLength !== null &&
      contentLength !== "0";
    if (hasBody) {
      init.body = request.body;
      // @ts-expect-error — duplex is required by Edge runtime for streaming bodies
      init.duplex = "half";
    }

    const upstream = await fetch(upstreamUrl, init);

    const resHeaders = new Headers(upstream.headers);
    const setCookies = upstream.headers.getSetCookie?.() ?? [];
    if (setCookies.length) {
      resHeaders.delete("set-cookie");
      for (const c of setCookies) {
        resHeaders.append("set-cookie", rewriteCookiePath(c));
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders,
    });
  } catch (e) {
    /* Surface proxy-level failures distinctly from upstream errors. 502 with
     * a JSON body makes the cause visible in our app's network panel instead
     * of returning a generic Vercel error page. */
    const message = e instanceof Error ? e.message : String(e);
    console.error("[schoolsoft proxy]", message, e);
    return new Response(
      JSON.stringify({ error: "proxy_error", message }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}

function rewriteCookiePath(cookie: string): string {
  return cookie.replace(/(\bPath=)(\/[^;]*)/i, "$1/schoolsoft$2");
}
