/** Vercel Function (Node.js runtime, Web `fetch` handler) proxying to
 *  https://sms.schoolsoft.se.
 *
 * Mirrors the Vite dev proxy in vite.config.ts, with one important addition:
 * upstream sets cookies with `Path=/<school>` (or `Path=/`), which won't
 * match our `/schoolsoft/<school>/...` mount on the SPA's origin. We prepend
 * `/schoolsoft` to every Set-Cookie `Path` attribute so the browser sends
 * the cookies back on subsequent proxied requests. School-agnostic.
 */
import {
  PROXY_SECURITY_HEADERS,
  isAllowedUpstreamPath,
  isSameOriginRequest,
  upstreamUrlFor,
  rewriteCookiePath,
  rewriteLocation,
} from "./_lib/proxy-rewrites.ts";

/** Methods the SPA issues; anything else (TRACE, PATCH, ...) is refused. */
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "DELETE"]);

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

export default { fetch: handler };

async function handler(request: Request): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!isSameOriginRequest(request.headers, request.url)) {
    return new Response("Forbidden", { status: 403 });
  }
  const upstreamUrl = upstreamUrlFor(request.url);
  if (!upstreamUrl) return new Response("Bad request", { status: 400 });
  if (!isAllowedUpstreamPath(upstreamUrl)) return new Response("Not found", { status: 404 });

  const headers = new Headers(request.headers);
  /* fetch() derives Host from the upstream URL. Vercel's own request headers
   * (x-vercel-*) are platform-internal and have no business upstream. */
  headers.delete("host");
  const internal = Array.from(headers.keys()).filter((n) => n.startsWith("x-vercel-"));
  for (const name of internal) headers.delete(name);
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
   * `duplex: "half"` for those made the runtime answer 500. */
  /* A Web Request knows whether it carries a body: `request.body` is null
   * for the query-string-only POSTs above, and non-null for any payload,
   * whether it arrived with Content-Length, chunked, or with the framing
   * headers stripped by an adapter. An explicit zero length is no body. */
  const hasBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body !== null &&
    request.headers.get("content-length") !== "0";
  if (hasBody) {
    init.body = request.body;
    // @ts-expect-error — duplex is required for streaming request bodies
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
