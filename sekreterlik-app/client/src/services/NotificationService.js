import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import FirebaseApiService from '../utils/FirebaseApiService';
import { queueFcmNotification } from '../utils/fcmTokenManager';

// =====================================================
// Koleksiyon isimleri
// =====================================================
const MASTER_NOTIFICATIONS = 'master_notifications';
const USER_NOTIFICATIONS = 'user_notifications';

// =====================================================
// Bildirim Tipleri
// =====================================================
export const NOTIFICATION_TYPES = {
  ANNOUNCEMENT: 'announcement',
  MEETING_INVITE: 'meeting_invite',
  EVENT_INVITE: 'event_invite',
  POLL_INVITE: 'poll_invite',
  ELECTION_UPDATE: 'election_update',
  // Geriye uyumluluk
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
// Yardimci: Hedef kullanicilari coz
// =====================================================
async function resolveTargetUsers(target) {
  if (!target || !target.type) {
    return await getAllMemberIds();
  }

  switch (target.type) {
    case TARGET_TYPES.ALL:
      return await getAllMemberIds();

    case TARGET_TYPES.REGION:
      return await getMemberIdsByRegion(target.value);

    case TARGET_TYPES.ROLE:
      return await getMemberIdsByRole(target.value);

    case TARGET_TYPES.SINGLE:
      return target.value ? [target.value] : [];

    default:
      return [];
  }
}

async function getAllMemberIds() {
  try {
    const members = await FirebaseApiService.getMembers(false);
    return (members || [])
      .map((m) => String(m.id || m.memberId || '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('[NotificationService] getAllMemberIds error:', error);
    return [];
  }
}

async function getMemberIdsByRegion(regionName) {
  try {
    const members = await FirebaseApiService.getMembers(false);
    return (members || [])
      .filter((m) => m.region === regionName)
      .map((m) => String(m.id || m.memberId || '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('[NotificationService] getMemberIdsByRegion error:', error);
    return [];
  }
}

async function getMemberIdsByRole(positionName) {
  try {
    const members = await FirebaseApiService.getMembers(false);
    return (members || [])
      .filter((m) => m.position === positionName || m.gorev === positionName)
      .map((m) => String(m.id || m.memberId || '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('[NotificationService] getMemberIdsByRole error:', error);
    return [];
  }
}

// =====================================================
// Push Notification Gonder
// =====================================================
async function sendPushNotifications(userIds, { title, body, type, url }) {
  try {
    console.error('[PUSH-SEND] Starting push for', userIds.length, 'users:', userIds);
    var subscriptions = [];
    for (var i = 0; i < userIds.length; i++) {
      try {
        console.error('[PUSH-SEND] Reading push_tokens for:', userIds[i]);
        var tokenDoc = await getDoc(doc(db, 'push_tokens', userIds[i]));
        console.error('[PUSH-SEND] Token exists:', tokenDoc.exists(), 'data:', tokenDoc.exists() ? Object.keys(tokenDoc.data()) : 'N/A');
        if (tokenDoc.exists() && tokenDoc.data().subscription && tokenDoc.data().isActive) {
          subscriptions.push(tokenDoc.data().subscription);
        }
      } catch (e) {
        console.error('[PUSH-SEND] Token read error:', e.message);
      }
    }

    console.error('[PUSH-SEND] Total subscriptions found:', subscriptions.length);
    if (subscriptions.length === 0) return;

    // Cloud Function HTTP endpoint'ine POST (maliisler: /api/send-push)
    var PUSH_URL = 'https://sendpush-bsrvxijkia-ew.a.run.app';

    try {
      var response = await fetch(PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: subscriptions,
          title: title || 'Yeni Bildirim',
          body: body || '',
          data: { type: type || 'general', url: url || '/notifications' },
        }),
      });

      if (response.ok) {
        var result = await response.json();
        console.log('[Push] Sent:', result.sent, 'failed:', result.failed);
        return;
      }
    } catch (pushErr) {
      console.warn('[Push] Cloud Function push failed:', pushErr.message);
    }

    // Fallback: Service Worker ile dogrudan bildirim goster
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
            { action: 'close', title: 'Kapat' },
          ],
        });
      } catch (_) {
        // SW fallback basarisiz
      }
    }
  } catch (error) {
    console.warn('[Push] Push notification error:', error);
  }
}

// =====================================================
// PUBLIC API
// =====================================================

class NotificationService {
  /**
   * Bildirim olustur ve fan-out ile dagit.
   * master_notifications + user_notifications/{userId}/items/
   * ESKİ notifications koleksiyonuna YAZMAZ.
   */
  static async createNotification({ title, body, type, target, url, scheduledAt, data }) {
    try {
      // Master bildirim yaz
      const masterRef = doc(collection(db, MASTER_NOTIFICATIONS));
      const now = new Date().toISOString();

      const masterData = {
        title,
        body,
        type: type || NOTIFICATION_TYPES.ANNOUNCEMENT,
        target: target || { type: TARGET_TYPES.ALL },
        url: url || null,
        scheduledAt: scheduledAt || null,
        createdAt: now,
        status: scheduledAt ? 'scheduled' : 'sent',
        ...(data ? { data } : {}),
      };

      await setDoc(masterRef, masterData);

      // Zamanli gonderim ise sadece master kaydet
      if (scheduledAt && new Date(scheduledAt) > new Date()) {
        return { success: true, masterId: masterRef.id, targetCount: 0, status: 'scheduled' };
      }

      // Fan-out: hedef kullanicilara dagit — writeBatch ile toplu yazma
      const targetUsers = await resolveTargetUsers(target);
      console.log('[NotificationService] Fan-out to', targetUsers.length, 'users');

      // Firestore writeBatch max 500 islem destekler, chunk'layalim
      const BATCH_SIZE = 450;
      let successCount = 0;

      for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
        const chunk = targetUsers.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const userId of chunk) {
          const userNotifRef = doc(db, USER_NOTIFICATIONS, userId, 'items', masterRef.id);
          batch.set(userNotifRef, {
            notificationId: masterRef.id,
            title,
            body,
            type: type || NOTIFICATION_TYPES.ANNOUNCEMENT,
            url: url || null,
            isRead: false,
            createdAt: now,
            ...(data ? data : {}),
          });
        }

        await batch.commit();
        successCount += chunk.length;
      }

