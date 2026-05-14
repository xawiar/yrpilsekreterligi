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
import { db, VAPID_KEY } from '../config/firebase';
import FirebaseApiService from '../utils/FirebaseApiService';
import { queueFcmNotification } from '../utils/fcmTokenManager';
import { getMemberId, getAuthUid } from '../utils/normalizeId';

// =====================================================
// Anonim ziyaretci icin localStorage anahtari
// =====================================================
const ANON_PUSH_ID_KEY = 'anon_push_id';
const ANON_PUSH_DISMISSED_KEY = 'anon_push_dismissed';

// VAPID key'i Uint8Array'e cevir (Web Push standardi)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = (typeof window !== 'undefined' ? window.atob(base64) : atob(base64));
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Basit UUID v4 — crypto varsa onu kullan, yoksa fallback
function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Anonim ziyaretci push aboneligi.
 * - localStorage'da anon_push_id yoksa anon_<uuid> uretir
 * - Service Worker push subscription olusturur
 * - push_tokens/{anonId} dokumanina yazar (isAnonymous: true)
 * Returns: { success, anonId, alreadySubscribed, error }
 */
export async function subscribeAnonymousPush() {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'no-window' };
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      return { success: false, error: 'unsupported' };
    }

    // Permission iste
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return { success: false, error: 'permission-denied' };
    }

    // anonId al/uret
    let anonId = null;
    try {
      anonId = localStorage.getItem(ANON_PUSH_ID_KEY);
    } catch (_) { /* private mode vs */ }
    if (!anonId) {
      anonId = `anon_${generateUuid()}`;
      try { localStorage.setItem(ANON_PUSH_ID_KEY, anonId); } catch (_) {}
    }

    // SW main.jsx'te register edildi — burada sadece hazır olmasını bekle.
    // Tek register noktası kuralı: aynı scope'ta yarışan register'ları engelle.
    const registration = await navigator.serviceWorker.ready;

    // Mevcut subscription varsa onu kullan
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
    }

    // Firestore'a yaz (push_tokens/{anonId})
    // subscription'i hem object hem JSON string olarak sakla — sendPush iki turunu de destekler
    const subJson = JSON.parse(JSON.stringify(subscription));
    await setDoc(doc(db, 'push_tokens', anonId), {
      subscription: subJson,
      isActive: true,
      isAnonymous: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || '',
    });

    return { success: true, anonId };
  } catch (error) {
    console.error('[NotificationService] subscribeAnonymousPush error:', error);
    return { success: false, error: error?.message || 'unknown' };
  }
}

/**
 * Anonim aboneleri getir (admin paneli icin).
 * push_tokens icinde isAnonymous=true dokumanlari dondurur.
 */
export async function getAnonymousSubscribers() {
  try {
    const q = query(collection(db, 'push_tokens'), where('isAnonymous', '==', true));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.isActive !== false && data.subscription) {
        list.push({ id: d.id, ...data });
      }
    });
    return list;
  } catch (error) {
    console.error('[NotificationService] getAnonymousSubscribers error:', error);
    return [];
  }
}

/**
 * Tum anonim abonelere push gonder (admin).
 * Returns: { success, sentCount, total }
 */
