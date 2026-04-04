import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const NotificationsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const memberId = user?.memberId || user?.id || user?.uid;

  const fetchNotifications = useCallback(async () => {
    if (!memberId) return;
    try {
      setLoading(true);
      const response = await ApiService.getNotifications(memberId);
      if (response?.success && Array.isArray(response.notifications)) {
        setNotifications(response.notifications);
      } else if (Array.isArray(response)) {
        setNotifications(response);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast?.error?.('Bildirimler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [memberId, toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await ApiService.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!memberId) return;
    try {
      setMarkingAll(true);
      await ApiService.markAllNotificationsAsRead(memberId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast?.success?.('Tum bildirimler okundu olarak isaretlendi');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast?.error?.('Bildirimler isaretlenirken hata olustu');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await ApiService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast?.success?.('Bildirim silindi');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast?.error?.('Bildirim silinirken hata olustu');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Az once';
    if (diffMin < 60) return `${diffMin} dakika once`;
    if (diffHour < 24) return `${diffHour} saat once`;
    if (diffDay < 7) return `${diffDay} gun once`;
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'meeting':
      case 'meeting_reminder':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'event':
      case 'event_reminder':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'poll':
      case 'poll_vote':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'message':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const getTypeBgColor = (type) => {
    switch (type) {
      case 'meeting':
      case 'meeting_reminder':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'event':
      case 'event_reminder':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'poll':
      case 'poll_vote':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'message':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bildirimler</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {unreadCount} okunmamis bildirim
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
              bg-indigo-600 text-white hover:bg-indigo-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200"
          >
            {markingAll ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Isleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tumunu Okundu Yap
              </>
            )}
          </button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Bildiriminiz bulunmuyor</h3>
          <p className="text-gray-500 dark:text-gray-400">Yeni bildirimler burada gorunecektir.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all duration-200
                ${notification.read
                  ? 'border-gray-200 dark:border-gray-700'
                  : 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10'
                }`}
            >
              <div className="p-4 flex items-start gap-3">
                {/* Type Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getTypeBgColor(notification.type)}`}>
                  {getTypeIcon(notification.type)}
                </div>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm font-semibold truncate ${
                      notification.read
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {notification.title}
                    </h3>
                    {!notification.read && (
                      <span className="flex-shrink-0 w-2.5 h-2.5 bg-indigo-500 rounded-full mt-1.5"></span>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 ${
                    notification.read
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {notification.body}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDate(notification.created_at || notification.createdAt)}
                  </p>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(notification.id);
                  }}
                  className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Bildirimi Sil"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
