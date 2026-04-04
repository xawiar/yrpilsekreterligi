import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { setBadgeCount } from '../utils/pwaBadge';
import { playNotificationSound } from '../utils/notificationSound';
import ApiService from '../utils/ApiService';
import { isNotificationAllowed, getStoredPreferences } from './useNotificationPreferences';

// Firebase kullanimi kontrolu
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' ||
                     import.meta.env.VITE_USE_FIREBASE === true ||
                     String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

const POLLING_INTERVAL = 30000; // 30 saniye

/**
 * Tarayici bildirimi goster (Notification API).
 * Service worker varsa registration.showNotification, yoksa new Notification kullanir.
 */
const showBrowserNotification = async (title, body) => {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') {
      // Izin henuz verilmemisse iste
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }

    // Service worker uzerinden goster (daha guvenilir, arka planda da calisir)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'realtime-' + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200]
      });
    } else {
      // Fallback: dogrudan Notification API
      new Notification(title, {
        body,
        icon: '/icon-192x192.png'
      });
    }
  } catch (e) {
    console.warn('Browser notification error:', e);
  }
};

const useRealtimeNotifications = (memberId, enabled = true) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isInitialLoad = useRef(true);
  const previousUnreadRef = useRef(0);
  const previousNotifIdsRef = useRef(new Set());

  // Backend polling fonksiyonu
  const fetchNotifications = useCallback(async () => {
    if (!memberId) return;
    try {
      const response = await ApiService.getNotifications(memberId);
      const allNotifs = response.notifications || response || [];
      const prefs = getStoredPreferences();

      // Tercihlere gore filtrele
      const notifs = allNotifs.filter(n => isNotificationAllowed(n.type, prefs));
      const unread = notifs.filter(n => !n.read).length;

      setNotifications(notifs);
      setUnreadCount(unread);
      setBadgeCount(unread);

      // Ilk yuklemeden sonra yeni bildirim gelirse ses cal + tarayici bildirimi goster
      if (!isInitialLoad.current && unread > previousUnreadRef.current) {
        playNotificationSound();
        // Yeni gelen bildirimleri bul ve tarayici bildirimi goster
        const currentIds = new Set(notifs.filter(n => !n.read).map(n => n.id));
        const newNotifs = notifs.filter(n => !n.read && !previousNotifIdsRef.current.has(n.id));
        for (const n of newNotifs) {
          showBrowserNotification(n.title || 'Yeni Bildirim', n.message || n.body || '');
        }
        previousNotifIdsRef.current = currentIds;
      } else {
        previousNotifIdsRef.current = new Set(notifs.filter(n => !n.read).map(n => n.id));
      }
      isInitialLoad.current = false;
      previousUnreadRef.current = unread;
    } catch (error) {
      console.error('Notification polling error:', error);
    }
  }, [memberId]);

  // Firebase modu: onSnapshot ile realtime
  useEffect(() => {
    if (!memberId || !enabled || !USE_FIREBASE || !db) return;

    // Reset initial load flag whenever memberId changes
    isInitialLoad.current = true;
    previousUnreadRef.current = 0;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('memberId', 'in', [memberId, null]),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prefs = getStoredPreferences();
      const allNotifs = [];
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        allNotifs.push(data);
      });

      // Tercihlere gore filtrele
      const notifs = allNotifs.filter(n => isNotificationAllowed(n.type, prefs));
      const unread = notifs.filter(n => !n.read).length;

      setNotifications(notifs);
      setUnreadCount(unread);
      setBadgeCount(unread);

      // Play sound + browser notification only when new unread notifications arrive after initial load
      if (!isInitialLoad.current && unread > previousUnreadRef.current) {
        playNotificationSound();
        // Yeni gelen bildirimleri bul ve tarayici bildirimi goster
        const currentIds = new Set(notifs.filter(n => !n.read).map(n => n.id));
        const newNotifs = notifs.filter(n => !n.read && !previousNotifIdsRef.current.has(n.id));
        for (const n of newNotifs) {
          showBrowserNotification(n.title || 'Yeni Bildirim', n.message || n.body || '');
        }
        previousNotifIdsRef.current = currentIds;
      } else {
        previousNotifIdsRef.current = new Set(notifs.filter(n => !n.read).map(n => n.id));
      }
      isInitialLoad.current = false;
      previousUnreadRef.current = unread;
    }, (error) => {
      console.error('Notification listener error:', error);
    });

    return () => unsubscribe();
  }, [memberId, enabled]);

  // Backend modu: polling ile bildirim kontrolu
  useEffect(() => {
    if (!memberId || !enabled || USE_FIREBASE) return;

    // Reset initial load flag whenever memberId changes
    isInitialLoad.current = true;
    previousUnreadRef.current = 0;

    // Ilk cagri hemen yapilsin
    fetchNotifications();

    // Her 30 saniyede bir polling
    const interval = setInterval(fetchNotifications, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [memberId, enabled, fetchNotifications]);

  return { notifications, unreadCount };
};

export default useRealtimeNotifications;
