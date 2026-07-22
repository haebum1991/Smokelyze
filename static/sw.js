const CACHE_NAME = "v-20260722-1505"; // R에서 자동으로 생성된 버전
const OFFLINE_URL = "/offline/";

const requiredFiles = [
    "/",
    "/index.html",
    "/about/",
    "/map/",
    "/resrc/",
    "/manifest.json",
    "/images/smokelyze_logo.webp",
    
    // --- CSS Files ---
    "/css/board.css",
    "/css/color-dark.css",
    "/css/color-purple.css",
    "/css/data.css",
    "/css/main.css",
    "/css/map.css",
    
    // --- JS Files ---
    "/js/aerscreen.js",
    "/js/ai-api.js",
    "/js/ai-chat.js",
    "/js/ai-config.js",
    "/js/ai-tools.js",
    "/js/airnow-loader.js",
    "/js/airnow.js",
    "/js/aws-hysplit.js",
    "/js/data-annual.js",
    "/js/data-query-plots.js",
    
    "/js/data-query.js",
    "/js/data-report.js",
    "/js/fb-MapPost-handler.js",
    "/js/fb-MapPost.js",
    "/js/fb-announcements.js",
    "/js/fb-init.js",
    "/js/fb-logging.js",
    "/js/geo-boundary.js",
    "/js/geo-utils.js",
    "/js/layers-colors.js",
    
    "/js/layers-constants.js",
    "/js/layers-def.js",
    "/js/layers-handler.js",
    "/js/layers-icon.js",
    "/js/layers-state.js",
    "/js/layers-tooltip.js",
    "/js/layers.js",
    "/js/loader-fetch.js",
    "/js/loader-handler.js",
    "/js/loader-state.js",
    
    "/js/loader-ui.js",
    "/js/loader.js",
    "/js/map-animate.js",
    "/js/map-capture.js",
    "/js/map-init.js",
    "/js/raster-loader.js",
    "/js/signin.js",
    "/js/stats-common.js",
    "/js/stats-daily.js",
    "/js/stats-data-export.js",
    
    "/js/stats-data-search.js",
    "/js/stats-plot-dy-barline.js",
    "/js/stats-plot-dy-parcoords.js",
    "/js/stats-plot-dy-scatter.js",
    "/js/stats-plot-yr-heat.js",
    "/js/stats-plot-yr-line.js",
    "/js/stats-yearly.js",
    "/js/ui-btn-tooltip.js",
    "/js/ui-date.js",
    "/js/ui-download.js",
    
    "/js/ui-init.js",
    "/js/ui-param-desc.js",
    "/js/ui-reset.js",
    "/js/ui-state.js",
    "/js/ui-time.js",
    "/js/ui-toggles.js",
    "/js/ui-tutorial.js",
    "/js/ui-analytics.js",
    "/js/utils.js"
];

self.addEventListener("install", event => {
    console.log("[SW] Installing new service worker (version: " + CACHE_NAME + ")");
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                const timestamp = Date.now();
                console.log("[SW] Aggressive Caching App Shell (Bust: " + timestamp + ")...");

                const fetchPromises = requiredFiles.map(url => {
                    const bustUrl = url.includes("?") ? `${url}&v=${timestamp}` : `${url}?v=${timestamp}`;

                    return fetch(bustUrl, { cache: "reload" })
                        .then(async response => {
                            if (!response.ok) throw new Error(`[SW] Failed to fetch ${url}`);

                            // [최종 병기] 가져온 내용물에서 껍데기(URL 정보)를 완전히 버리고,
                            // 내용(body)만 쏙 빼서 [깨끗한 이름]의 새 응답 객체를 만듭니다.
                            const blob = await response.blob();
                            const cleanResponse = new Response(blob, {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });

                            return cache.put(url, cleanResponse);
                        })
                        .catch(err => console.error(err));
                });
                return Promise.all(fetchPromises);
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
        path.startsWith("/smokeday/") ||
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

