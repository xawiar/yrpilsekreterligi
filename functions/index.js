/**
 * Firebase Cloud Functions
 * 1. Member Users Sync with Firebase Auth
 * 2. Push Notification (web-push ile — maliisler referansi)
 */

const {onDocumentCreated, onDocumentUpdated, onDocumentDeleted} =
  require("firebase-functions/v2/firestore");
const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");
const CryptoJS = require("crypto-js");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore("yrpilsekreterligi");

const ENCRYPTION_KEY_SECRET = defineSecret("ENCRYPTION_KEY");
const VAPID_PUBLIC_KEY_SECRET = defineSecret("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY_SECRET = defineSecret("VAPID_PRIVATE_KEY");
// Bootstrap email — bu email ile login olan kullanıcı, kendisini ve
// başkalarını admin olarak atayabilir. İlk admin için single-source-of-truth.
const BOOTSTRAP_ADMIN_EMAIL_SECRET = defineSecret("BOOTSTRAP_ADMIN_EMAIL");
// Anket cevap imzalaması için HMAC anahtarı (FAZ 3.3)
const NOTIFICATION_HMAC_SECRET = defineSecret("NOTIFICATION_HMAC_SECRET");

// Seçim günü cold start önleme — kritik HTTP function'larda 1 örnek hep uyanık.
// Maliyet: ~$5/ay/instance. Seçim haftası 1 yapılır, sonrası 0'a çekilir.
// 9 May 2026: 0 (seçime ~1 yıl var, idle ücret işlemesin).
// Seçim 3-5 gün öncesi 1 yap, redeploy et.
const HOT_MIN_INSTANCES = 0;

/**
 * @param {string} encryptedPassword
 * @return {string|null}
 */
function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || typeof encryptedPassword !== "string") {
    return null;
  }
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    logger.warn("ENCRYPTION_KEY not set — password decryption disabled");
    return null;
  }
  if (encryptedPassword.startsWith("U2FsdGVkX1")) {
    try {
      const bytes =
        CryptoJS.AES.decrypt(encryptedPassword, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (decrypted && decrypted.trim() !== "") {
        // Passwords are phone numbers (digits only) in this system
        const normalized = decrypted.replace(/\D/g, "");
        if (!normalized || normalized.length < 6) {
          return null; // Invalid phone-format password
        }
        return normalized;
      }
    } catch (error) {
      logger.error("Password decryption error:", error);
    }
  }
  // Passwords are phone numbers (digits only) in this system
  const normalized = encryptedPassword.replace(/\D/g, "");
  if (!normalized || normalized.length < 6) {
    return null; // Invalid phone-format password
  }
  return normalized;
}

/**
 * @param {string} username
 * @return {string|null}
 */
function formatEmail(username) {
  if (!username) return null;
  if (username.includes("@")) return username;
  return `${username}@ilsekreterlik.local`;
}

// =============================================
// PUSH NOTIFICATION — web-push (maliisler pattern)
// =============================================

/**
 * HTTP endpoint: Dinamik PWA manifest.
 * Firestore app_settings/branding'den isim/icon/açıklama okur,
 * cache header ile döner. Hosting rewrite ile /manifest.json'a bağlı.
 */
exports.manifest = onRequest(
    {
      region: "europe-west1",
      cors: true,
      minInstances: HOT_MIN_INSTANCES,
    },
    async (req, res) => {
      try {
        // En yeni branding doc'u bul
        const snap = await db
            .collection("app_settings")
            .where("type", "==", "branding")
            .get();
        let brand = {};
        if (!snap.empty) {
          // updatedAt'a göre en yeni
          const docs = snap.docs
              .map((d) => ({id: d.id, ...d.data()}))
              .sort((a, b) =>
                new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
          brand = docs[0] || {};
        }

        const themeColor = brand.themeColor || "#E30613";
        const appName = brand.appName || "Yeniden Refah Partisi Elazığ";
        const shortName = (brand.appName || "YRP Elazığ").substring(0, 20);
        const description =
          brand.appDescription ||
          "Yeniden Refah Partisi Elazığ İl Sekreterliği";

        // KRİTİK: data: URL'leri (base64) Chrome WebAPK build'i bozuyor.
        // Branding'te Storage upload başarısız olunca base64 fallback'a
        // düşmüş olabilir — manifest'te kullanma, public path fallback yap.
        const isValidIconUrl = (u) => {
          if (!u || typeof u !== "string") return false;
          if (u.startsWith("data:")) return false;
          return u.startsWith("http") || u.startsWith("/");
        };
        const icon192 = isValidIconUrl(brand.icon192Url) ?
          brand.icon192Url : "/icon-192x192.png";
        const icon512 = isValidIconUrl(brand.icon512Url) ?
          brand.icon512Url : "/icon-512x512.png";

        const manifest = {
          name: appName,
          short_name: shortName,
          description: description,
          id: "/",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: themeColor,
          orientation: "portrait",
          lang: "tr",
          dir: "ltr",
          categories: ["productivity", "business"],
          icons: [
            {
              src: icon192,
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: icon512,
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: icon192,
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: icon512,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          // PWA long-press / context menu kisayollari
          shortcuts: [
            {
              name: "Üyeler",
              short_name: "Üyeler",
              url: "/members",
              icons: [{src: icon192, sizes: "192x192"}],
            },
            {
              name: "Toplantılar",
              short_name: "Toplantılar",
              url: "/meetings",
              icons: [{src: icon192, sizes: "192x192"}],
            },
            {
              name: "Etkinlikler",
              short_name: "Etkinlikler",
              url: "/events",
              icons: [{src: icon192, sizes: "192x192"}],
            },
          ],
        };

        res.set("Content-Type", "application/manifest+json");
        // 5 dakika cache (admin update sonrası kısa sürede yansısın)
        res.set("Cache-Control", "public, max-age=300, s-maxage=300");
        res.status(200).send(JSON.stringify(manifest));
      } catch (error) {
        // Hata olsa bile valid manifest dön — install bozulmasın
        logger.error("Manifest generate error:", error);
        const fallback = {
          name: "Yeniden Refah Partisi Elazığ",
          short_name: "YRP Elazığ",
          description: "Yeniden Refah Partisi Elazığ İl Sekreterliği",
          id: "/",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#E30613",
          orientation: "portrait",
          lang: "tr",
          dir: "ltr",
          icons: [
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        };
        res.set("Content-Type", "application/manifest+json");
        res.status(200).send(JSON.stringify(fallback));
      }
    },
);

/**
 * HTTP endpoint: Push bildirim gonder
 * Client NotificationService'ten cagirilir
 */
exports.sendPush = onRequest(
    {
      region: "europe-west1",
      secrets: [VAPID_PUBLIC_KEY_SECRET, VAPID_PRIVATE_KEY_SECRET],
      cors: [
        "https://spilsekreterligi.web.app",
        "https://spilsekreterligi.firebaseapp.com",
        /\.web\.app$/,
        /localhost/,
      ],
      minInstances: HOT_MIN_INSTANCES,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({error: "Method not allowed"});
        return;
      }

      // GÜVENLİK: Bearer token + admin custom claim doğrulama
      // Bu endpoint'in herkese açık kalması, anonim aboneleri spam'lemeye
      // izin verirdi. Sadece admin yetkili kullanıcılar push gönderebilir.
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ?
        authHeader.slice(7) : null;
      if (!idToken) {
        res.status(401).json({error: "Yetki gerekli — Bearer token yok"});
        return;
      }
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (authErr) {
        logger.warn("sendPush geçersiz token:", authErr.message);
        res.status(401).json({error: "Geçersiz token"});
        return;
      }
      if (decoded.admin !== true) {
        logger.warn(
            "sendPush admin yetkisi yok:",
            decoded.uid, decoded.email,
        );
        res.status(403).json({error: "Admin yetkisi gerekli"});
        return;
      }
      const callerUid = decoded.uid;

      // Rate limit: 60sn'de max 10 push request (callerUid başına)
      try {
        const rateLimitRef = db.collection("rate_limits")
            .doc(`sendPush_${callerUid}`);
        const now = Date.now();
        const WINDOW_MS = 60 * 1000;
        const MAX_REQUESTS = 10;

        const limitResult = await db.runTransaction(async (tx) => {
          const doc = await tx.get(rateLimitRef);
          const docData = doc.exists ? doc.data() : null;
          const requests = (docData && Array.isArray(docData.requests)) ?
            docData.requests : [];
          const recent = requests.filter((t) => now - t < WINDOW_MS);
          if (recent.length >= MAX_REQUESTS) {
            const retryAfter = Math.ceil(
                (recent[0] + WINDOW_MS - now) / 1000,
            );
            return {limited: true, retryAfter};
          }
          recent.push(now);
          tx.set(rateLimitRef, {
            requests: recent,
            uid: callerUid,
            lastUpdated: now,
          });
          return {limited: false};
        });

        if (limitResult.limited) {
          res.set("Retry-After", String(limitResult.retryAfter));
          res.status(429).json({
            error: `Çok fazla push isteği. ${limitResult.retryAfter}` +
              ` saniye sonra tekrar deneyin.`,
          });
          return;
        }
      } catch (rateLimitErr) {
        // Fail-open: rate limit kontrolü çökerse isteği engelleme
        logger.warn("Rate limit check failed:", rateLimitErr.message);
      }

      try {
        const {
          subscriptions, title, body, data, icon, badge, image,
          masterNotificationId, deliveryChannel,
        } = req.body;

        if (!subscriptions || !Array.isArray(subscriptions) ||
            subscriptions.length === 0) {
          res.status(400).json({error: "No subscriptions"});
          return;
        }

        // web-push lazy require
        const webpush = require("web-push");

        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublic || !vapidPrivate) {
          res.status(500).json({error: "VAPID keys not configured"});
          return;
        }

        webpush.setVapidDetails(
            "mailto:datdijital.tr@gmail.com",
            vapidPublic,
            vapidPrivate,
        );

        // Payload: client'tan gelen icon/badge/image kullan,
        // yoksa default fallback. SW kendi UA'ya göre image/actions strip eder.
        const payload = JSON.stringify({
          title: title || "Yeni Bildirim",
          body: body || "",
          icon: icon || "/icon-192x192.png",
          badge: badge || "/badge-72x72.png",
          image: image || undefined,
          data: data || {},
        });

        let sent = 0;
        let failed = 0;
        let cleaned = 0;

        // Endpoint -> push sonucu eslesmesi icin parse edilmis sub
        // listesi tutuyoruz; 410/404 durumunda push_tokens'tan siliyoruz.
        const parsedSubs = subscriptions.map((sub) => {
          try {
            return typeof sub === "string" ? JSON.parse(sub) : sub;
          } catch (ignored) {
            return null;
          }
        });

        const results = await Promise.allSettled(
            parsedSubs.map((subscription) => {
              if (!subscription || !subscription.endpoint) {
                return Promise.reject(new Error("Invalid sub"));
              }
              return webpush.sendNotification(subscription, payload);
            }),
        );

        // Süresi dolmuş subscription endpoint'lerini topla
        const expiredEndpoints = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            sent++;
            return;
          }
          failed++;
          const err = r.reason || {};
          const code = err.statusCode;
          if (code === 410 || code === 404) {
            const sub = parsedSubs[i];
            if (sub && sub.endpoint) {
              expiredEndpoints.push(sub.endpoint);
            }
          }
        });

        // push_tokens koleksiyonunda eslesen doc'lari sil
        if (expiredEndpoints.length > 0) {
          try {
            const tokensRef = db.collection("push_tokens");
            // Firestore "in" sorgusu max 30 deger destekler — chunk'la
            const CHUNK = 30;
            for (
              let i = 0;
              i < expiredEndpoints.length;
              i += CHUNK
            ) {
              const chunk = expiredEndpoints.slice(i, i + CHUNK);
              const snap = await tokensRef
                  .where("subscription.endpoint", "in", chunk)
                  .get();
              const batch = db.batch();
              snap.forEach((d) => batch.delete(d.ref));
              if (!snap.empty) {
                await batch.commit();
                cleaned += snap.size;
              }
            }
            if (cleaned > 0) {
              logger.info(
                  `Cleaned ${cleaned} expired push_tokens`,
              );
            }
          } catch (cleanErr) {
            logger.warn(
                "Token cleanup failed:",
                cleanErr.message,
            );
          }
        }

        // FAZ 4.2 Observability: master_notifications doc'una delivery
        // istatistiği yaz. AdminNotificationPanel "Geçmiş" tab'ında her
        // bildirim için başarı oranı görüntülenir.
        if (masterNotificationId) {
          try {
            const channel = deliveryChannel === "anonymous" ?
              "anonymousDelivery" : "userDelivery";
            const stats = {
              total: subscriptions.length,
              sent,
              failed,
              cleaned,
              completedAt: new Date().toISOString(),
              successRate: subscriptions.length > 0 ?
                Math.round((sent / subscriptions.length) * 100) : 0,
            };
            await db.collection("master_notifications")
                .doc(masterNotificationId)
                .set({[channel]: stats}, {merge: true});
          } catch (statsErr) {
            logger.warn(
                "Delivery stats write failed:",
                statsErr.message,
            );
          }
        }

        res.json({sent, failed, cleaned});
      } catch (error) {
        logger.error("Push send error:", error);
        res.status(500).json({error: error.message});
      }
    },
);

