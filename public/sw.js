const CACHE_NAME = "invoicing-app-shell-v2";
const APP_SHELL = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Page navigations: always prefer live data, fall back to an offline page if unreachable.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Static app-shell assets: cache-first so the install/home-screen icon always resolves instantly.
  const url = new URL(request.url);
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  // Built JS/CSS chunks are content-hashed by Next.js (the filename changes whenever the content
  // does), so they're safe to cache forever — cache-first here is what actually makes repeat opens
  // of the installed app fast instead of re-downloading the whole bundle over the network every time.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
