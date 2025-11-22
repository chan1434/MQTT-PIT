// Service Worker for RFID-MQTT Dashboard
// Provides offline capability and API response caching

const CACHE_NAME = 'rfid-api-v1';
const API_CACHE_URLS = [
  '/php-backend/api/get_registered.php',
  '/php-backend/api/health.php',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching API endpoints');
      // Pre-cache is optional, we'll use runtime caching instead
      return Promise.resolve();
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only cache API requests
  if (url.pathname.includes('/php-backend/api/')) {
    // Network-first strategy with cache fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache successful GET requests
          if (event.request.method === 'GET' && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[ServiceWorker] Serving from cache:', event.request.url);
              return cachedResponse;
            }
            
            // If not in cache and offline, return offline page
            return new Response(
              JSON.stringify({
                success: false,
                message: 'Offline - cached data not available',
                cached: false,
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        })
    );
  }
  
  // For non-API requests, use default fetch
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      })
    );
  }
});

// Periodic sync for background updates (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-rfid-data') {
    event.waitUntil(updateRFIDData());
  }
});

async function updateRFIDData() {
  try {
    const response = await fetch('http://localhost:81/php-backend/api/get_registered.php');
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('http://localhost:81/php-backend/api/get_registered.php', response);
      console.log('[ServiceWorker] Background sync completed');
    }
  } catch (error) {
    console.log('[ServiceWorker] Background sync failed:', error);
  }
}

console.log('[ServiceWorker] Loaded');

