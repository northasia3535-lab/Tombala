// Tombala Gecesi — basit uygulama-kabuğu cache'i.
// Not: Oyun verisi Firebase üzerinden canlı geldiği için sadece
// statik dosyaları (arayüz) çevrimdışı da açılabilir hale getirir.
const CACHE_NAME = "tombala-gecesi-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-apple-touch-icon.png",
  "./icon-favicon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Firebase / Google Fonts isteklerine dokunma — hep ağdan gitsin.
  if (req.url.includes("firebaseio.com") || req.url.includes("googleapis.com") || req.url.includes("gstatic.com")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
