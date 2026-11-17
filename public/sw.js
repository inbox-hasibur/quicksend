// QuickSend PWA Service Worker
const CACHE_NAME = "quicksend-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico"
];

// Install: pre-cache application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// Activate: cleanup old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-while-revalidate for static assets, network-first with cache fallback for navigations
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Skip browser extensions and non-HTTP protocols
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Bypass service worker for any request from external origins
  if (url.origin !== self.location.origin) {
    return;
  }

  // Strictly bypass service worker for all API endpoints (/api/*)
  // This guarantees WebRTC signaling and health polling always hit the live network directly
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, clone and cache
          if (response && response.status === 200 && (response.type === "basic" || response.type === "default")) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          if (response && (response.ok || response.type === "opaqueredirect")) {
            return response;
          }
          // Server error status: attempt cached shell fallback before failing
          return caches.match(request, { ignoreSearch: true })
            .then((cached) => cached || caches.match("/"))
            .then((shell) => shell || response);
        })
        .catch(async () => {
          try {
            // When offline or network failed, serve cached app shell
            const cached = await caches.match(request, { ignoreSearch: true });
            if (cached) return cached;
            const shell = await caches.match("/");
            if (shell) return shell;
          } catch {
            // Ignore cache match error
          }
          return new Response("Offline - QuickSend app shell unavailable", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        })
    );
    return;
  }

  // Next.js static assets (_next/static), scripts, fonts, images
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".woff2"))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || new Response(null, { status: 404, statusText: "Not Found" }));

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default network with safe cache and 404 fallback (never returns undefined)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === "basic" || networkResponse.type === "default")) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        try {
          const cached = await caches.match(request);
          if (cached) return cached;
        } catch {
          // Ignore cache match error
        }
        return new Response(null, { status: 404, statusText: "Not Found" });
      })
  );
});
