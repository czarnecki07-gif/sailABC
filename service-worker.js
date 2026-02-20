const CACHE = "sailabc-tools-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/oprogramowanie.html",
  "/style.css",
  "/oprogramowanie.css",

  "/tools-nawigacja.html",
  "/tools-dziennik.html",
  "/tools-planer.html",
  "/tools-checklista.html",
  "/tools-wiatr.html",

  "/tools-planer.css",
  "/tools-checklista.css",
  "/tools-wiatr.css",

  "/tools-planer.js",
  "/tools-checklista.js",
  "/tools-wiatr.js",

  "/logo.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      // cache update for GET
      if (req.method === "GET") {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(()=>{});
      }
      return res;
    }).catch(() => cached))
  );
});
