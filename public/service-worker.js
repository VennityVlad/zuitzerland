
// Service Worker file
// Version is dynamically injected during build
self.APP_VERSION = '2025-05-01-v1';

// Check if in preview environment based on hostname
const isPreviewEnvironment = () => {
  return self.location.hostname.includes('lovableproject.com') || 
         self.location.hostname.includes('lovable.dev') ||
         self.location.hostname.includes('localhost');
};

// Skip activation in preview environments
if (isPreviewEnvironment()) {
  console.log('Service worker inactive in preview environment');
  self.skipWaiting(); // Skip waiting to ensure old service worker is removed
  
  // Immediately clear any existing caches from this origin
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.keys().then(keyList => {
        return Promise.all(
          keyList.map(key => caches.delete(key))
        );
      })
    );
  });
} else {
  // Cache name with version
  const CACHE_NAME = `app-cache-${self.APP_VERSION}`;

  // Install event - precache static assets
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => {
          return cache.addAll([
            '/',
            '/index.html',
            // Add other critical static assets
          ]);
        })
        .then(() => self.skipWaiting()) // Activate worker immediately
    );
  });

  // Activate event - clean up old caches
  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(keyList => {
        return Promise.all(
          keyList.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key); // Delete old caches
            }
          })
        );
      })
    );
    // Take control of all clients immediately
    return self.clients.claim();
  });

  // Fetch event - network-first strategy
  self.addEventListener('fetch', event => {
    // Skip cross-origin requests like API calls
    if (!event.request.url.startsWith(self.location.origin)) {
      return;
    }

    // Only cache GET requests as the Cache API doesn't support other methods
    if (event.request.method !== 'GET') {
      return fetch(event.request);
    }

    // Network first, falling back to cache for GET requests
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response before using it
          const responseToCache = response.clone();
          
          // Cache successful responses
          if (response.ok && !event.request.url.includes('/api/')) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request);
        })
    );
  });
}

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