export async function sendPushToAnonymousSubscribers({ title, body, url, image, type, masterNotificationId }) {
  try {
    const subscribers = await getAnonymousSubscribers();
    if (subscribers.length === 0) {
      return { success: true, sentCount: 0, total: 0 };
    }

    const subscriptions = [];
    const seenEndpoints = new Set();
    for (const s of subscribers) {
      let sub = s.subscription;
      if (typeof sub === 'string') {
        try { sub = JSON.parse(sub); } catch (_) { sub = null; }
      }
      if (sub && sub.endpoint && !seenEndpoints.has(sub.endpoint)) {
        subscriptions.push(sub);
        seenEndpoints.add(sub.endpoint);
      }
    }

    if (subscriptions.length === 0) {
      return { success: true, sentCount: 0, total: subscribers.length };
    }

    const PUSH_URL = 'https://sendpush-bsrvxijkia-ew.a.run.app';

    // Branding'den icon/badge/image/prefix oku
    let notifIcon = '';
    let notifBadge = '';
    let notifImage = '';
    let titlePrefix = '';
    try {
      const brandingMod = await import('../utils/brandingLoader');
      const brand = brandingMod.getBrandingSettings ? brandingMod.getBrandingSettings() : null;
      if (brand) {
        notifIcon = brand.notificationIconUrl || brand.icon192Url || brand.logoUrl || '';
        notifBadge = brand.badgeUrl || brand.icon192Url || '';
        notifImage = brand.notificationImageUrl || '';
        titlePrefix = (brand.notificationTitlePrefix || '').trim();
      }
    } catch (_) { /* ignore */ }

    // Effective image: admin panel'den gelirse onu, yoksa branding default
    const effImage = image || notifImage || '';
    const baseTitle = title || 'Yeniden Refah Partisi';
    const effTitle = titlePrefix && !baseTitle.startsWith(titlePrefix)
      ? `${titlePrefix} — ${baseTitle}`
      : baseTitle;

    const anonData = {
      type: type || 'announcement',
      url: url || '/',
      icon: notifIcon,
      badge: notifBadge,
      image: effImage
    };
    if (type === 'update') anonData.action = 'app-update';

    const authHeaders = await getAdminAuthHeaders();
    const response = await fetchWithRetry(PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        subscriptions,
        title: effTitle,
        body: body || '',
        icon: notifIcon || undefined,
        badge: notifBadge || undefined,
        image: effImage || undefined,
        data: anonData,
        masterNotificationId: masterNotificationId || null,
        deliveryChannel: 'anonymous',
      }),
    });

    if (response && response.ok) {
      return { success: true, sentCount: subscriptions.length, total: subscribers.length };
    }
    if (response && (response.status === 401 || response.status === 403)) {
      return { success: false, sentCount: 0, total: subscribers.length, error: 'unauthorized' };
    }
    if (response && response.status === 429) {
      return { success: false, sentCount: 0, total: subscribers.length, error: 'rate-limited' };
    }
    return { success: false, sentCount: 0, total: subscribers.length, error: 'push-endpoint-failed' };
  } catch (error) {
    console.error('[NotificationService] sendPushToAnonymousSubscribers error:', error);
    return { success: false, sentCount: 0, total: 0, error: error?.message || 'unknown' };
  }
}

export const ANON_PUSH_KEYS = {
  ID: ANON_PUSH_ID_KEY,
  DISMISSED: ANON_PUSH_DISMISSED_KEY,
};

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
  CHIEF_OBSERVERS: 'chief_observers',
  NEIGHBORHOOD_REPS: 'neighborhood_reps',
  // FAZ 3.2: Hiyerarşik hedefleme — Districts/Neighborhoods/Villages koleksiyonlarına bağlı
  DISTRICT: 'district',           // value: districtId
  NEIGHBORHOOD: 'neighborhood',   // value: neighborhoodId
  VILLAGE: 'village',             // value: villageId
  ANONYMOUS_ONLY: 'anonymous_only', // sadece anonim aboneler (login değil)
  // Kombine: { roles: [...], districtIds: [...], neighborhoodIds: [...], villageIds: [...] }
  COMBINED: 'combined',
};

// =====================================================
// Yardimci: notification type → preference key mapping
// (useNotificationPreferences.js ile uyumlu)
// =====================================================
function getPreferenceKeyForType(type) {
  if (!type) return null;
  const t = String(type).toLowerCase();
  if (t === 'meeting' || t === 'meeting_reminder' || t === 'meeting_invite') return 'meeting';
  if (t === 'event' || t === 'event_reminder' || t === 'event_invite') return 'event';
  if (t === 'election' || t === 'election_result' || t === 'election_update') return 'election';
  if (t === 'member' || t === 'new_member') return 'member';
  return null;
}

