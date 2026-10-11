/* Service worker: makes the app installable and quick to open, and lets the
 * app shell load offline. It caches only our own static files. SchoolSoft
 * data (/schoolsoft/*) and the proxy (/api/*) always go to the network and
 * are never stored, so no personal data ends up in the cache. */

const SHELL = "shell-v1";
const ASSETS = "assets-v1";
const KEEP = new Set([SHELL, ASSETS]);

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/schoolsoft/") || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/** A plain 200 of the expected kind. The SPA rewrite answers unknown paths
 *  with index.html, so a missing file looks like a 200 HTML page. */
function cacheable(response, wantHtml) {
  if (response.status !== 200 || response.type !== "basic") return false;
  const html = (response.headers.get("content-type") ?? "").includes("text/html");
  return html === wantHtml;
}

/** Cache writes are best effort: a full disk must not fail a response that
 *  already arrived. */
async function tryPut(cache, key, response) {
  try {
    await cache.put(key, response);
  } catch {
    /* quota or unsupported response; serve it uncached */
  }
}

/** Pages: always try the network, so a deploy shows up straight away; fall
 *  back to the last app shell when offline. Every route is the same SPA
 *  shell, so one cached copy serves them all. */
async function networkFirstShell(request) {
  let response;
  try {
    response = await fetch(request);
  } catch (err) {
    const cached = await caches.match("/", { cacheName: SHELL });
    if (cached) return cached;
    throw err;
  }
  if (cacheable(response, true)) {
    const cache = await caches.open(SHELL);
    const fresh = await response.clone().text();
    const previous = await cache.match("/").then((r) => r?.text());
    /* A new deploy references new hashed files: start the asset cache over,
     * so it holds one deploy's files and nothing the shell no longer uses. */
    if (previous !== undefined && previous !== fresh) await caches.delete(ASSETS);
    await tryPut(cache, "/", new Response(fresh, { status: 200, headers: response.headers }));
  }
  return response;
}

/** Hashed bundles never change, so a cached copy is always right. */
async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response, false)) await tryPut(cache, request, response.clone());
  return response;
}

/** Icons, manifest, favicon: serve the cached copy and refresh it. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (cacheable(response, false)) await tryPut(cache, request, response.clone());
    return response;
  });
  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  return refresh;
}
