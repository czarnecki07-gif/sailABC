/* service-worker.js — sailABC PWA (simple, safe) */

const CACHE_NAME = "sailabc-v3"; // <-- ZMIANA: v3 żeby wymusić odświeżenie cache

// Podstawowe pliki do cache
// (dodałem wersjonowanie dla access/auth-ui żeby nie brało starych)
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/weather.js",
  "/access.js?v=7",
  "/auth-ui.js?v=7",
  "/oprogramowanie.html",
  "/login.html",
  "/moje-konto.html",
  "/admin.html",
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
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

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

  if (req.method !== "GET") return;

  // nie cache’uj /api/*
  if (isInternalApi(url)) return;

  // zewnętrzne API zawsze sieć
  if (isExternalApiRequest(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && url.origin === self.location.origin) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        if (req.mode === "navigate") {
          const fallback = await cache.match("/index.html");
          if (fallback) return fallback;
        }
        throw e;
      }
    })()
  );
});