// NOT: `sendFcmNotification` Firestore trigger'i kaldirildi.
// Cift gonderim sorunu (HTTP sendPush + queue trigger ayni bildirimi
// gonderiyordu) nedeniyle artik sadece HTTP `sendPush` endpoint'i
// kullaniliyor. `fcm_notification_queue` koleksiyonu artik aktif olarak
// dinlenmiyor; client de fan-out sirasinda direkt sendPush'a gidiyor.
// Eski queue dokumanlari temizlenebilir (bilgilendirme amaclidir).

// =============================================
// MEMBER USERS SYNC
// =============================================

exports.onMemberUserCreate = onDocumentCreated(
    {
      document: "member_users/{userId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
      secrets: [ENCRYPTION_KEY_SECRET],
    },
    async (event) => {
      const data = event.data.data();
      const userId = event.params.userId;

      logger.info(
          `Creating Auth user for: ${userId}`,
          {username: data.username},
      );

      try {
        if (data.authUid) {
          logger.info(`Already has authUid: ${data.authUid}`);
          return null;
        }

        const email = formatEmail(data.username);
        if (!email) {
          logger.warn(`Invalid username: ${data.username}`);
          return null;
        }

        let password = decryptPassword(data.password);
        if (!password) {
          logger.warn(`No password for: ${userId}`);
          return null;
        }

        if (password.length < 6) {
          password = password.padStart(6, "0");
        }

        const authUser = await admin.auth().createUser({
          email: email,
          password: password,
          displayName: data.username,
          disabled: data.isActive === false,
        });

        logger.info(`Auth user created: ${authUser.uid}`);

        await event.data.ref.update({authUid: authUser.uid});
        return null;
      } catch (error) {
        logger.error(`Error creating auth: ${userId}`, error);
        if (error.code === "auth/email-already-exists") {
          return null;
        }
        throw error;
      }
    },
);

