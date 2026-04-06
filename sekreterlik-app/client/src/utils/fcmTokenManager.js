/**
 * FCM Token Manager
 * Firebase Cloud Messaging token'larini yonetir.
 * Uygulama kapali/arka planda iken push bildirim almak icin FCM token gereklidir.
 */

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, VAPID_KEY } from '../config/firebase';
import app from '../config/firebase';

// FCM VAPID Key — imported from config/firebase.js (single source of truth)
const FCM_VAPID_KEY = VAPID_KEY;

/**
 * FCM messaging service worker'ini kaydet
 */
async function registerFcmServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Oncelikle mevcut firebase-messaging-sw kayitlarini kontrol et
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existingFcmSw = registrations.find(
      (reg) => reg.active?.scriptURL?.includes('firebase-messaging-sw.js')
    );
    if (existingFcmSw) return existingFcmSw;

    // Yeni kayit olustur
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope'
    });
    return registration;
  } catch (error) {
    console.warn('⚠️ FCM SW registration failed:', error);
    return null;
  }
}

/**
 * FCM token al ve Firestore'a kaydet
 * @param {string|null} userId - Kullanici ID'si
 * @returns {string|null} FCM token
 */
export async function registerFcmToken(userId) {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('⚠️ FCM is not supported in this environment');
      return null;
    }

    // Bildirim izni kontrol et
    if (Notification.permission !== 'granted') {
      console.warn('⚠�� Notification permission not granted, skipping FCM');
      return null;
    }

    // FCM service worker'i kaydet
    const swRegistration = await registerFcmServiceWorker();

    const messaging = getMessaging(app);

    const tokenOptions = {
      vapidKey: FCM_VAPID_KEY
    };
    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }

    const fcmToken = await getToken(messaging, tokenOptions);

    if (!fcmToken) {
      console.warn('⚠️ FCM token alinamadi');
      return null;
    }


    // Firestore'a kaydet: fcm_tokens/{userId}
    if (userId) {
      const tokenRef = doc(db, 'fcm_tokens', String(userId));
      await setDoc(tokenRef, {
        token: fcmToken,
        userId: String(userId),
        platform: navigator.platform || 'unknown',
        userAgent: navigator.userAgent.substring(0, 200),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // localStorage'a da kaydet (hizli erisim icin)
    localStorage.setItem('fcmToken', fcmToken);

    return fcmToken;
  } catch (error) {
    console.warn('⚠️ FCM token registration error:', error);
    return null;
  }
}

/**
 * FCM token'i sil
 * @param {string|null} userId
 */
export async function removeFcmToken(userId) {
  try {
    if (userId) {
      const tokenRef = doc(db, 'fcm_tokens', String(userId));
      await deleteDoc(tokenRef);
    }
    localStorage.removeItem('fcmToken');
  } catch (error) {
    console.warn('FCM token removal error:', error);
  }
}

/**
 * Foreground mesajlarini dinle
 * Uygulama acikken gelen FCM mesajlarini isler
 * @param {function} callback - Mesaj geldiginde cagrilacak fonksiyon
 * @returns {function} Unsubscribe fonksiyonu
 */
export function listenToFcmMessages(callback) {
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {

      // Foreground'da browser notification goster
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          const title = payload.notification?.title || payload.data?.title || 'Yeni Bildirim';
          const body = payload.notification?.body || payload.data?.body || '';

          registration.showNotification(title, {
            body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            data: payload.data || {},
            vibrate: [200, 100, 200],
            tag: payload.data?.type || 'fcm-foreground',
            renotify: true,
            requireInteraction: true,
            actions: [
              { action: 'view', title: 'Goruntule' },
              { action: 'close', title: 'Kapat' }
            ]
          });
        });
      }

      if (callback) callback(payload);
    });
  } catch (error) {
    console.warn('FCM message listener error:', error);
    return () => {};
  }
}

/**
 * FCM uzerinden push bildirim gonder (Cloud Functions / Admin SDK gerektirir)
 * Client-side'dan dogrudan FCM gonderilemez, bu fonksiyon Firestore trigger icin veri yazar
 * @param {Object} params
 */
export async function queueFcmNotification({ userIds, title, body, type, url }) {
  try {
    const { collection, addDoc, serverTimestamp: serverTS } = await import('firebase/firestore');

    // Firestore'a bildirim kuyruklama dokumani yaz
    // Cloud Functions bu koleksiyonu dinleyerek FCM gonderimi yapar
    const queueRef = collection(db, 'fcm_notification_queue');
    await addDoc(queueRef, {
      userIds: userIds || [],
      title,
      body,
      type: type || 'general',
      url: url || '/notifications',
      status: 'pending',
      createdAt: serverTS()
    });

    return true;
  } catch (error) {
    console.warn('FCM notification queue error:', error);
    return false;
  }
}
