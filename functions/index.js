/**
 * Firebase Cloud Functions - Member Users Sync with Firebase Auth
 *
 * Bu fonksiyonlar Firestore'daki member_users collection'ındaki
 * değişiklikleri dinleyerek Firebase Authentication ile otomatik
 * senkronizasyon sağlar.
 */

const {onDocumentCreated, onDocumentUpdated, onDocumentDeleted} =
  require("firebase-functions/v2/firestore");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const CryptoJS = require("crypto-js");

// Firebase Admin SDK'yı başlat
if (!admin.apps.length) {
  admin.initializeApp();
}

// Encryption key - Environment variable'dan al veya default kullan
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ||
  "ilsekreterlik-app-encryption-key-2024-secret-very-long-key-" +
  "for-security-minimum-32-characters";

/**
 * Şifrelenmiş şifreyi çözer
 * @param {string} encryptedPassword - Şifrelenmiş şifre
 * @return {string|null} Çözülmüş şifre veya null
 */
function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || typeof encryptedPassword !== "string") {
    return null;
  }

  // Eğer "U2FsdGVkX1" ile başlıyorsa, şifrelenmiş demektir
  if (encryptedPassword.startsWith("U2FsdGVkX1")) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);

      if (decrypted && decrypted.trim() !== "") {
        // Sadece rakamlar kalacak şekilde normalize et
        return decrypted.replace(/\D/g, "");
      }
    } catch (error) {
      logger.error("Password decryption error:", error);
    }
  }

  // Şifrelenmemişse, sadece rakamlar kalacak şekilde normalize et
  return encryptedPassword.replace(/\D/g, "");
}

/**
 * Email formatına çevir
 * @param {string} username - Kullanıcı adı
 * @return {string|null} Email formatında kullanıcı adı veya null
 */
function formatEmail(username) {
  if (!username) return null;
  if (username.includes("@")) return username;
  return `${username}@ilsekreterlik.local`;
}

/**
 * Member User oluşturulduğunda Firebase Auth'da da oluştur
 */
exports.onMemberUserCreate = onDocumentCreated(
    {
      document: "member_users/{userId}",
      region: "europe-west1",
    },
    async (event) => {
      const data = event.data.data();
      const userId = event.params.userId;

      logger.info(
          `Creating Firebase Auth user for member_user: ${userId}`,
          {username: data.username},
      );

      try {
        // Kullanıcı zaten Firebase Auth'da varsa (authUid varsa), atla
        if (data.authUid) {
          logger.info(
              `User ${userId} already has authUid: ${data.authUid}`,
          );
          return null;
        }

        // Email formatına çevir
        const email = formatEmail(data.username);
        if (!email) {
          logger.warn(
              `Invalid username for user ${userId}: ${data.username}`,
          );
          return null;
        }

        // Şifreyi decrypt et
        let password = decryptPassword(data.password);
        if (!password) {
          logger.warn(`No password found for user ${userId}`);
          return null;
        }

        // Firebase Auth minimum 6 karakter şifre ister
        if (password.length < 6) {
          password = password.padStart(6, "0");
        }

        // Firebase Auth'da kullanıcı oluştur
        const authUser = await admin.auth().createUser({
          email: email,
          password: password,
          displayName: data.username,
          disabled: data.isActive === false,
        });

        logger.info(
            `Firebase Auth user created: ${authUser.uid} for ${email}`,
        );

        // Firestore'da authUid'yi güncelle
        await event.data.ref.update({
          authUid: authUser.uid,
        });

        logger.info(
            `Updated member_user ${userId} with authUid: ${authUser.uid}`,
        );
        return null;
      } catch (error) {
        logger.error(
            `Error creating Firebase Auth user for ${userId}:`,
            error,
        );

        // Email zaten kullanılıyorsa, bu normal bir durum
        if (error.code === "auth/email-already-exists") {
          logger.warn(
              `Email already exists: ${formatEmail(data.username)}`,
          );
          return null;
        }

        // Diğer hatalar için throw et (retry için)
        throw error;
      }
    },
);

/**
 * Member User güncellendiğinde Firebase Auth'da da güncelle
 */