exports.onMemberUserUpdate = onDocumentUpdated(
    {
      document: "member_users/{userId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
      secrets: [ENCRYPTION_KEY_SECRET],
    },
    async (event) => {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();
      const userId = event.params.userId;

      try {
        // AUTH SIFIRLAMA:
        // a) authUid dolu iken null'a düşürüldüyse, veya
        // b) authResetRequested flag'i değiştiyse (authUid zaten null da olsa)
        const authUidCleared =
          beforeData.authUid && !afterData.authUid;
        const resetFlagChanged =
          afterData.authResetRequested &&
          beforeData.authResetRequested !== afterData.authResetRequested;
        if (authUidCleared || resetFlagChanged) {
          logger.info(`Auth reset triggered: ${userId}`);
          const oldUid = beforeData.authUid || afterData.authUid;
          if (oldUid) {
            try {
              await admin.auth().deleteUser(oldUid);
              logger.info(`Old Auth deleted: ${oldUid}`);
            } catch (e) {
              if (e.code !== "auth/user-not-found") {
                logger.warn(`Old Auth delete failed: ${e.message}`);
              }
            }
          }

          const email = formatEmail(afterData.username);
          if (!email) {
            logger.warn(`Invalid username for recreate: ${afterData.username}`);
            return null;
          }
          let password = decryptPassword(afterData.password);
          if (!password) {
            logger.warn(`No password for recreate: ${userId}`);
            return null;
          }
          if (password.length < 6) password = password.padStart(6, "0");

          try {
            const authUser = await admin.auth().createUser({
              email,
              password,
              displayName: afterData.username,
              disabled: afterData.isActive === false,
            });
            await event.data.after.ref.update({authUid: authUser.uid});
            logger.info(`New Auth created: ${authUser.uid}`);
          } catch (createErr) {
            if (createErr.code === "auth/email-already-exists") {
              // Email başka Auth hesabında kilitli, onu da sil ve tekrar
              try {
                const existing = await admin.auth().getUserByEmail(email);
                await admin.auth().deleteUser(existing.uid);
                const authUser = await admin.auth().createUser({
                  email, password,
                  displayName: afterData.username,
                  disabled: afterData.isActive === false,
                });
                await event.data.after.ref.update({authUid: authUser.uid});
                logger.info(`Auth recreated after cleanup: ${authUser.uid}`);
              } catch (e2) {
                logger.error(`Auth recreate failed: ${e2.message}`);
              }
            } else {
              logger.error(`Auth create failed: ${createErr.message}`);
            }
          }
          return null;
        }

        if (!afterData.authUid) return null;

        const authUid = afterData.authUid;
        const emailChanged =
          formatEmail(beforeData.username) !==
          formatEmail(afterData.username);
        const passwordChanged =
          beforeData.password !== afterData.password;
        const activeChanged =
          beforeData.isActive !== afterData.isActive;
        const nameChanged =
          beforeData.username !== afterData.username;

        if (!emailChanged && !passwordChanged &&
            !activeChanged && !nameChanged) {
          return null;
        }

        const updateData = {};
        if (emailChanged && afterData.username) {
          updateData.email = formatEmail(afterData.username);
        }
        if (nameChanged && afterData.username) {
          updateData.displayName = afterData.username;
        }
        if (activeChanged !== undefined) {
          updateData.disabled = afterData.isActive === false;
        }
        if (passwordChanged && afterData.password) {
          const p = decryptPassword(afterData.password);
          if (p) {
            updateData.password =
              p.length < 6 ? p.padStart(6, "0") : p;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await admin.auth().updateUser(authUid, updateData);
          logger.info(`Auth updated: ${authUid}`);
        }
        return null;
      } catch (error) {
        logger.error(`Error updating auth: ${userId}`, error);
        if (error.code === "auth/user-not-found") {
          await event.data.after.ref.update({
            authUid: admin.firestore.FieldValue.delete(),
          });
          return null;
        }
        throw error;
      }
    },
);

exports.onMemberUserDelete = onDocumentDeleted(
    {
      document: "member_users/{userId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
    },
    async (event) => {
      const data = event.data.data();
      const userId = event.params.userId;

      try {
        if (!data.authUid) return null;
        await admin.auth().deleteUser(data.authUid);
        logger.info(`Auth user deleted: ${data.authUid}`);
        return null;
      } catch (error) {
        logger.error(`Error deleting auth: ${userId}`, error);
        if (error.code === "auth/user-not-found") return null;
        throw error;
      }
    },
);

// =============================================
// NOTIFICATION HELPERS (server-side fan-out)
// =============================================

/**
 * Tum aktif uyelerin id'lerini dondurur.
 * `members` koleksiyonu + push_tokens'a sahip ek kullanicilar.
 * @return {Promise<string[]>}
 */
async function getAllActiveMemberIds() {
  const ids = new Set();
  try {
    const membersSnap = await db.collection("members").get();
    membersSnap.forEach((d) => {
      const data = d.data() || {};
      if (data.isActive === false) return;
      const memberId = String(d.id);
      if (memberId) ids.add(memberId);
    });
  } catch (e) {
    logger.warn("getAllActiveMemberIds members err:", e.message);
  }
  // push_tokens'a sahip ama members'ta olmayan kullanicilar (admin vs.)
  try {
    const tokensSnap = await db.collection("push_tokens").get();
    tokensSnap.forEach((d) => {
      const data = d.data() || {};
      if (data.isAnonymous === true) return; // anonim subleri sayma
      ids.add(String(d.id));
    });
  } catch (e) {
    logger.warn("getAllActiveMemberIds tokens err:", e.message);
  }
  return Array.from(ids);
}

/**
 * Hedef tanima gore kullanici id'lerini cozer.
 * NotificationService.js client tarafindaki resolveTargetUsers
 * mantigi ile uyumludur.
 * @param {object} target
 * @return {Promise<string[]>}
 */
async function resolveTargetUserIds(target) {
  if (!target || !target.type || target.type === "all") {
    return await getAllActiveMemberIds();
  }
  if (target.type === "single" && target.value) {
    return [String(target.value)];
  }
  if (target.type === "region" && target.value) {
    try {
      const snap = await db
          .collection("members")
          .where("region", "==", target.value)
          .get();
      return snap.docs.map((d) => String(d.id));
    } catch (e) {
      logger.warn("resolveTargetUserIds region err:", e.message);
      return [];
    }
  }
  if (target.type === "role" && target.value) {
    try {
      const snap = await db
          .collection("members")
          .where("position", "==", target.value)
          .get();
      return snap.docs.map((d) => String(d.id));
    } catch (e) {
      logger.warn("resolveTargetUserIds role err:", e.message);
      return [];
    }
  }
  if (target.type === "neighborhood_reps") {
    try {
      const snap = await db
          .collection("neighborhood_representatives")
          .get();
      return snap.docs.map((d) => String(d.id));
    } catch (e) {
      logger.warn("resolveTargetUserIds nrep err:", e.message);
      return [];
    }
  }
  // Sandığa bağlı sorumlu zinciri + adminler (seçim sonucu bildirimleri için)
  if (target.type === "ballot_box_chain" && target.value) {
    return await resolveBallotBoxChain(String(target.value));
  }
  // chief_observers ve diger ozel hedefleri zamani gelince ekle
  return [];
}

/**
 * Bir kullanıcının belirli bir sandığa yazma yetkisi var mı?
 * @param {object} authUser - request.auth (uid + token)
 * @param {string} ballotBoxId
 * @return {Promise<object>} {allowed, reason?, role?}
 */
async function canWriteToBallotBox(authUser, ballotBoxId) {
  if (!authUser) return {allowed: false, reason: "auth_required"};
  const uid = String(authUser.uid);
  const bbId = String(ballotBoxId);

  // member_users doc id'si Auth UID DEĞİL — login akışı autogen ID kullanıyor.
  // Caller lookup öncelik:
  //   1. authUid field eşleşmesi (yeni login akışında set edilir)
  //   2. doc id == Auth UID (eski admin kayıtları)
  //   3. Auth email'den username çıkar (örn. tc@ilsekreterlik.local → tc)
  //      ve member_users.username ile eşleştir → authUid'i de doldur
  let user = null;
  try {
    const byField = await db
        .collection("member_users")
        .where("authUid", "==", uid)
        .limit(1)
        .get();
    if (!byField.empty) {
      user = {id: byField.docs[0].id, ...byField.docs[0].data()};
    } else {
      const snap = await db.collection("member_users").doc(uid).get();
      if (snap.exists) user = {id: snap.id, ...snap.data()};
    }

    // Fallback 3: email → username eşleştirmesi
    if (!user && authUser.token && authUser.token.email) {
      const email = String(authUser.token.email);
      const usernamePart = email.includes("@") ?
          email.split("@")[0] :
          email;
      if (usernamePart) {
        const byUsername = await db
            .collection("member_users")
            .where("username", "==", usernamePart)
            .limit(1)
            .get();
        if (!byUsername.empty) {
          user = {
            id: byUsername.docs[0].id,
            ...byUsername.docs[0].data(),
          };
          // authUid'i bağla — sonraki çağrılar hızlı olsun
          try {
            await db.collection("member_users")
                .doc(byUsername.docs[0].id)
                .update({authUid: uid});
          } catch (_) {/* ignore */}
        }
      }
    }
  } catch (e) {
    logger.warn("canWriteToBallotBox lookup err:", e.message);
    return {allowed: false, reason: "user_lookup_failed"};
  }
  if (!user) return {allowed: false, reason: "user_not_found"};

  const isAdminUser =
    user.userType === "admin" ||
    (authUser.token && authUser.token.admin === true);
  if (isAdminUser) return {allowed: true, role: "admin"};

  // Capabilities Model: userType esas alınmaz, ID alanları (observerId,
  // coordinatorId) dolu mu bakılır. Bir kullanıcı hem müşahit hem coordinator
  // olabilir veya userType='member' ama observerId dolu olabilir.
  const observerId = String(user.observerId || user.observer_id || "");
  const isObserver = !!observerId ||
    user.userType === "chief_observer" ||
    user.userType === "observer" ||
    user.userType === "musahit";

  if (isObserver) {
    const ownBb = String(user.ballotBoxId || user.ballot_box_id || "");
    if (ownBb && ownBb === bbId) {
      return {allowed: true, role: "chief_observer"};
    }
    // observerId dolu ama ballotBoxId yoksa → ballot_box_observers'tan da dene
    if (observerId) {
      try {
        const bbObs = await db
            .collection("ballot_box_observers")
            .where("__name__", "==", observerId)
            .limit(1)
            .get();
        if (!bbObs.empty) {
          const obsData = bbObs.docs[0].data();
          const obsBb = String(
              obsData.ballot_box_id || obsData.ballotBoxId || "",
          );
          if (obsBb && obsBb === bbId) {
            return {allowed: true, role: "chief_observer"};
          }
        }
      } catch (_) {/* ignore */}
    }
    return {allowed: false, reason: "not_own_ballot_box"};
  }

  const coordinatorId =
    String(user.coordinatorId || user.coordinator_id || "");
  if (!coordinatorId) {
    return {allowed: false, reason: "not_coordinator"};
  }

  const allowedSet = await computeCoordinatorBallotBoxIds(coordinatorId);
  if (allowedSet.has(bbId)) {
    return {allowed: true, role: "coordinator"};
  }
  return {allowed: false, reason: "not_in_coordinator_scope"};
}

// In-memory cache (function instance scoped). minInstances:1 ile aynı instance
// uzun süre yaşar → seçim günü pikinde aynı cache yeniden kullanılır.
// 2300 read/yazma → cached durumda 0 read.
const COORD_CACHE_TTL_MS = 5 * 60 * 1000;
let _coordCache = null;

/** Coord/box/region cache — 5 dk TTL. */
async function getCoordCache() {
  const now = Date.now();
  if (_coordCache && now - _coordCache.cachedAt < COORD_CACHE_TTL_MS) {
    return _coordCache;
  }
  const [coordsSnap, boxesSnap] = await Promise.all([
    db.collection("election_coordinators").get(),
    db.collection("ballot_boxes").get(),
  ]);
  let regionsSnap = null;
  try {
    regionsSnap = await db.collection("election_regions").get();
  } catch (_) {/* ignore */}

  const coords = [];
  coordsSnap.forEach((d) => coords.push({id: String(d.id), ...d.data()}));
  const boxes = [];
  boxesSnap.forEach((d) => boxes.push({id: String(d.id), ...d.data()}));
  const regions = [];
  if (regionsSnap) {
    regionsSnap.forEach((d) =>
      regions.push({id: String(d.id), ...d.data()}),
    );
  }
  _coordCache = {coords, boxes, regions, cachedAt: now};
  return _coordCache;
}

/**
 * Bir coordinator'ın yetkisi olduğu sandık ID setini döner.
 * @param {string} coordinatorId
 * @return {Promise<Set<string>>}
 */
async function computeCoordinatorBallotBoxIds(coordinatorId) {
  const ids = new Set();
  try {
    const cache = await getCoordCache();
    const allCoords = cache.coords;
    const allBoxes = cache.boxes;
    const allRegions = cache.regions;

    const coordinator = allCoords.find((c) => c.id === coordinatorId);
    if (!coordinator) return ids;

    const parseIds = (v) =>
      Array.isArray(v) ? v : v ? JSON.parse(v) : [];

    if (coordinator.role === "provincial_coordinator") {
      allBoxes.forEach((b) => ids.add(b.id));
      return ids;
    }

    if (coordinator.role === "district_supervisor") {
      const regionSups = allCoords.filter(
          (c) => c.role === "region_supervisor" &&
            String(c.parent_coordinator_id) === coordinatorId,
      );
      for (const rs of regionSups) {
        const region = allRegions.find(
            (r) => String(r.supervisor_id) === String(rs.id),
        );
        if (region) {
          const nbIds = parseIds(region.neighborhood_ids);
          const vlIds = parseIds(region.village_ids);
          allBoxes.forEach((b) => {
            if (
              (nbIds.length && nbIds.includes(b.neighborhood_id)) ||
              (vlIds.length && vlIds.includes(b.village_id))
            ) {
              ids.add(b.id);
            }
          });
        }
        const instSups = allCoords.filter(
            (c) => c.role === "institution_supervisor" &&
              String(c.parent_coordinator_id) === String(rs.id),
        );
        for (const isup of instSups) {
          if (!isup.institution_name) continue;
          allBoxes.forEach((b) => {
            if (b.institution_name === isup.institution_name) ids.add(b.id);
          });
        }
      }
      return ids;
    }

    if (coordinator.role === "region_supervisor") {
      const region = allRegions.find(
          (r) => String(r.supervisor_id) === coordinatorId,
      );
      if (region) {
        const nbIds = parseIds(region.neighborhood_ids);
        const vlIds = parseIds(region.village_ids);
        allBoxes.forEach((b) => {
          if (
            (nbIds.length && nbIds.includes(b.neighborhood_id)) ||
            (vlIds.length && vlIds.includes(b.village_id))
          ) {
            ids.add(b.id);
          }
        });
      }
      const instSups = allCoords.filter(
          (c) => c.role === "institution_supervisor" &&
            String(c.parent_coordinator_id) === coordinatorId,
      );
      for (const isup of instSups) {
        if (!isup.institution_name) continue;
        allBoxes.forEach((b) => {
          if (b.institution_name === isup.institution_name) ids.add(b.id);
        });
      }
      return ids;
    }

    if (
      coordinator.role === "institution_supervisor" &&
      coordinator.institution_name
    ) {
      allBoxes.forEach((b) => {
        if (b.institution_name !== coordinator.institution_name) return;
        if (coordinator.district_id &&
            String(b.district_id) !== String(coordinator.district_id)) return;
        if (coordinator.parent_coordinator_id) {
          const region = allRegions.find(
              (r) => String(r.supervisor_id) ===
                String(coordinator.parent_coordinator_id),
          );
          if (region) {
            const nbIds = parseIds(region.neighborhood_ids);
            const vlIds = parseIds(region.village_ids);
            const inRegion =
              (b.neighborhood_id && nbIds.includes(b.neighborhood_id)) ||
              (b.village_id && vlIds.includes(b.village_id));
            if (!inRegion) return;
          }
        }
        ids.add(b.id);
      });
    }
  } catch (e) {
    logger.error("computeCoordinatorBallotBoxIds err:", e.message);
  }
  return ids;
}

/**
 * submitElectionResult — Sandık sonucu güvenli yazma.
 * Tek yazma yolu — Firestore rules sıkılaştırılınca client direkt yazamaz.
 */
exports.submitElectionResult = onCall(
    {
      region: "europe-west1",
      cors: true,
      minInstances: HOT_MIN_INSTANCES,
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Giriş yapın");
      }
      const ballotBoxId = String(request.data?.ballotBoxId || "").trim();
      const mode = request.data?.mode === "update" ? "update" : "create";
      const docId = String(request.data?.docId || "").trim();
      const payload = request.data?.payload || {};

      if (!ballotBoxId) {
        throw new HttpsError("invalid-argument", "ballotBoxId gerekli");
      }
      if (mode === "update" && !docId) {
        throw new HttpsError(
            "invalid-argument", "update için docId gerekli",
        );
      }

      const check = await canWriteToBallotBox(request.auth, ballotBoxId);
      if (!check.allowed) {
        logger.warn(
            `submitElectionResult deny: uid=${request.auth.uid} ` +
            `bb=${ballotBoxId} reason=${check.reason}`,
        );
        throw new HttpsError(
            "permission-denied",
            "Bu sandık için yetkiniz yok",
        );
      }

      // ballot_box_id'yi payload'a zorla — saldırgan farklı yazamaz
      const safePayload = {
        ...payload,
        ballot_box_id: ballotBoxId,
      };

      try {
        if (mode === "create") {
          // DUPLICATE PREVENTION: Aynı (ballot_box_id, election_id) için
          // mevcut doc varsa otomatik UPDATE'e çevir. Race condition'da
          // 2 kullanıcı eşzamanlı yazarsa 2 doc oluşmasın → sayım iki kez
          // yapılmasın. Idempotent davranış.
          const electionId = safePayload.election_id || safePayload.electionId;
          if (electionId) {
            try {
              const existing = await db
                  .collection("election_results")
                  .where("ballot_box_id", "==", ballotBoxId)
                  .where("election_id", "==", electionId)
                  .limit(1)
                  .get();
              if (!existing.empty) {
                const existingId = existing.docs[0].id;
                await db.collection("election_results")
                    .doc(existingId).update(safePayload);
                logger.info(
                    `submitElectionResult create→update (duplicate): ` +
                    `uid=${request.auth.uid} bb=${ballotBoxId} ` +
                    `id=${existingId}`,
                );
                return {success: true, id: existingId, deduped: true};
              }
            } catch (e) {
              logger.warn("dedup check failed:", e.message);
              // Dedup başarısız olursa yine de create'e devam et
            }
          }

          const ref = await db.collection("election_results").add(safePayload);
          logger.info(
              `submitElectionResult create: uid=${request.auth.uid} ` +
              `bb=${ballotBoxId} role=${check.role} id=${ref.id}`,
          );
          return {success: true, id: ref.id};
        } else {
          await db.collection("election_results")
              .doc(docId).update(safePayload);
          logger.info(
              `submitElectionResult update: uid=${request.auth.uid} ` +
              `bb=${ballotBoxId} role=${check.role} id=${docId}`,
          );
          return {success: true, id: docId};
        }
      } catch (e) {
        logger.error("submitElectionResult write err:", e.message);
        throw new HttpsError("internal", "Yazma hatası: " + e.message);
      }
    },
);