      // Push notification gonder (non-blocking)
      try {
        await sendPushNotifications(targetUsers, { title, body, type, url });
      } catch (pushErr) {
        console.warn('[NotificationService] Push error (non-blocking):', pushErr);
      }

      // FCM push notification kuyruguna ekle (uygulama kapali/arka planda bile gelsin)
      try {
        await queueFcmNotification({ userIds: targetUsers, title, body, type, url });
      } catch (fcmErr) {
        console.warn('[NotificationService] FCM queue error (non-blocking):', fcmErr);
      }

      return { success: true, masterId: masterRef.id, targetCount: successCount, status: 'sent' };
    } catch (error) {
      console.error('[NotificationService] createNotification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hedef kullanici sayisini hesapla (onizleme icin)
   */
  static async getTargetCount(target) {
    try {
      const users = await resolveTargetUsers(target);
      return users.length;
    } catch (error) {
      console.error('[NotificationService] getTargetCount error:', error);
      return 0;
    }
  }

  /**
   * Tek bir bildirimi okundu yap — user_notifications subcollection
   */
  static async markAsRead(userId, notificationId) {
    try {
      const ref = doc(db, USER_NOTIFICATIONS, userId, 'items', notificationId);
      await updateDoc(ref, {
        isRead: true,
        readAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (error) {
      console.error('[NotificationService] markAsRead error:', error);
      return { success: false };
    }
  }

  /**
   * Tum okunmamis bildirimleri okundu yap — writeBatch ile toplu
   */
  static async markAllAsRead(userId) {
    try {
      const itemsRef = collection(db, USER_NOTIFICATIONS, userId, 'items');
      const q = query(itemsRef, where('isRead', '==', false));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return { success: true };

      const batch = writeBatch(db);
      const now = new Date().toISOString();
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { isRead: true, readAt: now });
      });
      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error('[NotificationService] markAllAsRead error:', error);
      return { success: false };
    }
  }

  /**
   * Tek bir bildirimi sil — user_notifications subcollection
   */
  static async deleteNotification(userId, notificationId) {
    try {
      const ref = doc(db, USER_NOTIFICATIONS, userId, 'items', notificationId);
      await deleteDoc(ref);
      return { success: true };
    } catch (error) {
      console.error('[NotificationService] deleteNotification error:', error);
      return { success: false };
    }
  }

  /**
   * Tum bildirimleri sil — writeBatch ile toplu
   */
  static async deleteAllNotifications(userId) {
    try {
      const itemsRef = collection(db, USER_NOTIFICATIONS, userId, 'items');
      const snapshot = await getDocs(itemsRef);
      if (snapshot.empty) return { success: true };

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error('[NotificationService] deleteAllNotifications error:', error);
      return { success: false };
    }
  }

  /**
   * Okunmamis bildirim sayisi — user_notifications subcollection
   */
  static async getUnreadCount(userId) {
    try {
      const itemsRef = collection(db, USER_NOTIFICATIONS, userId, 'items');
      const q = query(itemsRef, where('isRead', '==', false));
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('[NotificationService] getUnreadCount error:', error);
      return 0;
    }
  }

  /**
   * Real-time bildirim dinle — user_notifications/{userId}/items/ onSnapshot
   * Callback'e bildirim listesi doner.
   * Unsubscribe fonksiyonu dondurur.
   */
  static subscribeToNotifications(userId, callback) {
    const itemsRef = collection(db, USER_NOTIFICATIONS, userId, 'items');
    const q = query(itemsRef, orderBy('createdAt', 'desc'), limit(50));

    return onSnapshot(
      q,
      (snapshot) => {
        const results = [];
        snapshot.forEach((docSnap) => {
          results.push({
            id: docSnap.id,
            notificationId: docSnap.id,
            ...docSnap.data(),
          });
        });
        callback(results);
      },
      (error) => {
        console.error('[NotificationService] subscribeToNotifications error:', error);
        callback([]);
      }
    );
  }

  // =====================================================
  // Admin: Gonderim gecmisi
  // =====================================================
  static async getNotificationHistory(limitCount = 50) {
    try {
      const q = query(
        collection(db, MASTER_NOTIFICATIONS),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } catch (error) {
      console.error('[NotificationService] getNotificationHistory error:', error);
      return [];
    }
  }

  // Zamanli bildirimleri getir
  static async getScheduledNotifications() {
    try {
      const q = query(
        collection(db, MASTER_NOTIFICATIONS),
        where('status', '==', 'scheduled'),
        orderBy('scheduledAt', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } catch (error) {
      console.error('[NotificationService] getScheduledNotifications error:', error);
      return [];
    }
  }

  // Zamanli bildirimi iptal et
  static async cancelScheduledNotification(masterId) {
    try {
      await updateDoc(doc(db, MASTER_NOTIFICATIONS, masterId), { status: 'cancelled' });
      return { success: true };
    } catch (error) {
      console.error('[NotificationService] cancelScheduledNotification error:', error);
      return { success: false };
    }
  }
}

export default NotificationService;
