/**
 * Firebase Cloud Functions
 * 1. Member Users Sync with Firebase Auth
 * 2. Push Notification (web-push ile — maliisler referansi)
 */

const {onDocumentCreated, onDocumentUpdated, onDocumentDeleted} =
  require("firebase-functions/v2/firestore");
const {onRequest} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");
const CryptoJS = require("crypto-js");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore("yrpilsekreterligi");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  logger.warn("ENCRYPTION_KEY not set — password decryption disabled");
}

/**
 * @param {string} encryptedPassword
 * @return {string|null}
 */
function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || typeof encryptedPassword !== "string") {
    return null;
  }
  if (encryptedPassword.startsWith("U2FsdGVkX1")) {
    try {
      const bytes =
        CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
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
 * HTTP endpoint: Push bildirim gonder
 * Client NotificationService'ten cagirilir
 */
exports.sendPush = onRequest(
    {
      region: "europe-west1",
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

      try {
        const {subscriptions, title, body, data} = req.body;

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
            "mailto:admin@ilsekreterlik.local",
            vapidPublic,
            vapidPrivate,
        );

        const payload = JSON.stringify({
          title: title || "Yeni Bildirim",
          body: body || "",
          icon: "/icon-192x192.png",
          badge: "/badge-72x72.png",
          data: data || {},
        });

        let sent = 0;
        let failed = 0;

        const results = await Promise.allSettled(
            subscriptions.map((sub) => {
              try {
                const subscription = typeof sub === "string" ?
                  JSON.parse(sub) : sub;
                return webpush.sendNotification(subscription, payload);
              } catch (ignored) {
                return Promise.reject(new Error("Invalid sub"));
              }
            }),
        );

        results.forEach((r) => {
          if (r.status === "fulfilled") sent++;
          else failed++;
        });

        res.json({sent, failed});
      } catch (error) {
        logger.error("Push send error:", error);
        res.status(500).json({error: error.message});
      }
    },
);

/**
 * Firestore trigger: fcm_notification_queue'ya yazilinca push gonder
 */
exports.sendFcmNotification = onDocumentCreated(
    {
      document: "fcm_notification_queue/{docId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
    },
    async (event) => {
      const data = event.data.data();
      const docId = event.params.docId;

      logger.info("Push queue triggered:", docId);

      try {
        const userIds = data.userIds || [];
        const title = data.title || "Yeni Bildirim";
        const body = data.body || "";

        if (userIds.length === 0) {
          await event.data.ref.update({status: "skipped"});
          return null;
        }

        // Push token'lari topla
        const subscriptions = [];
        for (const userId of userIds) {
          try {
            const tokenDoc = await db
                .doc("push_tokens/" + userId).get();
            if (tokenDoc.exists && tokenDoc.data().subscription) {
              subscriptions.push(tokenDoc.data().subscription);
            }
          } catch (ignored) {
            // skip
          }
        }

        if (subscriptions.length === 0) {
          await event.data.ref.update({
            status: "no_tokens",
          });
          return null;
        }

        // web-push ile gonder
        const webpush = require("web-push");

        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublic || !vapidPrivate) {
          logger.error("VAPID keys not configured in env");
          await event.data.ref.update({
            status: "error",
            error: "VAPID keys not configured",
          });
          return null;
        }

        webpush.setVapidDetails(
            "mailto:admin@ilsekreterlik.local",
            vapidPublic,
            vapidPrivate,
        );

        const payload = JSON.stringify({
          title,
          body,
          icon: "/icon-192x192.png",
          data: data.data || {},
        });

        let sent = 0;
        let fail = 0;

        for (const sub of subscriptions) {
          try {
            const subscription = typeof sub === "string" ?
              JSON.parse(sub) : sub;
            await webpush.sendNotification(subscription, payload);
            sent++;
          } catch (e) {
            fail++;
            if (e.statusCode === 410 || e.statusCode === 404) {
              logger.warn("Expired token, cleaning up");
            }
          }
        }

        await event.data.ref.update({
          status: "sent",
          sent,
          fail,
          processedAt:
            admin.firestore.FieldValue.serverTimestamp(),
        });

        return null;
      } catch (error) {
        logger.error("Push queue error:", error);
        await event.data.ref.update({
          status: "error",
          error: error.message,
        }).catch(() => {});
        throw error;
      }
    },
);

// =============================================
// MEMBER USERS SYNC
// =============================================

exports.onMemberUserCreate = onDocumentCreated(
    {
      document: "member_users/{userId}",
      database: "yrpilsekreterligi",
      region: "europe-west1",
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
    },
    async (event) => {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();
      const userId = event.params.userId;

      try {
        // AUTH SIFIRLAMA: authUid dolu iken null'a düşürüldüyse
        // eski Auth hesabını sil, yenisini Firestore şifresiyle oluştur
        if (beforeData.authUid && !afterData.authUid) {
          logger.info(`Auth reset triggered: ${userId}`);
          try {
            await admin.auth().deleteUser(beforeData.authUid);
            logger.info(`Old Auth deleted: ${beforeData.authUid}`);
          } catch (e) {
            if (e.code !== "auth/user-not-found") {
              logger.warn(`Old Auth delete failed: ${e.message}`);
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