/**
 * approveElectionResult — sandık sonucu onaylama (server-side yetki + atomic).
 *
 * Eski client-side path direkt Firestore update yapıyordu, election_results
 * write sadece admin olunca kırıldı. Bu function aynı canWriteToBallotBox
 * yetkisini kullanır ve admin SDK ile yazar.
 *
 * @param {object} request.data
 *   - resultId: election_result doc id
 *   - category: 'cb' | 'mv' | null (genel seçimde kategori-bazlı)
 *   - autoApproveReason: opsiyonel
 *   - mode: 'approve' | 'reject' (default 'approve')
 *   - rejectReason: reject için opsiyonel
 */
exports.approveElectionResult = onCall(
    {
      region: "europe-west1",
      cors: true,
      minInstances: HOT_MIN_INSTANCES,
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Giriş yapın");
      }
      const resultId = String(request.data?.resultId || "").trim();
      const category = request.data?.category || null;
      const mode = request.data?.mode === "reject" ? "reject" : "approve";
      const autoApproveReason = request.data?.autoApproveReason || null;
      const rejectReason = request.data?.rejectReason || "";

      if (!resultId) {
        throw new HttpsError("invalid-argument", "resultId gerekli");
      }

      // 1. Mevcut doc'u oku → ballot_box_id'yi al
      const resultRef = db.collection("election_results").doc(resultId);
      const resultSnap = await resultRef.get();
      if (!resultSnap.exists) {
        throw new HttpsError("not-found", "Sonuç bulunamadı");
      }
      const resultData = resultSnap.data();
      const ballotBoxId = String(
          resultData.ballot_box_id || resultData.ballotBoxId || "",
      );
      if (!ballotBoxId) {
        throw new HttpsError("internal", "Sonuçta ballot_box_id yok");
      }

      // 2. Yetki: aynı canWriteToBallotBox kontrolü
      const check = await canWriteToBallotBox(request.auth, ballotBoxId);
      if (!check.allowed) {
        logger.warn(
            `approveElectionResult deny: uid=${request.auth.uid} ` +
            `bb=${ballotBoxId} reason=${check.reason}`,
        );
        throw new HttpsError(
            "permission-denied", "Bu sandık için yetkiniz yok",
        );
      }

      // 3. Caller bilgilerini member_users'tan çek (audit için)
      let userName = "";
      let userRole = check.role || "";
      try {
        const uid = String(request.auth.uid);
        const byField = await db.collection("member_users")
            .where("authUid", "==", uid).limit(1).get();
        const callerData = byField.empty ? null : byField.docs[0].data();
        if (callerData) {
          userName = callerData.name || callerData.fullName || "";
          userRole = callerData.userType || userRole;
        }
      } catch (_) {/* ignore */}

      const nowIso = new Date().toISOString();

      // 4. mode: reject → doc'u sil
      if (mode === "reject") {
        await resultRef.delete();
        logger.info(
            `approveElectionResult reject: uid=${request.auth.uid} ` +
            `id=${resultId} reason=${rejectReason}`,
        );
        return {success: true, deleted: true};
      }

      // 5. mode: approve → kategori-bazlı veya genel
      const updates = {updated_at: nowIso};
      if (category === "cb") {
        if (resultData.cb_status === "approved") {
          throw new HttpsError("failed-precondition", "CB zaten onaylanmış");
        }
        updates.cb_status = "approved";
        updates.cb_approved_by = String(request.auth.uid);
        updates.cb_approved_by_name = userName;
        updates.cb_approved_by_role = userRole;
        updates.cb_approved_at = nowIso;
        if (autoApproveReason) {
          updates.cb_auto_approve_reason = autoApproveReason;
        }
      } else if (category === "mv") {
        if (resultData.mv_status === "approved") {
          throw new HttpsError("failed-precondition", "MV zaten onaylanmış");
        }
        updates.mv_status = "approved";
        updates.mv_approved_by = String(request.auth.uid);
        updates.mv_approved_by_name = userName;
        updates.mv_approved_by_role = userRole;
        updates.mv_approved_at = nowIso;
        if (autoApproveReason) {
          updates.mv_auto_approve_reason = autoApproveReason;
        }
      } else {
        if (resultData.approval_status === "approved") {
          throw new HttpsError("failed-precondition", "Bu sonuç zaten onaylı");
        }
        updates.approval_status = "approved";
        updates.approved_by = String(request.auth.uid);
        updates.approved_by_name = userName;
        updates.approved_by_role = userRole;
        updates.approved_at = nowIso;
        if (autoApproveReason) updates.auto_approve_reason = autoApproveReason;
      }

      await resultRef.update(updates);
      logger.info(
          `approveElectionResult approve: uid=${request.auth.uid} ` +
          `id=${resultId} cat=${category || "all"}`,
      );
      return {success: true, id: resultId};
    },
);

/**
 * Coordinator Dashboard — server-side. Eskiden client 4 collection getAll
 * yapıyordu (~460K read 200 sorumlu için). Bu function tek HTTP call ile
 * filtrelenmiş sonuç döner (~50 read).
 *
 * Auth: çağıran user'ın member_users.coordinatorId'i ile coordinatorId
 * eşleşmeli (yetki kontrolü).
 */
exports.getCoordinatorDashboard = onCall(
    {
      region: "europe-west1",
      cors: true,
      minInstances: HOT_MIN_INSTANCES,
    },
    async (request) => {
      const coordinatorId = String(request.data?.coordinatorId || "").trim();
      if (!coordinatorId) {
        throw new HttpsError("invalid-argument", "coordinatorId gerekli");
      }
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Giriş yapın");
      }

      // Yetki: caller'ın coordinatorId'i bu coordinator'a denk gelmeli VEYA
      // caller admin olmalı. Caller lookup: authUid field → doc id → email
      // username → fallback. submitElectionResult ile aynı pattern.
      try {
        const uid = String(request.auth.uid);
        let caller = null;
        const byField = await db
            .collection("member_users")
            .where("authUid", "==", uid)
            .limit(1)
            .get();
        if (!byField.empty) {
          caller = byField.docs[0].data();
        } else {
          const callerSnap = await db
              .collection("member_users")
              .doc(uid)
              .get();
          if (callerSnap.exists) caller = callerSnap.data();
        }
        // Fallback: email → username eşleşmesi
        if (!caller && request.auth.token && request.auth.token.email) {
          const email = String(request.auth.token.email);
          const usernamePart = email.includes("@") ?
              email.split("@")[0] : email;
          if (usernamePart) {
            const byUsername = await db
                .collection("member_users")
                .where("username", "==", usernamePart)
                .limit(1)
                .get();
            if (!byUsername.empty) {
              caller = byUsername.docs[0].data();
              try {
                await db.collection("member_users")
                    .doc(byUsername.docs[0].id)
                    .update({authUid: uid});
              } catch (_) {/* ignore */}
            }
          }
        }
        const isAdmin =
          caller?.userType === "admin" ||
          request.auth.token?.admin === true;
        const callerCid = String(
            caller?.coordinatorId || caller?.coordinator_id || "",
        );
        if (!isAdmin && callerCid !== coordinatorId) {
          throw new HttpsError("permission-denied", "Yetkiniz yok");
        }
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        // member_users okuma hatası → güvenli tarafta dur
        throw new HttpsError("permission-denied", "Yetki kontrolü başarısız");
      }

      // Cache: 200 sorumlu × 5 dk = 1 cache miss + 199 hit
      // Miss: ~2300 read. Hit: 0 read.
      const cache = await getCoordCache();
      const allCoords = cache.coords;
      const allRegions = cache.regions;

      const coordinator = allCoords.find((c) => c.id === coordinatorId);
      if (!coordinator) {
        throw new HttpsError("not-found", "Sorumlu bulunamadı");
      }

      // 2. Rol-bazlı sandık filtresi
      let ballotBoxes = [];
      const allBallotBoxes = cache.boxes;

      const parseIds = (v) =>
        Array.isArray(v) ? v : v ? JSON.parse(v) : [];

      if (coordinator.role === "provincial_coordinator") {
        ballotBoxes = allBallotBoxes;
      } else if (coordinator.role === "district_supervisor") {
        const ids = new Set();
        const regionSups = allCoords.filter(
            (c) => c.role === "region_supervisor" &&
              String(c.parent_coordinator_id) === coordinatorId,
        );
        for (const rs of regionSups) {
          const region = allRegions.find(
              (r) => String(r.supervisor_id) === String(rs.id),
          );
          if (!region) continue;
          const nbIds = parseIds(region.neighborhood_ids);
          const vlIds = parseIds(region.village_ids);
          for (const bb of allBallotBoxes) {
            if (
              (nbIds.length && nbIds.includes(bb.neighborhood_id)) ||
              (vlIds.length && vlIds.includes(bb.village_id))
            ) {
              ids.add(bb.id);
            }
          }
          // Bölge altındaki kurum sorumlularının kurumları
          const instSups = allCoords.filter(
              (c) => c.role === "institution_supervisor" &&
                String(c.parent_coordinator_id) === String(rs.id),
          );
          for (const isup of instSups) {
            if (!isup.institution_name) continue;
            for (const bb of allBallotBoxes) {
              if (bb.institution_name === isup.institution_name) {
                ids.add(bb.id);
              }
            }
          }
        }
        ballotBoxes = allBallotBoxes.filter((bb) => ids.has(bb.id));
      } else if (coordinator.role === "region_supervisor") {
        const ids = new Set();
        const region = allRegions.find(
            (r) => String(r.supervisor_id) === coordinatorId,
        );
        if (region) {
          const nbIds = parseIds(region.neighborhood_ids);
          const vlIds = parseIds(region.village_ids);
          for (const bb of allBallotBoxes) {
            if (
              (nbIds.length && nbIds.includes(bb.neighborhood_id)) ||
              (vlIds.length && vlIds.includes(bb.village_id))
            ) {
              ids.add(bb.id);
            }
          }
        }
        const instSups = allCoords.filter(
            (c) => c.role === "institution_supervisor" &&
              String(c.parent_coordinator_id) === coordinatorId,
        );
        for (const isup of instSups) {
          if (!isup.institution_name) continue;
          for (const bb of allBallotBoxes) {
            if (bb.institution_name === isup.institution_name) {
              ids.add(bb.id);
            }
          }
        }
        ballotBoxes = allBallotBoxes.filter((bb) => ids.has(bb.id));
      } else if (
        coordinator.role === "institution_supervisor" &&
        coordinator.institution_name
      ) {
        ballotBoxes = allBallotBoxes.filter((bb) => {
          if (bb.institution_name !== coordinator.institution_name) {
            return false;
          }
          if (coordinator.district_id) {
            return String(bb.district_id) ===
              String(coordinator.district_id);
          }
          if (coordinator.parent_coordinator_id) {
            const pid = String(coordinator.parent_coordinator_id);
            const region = allRegions.find(
                (r) => String(r.supervisor_id) === pid,
            );
            if (region) {
              const nbIds = parseIds(region.neighborhood_ids);
              const vlIds = parseIds(region.village_ids);
              return (
                (bb.neighborhood_id && nbIds.includes(bb.neighborhood_id)) ||
                (bb.village_id && vlIds.includes(bb.village_id))
              );
            }
          }
          return true;
        });
      }

      // Zombi sandık filtresi (silinmiş ilçe)
      const validDistrictIds = new Set();
      try {
        const districtsSnap = await db.collection("districts").get();
        districtsSnap.forEach((d) => validDistrictIds.add(String(d.id)));
      } catch (e) {
        logger.warn("getCoordinatorDashboard districts:", e.message);
      }
      ballotBoxes = ballotBoxes.filter((bb) => {
        if (!bb.district_id) return true;
        return validDistrictIds.has(String(bb.district_id));
      });

      // 3. Üst sorumlular zinciri
      const parentCoordinators = [];
      let cur = coordinator.parent_coordinator_id;
      while (cur) {
        const p = allCoords.find((c) => c.id === String(cur));
        if (!p) break;
        parentCoordinators.push({id: p.id, name: p.name, role: p.role});
        cur = p.parent_coordinator_id;
      }

      // 4. Kendi bölgeleri (özet kart için)
      let myRegions = [];
      if (coordinator.role === "provincial_coordinator") {
        myRegions = allRegions.map((r) => ({id: r.id, name: r.name}));
      } else if (coordinator.role === "district_supervisor") {
        const subIds = allCoords
            .filter((c) => c.role === "region_supervisor" &&
              String(c.parent_coordinator_id) === coordinatorId)
            .map((c) => String(c.id));
        myRegions = allRegions
            .filter((r) => subIds.includes(String(r.supervisor_id)))
            .map((r) => ({id: r.id, name: r.name}));
      } else if (coordinator.role === "region_supervisor") {
        const r = allRegions.find(
            (x) => String(x.supervisor_id) === coordinatorId,
        );
        if (r) myRegions = [{id: r.id, name: r.name}];
      }

      // 5. Election results — sadece bu sandıklar
      const ballotBoxIds = new Set(ballotBoxes.map((b) => String(b.id)));
      const electionResults = [];
      try {
        const batches = [];
        const arr = Array.from(ballotBoxIds);
        for (let i = 0; i < arr.length; i += 30) {
          batches.push(arr.slice(i, i + 30));
        }
        for (const batch of batches) {
          if (batch.length === 0) continue;
          const snap = await db
              .collection("election_results")
              .where("ballot_box_id", "in", batch)
              .get();
          snap.forEach((d) =>
            electionResults.push({id: String(d.id), ...d.data()}),
          );
        }
      } catch (e) {
        logger.warn("getCoordinatorDashboard election_results:", e.message);
      }

      // 6. Region info + neighborhoods + villages (sadece region_supervisor)
      let regionInfo = null;
      const neighborhoods = [];
      const villages = [];
      if (coordinator.role === "region_supervisor") {
        const region = allRegions.find(
            (r) => String(r.supervisor_id) === coordinatorId,
        );
        if (region) {
          regionInfo = {id: region.id, name: region.name};
          const nbIds = parseIds(region.neighborhood_ids);
          const vlIds = parseIds(region.village_ids);

          if (nbIds.length > 0) {
            for (let i = 0; i < nbIds.length; i += 30) {
              const batch = nbIds.slice(i, i + 30);
              try {
                const snap = await db.collection("neighborhoods")
                    .where("__name__", "in", batch.map(String)).get();
                snap.forEach((d) =>
                  neighborhoods.push({id: String(d.id), ...d.data()}),
                );
              } catch (_) {/* ignore */}
            }
          }
          if (vlIds.length > 0) {
            for (let i = 0; i < vlIds.length; i += 30) {
              const batch = vlIds.slice(i, i + 30);
              try {
                const snap = await db.collection("villages")
                    .where("__name__", "in", batch.map(String)).get();
                snap.forEach((d) =>
                  villages.push({id: String(d.id), ...d.data()}),
                );
              } catch (_) {/* ignore */}
            }
          }
        }
      }

      logger.info(
          `getCoordinatorDashboard ${coordinatorId} (${coordinator.role}): ` +
          `${ballotBoxes.length} sandık, ${electionResults.length} sonuç`,
      );

      return {
        success: true,
        coordinator: {
          id: coordinator.id,
          name: coordinator.name,
          tc: coordinator.tc || "",
          phone: coordinator.phone || "",
          role: coordinator.role,
          institutionName: coordinator.institution_name,
        },
        ballotBoxes,
        regionInfo,
        regions: myRegions,
        neighborhoods,
        villages,
        parentCoordinators,
        electionResults,
      };
    },
);

