/** Edge-function proxy to https://sms.schoolsoft.se.
 *
 * Mirrors the Vite dev proxy in vite.config.ts, with one important addition:
 * upstream sets cookies with `Path=/<school>` (or `Path=/`), which won't
 * match our `/schoolsoft/<school>/...` mount on the SPA's origin. We prepend
 * `/schoolsoft` to every Set-Cookie `Path` attribute so the browser sends
 * the cookies back on subsequent proxied requests. School-agnostic.
 */
export const config = { runtime: "edge" } as const;

const UPSTREAM = "https://sms.schoolsoft.se";

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const upstreamPath = url.pathname.replace(/^\/schoolsoft/, "");
  const upstreamUrl = `${UPSTREAM}${upstreamPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("host", "sms.schoolsoft.se");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  /* Only attach a body for methods that actually have one. Several of our
   * POSTs (the OAuth code/refresh exchange, subject-warning confirm) carry
   * everything in the query string and send no body — passing `body` +
   * `duplex: "half"` for those crashes the Edge runtime with a 500. */
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
}

function rewriteCookiePath(cookie: string): string {
  return cookie.replace(/(\bPath=)(\/[^;]*)/i, "$1/schoolsoft$2");
}
