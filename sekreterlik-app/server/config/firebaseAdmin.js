const admin = require('firebase-admin');

let firebaseAdminInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Service account key gerekli - environment variable'dan alınır
 */
function initFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return admin;
  }

  // USE_FIREBASE kontrolü - Eğer açıkça false değilse Firebase kullan
  // Frontend'de VITE_USE_FIREBASE=true olduğu için backend'de de varsayılan olarak true kabul et
  const USE_FIREBASE = process.env.VITE_USE_FIREBASE !== 'false' && process.env.USE_FIREBASE !== 'false';
  
  if (!USE_FIREBASE) {
    console.log('Firebase Admin SDK: Firebase kullanılmıyor, skip ediliyor');
    return null;
  }

  try {
    // Service account key environment variable'dan alınır
    // Format: JSON string veya base64 encoded JSON
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      console.warn('⚠️ Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable bulunamadı');
      console.warn('   Firebase Auth şifre güncellemeleri çalışmayacak');
      return null;
    }

    let serviceAccount;
    try {
      // Önce JSON string olarak parse etmeyi dene
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch (e) {
      // JSON parse başarısız olursa, base64 decode etmeyi dene
      try {
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(decoded);
      } catch (e2) {
        console.error('❌ Firebase Admin SDK: Service account key parse edilemedi');
        return null;
      }
    }

    // Firebase Admin SDK'yı initialize et
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
    
    // Frontend'deki database adı ile eşleşmeli: 'yrpilsekreterligi'
    // Firebase Admin SDK'da database adını belirtmek için getFirestore kullan
    // NOT: Firebase Admin SDK'da database adı belirtmek için admin.firestore() yerine
    // admin.firestore().database('yrpilsekreterligi') kullanılmalı ama bu API mevcut değil
    // Bu yüzden varsayılan database'i kullanıyoruz ve frontend'in de varsayılan database'i kullanması gerekiyor
    // VEYA Firebase Console'da 'yrpilsekreterligi' database'ini default database olarak ayarlayın
    
    firebaseAdminInitialized = true;
    return admin;
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization error:', error);
    return null;
  }
}

module.exports = {
  initFirebaseAdmin,
  getAdmin: () => {
    if (!firebaseAdminInitialized) {
      return initFirebaseAdmin();
    }
    return admin;
  }
};