/**
 * Bir sandığa bağlı sorumlu zincirini ve adminleri döner.
 * Zincir: kurum sorumlusu → bölge sorumlusu → ilçe sorumlusu → il sorumlusu
 * + tüm adminler (member_users.userType === 'admin')
 *
 * 5000+ üyeye fan-out etmek yerine 5-10 ilgili kişiye gider.
 * @param {string} ballotBoxId
 * @return {Promise<string[]>}
 */
async function resolveBallotBoxChain(ballotBoxId) {
  const userIds = new Set();
  try {
    // 1. Sandığı al
    const bbSnap = await db
        .collection("ballot_boxes")
        .doc(ballotBoxId)
        .get();
    if (!bbSnap.exists) {
      logger.warn("ballot_box_chain: sandık bulunamadı:", ballotBoxId);
      return [];
    }
    const bb = bbSnap.data() || {};

    // Tüm coordinator'ları bir kerede al — zincir takibi için
    const allCoordsSnap = await db.collection("election_coordinators").get();
    const allCoords = {};
    allCoordsSnap.forEach((d) => {
      allCoords[String(d.id)] = {id: String(d.id), ...d.data()};
    });

    const matched = []; // kurum + bölge sorumluları (giriş noktası)

    // 2. Kurum sorumlusu (institution_name eşleşen)
    if (bb.institution_name) {
      Object.values(allCoords).forEach((c) => {
        if (c.role === "institution_supervisor" &&
            c.institution_name === bb.institution_name) {
          matched.push(c);
        }
      });
    }

    // 3. Bölge sorumlusu (sandığın mahalle/köy id'si region kapsamında)
    try {
      const regionsSnap = await db.collection("election_regions").get();
      regionsSnap.forEach((rd) => {
        const r = rd.data() || {};
        const nIds = Array.isArray(r.neighborhood_ids) ?
            r.neighborhood_ids :
            [];
        const vIds = Array.isArray(r.village_ids) ?
            r.village_ids :
            [];
        const inRegion =
          (bb.neighborhood_id && nIds.includes(bb.neighborhood_id)) ||
          (bb.village_id && vIds.includes(bb.village_id));
        if (inRegion && r.supervisor_id) {
          const rs = allCoords[String(r.supervisor_id)];
          if (rs) matched.push(rs);
        }
      });
    } catch (e) {
      logger.warn("ballot_box_chain regions err:", e.message);
    }

    // 4. parent_coordinator_id zincirini yukarı tara
    const seenCoords = new Set(matched.map((c) => String(c.id)));
    const queue = [...matched];
    while (queue.length > 0) {
      const c = queue.shift();
      const pid = c.parent_coordinator_id;
      if (pid && !seenCoords.has(String(pid)) && allCoords[String(pid)]) {
        seenCoords.add(String(pid));
        const parent = allCoords[String(pid)];
        matched.push(parent);
        queue.push(parent);
      }
    }

    // 5. Coordinator id → member_user_id eşleştir
    const memberUsersSnap = await db.collection("member_users").get();
    memberUsersSnap.forEach((d) => {
      const data = d.data() || {};
      const cid = data.coordinatorId || data.coordinator_id;
      if (cid && seenCoords.has(String(cid))) {
        userIds.add(String(d.id));
      }
      // Adminler: userType === 'admin'
      if (data.userType === "admin") {
        userIds.add(String(d.id));
      }
    });

    logger.info(
        `ballot_box_chain (${ballotBoxId}): ` +
        `${seenCoords.size} sorumlu, ${userIds.size} kullanıcı`,
    );
  } catch (e) {
    logger.error("resolveBallotBoxChain err:", e.message);
  }
  return Array.from(userIds);
}

/**
 * Verilen userId listesi icin push_tokens'tan subscription topla.
 * member_users.authUid mapping'ini de dener (id mismatch icin).
 * @param {string[]} userIds
 * @return {Promise<object[]>}
 */
async function collectSubscriptions(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];

  // memberId -> authUid mapping
  const memberToAuth = {};
  try {
    const muSnap = await db.collection("member_users").get();
    muSnap.forEach((d) => {
      const data = d.data() || {};
      const mid =
        String(data.memberId || data.observerId || d.id || "");
      const authUid = String(data.authUid || "");
      if (mid && authUid) memberToAuth[mid] = authUid;
    });
  } catch (e) {
    logger.warn("collectSubscriptions mu err:", e.message);
  }

  const seen = new Set();
  const subs = [];
  for (const raw of userIds) {
    const uid = String(raw);
    const candidates = [uid];
    if (memberToAuth[uid]) candidates.push(memberToAuth[uid]);

    for (const cand of candidates) {
      try {
        const tokenDoc = await db.doc(`push_tokens/${cand}`).get();
        if (!tokenDoc.exists) continue;
        const data = tokenDoc.data() || {};
        if (data.isActive === false) continue;
        let sub = data.subscription;
        if (!sub) continue;
        if (typeof sub === "string") {
          try {
            sub = JSON.parse(sub);
          } catch (_) {
            sub = null;
          }
        }
        if (sub && sub.endpoint && !seen.has(sub.endpoint)) {
          seen.add(sub.endpoint);
          subs.push(sub);
          break; // bu uid icin bulundu
        }
      } catch (_) {
        // skip
      }
    }
  }
  return subs;
}

/**
 * Verilen subscription listesine web-push ile bildirim gonderir.
 * 410/404 expired token'lari push_tokens'tan temizler.
 * @param {object[]} subs
 * @param {object} payloadObj
 * @return {Promise<{sent:number, failed:number, cleaned:number}>}
 */
async function sendWebPushBatch(subs, payloadObj) {
  if (!Array.isArray(subs) || subs.length === 0) {
    return {sent: 0, failed: 0, cleaned: 0};
  }
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    logger.warn("VAPID keys missing — skipping push");
    return {sent: 0, failed: subs.length, cleaned: 0};
  }
  const webpush = require("web-push");
  webpush.setVapidDetails(
      "mailto:datdijital.tr@gmail.com",
      vapidPublic,
      vapidPrivate,
  );
  const payload = JSON.stringify(payloadObj);

  let sent = 0;
  let failed = 0;
  let cleaned = 0;
  const expiredEndpoints = [];

  const results = await Promise.allSettled(
      subs.map((sub) => {
        if (!sub || !sub.endpoint) {
          return Promise.reject(new Error("Invalid sub"));
        }
        return webpush.sendNotification(sub, payload);
      }),
  );

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent++;
      return;
    }
    failed++;
    const err = r.reason || {};
    if (err.statusCode === 410 || err.statusCode === 404) {
      const sub = subs[i];
      if (sub && sub.endpoint) expiredEndpoints.push(sub.endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    try {
      const tokensRef = db.collection("push_tokens");
      const CHUNK = 30;
      for (let i = 0; i < expiredEndpoints.length; i += CHUNK) {
        const chunk = expiredEndpoints.slice(i, i + CHUNK);
        const snap = await tokensRef
            .where("subscription.endpoint", "in", chunk)
            .get();
        if (snap.empty) continue;
        const batch = db.batch();
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        cleaned += snap.size;
      }
    } catch (e) {
      logger.warn("Token cleanup failed:", e.message);
    }
  }
  return {sent, failed, cleaned};
}

/**
 * Master notification dokumanindan user_notifications/{uid}/items
 * subcollection'larina fan-out yapar. Optional: push da gonderir.
 * @param {string} masterId
 * @param {object} master
 * @param {boolean} sendPushFlag
 * @return {Promise<number>} fan-out edilen kullanici sayisi
 */
