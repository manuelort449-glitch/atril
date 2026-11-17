// Service worker: guarda la app en el dispositivo para que abra sin internet.
// Cambia VERSION cada vez que publiques cambios para que los aparatos se actualicen.
const VERSION = "atril-v8";
const FILES = [
  "./", "index.html", "styles.css", "app.js", "config.js", "data/datos.js",
  "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-512.png", "remote.html", "vendor/jsQR.js", "vendor/qrcode.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Nunca guardar en caché la sincronización ni Dropbox.
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/")) return;
  // Primero la red (para recibir actualizaciones); si no hay internet, la copia guardada.
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache" })
      .then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
