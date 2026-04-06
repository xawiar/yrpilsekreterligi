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
  serverTimestamp,
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
  [NOTIFICATION_TYPES.MEETING]: 'Toplantı',
  [NOTIFICATION_TYPES.MEETING_REMINDER]: 'Toplantı Hatırlatması',
  [NOTIFICATION_TYPES.EVENT]: 'Etkinlik',
  [NOTIFICATION_TYPES.EVENT_REMINDER]: 'Etkinlik Hatırlatması',
  [NOTIFICATION_TYPES.POLL]: 'Anket',
  [NOTIFICATION_TYPES.POLL_VOTE]: 'Anket Oyu',
  [NOTIFICATION_TYPES.MESSAGE]: 'Mesaj',
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
    const memberIds = (members || [])
      .map((m) => String(m.id || m.memberId || '').trim())
      .filter(Boolean);

    // Also include users who have push tokens but aren't in members
    // (e.g., admin users)
    try {
      const tokenSnap = await getDocs(collection(db, 'push_tokens'));
      tokenSnap.forEach((d) => {
        const tokenUserId = String(d.id);
        if (!memberIds.includes(tokenUserId)) {
          memberIds.push(tokenUserId);
        }
      });
    } catch (e) { /* skip */ }

    return memberIds;
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
// Retry helper for fetch calls
// =====================================================
async function fetchWithRetry(url, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (err) {
      if (i >= retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// =====================================================
// Push Notification Gonder
// =====================================================
async function sendPushNotifications(userIds, { title, body, type, url }) {
  try {
    var subscriptions = [];

    // Tum push_tokens'lari bir kez oku (ID eslestirme sorunu cozumu)
    var allTokens = {};
    try {
      var tokensSnap = await getDocs(collection(db, 'push_tokens'));
      tokensSnap.forEach(function(d) {
        var data = d.data();
        if (data.subscription && data.isActive) {
          allTokens[d.id] = data.subscription;
          if (data.userId) allTokens[String(data.userId)] = data.subscription;
        }
      });
    } catch (e) {
      console.warn('[Push] Token load error:', e.message);
    }

    // memberId → authUid mapping tablosu olustur
    var memberToAuth = {};
    try {
      var muSnap = await getDocs(collection(db, 'member_users'));
      muSnap.forEach(function(d) {
        var data = d.data();
        var mid = String(data.memberId || data.member_id || d.id || '');
        var authUid = data.authUid || data.auth_uid || '';
        if (mid && authUid) memberToAuth[mid] = authUid;
      });
    } catch (e2) { /* skip */ }

    // Her userId icin token bul
    for (var i = 0; i < userIds.length; i++) {
      var uid = String(userIds[i]);
      // 1. Direkt ID ile ara
      if (allTokens[uid]) {
        subscriptions.push(allTokens[uid]);
      }
      // 2. member_users mapping ile ara
      else if (memberToAuth[uid] && allTokens[memberToAuth[uid]]) {
        subscriptions.push(allTokens[memberToAuth[uid]]);
      }
    }

    if (subscriptions.length === 0) return;

    // Cloud Function HTTP endpoint'ine POST (maliisler: /api/send-push)
    var PUSH_URL = 'https://sendpush-bsrvxijkia-ew.a.run.app';

    try {
      var response = await fetchWithRetry(PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: subscriptions,
          title: title || 'Yeni Bildirim',
          body: body || '',
          data: { type: type || 'general', url: url || '/notifications' },
        }),
      });

      if (response && response.ok) {
        var result = await response.json();
        return;
      }
    } catch (pushErr) {
      console.warn('[Push] Cloud Function push failed after retries:', pushErr.message);
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
      // TIMESTAMP CONVENTION: Use serverTimestamp() for all Firestore writes.
      // This ensures consistent ordering regardless of client clock skew.
      // Field naming convention: camelCase (createdAt, updatedAt, readAt).

      const masterData = {
        title,
        body,
        type: type || NOTIFICATION_TYPES.ANNOUNCEMENT,
        target: target || { type: TARGET_TYPES.ALL },
        url: url || null,
        scheduledAt: scheduledAt || null,
        createdAt: serverTimestamp(),
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
            createdAt: serverTimestamp(),
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
        readAt: serverTimestamp(),
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
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { isRead: true, readAt: serverTimestamp() });
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
