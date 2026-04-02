import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { setBadgeCount } from '../utils/pwaBadge';
import { playNotificationSound } from '../utils/notificationSound';

// Firebase kullanımı kontrolü
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' ||
                     import.meta.env.VITE_USE_FIREBASE === true ||
                     String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

const useRealtimeNotifications = (memberId, enabled = true) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!memberId || !enabled || !db || !USE_FIREBASE) return;

    // Reset initial load flag whenever memberId changes
    isInitialLoad.current = true;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('memberId', 'in', [memberId, null]),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    let previousUnread = 0;

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
      if (!isInitialLoad.current && unread > previousUnread) {
        playNotificationSound();
      }
      isInitialLoad.current = false;
      previousUnread = unread;
    }, (error) => {
      console.error('Notification listener error:', error);
    });

    return () => unsubscribe();
  }, [memberId, enabled]);

  return { notifications, unreadCount };
};

export default useRealtimeNotifications;
