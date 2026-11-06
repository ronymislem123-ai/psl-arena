/* PSL ARENA service worker — keeps the ML runtime, the model, fonts and built assets
 * available offline. Pages and API responses are never cached (private data, auth). */
const VERSION = "psl-arena-v1";
const ASSET_CACHE = `${VERSION}-assets`;

const isImmutableAsset = (url) =>
  url.pathname.startsWith("/mediapipe/") ||
  url.pathname.startsWith("/models/") ||
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  /\.(woff2?|ttf)$/.test(url.pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("psl-arena-") && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache data or auth
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  // pages: network first, fall back to a cached copy of the shell when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname === "/" || url.pathname === "/battle/new")) {
            caches.open(ASSET_CACHE).then((c) => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match("/"))),
    );
  }
});
