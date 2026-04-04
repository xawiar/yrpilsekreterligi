import { useState, useEffect, useRef, useCallback } from 'react';
import NotificationService from '../services/NotificationService';
import { setBadgeCount } from '../utils/pwaBadge';
import { playNotificationSound } from '../utils/notificationSound';
import { isNotificationAllowed, getStoredPreferences } from './useNotificationPreferences';

// =====================================================
// Browser Notification
// =====================================================
const showBrowserNotification = async (title, body) => {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'realtime-' + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200],
      });
    } else {
      new Notification(title, { body, icon: '/icon-192x192.png' });
    }
  } catch (e) {
    console.warn('[useRealtimeNotifications] Browser notification error:', e);
  }
};

// =====================================================
// Hook: TEK listener — sadece user_notifications/{userId}/items/
// =====================================================
const useRealtimeNotifications = (memberId, enabled = true) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoad = useRef(true);
  const prevUnreadCount = useRef(0);
  const prevNotifIds = useRef(new Set());

  useEffect(() => {
    if (!memberId || !enabled) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    isFirstLoad.current = true;
    prevUnreadCount.current = 0;
    prevNotifIds.current = new Set();

    // TEK listener — user_notifications/{userId}/items/ onSnapshot
    const unsubscribe = NotificationService.subscribeToNotifications(
      memberId,
      (items) => {
        // Kullanici tercihlerine gore filtrele
        const prefs = getStoredPreferences();
        const filtered = items.filter((n) => isNotificationAllowed(n.type, prefs));

        // Okunmamis say
        const unread = filtered.filter((n) => !n.isRead).length;

        setNotifications(filtered);
        setUnreadCount(unread);
        setBadgeCount(unread);

        // Ses + browser notification — sadece yeni bildirim geldiginde
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          prevUnreadCount.current = unread;
          prevNotifIds.current = new Set(
            filtered.filter((n) => !n.isRead).map((n) => n.id)
          );
        } else if (unread > prevUnreadCount.current) {
          // Yeni bildirimler geldi
          playNotificationSound();

          const currentIds = new Set(
            filtered.filter((n) => !n.isRead).map((n) => n.id)
          );
          const brandNew = filtered.filter(
            (n) => !n.isRead && !prevNotifIds.current.has(n.id)
          );

          for (const notif of brandNew) {
            showBrowserNotification(
              notif.title || 'Yeni Bildirim',
              notif.body || notif.message || ''
            );
          }

          prevNotifIds.current = currentIds;
          prevUnreadCount.current = unread;
        } else {
          prevNotifIds.current = new Set(
            filtered.filter((n) => !n.isRead).map((n) => n.id)
          );
          prevUnreadCount.current = unread;
        }
      }
    );

    return () => unsubscribe();
  }, [memberId, enabled]);

  return { notifications, unreadCount };
};

export default useRealtimeNotifications;
