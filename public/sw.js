const CACHE_NAME = 'ba-waste-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.webp',
  '/logo-ppa.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy: Network First for API, Cache First for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // API calls: Network only (don't cache API responses)
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Static assets & app shell: Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        // Only cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Network failed, return cached or offline fallback
        return cached || new Response('Offline - Cek koneksi internet', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      });
      
      // Return cached immediately, update in background
      return cached || fetchPromise;
    })
  );
});
