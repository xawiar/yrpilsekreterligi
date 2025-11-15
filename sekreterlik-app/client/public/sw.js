// Service Worker tamamen devre dışı - Redirect döngüsü sorunu nedeniyle
// Bu Service Worker kendini unregister eder ve cache'i temizler

const CACHE_NAME = 'sekreterlik-disabled-' + Date.now();

// Install event - kendini hemen unregister et
self.addEventListener('install', (event) => {
  console.log('Service Worker installing - will self-destruct');
  self.skipWaiting();
});

// Activate event - tüm cache'leri temizle ve kendini unregister et
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating - clearing all caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('All caches deleted');
      // Service Worker'ı unregister et
      return self.registration.unregister();
    }).then(() => {
      console.log('Service Worker unregistered');
      // Tüm client'ları yenile
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach(client => {
        client.postMessage({ type: 'RELOAD' });
      });
    })
  );
});

// Fetch event - hiçbir şey cache'leme, her zaman network'ten al
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});

// Mesaj event - reload komutu
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
