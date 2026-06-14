const CACHE_NAME = "gymboard-v1.4";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/auth-storage.js",
  "./js/config.js",
  "./js/data-store.js",
  "./js/supabase-client.js",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./favicon.ico",
  "./assets/gymboard-icon-v5.svg",
  "./assets/gymboard-icon-192-v5.png",
  "./assets/gymboard-icon-512-v5.png",
  "./assets/favicon-v5.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// Per i file dell'app usa prima la cache e aggiorna la copia in background.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkResponse = fetch(event.request)
        .then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cachedResponse || caches.match("./index.html"));

      return cachedResponse || networkResponse;
    }),
  );
});
