/* service-worker.js — sailABC PWA (simple, safe) */

const CACHE_NAME = "sailabc-v2";

// Podstawowe pliki do cache (dodaj tu więcej jeśli chcesz)
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/weather.js",
  "/access.js",
  "/oprogramowanie.html",
  "/manifest.webmanifest",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/pwa.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // usuń stare cache
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

// helper: czy to request do API pogodowego?
function isExternalApiRequest(url) {
  return (
    url.hostname.includes("open-meteo.com") ||
    url.hostname.includes("openstreetmap.org") ||
    url.hostname.includes("tile.openstreetmap.org")
  );
}

function isInternalApi(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // tylko GET
  if (req.method !== "GET") return;

  // NIE cache’uj /api/* (login, /api/me itp.)
  if (isInternalApi(url)) {
    return; // przeglądarka ogarnie normalnie
  }

  // API + kafelki mapy: zawsze sieć (nie cache’ujemy, żeby nie psuć pogody/mapy)
  if (isExternalApiRequest(url)) {
    return;
  }

  // Dla reszty: cache-first z fallbackiem do sieci
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        // cache’uj tylko zasoby z tego samego origin
        if (fresh && fresh.ok && url.origin === self.location.origin) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        // Offline fallback: jeśli to nawigacja do strony, spróbuj index
        if (req.mode === "navigate") {
          const fallback = await cache.match("/index.html");
          if (fallback) return fallback;
        }
        throw e;
      }
    })()
  );
});
