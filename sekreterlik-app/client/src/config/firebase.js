// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA0wDM5fXHtm0uDlALRhkQzF7tpsZ-7BZI",
  authDomain: "spilsekreterligi.firebaseapp.com",
  projectId: "spilsekreterligi",
  storageBucket: "spilsekreterligi.firebasestorage.app",
  messagingSenderId: "692841027309",
  appId: "1:692841027309:web:d702e7f55031de5eef5ee4",
  measurementId: "G-0X605S84W1"
};

// Initialize Firebase - Check if app already exists
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  // If getApp fails, try to initialize
  app = initializeApp(firebaseConfig);
}

// Initialize Firebase services - Browser-safe initialization
let analytics = null;
let auth = null;
let db = null;
let storage = null;
let messaging = null;

// Firestore database adı
const FIRESTORE_DATABASE_NAME = 'yrpilsekreterligi';

if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    auth = getAuth(app);
    // Belirtilen database adı ile Firestore'u başlat
    db = getFirestore(app, FIRESTORE_DATABASE_NAME);
    storage = getStorage(app);

    // FCM Messaging baslat (destekleniyorsa)
    isMessagingSupported().then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
        console.log('✅ Firebase Messaging initialized');
      } else {
        console.warn('⚠️ Firebase Messaging is not supported in this browser');
      }
    }).catch((err) => {
      console.warn('⚠️ Firebase Messaging init check failed:', err);
    });

    console.log('✅ Firebase initialized with database:', FIRESTORE_DATABASE_NAME);

    // QUIC protokol hatalarını azaltmak için network bağlantısını optimize et
    // enableNetwork ile bağlantıyı aktif tut
    enableNetwork(db).catch(err => {
      console.warn('⚠️ Firestore network enable warning (non-critical):', err);
    });
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // Fallback: Initialize without analytics
    auth = getAuth(app);
    // Belirtilen database adı ile Firestore'u başlat
    db = getFirestore(app, FIRESTORE_DATABASE_NAME);
    storage = getStorage(app);
    console.log('✅ Firebase initialized (fallback) with database:', FIRESTORE_DATABASE_NAME);
    
    // Network bağlantısını aktif tut
    enableNetwork(db).catch(err => {
      console.warn('⚠️ Firestore network enable warning (non-critical):', err);
    });
  }
} else {
  // Server-side: Only initialize core services
  auth = getAuth(app);
  // Belirtilen database adı ile Firestore'u başlat
  db = getFirestore(app, FIRESTORE_DATABASE_NAME);
  storage = getStorage(app);
}

// FCM messaging nesnesini lazy olarak al (async init sebebiyle)
export const getFirebaseMessaging = () => messaging;

export { analytics, auth, db, storage, messaging };

export default app;

