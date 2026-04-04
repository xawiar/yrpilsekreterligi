import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { setBadgeCount } from '../utils/pwaBadge';
import { playNotificationSound } from '../utils/notificationSound';
import ApiService from '../utils/ApiService';

// Firebase kullanimi kontrolu
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' ||
                     import.meta.env.VITE_USE_FIREBASE === true ||
                     String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

const POLLING_INTERVAL = 30000; // 30 saniye

const useRealtimeNotifications = (memberId, enabled = true) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isInitialLoad = useRef(true);
  const previousUnreadRef = useRef(0);

  // Backend polling fonksiyonu
  const fetchNotifications = useCallback(async () => {
    if (!memberId) return;
    try {
      const response = await ApiService.getNotifications(memberId);
      const notifs = response.notifications || response || [];
      const unread = notifs.filter(n => !n.read).length;

      setNotifications(notifs);
      setUnreadCount(unread);
      setBadgeCount(unread);

      // Ilk yuklemeden sonra yeni bildirim gelirse ses cal
      if (!isInitialLoad.current && unread > previousUnreadRef.current) {
        playNotificationSound();
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
      const notifs = [];
      let unread = 0;
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        notifs.push(data);
        if (!data.read) unread++;
      });

      setNotifications(notifs);
      setUnreadCount(unread);
      setBadgeCount(unread);

      // Play sound only when new unread notifications arrive after initial load
      if (!isInitialLoad.current && unread > previousUnreadRef.current) {
        playNotificationSound();
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
