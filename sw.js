// Offline support: the app shell is fetched network-first (so new deploys show
// up right away) and photos/voice clips cache-first (they never change).
const CACHE = "bendito-52986e6456";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/audio.js", "js/components.js", "js/content.js", "js/content-data.js", "js/modals.js", "js/player.js", "js/screens.js", "js/store.js", "js/ui.js", "icon.svg", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isMedia = /\/(img|voice)\//.test(req.url);
  e.respondWith(isMedia ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req)) || (await caches.match("index.html"));
  }
}
