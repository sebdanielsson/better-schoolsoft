/** Edge-function proxy to https://sms.schoolsoft.se.
 *
 * Mirrors the Vite dev proxy in vite.config.ts, with one important addition:
 * upstream sets cookies with `Path=/<school>` (or `Path=/`), which won't
 * match our `/schoolsoft/<school>/...` mount on the SPA's origin. We prepend
 * `/schoolsoft` to every Set-Cookie `Path` attribute so the browser sends
 * the cookies back on subsequent proxied requests. School-agnostic.
 */
import {
  PROXY_SECURITY_HEADERS,
  rewriteCookiePath,
  rewriteLocation,
} from "../_lib/proxy-rewrites.ts";

export const config = { runtime: "edge" } as const;

const UPSTREAM = "https://sms.schoolsoft.se";

/** RFC 9110 hop-by-hop headers — scoped to a single connection, never forwarded. */
const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const upstreamPath = url.pathname.replace(/^\/schoolsoft/, "");
  const upstreamUrl = `${UPSTREAM}${upstreamPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("host", "sms.schoolsoft.se");
  /* Hop-by-hop headers describe the client<->proxy connection and must not be
   * relayed onto the proxy<->upstream one. */
  for (const h of HOP_BY_HOP) headers.delete(h);

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
  /* `fetch` transparently decompresses the upstream body, but leaves the
   * original `content-encoding`/`content-length` on the response. Relaying
   * those alongside the already-decoded stream tells the browser to gunzip
   * plaintext (or to expect the compressed byte count), so both must go — the
   * runtime re-adds correct framing for the body we actually return. */
  for (const h of HOP_BY_HOP) resHeaders.delete(h);
  resHeaders.delete("content-encoding");
  resHeaders.delete("content-length");

  for (const [k, v] of Object.entries(PROXY_SECURITY_HEADERS)) resHeaders.set(k, v);

  const location = upstream.headers.get("location");
  if (location) resHeaders.set("location", rewriteLocation(location));

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
