const CACHE_NAME = "local-seo-ranker-v2.0.0";
const STATIC_CACHE = "lsr-static-v2";
const DYNAMIC_CACHE = "lsr-dynamic-v2";
const IMAGE_CACHE = "lsr-images-v2";
const API_CACHE = "lsr-api-v2";

// Enhanced cache configuration
const CACHE_CONFIG = {
  maxEntries: 500,
  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
  networkTimeoutSeconds: 3
};

// Files to cache immediately
const STATIC_ASSETS = [
  "/",
  "/admin/jobs",
  "/admin/gallery",
  "/admin/settings",
  "/agency/admin/dashboard",
  "/signin",
  "/signup",
  "/manifest.json",
  "/offline.html"
];

// API endpoints to cache for offline use
const CACHED_API_ENDPOINTS = [
  "/api/auth/profile",
  "/api/businesses",
  "/api/projects",
  "/api/analytics/summary"
];

// Install event - enhanced caching
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker installing v2.0.0...");
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
      initializeOfflineStorage(),
      self.skipWaiting()
    ]).then(() => {
      console.log("✅ Service Worker installed successfully");
      self.postMessage({ type: "SW_INSTALLED" });
    }).catch(error => {
      console.error("❌ Service Worker installation failed:", error);
    })
  );
});

// Activate event - enhanced cleanup and client claiming
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activating...");
  
  event.waitUntil(
    Promise.all([
      cleanupOldCaches(),
      self.clients.claim(),
      setupBackgroundSync(),
      initializePushNotifications()
    ]).then(() => {
      console.log("✅ Service Worker activated");
      self.postMessage({ type: "SW_ACTIVATED" });
    })
  );
});

// Enhanced fetch handler with intelligent caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return;
  }

  // Route to appropriate handler based on request type
  if (request.destination === "image") {
    event.respondWith(handleImageRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Advanced image handling with progressive loading
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    
    // Check cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Network with timeout
    const networkResponse = await fetchWithTimeout(request, CACHE_CONFIG.networkTimeoutSeconds * 1000);
    
    if (networkResponse && networkResponse.ok) {
      // Clone and cache response
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
      
      // Cleanup old cache entries
      await cleanupCache(IMAGE_CACHE, CACHE_CONFIG.maxEntries);
    }

    return networkResponse;
  } catch (error) {
    console.warn("Image request failed:", error);
    
    // Return placeholder image for offline
    return new Response(
      `<svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" fill="#6b7280">Image Offline</text>
      </svg>`,
      {
        headers: { 'Content-Type': 'image/svg+xml' },
        status: 200
      }
    );
  }
}

// API request handling with offline-first strategy for read operations
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const cache = await caches.open(API_CACHE);
  
  // For read operations, try cache first for faster response
  if (request.method === "GET" && CACHED_API_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Serve from cache immediately
      const response = cachedResponse.clone();
      
      // Update cache in background
      fetchAndUpdateCache(request, cache);
      
      return response;
    }
  }

  try {
    // Try network first for fresh data
    const networkResponse = await fetchWithTimeout(request, CACHE_CONFIG.networkTimeoutSeconds * 1000);
    
    if (networkResponse && networkResponse.ok) {
      // Cache successful responses
      if (request.method === "GET") {
        cache.put(request, networkResponse.clone());
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.warn("API request failed, trying cache:", error);
    
    // Fallback to cache for GET requests
    if (request.method === "GET") {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Return offline response
    return createOfflineResponse(request);
  }
}

// Static asset handling with cache-first strategy
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetchWithTimeout(request, CACHE_CONFIG.networkTimeoutSeconds * 1000);

    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn("Static asset failed:", error);
    
    // Fallback to cache
    const cache = await caches.open(STATIC_CACHE);
    return cache.match(request) || cache.match("/offline.html");
  }
}

// Navigation request handling with app shell pattern
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetchWithTimeout(request, CACHE_CONFIG.networkTimeoutSeconds * 1000);
    
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn("Navigation request failed:", error);
    
    // Fallback to cached page or app shell
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return app shell for SPA routes
    const appShell = await cache.match("/") || await caches.open(STATIC_CACHE).then(c => c.match("/"));
    return appShell || cache.match("/offline.html");
  }
}

// Enhanced background sync
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync triggered:", event.tag);

  switch (event.tag) {
    case "upload-files":
      event.waitUntil(syncUploadFiles());
      break;
    case "sync-data":
      event.waitUntil(syncOfflineData());
      break;
    case "analytics":
      event.waitUntil(syncAnalytics());
      break;
    default:
      console.log("Unknown sync tag:", event.tag);
  }
});

// Enhanced push notification handling
self.addEventListener("push", (event) => {
  console.log("📨 Push notification received");
  
  let notificationData = {
    title: "Local SEO Ranker",
    body: "New update available",
    icon: "/icon-192x192.png",
    badge: "/icon-72x72.png",
    tag: "default"
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (error) {
      notificationData.body = event.data.text();
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: notificationData.url || "/admin/jobs",
      timestamp: Date.now(),
      ...notificationData.data
    },
    actions: [
      {
        action: "view",
        title: "View",
        icon: "/icon-192x192.png"
      },
      {
        action: "dismiss",
        title: "Dismiss"
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Enhanced notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.action);
  
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/admin/jobs";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then(clientList => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Enhanced message handling
self.addEventListener("message", (event) => {
  console.log("💬 Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === "CACHE_UPDATE") {
    event.waitUntil(updateCache(event.data.urls));
  }
});

// Utility functions

async function fetchWithTimeout(request, timeout = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchAndUpdateCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
  } catch (error) {
    console.warn("Background cache update failed:", error);
  }
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
  
  return Promise.all(
    cacheNames.map(cacheName => {
      if (!currentCaches.includes(cacheName)) {
        console.log("🗑️ Deleting old cache:", cacheName);
        return caches.delete(cacheName);
      }
    })
  );
}

async function cleanupCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  if (requests.length > maxEntries) {
    const entriesToDelete = requests.slice(0, requests.length - maxEntries);
    await Promise.all(entriesToDelete.map(request => cache.delete(request)));
  }
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.pathname.includes("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".ico")
  );
}

function createOfflineResponse(request) {
  const isAPIRequest = request.url.includes("/api/");
  
  if (isAPIRequest) {
    return new Response(
      JSON.stringify({
        error: "offline",
        message: "This request requires an internet connection",
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  
  return new Response("Offline", { status: 503 });
}

async function initializeOfflineStorage() {
  // Initialize IndexedDB for offline data storage
  if ("indexedDB" in self) {
    // This would be expanded with actual IndexedDB setup
    console.log("📦 IndexedDB available for offline storage");
  }
}

async function setupBackgroundSync() {
  // Setup background sync registration
  console.log("🔄 Background sync capabilities ready");
}

async function initializePushNotifications() {
  // Initialize push notification handling
  console.log("📨 Push notification system ready");
}

async function syncUploadFiles() {
  // Implementation for syncing uploaded files
  console.log("📁 Syncing uploaded files...");
}

async function syncOfflineData() {
  // Implementation for syncing offline data changes
  console.log("💾 Syncing offline data changes...");
}

async function syncAnalytics() {
  // Implementation for syncing analytics data
  console.log("📊 Syncing analytics data...");
}

async function updateCache(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  return Promise.all(
    urls.map(async url => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn("Failed to update cache for:", url, error);
      }
    })
  );
}

console.log("🎯 Local SEO Ranker Service Worker v2.0.0 loaded");
