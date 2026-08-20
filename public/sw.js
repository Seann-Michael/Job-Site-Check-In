/* Local SEO Ranker service worker.
 *
 * Strategy:
 *  - Navigations (HTML): network-first, fall back to /offline.html. Nothing
 *    authenticated is ever precached.
 *  - Hashed build assets (/assets/*): cache-first (immutable by content hash).
 *  - Same-origin static files (icons, manifest): stale-while-revalidate.
 *  - API and cross-origin requests (Supabase, Maps, Stripe): never intercepted.
 *
 * `__BUILD_ID__` is replaced at build time by the Vite build-id plugin, so each
 * deploy gets a fresh cache namespace and old caches are purged on activate.
 */
const BUILD_ID = "__BUILD_ID__";
const CACHE_PREFIX = "lsr-";
const ASSET_CACHE = `${CACHE_PREFIX}assets-${BUILD_ID}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${BUILD_ID}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.json"]))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              k.startsWith(CACHE_PREFIX) &&
              k !== ASSET_CACHE &&
              k !== STATIC_CACHE,
          )
          .concat(keys.filter((k) => k.startsWith("local-seo-ranker-")))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (/\.(png|svg|ico|webmanifest|json|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    return (
      cached ||
      new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

// Web Push
self.addEventListener("push", (event) => {
  let data = {
    title: "Local SEO Ranker",
    body: "You have a new notification",
    icon: "/icon-192x192.png",
    badge: "/icon-72x72.png",
    tag: "default",
  };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: { url: data.url || "/admin/jobs", ...(data.data || {}) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = new URL(
    (event.notification.data && event.notification.data.url) || "/admin/jobs",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url === urlToOpen && "focus" in client)
          return client.focus();
      }
      return self.clients.openWindow(urlToOpen);
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
