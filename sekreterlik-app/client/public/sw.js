const CACHE_NAME = 'sekreterlik-v9-yrp-20260426';

// Workbox runtime caching'i import et — fonts, images, navigation
// (workbox-sw.js Vite tarafından üretilir, runtime caching stratejilerini içerir).
// Hata olursa custom SW yine çalışır, sadece runtime cache devre dışı kalır.
try {
  importScripts('/workbox-sw.js');
} catch (e) {
  console.warn('[SW] workbox-sw.js import edilemedi (runtime cache devre dışı):', e?.message || e);
}

// manifest.json precache YOK — server-side dynamic (Cloud Function),
// her seferinde fresh çekilmeli
const urlsToCache = [
  '/',
  '/index.html',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  // Yeni SW yüklenir yüklenmez aktif ol — eski SW'i bekleme
  self.skipWaiting();
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
  event.waitUntil((async () => {
    // Eski cache'leri temizle
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((name) => name !== CACHE_NAME ? caches.delete(name) : null)
    );
    // Mevcut tab'ları hemen yeni SW kontrolüne al
    await self.clients.claim();
  })());
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// iOS Safari userAgent kontrolü — action butonlarını ve image'ı atlatmak için.
// iOS PWA push 16.4+'da çalışıyor ama actions/image/badge UI'da gözükmüyor;
// bandwidth tasarrufu + tutarlı UX için bu alanları iOS'ta kaldırıyoruz.
function isIOSAgent() {
  const ua = (self.navigator && self.navigator.userAgent) || '';
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const isIOS = isIOSAgent();
  // tag: notificationId varsa unique kullan; yoksa fallback type/general
  // Unique tag → bildirimler birbirini ezmez (Soapbox pattern).
  const tagValue = data.tag
    || (data.data && (data.data.notificationId || data.data.id))
    || data.notificationId
    || data.id
    || (data.data && data.data.type)
    || 'general';

  const options = {
    body: data.body || 'Yeni bildirim',
    icon: data.icon || (data.data && data.data.icon) || '/icon-192x192.png',
    badge: data.badge || (data.data && data.data.badge) || '/badge-72x72.png',
    // iOS'ta image gösterilmiyor → bandwidth tasarrufu için strip
    image: !isIOS ? (data.image || (data.data && data.data.image) || undefined) : undefined,
    data: {
      ...(data.data || {}),
      timestamp: data.timestamp || Date.now()
    },
    // iOS'ta actions UI'da yok → strip; diğer platformlarda admin payload'ı veya default
    actions: !isIOS ? (data.actions || [
      { action: 'view', title: 'Görüntüle' },
      { action: 'close', title: 'Kapat' }
    ]) : [],
    // requireInteraction: default false → masaüstünde sinir bozucu kalıcılığı önler.
    // Anket gibi özel bildirimler payload'da true gönderebilir.
    requireInteraction: data.requireInteraction === true,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200],
    sound: data.sound || undefined,
    tag: tagValue,
    // Unique tag varsa renotify'a gerek yok; type-bazlı tag'lerde true mantıklı
    renotify: data.renotify !== undefined ? data.renotify : false,
    timestamp: data.timestamp || Date.now()
  };
  
  // Update badge count if available (push payload'da varsa, yoksa skip)
  const badgeCount = (data.data && typeof data.data.badgeCount === 'number') ? data.data.badgeCount : null;
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

  // FAZ 3.3: Anket oyu (vote_0, vote_1, vote_2 ...)
  // Soapbox pattern — uygulama açmadan oy kaydet.
  if (event.action && event.action.startsWith('vote_') && data.voteToken && data.pollId) {
    const optionIndex = parseInt(event.action.slice(5), 10);
    if (!isNaN(optionIndex)) {
      event.waitUntil(
        fetch('https://recordpollvote-bsrvxijkia-ew.a.run.app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voteToken: data.voteToken,
            optionIndex,
          }),
        })
          .then(async (res) => {
            if (res.ok) {
              // Başarı feedback bildirimi
              const optionText = (Array.isArray(data.pollOptions) && data.pollOptions[optionIndex])
                || `Seçenek ${optionIndex + 1}`;
              return self.registration.showNotification('✅ Oyunuz alındı', {
                body: `Seçiminiz: ${optionText}`,
                icon: data.icon || '/icon-192x192.png',
                badge: data.badge || '/badge-72x72.png',
                tag: `poll_vote_${data.pollId}`,
                requireInteraction: false,
                silent: true,
              });
            } else {
              const err = await res.json().catch(() => ({}));
              return self.registration.showNotification('⚠️ Oy kaydedilemedi', {
                body: err.error || 'Lütfen anket sayfasından tekrar deneyin.',
                icon: '/icon-192x192.png',
                tag: `poll_vote_error_${data.pollId}`,
                requireInteraction: false,
              });
            }
          })
          .catch((err) => {
            console.error('[SW] recordPollVote error:', err);
          })
      );
      return;
    }
  }

  // ÖZEL: Uygulama güncelleme bildirimi → SW skipWaiting + force reload
  if (data.action === 'app-update' || data.type === 'update') {
    event.waitUntil(
      (async () => {
        try {
          // Yeni asset'leri cache'e indir, eski cache'i temizle
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
          // Açık tüm tab'leri yenile
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of clientList) {
            try { client.navigate(client.url); client.focus(); } catch (_) { /* ignore */ }
          }
          // Tab yoksa yeni pencere aç
          if (clientList.length === 0) {
            await self.clients.openWindow('/');
          }
        } catch (e) {
          console.warn('App update reload error:', e);
        }
      })()
    );
    return;
  }

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