// =====================================================
// Yardimci: notification_preferences koleksiyonundan opt-out edenleri filtrele
// Doc yoksa veya field yoksa → varsayilan true (gonder)
// =====================================================
async function filterByPreferences(userIds, type) {
  if (!Array.isArray(userIds) || userIds.length === 0) return userIds || [];
  const prefKey = getPreferenceKeyForType(type);
  // Bilinmeyen tip — filtrelenmez
  if (!prefKey && !type) return userIds;

  try {
    // Tum preferences'lari tek seferde oku, in-memory map olustur
    const prefsSnap = await getDocs(collection(db, 'notification_preferences'));
    const prefsMap = {};
    prefsSnap.forEach((d) => {
      prefsMap[String(d.id)] = d.data() || {};
    });

    return userIds.filter((uid) => {
      const prefs = prefsMap[String(uid)];
      if (!prefs) return true; // doc yok → varsayilan goster
      // Hem mapped key hem direkt type'a bak
      if (prefKey && prefs[prefKey] === false) return false;
      if (type && prefs[type] === false) return false;
      return true;
    });
  } catch (error) {
    console.warn('[NotificationService] filterByPreferences error (non-blocking):', error);
    return userIds; // hata durumunda guvenli taraf — gonder
  }
}

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

    case TARGET_TYPES.CHIEF_OBSERVERS:
      return await getChiefObserverIds();

    case TARGET_TYPES.NEIGHBORHOOD_REPS:
      return await getNeighborhoodRepresentativeIds();

    // FAZ 3.2: Hiyerarşik hedefleme
    case TARGET_TYPES.DISTRICT:
      return await getMemberIdsByLocation({ districtIds: [target.value].filter(Boolean) });

    case TARGET_TYPES.NEIGHBORHOOD:
      return await getMemberIdsByLocation({ neighborhoodIds: [target.value].filter(Boolean) });

    case TARGET_TYPES.VILLAGE:
      return await getMemberIdsByLocation({ villageIds: [target.value].filter(Boolean) });

    case TARGET_TYPES.ANONYMOUS_ONLY:
      // Anonimler member değil — boş döner; sendPushToAnonymousSubscribers
      // ayrıca ALL veya ANONYMOUS_ONLY hedeflerinde çalışır.
      return [];

    case TARGET_TYPES.COMBINED:
      return await getMemberIdsByCombined(target.value || {});

    default:
      return [];
  }
}

