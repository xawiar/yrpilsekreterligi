const CACHE_NAME = 'sekreterlik-v8-fcm-20260403';
// Vite geliştirme ortamında sabit bundle yolları yok; yalnızca güvenli, mevcut dosyaları önbelleğe al
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // addAll bazı istekler başarısız olduğunda tümünü reddedebilir; tek tek ve hataları yutarak ekle
      await Promise.all(urlsToCache.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          if (resp && resp.ok) {
            await cache.put(url, resp.clone());
          }
        } catch (_) {
          // mevcut olmayan dosyaları atla
        }
      }));
      console.log('Cache primed');
    } catch (e) {
      // hiçbir şey yapma – SW kurulumu yine de tamamlanacak
      console.warn('Cache warmup error:', e);
    }
  })());
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip localhost URLs entirely — do NOT intercept, let the browser handle them
  if (url.includes('localhost:5000') || url.includes('localhost:3000') || url.includes('127.0.0.1')) {
    return; // Do not call event.respondWith — browser handles natively
  }

  // Skip API requests — do not cache
  if (url.includes('/api/')) {
    return;
  }

  // Skip Firebase/Firestore requests — do not cache
  if (url.includes('firestore.googleapis.com') || url.includes('firebase') || url.includes('googleapis.com')) {
    return;
  }

  // Navigation requests (HTML pages) — network-first for SPA routing
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => {
          // Offline fallback: serve cached index.html for SPA
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request).catch(() => {
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'Yeni bildirim',
    icon: data.icon || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: {
      ...(data.data || {}),
      timestamp: data.timestamp || Date.now()
    },
    actions: data.actions || [
      {
        action: 'view',
        title: 'Görüntüle'
      },
      {
        action: 'close',
        title: 'Kapat'
      }
    ],
    requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200], // Vibrate pattern
    sound: data.sound || undefined, // Sound (browser may ignore)
    tag: data.tag || data.data?.type || 'general', // Tag for grouping
    renotify: data.renotify !== undefined ? data.renotify : true,
    timestamp: data.timestamp || Date.now()
  };
  
  // Update badge count if available
  if (badgeCount !== null && 'setAppBadge' in navigator) {
    navigator.setAppBadge(badgeCount).catch(err => {
      console.warn('Could not set app badge:', err);
    });
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Bildirim', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);

  event.notification.close();

  if (event.action === 'close') {
    // Just close the notification
    console.log('Notification closed');
    return;
  }

  // Bildirim verisinden hedef URL belirle
  const data = event.notification.data || {};
  let targetUrl = '/';

  if (data.url) {
    // Eger bildirimde acik URL varsa onu kullan
    targetUrl = data.url;
  } else if (data.type) {
    // Bildirim tipine gore yonlendir
    switch (data.type) {
      case 'meeting':
        targetUrl = '/meetings';
        break;
      case 'event':
        targetUrl = '/events';
        break;
      case 'election':
      case 'election_result':
        targetUrl = '/elections';
        break;
      case 'member':
        targetUrl = '/members';
        break;
      case 'message':
        targetUrl = '/notifications';
        break;
      default:
        targetUrl = '/notifications';
        break;
    }
  }

  // Mevcut acik pencereyi bul veya yeni pencere ac
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Zaten acik bir pencere varsa ona yonlendir
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          // Post message to main app so it can mark notification as read
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            notificationId: data.notificationId || data.id,
            url: data.url
          });
          return client.focus();
        }
      }
      // Yoksa yeni pencere ac
      return clients.openWindow(targetUrl);
    })
  );
});

// Background sync function
async function doBackgroundSync() {
  try {
    console.log('Background sync started');
    
    // Get pending data from IndexedDB
    const pendingData = await getPendingData();
    
    if (pendingData.length > 0) {
      console.log('Syncing pending data:', pendingData);
      
      // Send pending data to server
      for (const data of pendingData) {
        try {
          await fetch('/api/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });
          
          // Remove from pending data
          await removePendingData(data.id);
        } catch (error) {
          console.error('Error syncing data:', error);
        }
      }
    }
    
    console.log('Background sync completed');
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

// IndexedDB functions for background sync
async function getPendingData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sekreterlik-sync', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pending'], 'readonly');
      const store = transaction.objectStore('pending');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function removePendingData(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sekreterlik-sync', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pending'], 'readwrite');
      const store = transaction.objectStore('pending');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}
