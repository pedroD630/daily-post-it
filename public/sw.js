/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Bump this version on any change that should bust the SW cache.
// The build hash in /assets/* file names already busts code/CSS caches automatically.
const SW_VERSION = "v4";
const RUNTIME_CACHE = `daily-postit-runtime-${SW_VERSION}`;
const PRECACHE = `daily-postit-precache-${SW_VERSION}`;

// Only precache the shell entry — index.html is fetched network-first below.
// Static assets (with content-hashed names) are cached lazily on first request.
const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/android/launchericon-192x192.png",
  "/icons/android/launchericon-512x512.png",
  "/icons/ios/180.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => { /* tolerate missing icons */ }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== RUNTIME_CACHE && n !== PRECACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// Allow the page to trigger immediate activation of a newly-installed SW.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHashedAsset(url) {
  // Vite emits files like /assets/index-AbCdEf12.js — content-hashed and immutable.
  return /\/assets\/.+\.[a-z0-9]+\.(js|css|woff2?|png|jpg|svg|ico)$/i.test(url.pathname)
      || /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs from same origin (skip Firebase auth proxy, APIs, etc.)
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the Firebase auth handler/iframe proxied through /__/auth/*
  if (url.pathname.startsWith("/__/auth/")) return;

  // Network-first for HTML navigations — guarantees users see the latest deploy.
  const isNavigation = req.mode === "navigate"
                    || (req.destination === "" && req.headers.get("accept")?.includes("text/html"));

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Cache-first for hashed static assets — they're immutable, safe to keep forever.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for everything else (manifest, icons, root-level files).
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
