// SkyForce Academy service worker: the app itself works offline; map tiles, weather and routing need internet.
// Bump VERSION whenever you upload a new build so players get the update.
const VERSION = "sfa-v5-1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"];
const TILES = "sfa-tiles";
const MAX_TILES = 400;

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cache) { const ks = await cache.keys(); if (ks.length > MAX_TILES) await Promise.all(ks.slice(0, ks.length - MAX_TILES).map(k => cache.delete(k))); }

self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.origin === location.origin) {                      // the app: cache first, refresh in background
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(r, res.clone())); return res; }).catch(() => hit);
      return hit || net;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  if (u.hostname.endsWith("arcgisonline.com")) {           // satellite tiles: keep recent ones so visited areas still show offline
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(r);
      try { const res = await fetch(r); if (res.ok || res.type === "opaque") { c.put(r, res.clone()).then(() => trim(c)); } return res; }
      catch (err) { if (hit) return hit; throw err; }
    }));
  }
  // weather / routing / terrain APIs: always live, never cached
});
