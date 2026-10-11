/* Service worker: makes the app installable and quick to open, and lets the
 * app shell load offline. It caches only our own static files. SchoolSoft
 * data (/schoolsoft/*) and the proxy (/api/*) always go to the network and
 * are never stored, so no personal data ends up in the cache. */

const SHELL = "shell-v1";
const ASSETS = "assets-v1";
const KEEP = new Set([SHELL, ASSETS]);
/** Hashed bundles pile up across deploys; keep the newest ones. */
const MAX_ASSETS = 80;

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

/** Pages: always try the network, so a deploy shows up straight away; fall
 *  back to the last app shell when offline. Every route is the same SPA
 *  shell, so one cached copy serves them all. */
async function networkFirstShell(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put("/", response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match("/");
    if (cached) return cached;
    throw err;
  }
}

/** Hashed bundles never change, so a cached copy is always right. */
async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(
      keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)),
    );
  }
  return response;
}

/** Icons, manifest, favicon: serve the cached copy and refresh it. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  return refresh;
}