async function fanOutNotification(masterId, master, sendPushFlag) {
  const target = master.target || {type: "all"};
  const userIds = await resolveTargetUserIds(target);
  if (userIds.length === 0) return 0;

  const BATCH_SIZE = 450;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const chunk = userIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((uid) => {
      const ref = db
          .collection("user_notifications")
          .doc(uid)
          .collection("items")
          .doc(masterId);
      batch.set(ref, {
        notificationId: masterId,
        title: master.title || "",
        body: master.body || "",
        type: master.type || "announcement",
        url: master.url || null,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(master.data ? master.data : {}),
      });
    });
    await batch.commit();
  }

  if (sendPushFlag) {
    try {
      const subs = await collectSubscriptions(userIds);
      await sendWebPushBatch(subs, {
        title: master.title || "Yeni Bildirim",
        body: master.body || "",
        icon: "/icon-192x192.png",
        badge: "/badge-72x72.png",
        data: {
          type: master.type || "announcement",
          url: master.url || "/notifications",
        },
      });
    } catch (e) {
      logger.warn("fanOutNotification push err:", e.message);
    }
  }
  return userIds.length;
}

// =============================================
// SCHEDULED NOTIFICATION DISPATCHER
// =============================================

/**
 * 5 dakikada bir master_notifications icinde
 * status == 'scheduled' && scheduledAt <= now olan dokumanlari
 * fan-out edip push gonderir, status'u 'sent' yapar.
 */
exports.dispatchScheduledNotifications = onSchedule(
    {
      schedule: "every 5 minutes",
      timeZone: "Europe/Istanbul",
      region: "europe-west1",
      secrets: [VAPID_PUBLIC_KEY_SECRET, VAPID_PRIVATE_KEY_SECRET],
    },
    async () => {
      const now = new Date();
      try {
        const snap = await db
            .collection("master_notifications")
            .where("status", "==", "scheduled")
            .get();

        if (snap.empty) {
          return null;
        }

        let processed = 0;
        for (const doc of snap.docs) {
          const data = doc.data() || {};
          const scheduledAt = data.scheduledAt;
          let scheduledDate = null;
          if (scheduledAt && typeof scheduledAt.toDate === "function") {
            scheduledDate = scheduledAt.toDate();
          } else if (typeof scheduledAt === "string") {
            scheduledDate = new Date(scheduledAt);
          } else if (scheduledAt instanceof Date) {
            scheduledDate = scheduledAt;
          }
          if (!scheduledDate || scheduledDate > now) continue;

          try {
            const targetCount = await fanOutNotification(
                doc.id,
                data,
                true,
            );
            await doc.ref.update({
              status: "sent",
              sentAt:
                admin.firestore.FieldValue.serverTimestamp(),
              dispatchedTargetCount: targetCount,
            });
            processed++;
            logger.info(
                `Scheduled notification dispatched: ${doc.id} ` +
                `(${targetCount} users)`,
            );
          } catch (e) {
            logger.error(
                `Scheduled dispatch failed: ${doc.id}`,
                e,
            );
            await doc.ref
                .update({
                  status: "error",
                  error: e.message,
                })
                .catch(() => {});
          }
        }
        if (processed > 0) {
          logger.info(`Dispatcher processed ${processed} jobs`);
        }
        return null;
      } catch (e) {
        logger.error("dispatchScheduledNotifications err:", e);
        throw e;
      }
    },
);

// =============================================
// AUTOMATION TRIGGERS
// =============================================

/**
 * Master notification yaz + tum hedef kullanicilara fan-out yap.
 * @param {object} params
 * @return {Promise<string|null>} masterId
 */
async function createAndFanOut({title, body, type, target, url, data}) {
  try {
    const masterRef = db.collection("master_notifications").doc();
    const masterData = {
      title: title || "",
      body: body || "",
      type: type || "announcement",
      target: target || {type: "all"},
      url: url || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "sent",
      source: "automation",
      ...(data ? {data} : {}),
    };
    await masterRef.set(masterData);
    await fanOutNotification(masterRef.id, masterData, true);
    return masterRef.id;
  } catch (e) {
    logger.error("createAndFanOut err:", e);
    return null;
  }
}

/**
 * Yeni uye eklenince tum aktif uyelere bildirim
 */
exports.onMemberCreate = onDocumentCreated(
    {
      document: "members/{memberId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
      secrets: [VAPID_PUBLIC_KEY_SECRET, VAPID_PRIVATE_KEY_SECRET],
    },
    async (event) => {
      try {
        const data = (event.data && event.data.data()) || {};
        const name = data.name || data.fullName || "Yeni üye";
        const district =
          data.district_name ||
          data.region ||
          data.district ||
          "";
        const body = district ?
          `${name} (${district})` :
          `${name}`;
        await createAndFanOut({
          title: "Yeni Üye Kaydı",
          body,
          type: "announcement",
          target: {type: "all"},
          url: "/members",
          data: {memberId: event.params.memberId},
        });
        return null;
      } catch (e) {
        logger.error("onMemberCreate err:", e);
        return null;
      }
    },
);

/**
 * Yeni secim sonucu girilince — sadece o sandığa bağlı sorumlu zincirine
 * (kurum/bölge/ilçe/il) ve adminlere bildirim gider.
 *
 * Eskiden tüm aktif üyelere fan-out ediliyordu (target: 'all') —
 * 5000 üye × 2000 sandık = 10M write felaketi. Düzeltildi.
 */
exports.onElectionResultCreate = onDocumentCreated(
    {
      document: "election_results/{resultId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
      secrets: [VAPID_PUBLIC_KEY_SECRET, VAPID_PRIVATE_KEY_SECRET],
    },
    async (event) => {
      try {
        const data = (event.data && event.data.data()) || {};
        const ballotBoxId = data.ballot_box_id || data.ballotBoxId;
        if (!ballotBoxId) {
          logger.warn("onElectionResultCreate: ballot_box_id yok, atla");
          return null;
        }
        const boxLabel =
          data.ballot_box_name ||
          data.ballot_box_number ||
          `#${ballotBoxId}`;

        // Tutarsızlık (has_inconsistency) varsa farklı bildirim — sorumlu
        // kontrol etsin diye uyarı tonu + URL doğrudan sandığa.
        const isInconsistent = data.has_inconsistency === true;
        const title = isInconsistent ?
          "⚠️ Tutarsız Sonuç — Kontrol Gerek" :
          "Yeni Seçim Sonucu";
        const body = isInconsistent ?
          `Sandık ${boxLabel}: değerler tutmuyor, kontrol edin.` :
          `Yeni seçim sonucu girildi: ${boxLabel}`;

        await createAndFanOut({
          title,
          body,
          type: isInconsistent ? "election_inconsistency" : "election_update",
          target: {type: "ballot_box_chain", value: String(ballotBoxId)},
          url: "/elections",
          data: {
            resultId: event.params.resultId,
            ballotBoxId,
            inconsistency: isInconsistent,
          },
        });
        return null;
      } catch (e) {
        logger.error("onElectionResultCreate err:", e);
        return null;
      }
    },
);

/**
 * Uyelik basvurusu approved/rejected olunca basvurana bildirim
 */
exports.onMembershipApplicationStatusChange = onDocumentUpdated(
    {
      document: "membership_applications/{appId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
      secrets: [VAPID_PUBLIC_KEY_SECRET, VAPID_PRIVATE_KEY_SECRET],
    },
    async (event) => {
      try {
        const before = event.data.before.data() || {};
        const after = event.data.after.data() || {};
        if (before.status === after.status) return null;
        if (after.status !== "approved" && after.status !== "rejected") {
          return null;
        }

        const phone = (after.phone || "").replace(/\D/g, "");
        if (!phone) {
          logger.info("Application has no phone, skipping");
          return null;
        }

        // member_users'tan phone uzerinden eslesen kullaniciyi bul
        let targetMemberId = null;
        try {
          const muSnap = await db
              .collection("member_users")
              .where("phone", "==", phone)
              .limit(1)
              .get();
          if (!muSnap.empty) {
            const d = muSnap.docs[0];
            const muData = d.data() || {};
            targetMemberId =
              String(muData.memberId || muData.observerId || d.id);
          }
        } catch (e) {
          logger.warn("application user lookup err:", e.message);
        }

        if (!targetMemberId) {
          logger.info("Application user not found by phone");
          return null;
        }

        const statusLabel =
          after.status === "approved" ? "onaylandı" : "reddedildi";
        await createAndFanOut({
          title: "Üyelik Başvurunuz",
          body: `Başvurunuz ${statusLabel}.`,
          type: "announcement",
          target: {type: "single", value: targetMemberId},
          url: "/notifications",
          data: {
            applicationId: event.params.appId,
            applicationStatus: after.status,
          },
        });
        return null;
      } catch (e) {
        logger.error("onMembershipApplicationStatusChange err:", e);
        return null;
      }
    },
);

/**
 * Talep durumu degisince talep sahibine bildirim
 * NOT: `requests` koleksiyonu kullanimda olmadiginda bu trigger
 * yine register edilir ama ilgili dokuman olmadan zaten tetiklenmez.
 */
exports.onRequestStatusChange = onDocumentUpdated(
    {
      document: "requests/{requestId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
      secrets: [VAPID_PUBLIC_KEY_SECRET, VAPID_PRIVATE_KEY_SECRET],
    },
    async (event) => {
      try {
        const before = event.data.before.data() || {};
        const after = event.data.after.data() || {};
        if (before.status === after.status) return null;

        const ownerId =
          after.userId ||
          after.memberId ||
          after.ownerId ||
          after.requesterId ||
          null;
        if (!ownerId) {
          logger.info("Request has no owner id, skipping");
          return null;
        }

        const statusText = String(after.status || "güncellendi");
        await createAndFanOut({
          title: "Talebiniz Güncellendi",
          body: `Talebinizin durumu: ${statusText}`,
          type: "announcement",
          target: {type: "single", value: String(ownerId)},
          url: "/requests",
          data: {
            requestId: event.params.requestId,
            requestStatus: after.status,
          },
        });
        return null;
      } catch (e) {
        logger.error("onRequestStatusChange err:", e);
        return null;
      }
    },
);

// ═══════════════════════════════════════════════════════════════
// Public Secim Sonuclari API — Admin SDK ile okur, rules bypass
// ═══════════════════════════════════════════════════════════════

/**
 * /api/election-results → Tum secimlerin aggregate sonuclarini doner
 * /api/election-results?id=XXX → Tek secimin detayli sonuclarini doner
 * CDN Cache: 60sn — binlerce ziyaretciye tek Firestore read
 */
