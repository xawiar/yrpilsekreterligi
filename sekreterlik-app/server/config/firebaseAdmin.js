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

  const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';
  
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
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
    
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

