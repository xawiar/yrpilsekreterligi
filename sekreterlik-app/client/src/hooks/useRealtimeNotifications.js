import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { setBadgeCount } from '../utils/pwaBadge';
import { playNotificationSound } from '../utils/notificationSound';
import ApiService from '../utils/ApiService';
import { isNotificationAllowed, getStoredPreferences } from './useNotificationPreferences';

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' ||
                     import.meta.env.VITE_USE_FIREBASE === true ||
                     String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

const POLLING_INTERVAL = 30000;

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
        vibrate: [200, 100, 200]
      });
    } else {
      new Notification(title, { body, icon: '/icon-192x192.png' });
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

  const fetchNotifications = useCallback(async () => {
    if (!memberId) return;
    try {
      const response = await ApiService.getNotifications(memberId);
      const allNotifs = response.notifications || response || [];
      const prefs = getStoredPreferences();
      const notifs = allNotifs.filter(function(n) { return isNotificationAllowed(n.type, prefs); });
      const unread = notifs.filter(function(n) { return !n.read; }).length;

      setNotifications(notifs);
      setUnreadCount(unread);
      setBadgeCount(unread);

      if (!isInitialLoad.current && unread > previousUnreadRef.current) {
        playNotificationSound();
        var currentIds = new Set(notifs.filter(function(n) { return !n.read; }).map(function(n) { return n.id; }));
        var brandNew = notifs.filter(function(n) { return !n.read && !previousNotifIdsRef.current.has(n.id); });
        for (var i = 0; i < brandNew.length; i++) {
          showBrowserNotification(brandNew[i].title || 'Yeni Bildirim', brandNew[i].message || brandNew[i].body || '');
        }
        previousNotifIdsRef.current = currentIds;
      } else {
        previousNotifIdsRef.current = new Set(notifs.filter(function(n) { return !n.read; }).map(function(n) { return n.id; }));
      }
      isInitialLoad.current = false;
      previousUnreadRef.current = unread;
    } catch (error) {
      console.error('Notification polling error:', error);
    }
  }, [memberId]);

  // Firebase modu: onSnapshot ile realtime
  useEffect(function() {
    if (!memberId || !enabled || !USE_FIREBASE || !db) return;

    isInitialLoad.current = true;
    previousUnreadRef.current = 0;

    // Primary: user_notifications subcollection (fan-out pattern)
    var userNotifsRef = collection(db, 'user_notifications/' + memberId + '/items');
    var q = query(userNotifsRef, orderBy('createdAt', 'desc'), limit(50));

    function processAndUpdate(notifsList) {
      var prefs = getStoredPreferences();
      var sorted = notifsList
        .sort(function(a, b) {
          var dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          var dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB - dateA;
        })
        .slice(0, 50);

      var filtered = sorted.filter(function(n) { return isNotificationAllowed(n.type, prefs); });
      var unread = filtered.filter(function(n) { return !n.read; }).length;

      setNotifications(filtered);
      setUnreadCount(unread);
      setBadgeCount(unread);

      if (!isInitialLoad.current && unread > previousUnreadRef.current) {
        playNotificationSound();
        var currentIds = new Set(filtered.filter(function(n) { return !n.read; }).map(function(n) { return n.id; }));
        var brandNew = filtered.filter(function(n) { return !n.read && !previousNotifIdsRef.current.has(n.id); });
        for (var j = 0; j < brandNew.length; j++) {
          showBrowserNotification(brandNew[j].title || 'Yeni Bildirim', brandNew[j].message || brandNew[j].body || '');
        }
        previousNotifIdsRef.current = currentIds;
      } else {
        previousNotifIdsRef.current = new Set(filtered.filter(function(n) { return !n.read; }).map(function(n) { return n.id; }));
      }
      isInitialLoad.current = false;
      previousUnreadRef.current = unread;
    }

    var userNotifsLoaded = false;
    var fallbackUnsub = null;

    var unsub1 = onSnapshot(q, function(snapshot) {
      var newNotifsList = [];
      snapshot.forEach(function(docSnap) {
        newNotifsList.push({ id: docSnap.id, ...docSnap.data() });
      });

      // user_notifications is primary — if it has data, use it exclusively
      if (newNotifsList.length > 0) {
        userNotifsLoaded = true;
        // Cancel old notifications fallback listener if active
        if (fallbackUnsub) {
          fallbackUnsub();
          fallbackUnsub = null;
        }
        processAndUpdate(newNotifsList);
      } else if (!userNotifsLoaded) {
        // user_notifications empty on first load — activate fallback from old 'notifications' collection
        var oldNotifsRef = collection(db, 'notifications');
        var oldQ = query(oldNotifsRef, orderBy('createdAt', 'desc'), limit(100));
        fallbackUnsub = onSnapshot(oldQ, function(oldSnapshot) {
          var oldNotifsList = [];
          oldSnapshot.forEach(function(docSnap) {
            var data = { id: docSnap.id, ...docSnap.data() };
            if (data.memberId === memberId || data.memberId === null || !data.memberId) {
              oldNotifsList.push(data);
            }
          });
          processAndUpdate(oldNotifsList);
        }, function(err) { console.warn('old notifications fallback listener error:', err); });
      }
    }, function(err) { console.warn('user_notifications listener error:', err); });

    return function() {
      unsub1();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [memberId, enabled]);

  // Backend modu: polling
  useEffect(function() {
    if (!memberId || !enabled || USE_FIREBASE) return;

    isInitialLoad.current = true;
    previousUnreadRef.current = 0;
    fetchNotifications();
    var interval = setInterval(fetchNotifications, POLLING_INTERVAL);
    return function() { clearInterval(interval); };
  }, [memberId, enabled, fetchNotifications]);

  return { notifications: notifications, unreadCount: unreadCount };
};

export default useRealtimeNotifications;
