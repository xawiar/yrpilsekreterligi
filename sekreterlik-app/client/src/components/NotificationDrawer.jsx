import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import useRealtimeNotifications from '../hooks/useRealtimeNotifications';
import ApiService from '../utils/ApiService';

// =====================================================
// Madde 12: Zaman damgasi
// =====================================================
const timeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Az once';
  if (minutes < 60) return `${minutes} dk once`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat once`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gun once`;
  if (days < 30) return `${Math.floor(days / 7)} hafta once`;
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

// =====================================================
// Madde 13: Tip bazli badge ikonlari
// =====================================================
const getTypeIcon = (type) => {
  switch (type) {
    case 'announcement':
      // Megafon
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      );
    case 'meeting_invite':
    case 'meeting':
    case 'meeting_reminder':
      // Takvim
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'event_invite':
    case 'event':
    case 'event_reminder':
      // Parti
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'poll_invite':
    case 'poll':
    case 'poll_vote':
      // Soru isareti / anket
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'election_update':
      // Sandik
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case 'message':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
};

const getTypeBgColor = (type) => {
  switch (type) {
    case 'announcement':
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
    case 'meeting_invite':
    case 'meeting':
    case 'meeting_reminder':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    case 'event_invite':
    case 'event':
    case 'event_reminder':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    case 'poll_invite':
    case 'poll':
    case 'poll_vote':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
    case 'election_update':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    case 'message':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
};

// =====================================================
// Madde 15: Bildirime tikla — navigasyon
// =====================================================
const getNavigationUrl = (notification, user) => {
  // Eger bildirimde url tanimli ise onu kullan
  if (notification.url) return notification.url;

  const isAdmin = user?.role === 'admin';
  const type = notification.type;

  // Admin icin dogrudan admin route'larina yonlendir
  if (isAdmin) {
    switch (type) {
      case 'announcement':
        return '/notifications';
      case 'meeting_invite':
      case 'meeting':
      case 'meeting_reminder':
        return '/meetings';
      case 'event_invite':
      case 'event':
      case 'event_reminder':
        return '/events';
      case 'poll_invite':
      case 'poll':
      case 'poll_vote':
        return '/settings?tab=polls';
      case 'election_update':
        return '/elections';
      case 'message':
        return '/notifications';
      default:
        return '/notifications';
    }
  }

  // Uye icin member-dashboard view'larina yonlendir
  switch (type) {
    case 'announcement':
      return '/notifications';
    case 'meeting_invite':
    case 'meeting':
    case 'meeting_reminder':
      return '/member-dashboard?view=meetings-page';
    case 'event_invite':
    case 'event':
    case 'event_reminder':
      return '/member-dashboard?view=events-page';
    case 'poll_invite':
    case 'poll':
    case 'poll_vote':
      return '/member-dashboard?view=dashboard';
    case 'election_update':
      return '/member-dashboard?view=election-preparation-page';
    case 'message':
      return '/notifications';
    default:
      return '/notifications';
  }
};

// =====================================================
// Madde 11: NotificationDrawer component
// =====================================================
const NotificationDrawer = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const memberId = user?.memberId || user?.id || user?.uid;
  const { notifications, unreadCount } = useRealtimeNotifications(memberId);
  const [markingAll, setMarkingAll] = useState(false);

  // ESC tusuna basinca kapat
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // Body scroll'u engelle
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Madde 14: Okundu yap
  const handleMarkAsRead = async (notificationId) => {
    try {
      await ApiService.markNotificationAsRead(notificationId);
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  // Madde 14: Tumunu okundu yap
  const handleMarkAllAsRead = async () => {
    if (!memberId) return;
    setMarkingAll(true);
    try {
      await ApiService.markAllNotificationsAsRead(memberId);
      toast?.success?.('Tum bildirimler okundu olarak isaretlendi');
    } catch (error) {
      console.error('Mark all as read error:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  // Madde 14: Sil
  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    try {
      await ApiService.deleteNotification(notificationId);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Madde 15: Tikla ve navigate et
  const handleClick = (notification) => {
    // Okunmamissa okundu yap
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    const url = getNavigationUrl(notification, user);
    navigate(url);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Drawer (Madde 11: Sagdan acilan panel) */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bildirimler</h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markingAll}
                    className="p-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Tumunu okundu yap"
                  >
                    {markingAll ? (
                      <span className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full inline-block"></span>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  onClick={() => { navigate('/notifications'); onClose(); }}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Tum bildirimler"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Bildirim Listesi (Madde 11) */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <svg className="w-16 h-16 text-gray-200 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Bildiriminiz bulunmuyor</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Yeni bildirimler burada gorunecektir</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleClick(notification)}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${
                        !notification.read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Tip ikonu (Madde 13) */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${getTypeBgColor(notification.type)}`}>
                          {getTypeIcon(notification.type)}
                        </div>

                        {/* Icerik */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm truncate ${
                              !notification.read
                                ? 'font-semibold text-gray-900 dark:text-white'
                                : 'font-medium text-gray-700 dark:text-gray-300'
                            }`}>
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!notification.read && (
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                              )}
                              {/* Sil butonu (Madde 14) */}
                              <button
                                onClick={(e) => handleDelete(e, notification.id)}
                                className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                                title="Sil"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs mt-0.5 line-clamp-2 ${
                            !notification.read
                              ? 'text-gray-600 dark:text-gray-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {notification.body || notification.message}
                          </p>
                          {/* Zaman damgasi (Madde 12) */}
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                            {timeAgo(notification.createdAt || notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                <button
                  onClick={() => { navigate('/notifications'); onClose(); }}
                  className="w-full py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  Tum Bildirimleri Gor
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationDrawer;