exports.publicElectionResults = onRequest(
    {
      region: "europe-west1",
      cors: true,
      minInstances: HOT_MIN_INSTANCES,
    },
    async (req, res) => {
      try {
        const electionId = req.query.id;

        // Tek secim detayi istenmisse
        if (electionId) {
          // Secim meta bilgisi
          const electionSnap = await db
              .collection("elections")
              .doc(String(electionId))
              .get();

          const electionData = electionSnap.exists ?
            {id: electionSnap.id, ...electionSnap.data()} : null;

          // Secim sonuclari
          const resultsSnap = await db
              .collection("election_results")
              .get();

          const safeParseVotes = (val) => {
            if (!val) return {};
            if (typeof val === "string") {
              try {
                return JSON.parse(val);
              } catch (e) {
                return {};
              }
            }
            if (typeof val === "object") return val;
            return {};
          };

          const matchedResults = [];
          resultsSnap.docs.forEach((d) => {
            const data = d.data();
            const match =
              String(data.election_id) === String(electionId) ||
              String(data.electionId) === String(electionId) ||
              String(data.election) === String(electionId);
            // Reddedilmişleri dışla: eski tip (approval_status) +
            // yeni tip (cb_status/mv_status) reject durumlarını dışla.
            // cb_status veya mv_status='approved' ise approval_status reject
            // olsa bile (eski kalıntı) DAHIL ET. Hem cb hem mv reddedilmişse
            // VEYA eski approval_status reject ise dışla.
            const cbApproved = data.cb_status === "approved";
            const mvApproved = data.mv_status === "approved";
            const cbRejected = data.cb_status === "rejected";
            const mvRejected = data.mv_status === "rejected";
            const approvalRejected = data.approval_status === "rejected";

            // En az bir kategori onaylıysa dahil
            // Veya hiç status yoksa (yeni save henüz onay almamış) ama
            // approval_status reject değilse dahil
            const include =
              cbApproved || mvApproved ||
              (!cbRejected && !mvRejected && !approvalRejected);

            if (match && include) {
              matchedResults.push({id: d.id, ...data});
            }
          });

          // Aggregate
          const cbTotals = {};
          const mvTotals = {};
          const mayorTotals = {};
          const provincialTotals = {};
          const municipalTotals = {};
          let totalVoters = 0;
          let totalUsed = 0;
          let totalValid = 0;
          let totalInvalid = 0;
          const ballotBoxResults = [];

          // Sandik ve konum bilgileri
          const bbSnap = await db.collection("ballot_boxes").get();
          const bbMap = {};
          bbSnap.docs.forEach((d) => {
            bbMap[d.id] = {id: d.id, ...d.data()};
          });

          const [distSnap, townSnap, nhSnap, vilSnap] = await Promise.all([
            db.collection("districts").get(),
            db.collection("towns").get(),
            db.collection("neighborhoods").get(),
            db.collection("villages").get(),
          ]);
          const distMap = {};
          distSnap.docs.forEach((d) => {
            distMap[d.id] = d.data().name || "";
          });
          const townMap = {};
          townSnap.docs.forEach((d) => {
            townMap[d.id] = d.data().name || "";
          });
          const nhMap = {};
          nhSnap.docs.forEach((d) => {
            nhMap[d.id] = d.data().name || "";
          });
          const vilMap = {};
          vilSnap.docs.forEach((d) => {
            vilMap[d.id] = d.data().name || "";
          });

          matchedResults.forEach((r) => {
            // Kategori-bazlı (cb_*, mv_*) alanları önce kullan,
            // yoksa flat alanlara fallback. Genel seçimde CB ve MV ayrı save
            // edildiği için flat alan son save kazanır mantığıyla çakışıyordu.
            const cbVoters = parseInt(r.cb_total_voters || 0) || 0;
            const mvVoters = parseInt(r.mv_total_voters || 0) || 0;
            const flatVoters = parseInt(r.total_voters || 0) || 0;
            // Aynı seçmen sandıkta CB+MV kullanır → max al, çift sayma
            const voters = Math.max(cbVoters, mvVoters, flatVoters);

            const cbUsed = parseInt(r.cb_used_votes || 0) || 0;
            const mvUsed = parseInt(r.mv_used_votes || 0) || 0;
            const flatUsed = parseInt(r.used_votes || 0) || 0;
            const used = Math.max(cbUsed, mvUsed, flatUsed);

            const cbValid = parseInt(r.cb_valid_votes || 0) || 0;
            const mvValid = parseInt(r.mv_valid_votes || 0) || 0;
            const flatValid = parseInt(r.valid_votes || 0) || 0;
            // Genel seçimde CB+MV ayrı pusula → topla
            // Tek seçim (cb veya mv only) → kategori veya flat
            const valid = (cbValid > 0 && mvValid > 0) ?
              (cbValid + mvValid) :
              Math.max(cbValid, mvValid, flatValid);

            const cbInvalid = parseInt(r.cb_invalid_votes || 0) || 0;
            const mvInvalid = parseInt(r.mv_invalid_votes || 0) || 0;
            const flatInvalid = parseInt(r.invalid_votes || 0) || 0;
            const invalid = (cbInvalid > 0 && mvInvalid > 0) ?
              (cbInvalid + mvInvalid) :
              Math.max(cbInvalid, mvInvalid, flatInvalid);

            totalVoters += voters;
            totalUsed += used;
            totalValid += valid;
            totalInvalid += invalid;

            const bbId = r.ballot_box_id || r.ballotBoxId;
            const bb = bbMap[bbId] || {};

            Object.entries(safeParseVotes(r.cb_votes)).forEach(([k, v]) => {
              cbTotals[k] = (cbTotals[k] || 0) + (parseInt(v) || 0);
            });
            Object.entries(safeParseVotes(r.mv_votes)).forEach(([k, v]) => {
              mvTotals[k] = (mvTotals[k] || 0) + (parseInt(v) || 0);
            });
            Object.entries(safeParseVotes(r.mayor_votes)).forEach(([k, v]) => {
              mayorTotals[k] = (mayorTotals[k] || 0) + (parseInt(v) || 0);
            });
            Object.entries(safeParseVotes(r.provincial_assembly_votes))
                .forEach(([k, v]) => {
                  provincialTotals[k] =
                    (provincialTotals[k] || 0) + (parseInt(v) || 0);
                });
            Object.entries(safeParseVotes(r.municipal_council_votes))
                .forEach(([k, v]) => {
                  municipalTotals[k] =
                    (municipalTotals[k] || 0) + (parseInt(v) || 0);
                });

            ballotBoxResults.push({
              resultId: r.id,
              ballotBoxId: bbId || "",
              ballotNumber: bb.ballot_number || bb.number || "",
              districtName: distMap[bb.district_id] || "",
              townName: townMap[bb.town_id] || "",
              neighborhoodName: nhMap[bb.neighborhood_id] || "",
              villageName: vilMap[bb.village_id] || "",
              totalVoters: voters,
              usedVotes: used,
              validVotes: valid,
              invalidVotes: invalid,
              cbVotes: safeParseVotes(r.cb_votes),
              mvVotes: safeParseVotes(r.mv_votes),
              mayorVotes: safeParseVotes(r.mayor_votes),
            });
          });

          const toSorted = (obj) => {
            const total = Object.values(obj)
                .reduce((s, v) => s + v, 0);
            return Object.entries(obj)
                .map(([name, votes]) => ({
                  name,
                  votes,
                  percent: total > 0 ?
                    parseFloat(((votes / total) * 100).toFixed(2)) : 0,
                }))
                .sort((a, b) => b.votes - a.votes);
          };

          const result = {
            election: electionData,
            totalBallotBoxes: Object.keys(bbMap).length,
            openedBallotBoxes: matchedResults.length,
            totalVoters,
            usedVotes: totalUsed,
            validVotes: totalValid,
            invalidVotes: totalInvalid,
            cbResults: toSorted(cbTotals),
            mvResults: toSorted(mvTotals),
            mayorResults: toSorted(mayorTotals),
            provincialResults: toSorted(provincialTotals),
            municipalResults: toSorted(municipalTotals),
            ballotBoxResults,
            updatedAt: new Date().toISOString(),
          };

          res.set("Cache-Control",
              "public, max-age=30, s-maxage=60");
          res.json({success: true, data: result});
          return;
        }

        // Tum secimlerin listesi
        const electionsSnap = await db.collection("elections").get();
        const elections = electionsSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().title || "",
          date: d.data().date || d.data().election_date || "",
          type: d.data().type || "",
          status: d.data().status || "",
        }));

        res.set("Cache-Control", "public, max-age=60, s-maxage=120");
        res.json({success: true, data: elections});
      } catch (error) {
        logger.error("publicElectionResults error:", error);
        res.status(500).json({
          success: false,
          error: "Sunucu hatasi",
        });
      }
    },
);

// =============================================
// FAZ 3.3 — ANKET BİLDİRİM (Soapbox pattern)
// =============================================
// HMAC voteToken: anket bildiriminde her kullanıcıya özel imzalı token gömülür.
// Service Worker action handler bu token ile recordPollVote'a POST atıp
// uygulama açmadan oy kaydeder.
//
// Token formatı (URL-safe):
//   payload = subject|pollId|exp     (örn: "anon_abc123|poll_xyz|1714521600")
//   signature = HMAC-SHA256(NOTIFICATION_HMAC_SECRET, payload)
//   token = b64url(payload) + "." + b64url(signature)
//
// subject: 'user_<uid>' veya 'anon_<id>' (kim oy veriyor)
// exp: unix timestamp (saniye), 7 gün geçerlilik

const crypto = require("crypto");

/**
 * @param {Buffer|string} buf
 * @return {string} base64url encoded
 */
function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
}

/**
 * @param {string} str base64url encoded
 * @return {string} decoded utf8 string
 */
