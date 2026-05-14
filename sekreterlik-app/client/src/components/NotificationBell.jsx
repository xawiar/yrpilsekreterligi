import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useRealtimeNotifications from '../hooks/useRealtimeNotifications';
import NotificationDrawer from './NotificationDrawer';

/**
 * Çan ikonu + okunmamış sayısı badge'i + tıklayınca NotificationDrawer.
 * Reusable: ChiefObserver, Coordinator vb. dashboard'larda kullanılır.
 *
 * Props:
 * - className (opsiyonel) — ek CSS sınıfları (genelde renk/boyut için)
 * - iconClassName (opsiyonel) — SVG sınıfları (renk/boyut)
 */
const NotificationBell = ({
  className = 'p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition shadow-lg',
  iconClassName = 'w-6 h-6'
}) => {
  const { user } = useAuth();
  const memberId = user?.memberId || user?.id || user?.uid || user?.coordinatorId || user?.observerId || null;
  const { unreadCount } = useRealtimeNotifications(memberId);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative ${className}`}
        title="Bildirimler"
      >
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-md">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default NotificationBell;
