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
const CryptoJS = require("crypto-js");

if (!admin.apps.length) {
  admin.initializeApp();
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ||
  "ilsekreterlik-app-encryption-key-2024-secret-very-long-key-" +
  "for-security-minimum-32-characters";

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
        return decrypted.replace(/\D/g, "");
      }
    } catch (error) {
      logger.error("Password decryption error:", error);
    }
  }
  return encryptedPassword.replace(/\D/g, "");
}

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
    {region: "europe-west1", cors: true},
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

        const vapidPublic = process.env.VAPID_PUBLIC_KEY ||
          "BJjc4yxeV5_GZkrrk70VPsvGoFJ6x3aSwRoxD5mt" +
          "WOlNxJhkq99DcB56cJmzX7O-VRTlXpPJAZLEan7b_VpDtEE";
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY ||
          "zJmu8Hc1RCCe91ATwlth4qZ_rjSAr1QK1F3zzUR3hd0";

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
            const tokenDoc = await admin.firestore()
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

        const vapidPublic = process.env.VAPID_PUBLIC_KEY ||
          "BJjc4yxeV5_GZkrrk70VPsvGoFJ6x3aSwRoxD5mt" +
          "WOlNxJhkq99DcB56cJmzX7O-VRTlXpPJAZLEan7b_VpDtEE";
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY ||
          "zJmu8Hc1RCCe91ATwlth4qZ_rjSAr1QK1F3zzUR3hd0";

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
      region: "europe-west1",
    },
    async (event) => {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();
      const userId = event.params.userId;

      try {
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