exports.onMemberUserUpdate = onDocumentUpdated(
    {
      document: "member_users/{userId}",
      region: "europe-west1",
    },
    async (event) => {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();
      const userId = event.params.userId;

      logger.info(
          `Updating Firebase Auth user for member_user: ${userId}`,
      );

      try {
        // Eğer authUid yoksa, onCreate trigger'ı çalışacak
        if (!afterData.authUid) {
          logger.info(
              `No authUid for user ${userId}, onCreate will handle it`,
          );
          return null;
        }

        const authUid = afterData.authUid;

        // Email değişti mi?
        const beforeEmail = formatEmail(beforeData.username);
        const afterEmail = formatEmail(afterData.username);
        const emailChanged = beforeEmail !== afterEmail;

        // Şifre değişti mi?
        const passwordChanged = beforeData.password !== afterData.password;

        // isActive değişti mi?
        const activeChanged = beforeData.isActive !== afterData.isActive;

        // DisplayName değişti mi?
        const displayNameChanged = beforeData.username !== afterData.username;

        // Hiçbir şey değişmediyse, atla
        if (!emailChanged && !passwordChanged &&
            !activeChanged && !displayNameChanged) {
          logger.info(`No relevant changes for user ${userId}`);
          return null;
        }

        // Firebase Auth kullanıcısını güncelle
        const updateData = {};

        if (emailChanged && afterEmail) {
          updateData.email = afterEmail;
        }

        if (displayNameChanged && afterData.username) {
          updateData.displayName = afterData.username;
        }

        if (activeChanged !== undefined) {
          updateData.disabled = afterData.isActive === false;
        }

        // Şifre değiştiyse, güncelle
        if (passwordChanged && afterData.password) {
          const decryptedPassword = decryptPassword(afterData.password);
          if (decryptedPassword) {
            let password = decryptedPassword;
            if (password.length < 6) {
              password = password.padStart(6, "0");
            }
            updateData.password = password;
          }
        }

        // Güncelleme yap
        if (Object.keys(updateData).length > 0) {
          await admin.auth().updateUser(authUid, updateData);
          logger.info(
              `Firebase Auth user updated: ${authUid}`,
              updateData,
          );
        }

        return null;
      } catch (error) {
        logger.error(
            `Error updating Firebase Auth user for ${userId}:`,
            error,
        );

        // Kullanıcı bulunamadıysa, onCreate trigger'ı çalışacak
        if (error.code === "auth/user-not-found") {
          logger.warn(
              `Firebase Auth user not found: ${afterData.authUid}, ` +
              "onCreate will handle it",
          );
          // authUid'yi temizle, onCreate trigger'ı yeni kullanıcı oluşturacak
          await event.data.after.ref.update({
            authUid: admin.firestore.FieldValue.delete(),
          });
          return null;
        }

        throw error;
      }
    },
);

/**
 * Member User silindiğinde Firebase Auth'dan da sil
 */
exports.onMemberUserDelete = onDocumentDeleted(
    {
      document: "member_users/{userId}",
      region: "europe-west1",
    },
    async (event) => {
      const data = event.data.data();
      const userId = event.params.userId;

      logger.info(
          `Deleting Firebase Auth user for member_user: ${userId}`,
      );

      try {
        // Eğer authUid yoksa, Firebase Auth'da kullanıcı yok demektir
        if (!data.authUid) {
          logger.info(
              `No authUid for user ${userId}, nothing to delete`,
          );
          return null;
        }

        // Firebase Auth'dan kullanıcıyı sil
        await admin.auth().deleteUser(data.authUid);
        logger.info(`Firebase Auth user deleted: ${data.authUid}`);
        return null;
      } catch (error) {
        logger.error(
            `Error deleting Firebase Auth user for ${userId}:`,
            error,
        );

        // Kullanıcı zaten silinmişse, bu normal bir durum
        if (error.code === "auth/user-not-found") {
          logger.warn(
              `Firebase Auth user already deleted: ${data.authUid}`,
          );
          return null;
        }

        // Diğer hatalar için throw et (retry için)
        throw error;
      }
    },
);
