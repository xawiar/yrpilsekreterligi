import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import FirebaseService from './FirebaseService';
import FirebaseApiService from '../utils/FirebaseApiService';

// =====================================================
// Bildirim Tipleri (Madde 2)
// =====================================================
export const NOTIFICATION_TYPES = {
  ANNOUNCEMENT: 'announcement',
  MEETING_INVITE: 'meeting_invite',
  EVENT_INVITE: 'event_invite',
  POLL_INVITE: 'poll_invite',
  ELECTION_UPDATE: 'election_update',
  // Mevcut tipler (geriye uyumluluk)
  MEETING: 'meeting',
  MEETING_REMINDER: 'meeting_reminder',
  EVENT: 'event',
  EVENT_REMINDER: 'event_reminder',
  POLL: 'poll',
  POLL_VOTE: 'poll_vote',
  MESSAGE: 'message',
};

export const NOTIFICATION_TYPE_LABELS = {
  [NOTIFICATION_TYPES.ANNOUNCEMENT]: 'Duyuru',
  [NOTIFICATION_TYPES.MEETING_INVITE]: 'Toplanti Daveti',
  [NOTIFICATION_TYPES.EVENT_INVITE]: 'Etkinlik Daveti',
  [NOTIFICATION_TYPES.POLL_INVITE]: 'Anket Daveti',
  [NOTIFICATION_TYPES.ELECTION_UPDATE]: 'Secim Guncellemesi',
};

// Hedef tipleri
export const TARGET_TYPES = {
  ALL: 'all',
  REGION: 'region',
  ROLE: 'role',
  SINGLE: 'single',
};

// =====================================================
// NotificationService — Fan-out pattern (Madde 1, 3, 4, 5)
// =====================================================
class NotificationService {

  // Koleksiyon isimleri
  static COLLECTIONS = {
    MASTER_NOTIFICATIONS: 'master_notifications',
    USER_NOTIFICATIONS: 'user_notifications',
    NOTIFICATIONS: 'notifications', // mevcut koleksiyon (geriye uyumluluk)
  };

