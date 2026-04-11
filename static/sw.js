const CACHE_NAME = "v-20260410-1804"; // R에서 자동으로 생성된 버전
const OFFLINE_URL = "/offline/";

const requiredFiles = [
    "/",
    "/index.html",
    "/manifest.json",
    "/css/main.css",
    "/css/color-dark.css",
    "/js/ui-init.js",
    "/images/smokelyze_logo.webp"
];

self.addEventListener("install", event => {
    console.log("[SW] Installing new service worker (version: " + CACHE_NAME + ")");
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log("[SW] Caching App Shell files...");
                return cache.addAll(requiredFiles);
            })
            .catch(error => {
                console.error("[SW] Failed to pre-cache:", error);
            })
    );
});

self.addEventListener("message", event => {
    if (event.data === "skipWaiting") {
        self.skipWaiting();
    }
});

self.addEventListener("activate", event => {
    console.log("[SW] Activating service worker and cleaning old caches...");
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log("[SW] Deleting old cache:", cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim() // Take control of all clients immediately
        ])
    );
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET" || !event.request.url.startsWith("http")) return;

    const requestUrl = new URL(event.request.url);
    const isLocal = requestUrl.origin === location.origin;
    const path = requestUrl.pathname;

    // 1. Netlify Functions / GCS - Network Only
    if (
        path.startsWith("/.netlify/functions/") ||
        path.startsWith("/data_by_date") ||
        path.startsWith("/data_by_aqs") ||
        path.startsWith("/data_by_aqs_meta") ||
        path.startsWith("/data_by_state") ||
        path.startsWith("/noaa_hms") ||
        path.startsWith("/modis_burn") ||
        path.includes("/realtime/")
    ) {
        return;
    }

    // 2. Local Static Resources - Stale-While-Revalidate (Fast UI)
    // - Separate entry points (root, index.html) to be Network-First to avoid stale logic loops
    const isStaticAsset = path.startsWith("/images/") || path.startsWith("/css/") || path.startsWith("/js/");
    const isEntryPoint = path === "/" || path === "/index.html";

    if (isLocal && isStaticAsset && !isEntryPoint) {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    return cachedResponse || fetchPromise;
                })
        );
        return;
    }

    // 3. External Images (Google Profile, etc.) - Stale-While-Revalidate
    if (requestUrl.hostname.includes("googleusercontent.com") || event.request.destination === "image") {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    return cachedResponse || fetchPromise;
                })
        );
        return;
    }

    // 4. Other External CDN - Network-First with Cache fallback
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.status === 200 && (response.type === "basic" || response.type === "cors")) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

