import React, { useState } from 'react';
import useRealtimeNotifications from '../hooks/useRealtimeNotifications';
import NotificationDrawer from './NotificationDrawer';

/**
 * Sağ panel için kompakt bildirim feed'i.
 * Son 5 bildirimi gösterir, "Tümünü gör" ile NotificationDrawer açar.
 */
const NotificationFeed = ({ userId, limit = 5 }) => {
  const { notifications, unreadCount } = useRealtimeNotifications(userId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const recent = (notifications || []).slice(0, limit);

  const formatRelative = (date) => {
    if (!date) return '';
    const d = date.toDate?.() || new Date(date);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'şimdi';
    if (min < 60) return `${min}dk`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}sa`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}g`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Bildirimler
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </h3>
          {(notifications?.length || 0) > limit && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-semibold"
            >
              Tümü →
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500">
              Henüz bildirim yok.
            </div>
          ) : (
            recent.map((n) => (
              <button
                key={n.id}
                onClick={() => setDrawerOpen(true)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition ${
                  !n.read ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {n.title && (
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                        {n.title}
                      </div>
                    )}
                    {n.body && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {n.body}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {formatRelative(n.created_at || n.createdAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <NotificationDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default NotificationFeed;
