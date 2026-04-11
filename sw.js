// sw.js – Advanced caching with offline fallback, no extra code needed
const CACHE_VERSION = 'wesnoth-v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGES_CACHE = `images-${CACHE_VERSION}`;

// Assets to precache during installation
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/Chronicle.html',
  '/offline.html',
  '/terms.html',
  '/policy.html',
  '/manifest.json',
  '/styles/chronicle-colors.css',
  '/styles/chronicle-light.css',
  '/styles/chronicle-dark.css',
  '/styles/chronicle-high.css',
  '/styles/chronicle-screens.css',
  '/styles/chronicle-dir.css',
  '/styles/index-colors.css',
  '/styles/index-light.css',
  '/styles/index-dark.css',
  '/styles/index-high.css',
  '/styles/index-screens.css',
  '/styles/index-dir.css',
  '/scripts/init.js',
  '/scripts/chronicle.js',
  '/scripts/index.js',
  '/i18n/ui_en.js',
  '/i18n/ui_es.js',
  '/i18n/ui_fr.js',
  '/i18n/ui_de.js',
  '/i18n/events_en.js',
  '/i18n/events_ar.js',
  '/assets/icons/pwa-icons/icon-72x72.png',
  '/assets/icons/pwa-icons/icon-192x192.png',
  '/assets/icons/pwa-icons/icon-512x512.png'
];

// ---------- Install: precache core assets ----------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------- Activate: clean old caches ----------
self.addEventListener('activate', event => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ---------- Fetch: network-first for HTML, cache strategies for assets ----------
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // HTML navigation: network-first, fallback to cache, then offline page
  if (request.mode === 'navigate' || (request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a copy of the fresh HTML
          const cloned = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, cloned));
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Images: cache-first (long‑lived assets)
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          const cloned = response.clone();
          caches.open(IMAGES_CACHE).then(cache => cache.put(request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // CSS / JS / Fonts: stale-while-revalidate
  if (url.pathname.match(/\.(css|js|woff2?|ttf|eot)$/i)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(networkResponse => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Everything else: network-first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        const cloned = response.clone();
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, cloned));
        return response;
      })
      .catch(() => caches.match(request))
  );
});