  // =====================================================
  // Madde 1: Fan-out pattern — Bildirim olustur ve dagit
  // =====================================================
  static async createNotification({ title, body, type, target, url, scheduledAt, data }) {
    try {
      const currentUser = await this._getCurrentUserId();

      // Master bildirim yaz
      const masterData = {
        title,
        body,
        type: type || NOTIFICATION_TYPES.ANNOUNCEMENT,
        target: target || { type: TARGET_TYPES.ALL },
        url: url || null,
        scheduledAt: scheduledAt || null,
        createdBy: currentUser,
        createdAt: new Date().toISOString(),
        status: scheduledAt ? 'scheduled' : 'sent',
        ...(data ? { data } : {}),
      };

      const masterId = await FirebaseService.create(
        this.COLLECTIONS.MASTER_NOTIFICATIONS,
        null,
        masterData,
        false
      );

      // Zamanli gonderim ise sadece master kaydet, dagitim yapma
      if (scheduledAt && new Date(scheduledAt) > new Date()) {
        return { success: true, masterId, targetCount: 0, status: 'scheduled' };
      }

      // Fan-out: hedef kullanicilara dagit (Madde 3)
      const targetUsers = await this.resolveTargetUsers(target);
      let successCount = 0;

      for (const userId of targetUsers) {
        try {
          // user_notifications/{userId}/items/ subcollection'a kopya yaz
          const userNotifRef = doc(db, `user_notifications/${userId}/items`, masterId);
          await setDoc(userNotifRef, {
            notificationId: masterId,
            title,
            body,
            type: type || NOTIFICATION_TYPES.ANNOUNCEMENT,
            url: url || null,
            read: false,  // Madde 4: per-user okundu durumu
            createdAt: new Date().toISOString(),
            ...(data ? data : {}),
          });

          // Geriye uyumluluk: mevcut notifications koleksiyonuna da yaz
          await FirebaseService.create(
            'notifications',
            null,
            {
              title,
              body,
              type: type || NOTIFICATION_TYPES.ANNOUNCEMENT,
              url: url || null,
              read: false,
              memberId: userId,
              masterNotificationId: masterId,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 gun
            },
            false
          );

          successCount++;
        } catch (err) {
          console.error(`Fan-out error for user ${userId}:`, err);
        }
      }

      // Madde 5: Push notification entegrasyonu
      try {
        await this._sendPushNotifications(targetUsers, { title, body, type, url });
      } catch (pushErr) {
        console.warn('Push notification error (non-blocking):', pushErr);
      }

      return { success: true, masterId, targetCount: successCount, status: 'sent' };
    } catch (error) {
      console.error('createNotification error:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // Madde 3: Hedefleme — resolveTargetUsers
  // =====================================================
  static async resolveTargetUsers(target) {
    if (!target || !target.type) {
      return await this._getAllMemberIds();
    }

    switch (target.type) {
      case TARGET_TYPES.ALL:
        return await this._getAllMemberIds();

      case TARGET_TYPES.REGION:
        return await this._getMemberIdsByRegion(target.value);

      case TARGET_TYPES.ROLE:
        return await this._getMemberIdsByRole(target.value);

      case TARGET_TYPES.SINGLE:
        return target.value ? [target.value] : [];

      default:
        return [];
    }
  }

  // Hedef kullanici sayisini hesapla (onizleme icin)
  static async getTargetCount(target) {
    try {
      const users = await this.resolveTargetUsers(target);
      return users.length;
    } catch (error) {
      console.error('getTargetCount error:', error);
      return 0;
    }
  }

  // =====================================================
  // Madde 4: Okundu/okunmadi per-user
  // =====================================================
  static async markAsRead(userId, notificationId) {
    try {
      // user_notifications subcollection'da okundu yap
      const userNotifRef = doc(db, `user_notifications/${userId}/items`, notificationId);
      await updateDoc(userNotifRef, { read: true });

      // Geriye uyumluluk: mevcut notifications koleksiyonunda da guncelle
      await FirebaseApiService.markNotificationAsRead(notificationId);

      return { success: true };
    } catch (error) {
      console.error('markAsRead error:', error);
      // Fallback: sadece eski sistemi guncelle
      return await FirebaseApiService.markNotificationAsRead(notificationId);
    }
  }

  static async markAllAsRead(userId) {
    try {
      // user_notifications subcollection'daki tum bildirimleri okundu yap
      const itemsRef = collection(db, `user_notifications/${userId}/items`);
      const q = query(itemsRef, where('read', '==', false));
      const snapshot = await getDocs(q);

      const promises = [];
      snapshot.forEach((docSnap) => {
        promises.push(updateDoc(docSnap.ref, { read: true }));
      });
      await Promise.all(promises);

      // Geriye uyumluluk
      await FirebaseApiService.markAllNotificationsAsRead(userId);

      return { success: true };
    } catch (error) {
      console.error('markAllAsRead error:', error);
      return await FirebaseApiService.markAllNotificationsAsRead(userId);
    }
  }

  static async deleteNotification(userId, notificationId) {
    try {
      // user_notifications subcollection'dan sil
      const userNotifRef = doc(db, `user_notifications/${userId}/items`, notificationId);
      await deleteDoc(userNotifRef);

      // Geriye uyumluluk
      await FirebaseApiService.deleteNotification(notificationId);

      return { success: true };
    } catch (error) {
      console.error('deleteNotification error:', error);
      return await FirebaseApiService.deleteNotification(notificationId);
    }
  }

  // =====================================================
  // Gonderim gecmisi (Madde 9)
  // =====================================================
  static async getNotificationHistory(limitCount = 50) {
    try {
      const masterNotifs = await FirebaseService.getAll(
        this.COLLECTIONS.MASTER_NOTIFICATIONS,
        {},
        false
      );

      if (!masterNotifs || masterNotifs.length === 0) {
        return [];
      }

      // Tarihe gore sirala ve limitle
      return masterNotifs
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, limitCount);
    } catch (error) {
      console.error('getNotificationHistory error:', error);
      return [];
    }
  }

  // Zamanli bildirimleri getir (Madde 10)
  static async getScheduledNotifications() {
    try {
      const masterNotifs = await FirebaseService.getAll(
        this.COLLECTIONS.MASTER_NOTIFICATIONS,
        {},
        false
      );

      return (masterNotifs || [])
        .filter(n => n.status === 'scheduled' && n.scheduledAt)
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    } catch (error) {
      console.error('getScheduledNotifications error:', error);
      return [];
    }
  }

  // Zamanli bildirimi iptal et
  static async cancelScheduledNotification(masterId) {
    try {
      await FirebaseService.update(
        this.COLLECTIONS.MASTER_NOTIFICATIONS,
        masterId,
        { status: 'cancelled' },
        false
      );
      return { success: true };
    } catch (error) {
      console.error('cancelScheduledNotification error:', error);
      return { success: false };
    }
  }

  // =====================================================
  // Yardimci metodlar
  // =====================================================

  static async _getCurrentUserId() {
    try {
      const { auth } = await import('../config/firebase');
      return auth.currentUser?.uid || null;
    } catch {
      return null;
    }
  }

  static async _getAllMemberIds() {
    try {
      const members = await FirebaseApiService.getMembers(false);
      return (members || [])
        .map(m => String(m.id || m.memberId || '').trim())
        .filter(Boolean);
    } catch (error) {
      console.error('_getAllMemberIds error:', error);
      return [];
    }
  }

  static async _getMemberIdsByRegion(regionName) {
    try {
      const members = await FirebaseApiService.getMembers(false);
      return (members || [])
        .filter(m => m.region === regionName)
        .map(m => String(m.id || m.memberId || '').trim())
        .filter(Boolean);
    } catch (error) {
      console.error('_getMemberIdsByRegion error:', error);
      return [];
    }
  }

  static async _getMemberIdsByRole(positionName) {
    try {
      const members = await FirebaseApiService.getMembers(false);
      return (members || [])
        .filter(m => m.position === positionName || m.gorev === positionName)
        .map(m => String(m.id || m.memberId || '').trim())
        .filter(Boolean);
    } catch (error) {
      console.error('_getMemberIdsByRole error:', error);
      return [];
    }
  }

  // Madde 5: Push notification gonder
  static async _sendPushNotifications(userIds, { title, body, type, url }) {
    try {
      // Push subscription'lari Firestore'dan getir
      const subscriptions = await FirebaseService.getAll('push_subscriptions', {}, false);
      if (!subscriptions || subscriptions.length === 0) {
        console.log('[Push] No push subscriptions found');
        return;
      }

      // Hedef kullanicilarin subscription'larini filtrele
      const targetSubs = subscriptions.filter(s => userIds.includes(s.userId));
      if (targetSubs.length === 0) {
        console.log('[Push] No matching subscriptions for target users');
        return;
      }

      console.log(`[Push] Sending push to ${targetSubs.length} subscriptions`);

      // Backend uzerinden gercek web-push gonder
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

      // Auth token al
      let authToken = null;
      try {
        authToken = localStorage.getItem('token');
      } catch (e) {
        // sessizce devam
      }

      const headers = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Subscription'lari web-push formatina cevir
      const formattedSubscriptions = targetSubs.map(sub => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        }
      }));

      try {
        // Backend push endpoint'ini kullan (send-direct: subscription'lari dogrudan gonder)
        const response = await fetch(`${API_BASE_URL}/push-subscriptions/send-direct`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title,
            body,
            subscriptions: formattedSubscriptions,
            data: { type: type || 'general', url: url || '/notifications' }
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`[Push] Backend push sent: ${result.sentCount || 0} successful`);
          return;
        }
        console.warn('[Push] Backend push endpoint returned:', response.status);
      } catch (backendErr) {
        console.warn('[Push] Backend push failed, falling back to direct notification:', backendErr.message);
      }

      // Fallback: Backend erisilemediyse, Service Worker uzerinden dogrudan bildirim goster
      // Bu sadece uygulama acikken calisir, ama hic bildirim gormemekten iyidir
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: type || 'general',
            renotify: true,
            vibrate: [200, 100, 200],
            requireInteraction: true,
            data: { type: type || 'general', url: url || '/notifications' },
            actions: [
              { action: 'view', title: 'Goruntule' },
              { action: 'close', title: 'Kapat' }
            ]
          });
          console.log('[Push] Fallback: Direct SW notification shown');
        } catch (swErr) {
          console.warn('[Push] Service Worker fallback failed:', swErr);
        }
      }
    } catch (error) {
      console.warn('[Push] Push notification send error:', error);
    }
  }
}

export default NotificationService;