// FAZ 3.2: Konum-bazlı üye filtreleme (ilçe/mahalle/köy ID listeleri)
// Member dokümanında district_id/neighborhood_id/village_id alanları olduğunu varsayar.
// Eski format (region string) için region geri uyum: districtName/neighborhoodName eşitse de filtreden geçer.
async function getMemberIdsByLocation({ districtIds, neighborhoodIds, villageIds }) {
  try {
    const members = await FirebaseApiService.getMembers(false);
    const dIds = (districtIds || []).map(String);
    const nIds = (neighborhoodIds || []).map(String);
    const vIds = (villageIds || []).map(String);
    const hasAnyFilter = dIds.length > 0 || nIds.length > 0 || vIds.length > 0;
    if (!hasAnyFilter) return [];

    return (members || [])
      .filter((m) => {
        const mDid = String(m.district_id || m.districtId || '');
        const mNid = String(m.neighborhood_id || m.neighborhoodId || '');
        const mVid = String(m.village_id || m.villageId || '');
        if (dIds.length && !dIds.includes(mDid)) return false;
        if (nIds.length && !nIds.includes(mNid)) return false;
        if (vIds.length && !vIds.includes(mVid)) return false;
        return true;
      })
      .map((m) => String(m.id || m.memberId || '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('[NotificationService] getMemberIdsByLocation error:', error);
    return [];
  }
}

// FAZ 3.2: Kombine filtre — roller + bölge ID'leri (AND mantığı)
// value: { roles: ['Mahalle Sorumlusu', ...], districtIds: [...], neighborhoodIds: [...], villageIds: [...] }
async function getMemberIdsByCombined(value) {
  try {
    const members = await FirebaseApiService.getMembers(false);
    const roles = Array.isArray(value.roles) ? value.roles.filter(Boolean) : [];
    const dIds = Array.isArray(value.districtIds) ? value.districtIds.map(String) : [];
    const nIds = Array.isArray(value.neighborhoodIds) ? value.neighborhoodIds.map(String) : [];
    const vIds = Array.isArray(value.villageIds) ? value.villageIds.map(String) : [];

    return (members || [])
      .filter((m) => {
        if (roles.length > 0) {
          const mRole = m.position || m.gorev || m.role || '';
          if (!roles.includes(mRole)) return false;
        }
        if (dIds.length > 0) {
          const mDid = String(m.district_id || m.districtId || '');
          if (!dIds.includes(mDid)) return false;
        }
        if (nIds.length > 0) {
          const mNid = String(m.neighborhood_id || m.neighborhoodId || '');
          if (!nIds.includes(mNid)) return false;
        }
        if (vIds.length > 0) {
          const mVid = String(m.village_id || m.villageId || '');
          if (!vIds.includes(mVid)) return false;
        }
        return true;
      })
      .map((m) => String(m.id || m.memberId || '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('[NotificationService] getMemberIdsByCombined error:', error);
    return [];
  }
}

// Başmüşahit ID'leri — ballot_box_observers'tan TC al, member_users'tan eşleştir
async function getChiefObserverIds() {
  try {
    const obsSnap = await getDocs(collection(db, 'ballot_box_observers'));
    const chiefTcs = [];
    obsSnap.forEach((d) => {
      const data = d.data();
      if (data.is_chief_observer && data.tc) {
        chiefTcs.push(String(data.tc).trim());
      }
    });

    // Capabilities Model: müşahit yetkisi userType='musahit' VEYA observerId dolu
    const muSnap = await getDocs(collection(db, 'member_users'));
    const ids = [];
    muSnap.forEach((d) => {
      const data = d.data();
      const hasObserverCapability = data.userType === 'musahit' || !!data.observerId;
      if (hasObserverCapability && data.tc && chiefTcs.includes(String(data.tc).trim())) {
        const memberId = data.observerId || d.id;
        ids.push(String(memberId));
      }
    });
    return ids;
  } catch (error) {
    console.error('[NotificationService] getChiefObserverIds error:', error);
    return [];
  }
}

// Mahalle Temsilcisi ID'leri — neighborhood_representatives koleksiyonu
async function getNeighborhoodRepresentativeIds() {
  try {
    const snap = await getDocs(collection(db, 'neighborhood_representatives'));
    return snap.docs.map((d) => String(d.id));
  } catch (error) {
    console.error('[NotificationService] getNeighborhoodRepresentativeIds error:', error);
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
      // 401/403/429 → retry'a gerek yok, hemen dön
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        return res;
      }
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (err) {
      if (i >= retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Cloud Function admin endpoint'leri için Authorization header üret
// Auth token ile sendPush admin yetkili gönderim sağlar.
async function getAdminAuthHeaders() {
  try {
    const { auth } = await import('../config/firebase');
    const user = auth?.currentUser;
    if (!user) return {};
    const idToken = await user.getIdToken();
    return { Authorization: 'Bearer ' + idToken };
  } catch (_) {
    return {};
  }
}

// =====================================================
// FAZ 3.3 — Anket Bildirimi (Soapbox pattern)
// =====================================================
/**
 * Anket bildirimini hedef kullanıcılara gönderir.
 * Cloud Function sendPollPush her recipient için ayrı HMAC voteToken üretir.
 *
 * @param {object} params
 *   - userIds: hedef üye ID listesi (subscription'ları push_tokens'tan topar)
 *   - includeAnonymous: anonim aboneleri de dahil et
 *   - pollId, pollTitle, pollBody, pollOptions
 *   - masterNotificationId
 */
export async function sendPollPushNotification({
  userIds = [],
  includeAnonymous = false,
  pollId,
  pollTitle,
  pollBody,
  pollOptions,
  masterNotificationId,
}) {
  if (!pollId || !pollTitle || !Array.isArray(pollOptions) || pollOptions.length === 0) {
    return { success: false, error: 'invalid-poll-data' };
  }

  // 1) Hedef üyelerden subscription'ları topla
  const recipients = [];
  const seenEndpoints = new Set();

  // memberId → authUid mapping (push_tokens authUid ile id'leniyor)
  let memberToAuth = {};
  try {
    const muSnap = await getDocs(collection(db, 'member_users'));
    muSnap.forEach((d) => {
      const data = d.data();
      const mid = getMemberId(data) || String(d.id || '');
      const authUid = getAuthUid(data) || '';
      if (mid && authUid) memberToAuth[mid] = authUid;
    });
  } catch (_) { /* skip */ }

  for (const uid of userIds) {
    const candidateIds = [String(uid)];
    if (memberToAuth[uid]) candidateIds.push(memberToAuth[uid]);
    for (const cid of candidateIds) {
      try {
        const tokenDoc = await getDoc(doc(db, 'push_tokens', cid));
        if (tokenDoc.exists()) {
          const tokenData = tokenDoc.data();
          if (tokenData.subscription && tokenData.isActive !== false) {
            let sub = tokenData.subscription;
            if (typeof sub === 'string') {
              try { sub = JSON.parse(sub); } catch (_) { sub = null; }
            }
            if (sub && sub.endpoint && !seenEndpoints.has(sub.endpoint)) {
              recipients.push({
                subscription: sub,
                subject: `user_${cid}`,
              });
              seenEndpoints.add(sub.endpoint);
              break;
            }
          }
        }
      } catch (_) { /* skip */ }
    }
  }

  // 2) Anonim aboneler — opsiyonel
  if (includeAnonymous) {
    try {
      const anonSubs = await getAnonymousSubscribers();
      for (const a of anonSubs) {
        let sub = a.subscription;
        if (typeof sub === 'string') {
          try { sub = JSON.parse(sub); } catch (_) { sub = null; }
        }
        if (sub && sub.endpoint && !seenEndpoints.has(sub.endpoint)) {
          recipients.push({
            subscription: sub,
            subject: a.id, // 'anon_xxx' formatında
          });
          seenEndpoints.add(sub.endpoint);
        }
      }
    } catch (_) { /* skip */ }
  }

  if (recipients.length === 0) {
    return { success: true, sentCount: 0, total: 0 };
  }

  // 3) Branding'den icon/badge oku
  let notifIcon = '';
  let notifBadge = '';
  let titlePrefix = '';
  try {
    const brandingMod = await import('../utils/brandingLoader');
    const brand = brandingMod.getBrandingSettings ? brandingMod.getBrandingSettings() : null;
    if (brand) {
      notifIcon = brand.notificationIconUrl || brand.icon192Url || brand.logoUrl || '';
      notifBadge = brand.badgeUrl || brand.icon192Url || '';
      titlePrefix = (brand.notificationTitlePrefix || '').trim();
    }
  } catch (_) { /* ignore */ }

  const effTitle = titlePrefix && pollTitle.indexOf(titlePrefix) !== 0
    ? `${titlePrefix} — ${pollTitle}`
    : pollTitle;

  // 4) Cloud Function sendPollPush'a POST
  const POLL_PUSH_URL = 'https://sendpollpush-bsrvxijkia-ew.a.run.app';
  const authHeaders = await getAdminAuthHeaders();

  try {
    const response = await fetchWithRetry(POLL_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        recipients,
        pollId,
        pollTitle: effTitle,
        pollBody: pollBody || '',
        pollOptions,
        icon: notifIcon || undefined,
        badge: notifBadge || undefined,
        masterNotificationId: masterNotificationId || null,
        deliveryChannel: 'user',
      }),
    });

    if (response && response.ok) {
      return { success: true, sentCount: recipients.length, total: recipients.length };
    }
    if (response && (response.status === 401 || response.status === 403)) {
      return { success: false, error: 'unauthorized' };
    }
    return { success: false, error: 'poll-push-endpoint-failed' };
  } catch (error) {
    console.error('[NotificationService] sendPollPushNotification error:', error);
    return { success: false, error: error?.message || 'unknown' };
  }
}

// =====================================================
// Push Notification Gonder
// =====================================================
export async function sendPushNotifications(userIds, { title, body, type, url, masterNotificationId }) {
  try {
    var subscriptions = [];

    // memberId → authUid mapping tablosu olustur (ID mismatch cozumu icin gerekli)
    var memberToAuth = {};
    try {
      var muSnap = await getDocs(collection(db, 'member_users'));
      muSnap.forEach(function(d) {
        var data = d.data();
        var mid = getMemberId(data) || String(d.id || '');
        var authUid = getAuthUid(data) || '';
        if (mid && authUid) memberToAuth[mid] = authUid;
      });
    } catch (e2) { /* skip */ }

    // Her userId icin push_token'i hedefli sorguyla bul (tum koleksiyonu okumak yerine)
    var seenEndpoints = new Set();
    for (var i = 0; i < userIds.length; i++) {
      var uid = String(userIds[i]);
      // Denenecek ID'ler: dogrudan uid ve mapping'den gelen authUid
      var candidateIds = [uid];
      if (memberToAuth[uid]) candidateIds.push(memberToAuth[uid]);

      for (var j = 0; j < candidateIds.length; j++) {
        try {
          var tokenDoc = await getDoc(doc(db, 'push_tokens', candidateIds[j]));
          if (tokenDoc.exists()) {
            var tokenData = tokenDoc.data();
            if (tokenData.subscription && tokenData.isActive && !seenEndpoints.has(tokenData.subscription.endpoint)) {
              subscriptions.push(tokenData.subscription);
              seenEndpoints.add(tokenData.subscription.endpoint);
              break; // Bu userId icin token bulundu, sonrakine gec
            }
          }
        } catch (e) { /* skip */ }
      }
    }

    if (subscriptions.length === 0) return;

    // Cloud Function HTTP endpoint'ine POST (maliisler: /api/send-push)
    var PUSH_URL = 'https://sendpush-bsrvxijkia-ew.a.run.app';

    // Branding ayarlarından notification icon/badge/image/prefix oku
    var notifIcon = '';
    var notifBadge = '';
    var notifImage = '';
    var titlePrefix = '';
    try {
      var brandingMod = await import('../utils/brandingLoader');
      var brand = brandingMod.getBrandingSettings ? brandingMod.getBrandingSettings() : null;
      if (brand) {
        notifIcon = brand.notificationIconUrl || brand.icon192Url || brand.logoUrl || '';
        notifBadge = brand.badgeUrl || brand.icon192Url || '';
        notifImage = brand.notificationImageUrl || '';
        titlePrefix = (brand.notificationTitlePrefix || '').trim();
      }
    } catch (_) { /* ignore */ }

    var baseTitle = title || 'Yeni Bildirim';
    var effTitle = titlePrefix && baseTitle.indexOf(titlePrefix) !== 0
      ? titlePrefix + ' — ' + baseTitle
      : baseTitle;

    // Type 'update' ise SW'ın özel reload akışını tetiklemek için action koy
    var pushData = {
      type: type || 'general',
      url: url || '/notifications',
      icon: notifIcon,
      badge: notifBadge,
      image: notifImage || undefined
    };
    if (type === 'update') pushData.action = 'app-update';

    try {
      var authHeaders = await getAdminAuthHeaders();
      var response = await fetchWithRetry(PUSH_URL, {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          authHeaders
        ),
        body: JSON.stringify({
          subscriptions: subscriptions,
          title: effTitle,
          body: body || '',
          icon: notifIcon || undefined,
          badge: notifBadge || undefined,
          image: notifImage || undefined,
          data: pushData,
          masterNotificationId: masterNotificationId || null,
          deliveryChannel: 'user',
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
  static async createNotification({ title, body, type, target, url, scheduledAt, data, pollId, pollOptions }) {
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
      const rawTargetUsers = await resolveTargetUsers(target);
      // notification_preferences koleksiyonundan opt-out edenleri filtrele
      const targetUsers = await filterByPreferences(rawTargetUsers, type);

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

      // FAZ 3.3 — Anket bildirimiyse sendPollPush kullan (HMAC voteToken'lı)
      const isPoll = type === NOTIFICATION_TYPES.POLL_INVITE && pollId &&
        Array.isArray(pollOptions) && pollOptions.length > 0;

      if (isPoll) {
        try {
          await sendPollPushNotification({
            userIds: targetUsers,
            includeAnonymous: !target || target.type === TARGET_TYPES.ALL ||
              target.type === TARGET_TYPES.ANONYMOUS_ONLY,
            pollId,
            pollTitle: title,
            pollBody: body,
            pollOptions,
            masterNotificationId: masterRef.id,
          });
        } catch (pollErr) {
          console.warn('[NotificationService] Poll push error (non-blocking):', pollErr);
        }
      } else {
        // Push notification gonder (non-blocking)
        // masterNotificationId Cloud Function'a iletiyor → master_notifications doc'una
        // delivery istatistikleri yazıyor (FAZ 4.2 observability).
        try {
          await sendPushNotifications(targetUsers, {
            title, body, type, url,
            masterNotificationId: masterRef.id,
          });
        } catch (pushErr) {
          console.warn('[NotificationService] Push error (non-blocking):', pushErr);
        }
      }

      // FCM push notification kuyruguna ekle (uygulama kapali/arka planda bile gelsin)
      try {
        await queueFcmNotification({ userIds: targetUsers, title, body, type, url });
      } catch (fcmErr) {
        console.warn('[NotificationService] FCM queue error (non-blocking):', fcmErr);
      }

      // Anonim abonelere gönder:
      // - target ALL (tüm üye + anonim)
      // - target ANONYMOUS_ONLY (sadece anonim, login olmayan)
      // - target boş/belirsiz (eski geriye uyum)
      // NOT: Anket bildirimleri sendPollPushNotification içinde anonim de yöneter,
      // burada tekrar göndermiyoruz.
      const shouldSendAnonymous = !isPoll && (!target ||
        target.type === TARGET_TYPES.ALL ||
        target.type === TARGET_TYPES.ANONYMOUS_ONLY);
      if (shouldSendAnonymous) {
        try {
          await sendPushToAnonymousSubscribers({
            title, body, url, type,
            image: data?.image,
            masterNotificationId: masterRef.id,
          });
        } catch (anonErr) {
          console.warn('[NotificationService] Anonim push error (non-blocking):', anonErr);
        }
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