function b64urlDecode(str) {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

/**
 * Vote token üret. Cloud Function içinde anket bildirimi göndermeden önce
 * her hedef kullanıcı için ayrı token üretilir.
 * @param {string} subject - 'user_<uid>' veya 'anon_<id>'
 * @param {string} pollId - Anket doc id
 * @param {string} secret - HMAC anahtarı (NOTIFICATION_HMAC_SECRET)
 * @param {number} ttlSeconds - Geçerlilik süresi (saniye)
 * @return {string} URL-safe imzalı token
 */
function createVoteToken(
    subject, pollId, secret, ttlSeconds = 7 * 24 * 60 * 60,
) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${subject}|${pollId}|${exp}`;
  const sig = crypto.createHmac("sha256", secret)
      .update(payload)
      .digest();
  return `${b64urlEncode(payload)}.${b64urlEncode(sig)}`;
}

/**
 * Vote token'ı doğrula. Geçerliyse {subject, pollId, exp} döner, yoksa null.
 * @param {string} token - createVoteToken çıktısı
 * @param {string} secret - HMAC anahtarı
 * @return {object|null} { subject, pollId, exp } veya null
 */
function verifyVoteToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload;
  try {
    payload = b64urlDecode(parts[0]);
  } catch (_) {
    return null;
  }
  const expectedSig = crypto.createHmac("sha256", secret)
      .update(payload)
      .digest();
  let providedSig;
  try {
    providedSig = Buffer.from(
        parts[1].replace(/-/g, "+").replace(/_/g, "/") +
          "=".repeat((4 - parts[1].length % 4) % 4),
        "base64",
    );
  } catch (_) {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;
  const fields = payload.split("|");
  if (fields.length !== 3) return null;
  const [subject, pollId, expStr] = fields;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return {subject, pollId, exp};
}

/**
 * Anket bildirimine tıklayan kullanıcının oyunu kaydeder.
 * SW notificationclick action handler'dan POST çağrılır.
 *
 * Body: { voteToken, optionIndex }
 * Idempotent: aynı subject 5 kez tıklasa bile son oy geçerli (overwrite).
 *
 * Auth: HMAC voteToken yeterli — anonim de oy verebilir.
 */
exports.recordPollVote = onRequest(
    {
      region: "europe-west1",
      secrets: [NOTIFICATION_HMAC_SECRET],
      cors: [
        "https://spilsekreterligi.web.app",
        "https://spilsekreterligi.firebaseapp.com",
        /\.web\.app$/,
        /localhost/,
      ],
      minInstances: HOT_MIN_INSTANCES,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({error: "Method not allowed"});
        return;
      }

      const secret = process.env.NOTIFICATION_HMAC_SECRET;
      if (!secret) {
        res.status(500).json({error: "Server misconfigured: HMAC secret yok"});
        return;
      }

      const {voteToken, optionIndex} = req.body || {};
      if (!voteToken || optionIndex === undefined || optionIndex === null) {
        res.status(400).json({error: "voteToken ve optionIndex gerekli"});
        return;
      }

      const verified = verifyVoteToken(voteToken, secret);
      if (!verified) {
        res.status(401).json({error: "Geçersiz veya süresi dolmuş token"});
        return;
      }

      const {subject, pollId} = verified;
      const optionIdx = parseInt(optionIndex, 10);
      if (isNaN(optionIdx) || optionIdx < 0) {
        res.status(400).json({error: "Geçersiz optionIndex"});
        return;
      }

      try {
        // Anket var mı, hala aktif mi kontrol et
        const pollDoc = await db.collection("polls").doc(pollId).get();
        if (!pollDoc.exists) {
          res.status(404).json({error: "Anket bulunamadı"});
          return;
        }
        const poll = pollDoc.data();
        if (poll.status === "ended" || poll.status === "closed") {
          res.status(409).json({error: "Anket sona ermiş"});
          return;
        }
        if (poll.endDate && new Date(poll.endDate) < new Date()) {
          res.status(409).json({error: "Anket süresi dolmuş"});
          return;
        }
        const options = Array.isArray(poll.options) ? poll.options : [];
        if (optionIdx >= options.length) {
          res.status(400).json({error: "Geçersiz seçenek"});
          return;
        }

        // Idempotent yazma: doc id = pollId_subject deterministic
        // → aynı kişi tekrar tıklasa overwrite (son oy geçerli)
        const safeSubject = subject.replace(/[^a-zA-Z0-9_]/g, "_");
        const voteId = `${pollId}_${safeSubject}`;
        await db.collection("poll_votes").doc(voteId).set({
          pollId: String(pollId),
          memberId: subject.startsWith("user_") ?
            subject.slice(5) : null,
          anonId: subject.startsWith("anon_") ? subject : null,
          subject,
          optionIndex: optionIdx,
          optionText: options[optionIdx] || null,
          source: "push_notification",
          createdAt: new Date().toISOString(),
        }, {merge: true});

        res.json({
          success: true,
          message: "Oyunuz kaydedildi",
          pollId,
          optionIndex: optionIdx,
        });
      } catch (error) {
        logger.error("recordPollVote error:", error);
        res.status(500).json({error: error.message || "Bilinmeyen hata"});
      }
    },
);

/**
 * Anket bildirimini hedef kullanıcılara gönderir.
 * sendPush'tan farklı: her abone için ayrı HMAC voteToken üretir,
 * payload'a kullanıcıya özel token gömer.
 *
 * Body: {
 *   recipients: [{ subscription, subject }],
 *     // subject = 'user_xxx' veya 'anon_xxx'
 *   pollId, pollTitle, pollBody,
 *   pollOptions,
 *     // [string], max 2 ise actions[] olarak; 3+ ise sadece deep link
 *   masterNotificationId
 * }
 */
exports.sendPollPush = onRequest(
    {
      region: "europe-west1",
      secrets: [
        VAPID_PUBLIC_KEY_SECRET,
        VAPID_PRIVATE_KEY_SECRET,
        NOTIFICATION_HMAC_SECRET,
      ],
      cors: [
        "https://spilsekreterligi.web.app",
        "https://spilsekreterligi.firebaseapp.com",
        /\.web\.app$/,
        /localhost/,
      ],
    },
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({error: "Method not allowed"});
        return;
      }

      // Auth: admin custom claim
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ?
        authHeader.slice(7) : null;
      if (!idToken) {
        res.status(401).json({error: "Yetki gerekli"});
        return;
      }
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (_) {
        res.status(401).json({error: "Geçersiz token"});
        return;
      }
      if (decoded.admin !== true) {
        res.status(403).json({error: "Admin yetkisi gerekli"});
        return;
      }

      const {
        recipients, pollId, pollTitle, pollBody, pollOptions,
        icon, badge, masterNotificationId, deliveryChannel,
      } = req.body || {};

      if (!Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({error: "recipients gerekli"});
        return;
      }
      if (!pollId || !pollTitle || !Array.isArray(pollOptions)) {
        res.status(400).json({error: "pollId, pollTitle, pollOptions gerekli"});
        return;
      }

      const webpush = require("web-push");
      const vapidPublic = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      const hmacSecret = process.env.NOTIFICATION_HMAC_SECRET;
      if (!vapidPublic || !vapidPrivate || !hmacSecret) {
        res.status(500).json({error: "Sunucu yapılandırma hatası"});
        return;
      }
      webpush.setVapidDetails(
          "mailto:datdijital.tr@gmail.com",
          vapidPublic,
          vapidPrivate,
      );

      // Mobile'da actions max 2 destekleniyor; 3+ ise sadece deep link.
      const useActions = pollOptions.length <= 2;

      let sent = 0;
      let failed = 0;
      let cleaned = 0;
      const expiredEndpoints = [];

      const tasks = recipients.map(async (recipient) => {
        try {
          let sub = recipient.subscription;
          if (typeof sub === "string") {
            try {
              sub = JSON.parse(sub);
            } catch (_) {
              sub = null;
            }
          }
          if (!sub || !sub.endpoint) return;

          const subject = recipient.subject ||
            (recipient.userId ? `user_${recipient.userId}` :
             recipient.anonId ? recipient.anonId : null);
          if (!subject) return;

          const voteToken = createVoteToken(subject, pollId, hmacSecret);

          const payload = JSON.stringify({
            title: pollTitle,
            body: pollBody || "",
            icon: icon || "/icon-192x192.png",
            badge: badge || "/badge-72x72.png",
            tag: `poll_${pollId}`,
            data: {
              type: "poll",
              pollId,
              voteToken,
              url: `/polls/${pollId}`,
              pollOptions,
            },
            actions: useActions ?
              pollOptions.map((opt, idx) => ({
                action: `vote_${idx}`,
                title: String(opt).slice(0, 30),
              })) :
              undefined,
            requireInteraction: true,
          });

          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (err) {
          failed++;
          const code = err && err.statusCode;
          if (code === 410 || code === 404) {
            const sub = recipient.subscription;
            const ep = (typeof sub === "string" ?
              (() => {
                try {
                  return JSON.parse(sub).endpoint;
                } catch (_) {
                  return null;
                }
              })() :
              sub && sub.endpoint);
            if (ep) expiredEndpoints.push(ep);
          }
        }
      });

      await Promise.all(tasks);

      // 410/404 endpoint cleanup
      if (expiredEndpoints.length > 0) {
        try {
          const tokensRef = db.collection("push_tokens");
          const CHUNK = 30;
          for (let i = 0; i < expiredEndpoints.length; i += CHUNK) {
            const chunk = expiredEndpoints.slice(i, i + CHUNK);
            const snap = await tokensRef
                .where("subscription.endpoint", "in", chunk)
                .get();
            const batch = db.batch();
            snap.forEach((d) => batch.delete(d.ref));
            if (!snap.empty) {
              await batch.commit();
              cleaned += snap.size;
            }
          }
        } catch (cleanErr) {
          logger.warn("Token cleanup failed:", cleanErr.message);
        }
      }

      // Master notification doc'a delivery stats
      if (masterNotificationId) {
        try {
          const channel = deliveryChannel === "anonymous" ?
            "anonymousDelivery" : "userDelivery";
          await db.collection("master_notifications")
              .doc(masterNotificationId)
              .set({
                [channel]: {
                  total: recipients.length, sent, failed, cleaned,
                  completedAt: new Date().toISOString(),
                  successRate: recipients.length > 0 ?
                    Math.round((sent / recipients.length) * 100) : 0,
                  channel: "poll",
                },
              }, {merge: true});
        } catch (statsErr) {
          logger.warn("Delivery stats write failed:", statsErr.message);
        }
      }

      res.json({sent, failed, cleaned});
    },
);

// =============================================
// ADMIN CUSTOM CLAIM — Yetkili kullanıcı atama
// =============================================

/**
 * Bir kullanıcıya admin custom claim atar veya kaldırır.
 * Yetki kuralları:
 *   1. Bootstrap email (BOOTSTRAP_ADMIN_EMAIL secret'inde tanımlı) ile login
 *      olan kullanıcı her zaman çağırabilir — ilk admini setlemek için.
 *   2. Daha önce admin claim almış kullanıcılar başkalarına claim atayabilir.
 * Çağrı sonrası hedef kullanıcının token'ını yenilemesi (re-login veya
 * getIdToken(true)) gerekir; aksi halde eski token'da claim henüz yoktur.
 *
 * Çağrı: httpsCallable(functions, 'setAdminClaim')({uid, admin: true|false})
 */
exports.setAdminClaim = onCall(
    {
      region: "europe-west1",
      secrets: [BOOTSTRAP_ADMIN_EMAIL_SECRET],
    },
    async (request) => {
      const callerUid = request.auth && request.auth.uid;
      const callerToken = (request.auth && request.auth.token) || {};
      const callerEmail = callerToken.email || null;

      if (!callerUid) {
        throw new HttpsError("unauthenticated", "Önce giriş yapın");
      }

      const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "";
      const isBootstrap =
        bootstrapEmail && callerEmail &&
        callerEmail.toLowerCase() === bootstrapEmail.toLowerCase();
      const isCallerAdmin = callerToken.admin === true;

      if (!isBootstrap && !isCallerAdmin) {
        throw new HttpsError(
            "permission-denied",
            "Bu işlem için admin yetkisi gerekli",
        );
      }

      const targetUid = request.data && request.data.uid;
      const value = !(request.data && request.data.admin === false);

      if (!targetUid || typeof targetUid !== "string") {
        throw new HttpsError("invalid-argument", "uid parametresi gerekli");
      }

      try {
        const targetUser = await admin.auth().getUser(targetUid);
        const existingClaims = targetUser.customClaims || {};
        const newClaims = {...existingClaims, admin: value};
        await admin.auth().setCustomUserClaims(targetUid, newClaims);

        // Audit log
        try {
          await db.collection("audit_logs").add({
            action: value ? "grant_admin" : "revoke_admin",
            entity_type: "user",
            entity_id: targetUid,
            target_email: targetUser.email || null,
            performed_by: callerUid,
            performed_by_email: callerEmail,
            performed_by_role: isBootstrap ? "bootstrap" : "admin",
            created_at: new Date().toISOString(),
          });
        } catch (auditErr) {
          logger.warn("setAdminClaim audit log failed:", auditErr.message);
        }

        return {
          success: true,
          uid: targetUid,
          email: targetUser.email,
          admin: value,
          message: value ?
            "Admin yetkisi verildi. Kullanıcı bir sonraki girişinde " +
              "geçerli olacak." :
            "Admin yetkisi kaldırıldı.",
        };
      } catch (error) {
        logger.error("setAdminClaim error:", error);
        if (error.code === "auth/user-not-found") {
          throw new HttpsError(
              "not-found", "Kullanıcı bulunamadı: " + targetUid,
          );
        }
        throw new HttpsError("internal", error.message || "Bilinmeyen hata");
      }
    },
);

/**
 * Mevcut kullanıcı admin mi sorgular. Token'daki claim'e bakar.
 * Client UI'da admin-only butonları göstermek için.
 */
exports.checkAdminClaim = onCall(
    {region: "europe-west1"},
    async (request) => {
      const token = (request.auth && request.auth.token) || {};
      return {
        admin: token.admin === true,
        uid: request.auth && request.auth.uid,
        email: token.email || null,
      };
    },
);

