// Firebase Cloud Messaging Service Worker
// Bu dosya uygulama kapali/arka planda iken push bildirimlerini alir

// VAPID key duplicated here because Service Workers cannot use ES module imports
// Keep in sync with VITE_VAPID_PUBLIC_KEY in .env and config/firebase.js

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA0wDM5fXHtm0uDlALRhkQzF7tpsZ-7BZI",
  authDomain: "spilsekreterligi.firebaseapp.com",
  projectId: "spilsekreterligi",
  storageBucket: "spilsekreterligi.firebasestorage.app",
  messagingSenderId: "692841027309",
  appId: "1:692841027309:web:d702e7f55031de5eef5ee4",
  measurementId: "G-0X605S84W1"
});

const messaging = firebase.messaging();

// iOS Safari userAgent — actions/image strip için
function isIOSAgent() {
  const ua = (self.navigator && self.navigator.userAgent) || '';
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
}

// Arka plan mesajlarini isle
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Yeni Bildirim';
  const body = payload.notification?.body || payload.data?.body || '';
  const data = payload.data || {};
  const isIOS = isIOSAgent();

  // Unique tag tercih edilir → bildirimler birbirini ezmesin
  const tagValue = data.notificationId || data.id || data.type || 'fcm-general';

  const notificationOptions = {
    body: body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    // image alanı: iOS'ta gözükmüyor → bandwidth tasarrufu için strip
    image: !isIOS ? (data.image || undefined) : undefined,
    data: {
      ...data,
      timestamp: Date.now()
    },
    vibrate: [200, 100, 200],
    // requireInteraction default false → masaüstü kalıcılığı kapat
    requireInteraction: data.requireInteraction === 'true' || data.requireInteraction === true,
    tag: tagValue,
    renotify: false,
    actions: !isIOS ? [
      { action: 'view', title: 'Görüntüle' },
      { action: 'close', title: 'Kapat' }
    ] : []
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Bildirime tiklandiginda
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  event.notification.close();

  if (event.action === 'close') return;

  const data = event.notification.data || {};
  let targetUrl = '/';

  if (data.url) {
    targetUrl = data.url;
  } else if (data.type) {
    switch (data.type) {
      case 'meeting': targetUrl = '/meetings'; break;
      case 'event': targetUrl = '/events'; break;
      case 'election':
      case 'election_result': targetUrl = '/elections'; break;
      case 'member': targetUrl = '/members'; break;
      case 'message':
      default: targetUrl = '/notifications'; break;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
