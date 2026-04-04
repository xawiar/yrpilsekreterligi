import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import * as Sentry from '@sentry/react'
import { loadBrandingSettings, loadThemeSettings } from './utils/brandingLoader'

// Uygulama basladiginda branding ve tema ayarlarini yukle
loadBrandingSettings().then(settings => {
  if (settings) {
    console.log('✅ Branding settings loaded');
  }
});

loadThemeSettings().then(theme => {
  if (theme) {
    console.log('✅ Theme settings loaded');
  }
});

// FCM foreground mesaj dinleyicisini baslat
import('./utils/fcmTokenManager').then(({ listenToFcmMessages }) => {
  listenToFcmMessages((payload) => {
    console.log('FCM message in foreground:', payload?.notification?.title);
  });
}).catch(() => {});

// Push token kaydet — login olunca calisir
// localStorage'da user olana kadar bekle (max 30sn)
function tryPushSetup(attempt) {
  if (attempt > 15) return; // 30sn sonra vazgec
  const savedUser = localStorage.getItem('user');
  if (!savedUser) {
    setTimeout(function() { tryPushSetup(attempt + 1); }, 2000);
    return;
  }
  setupPush(savedUser);
}
setTimeout(function() { tryPushSetup(0); }, 2000);

async function setupPush(savedUser) {
  try {
    console.error('[PUSH] User found, starting push setup...');
    const user = JSON.parse(savedUser);
    const userId = user.id || user.uid || '';
    if (!userId) { console.error('[PUSH] No userId'); return; }
    console.error('[PUSH] userId:', userId);

    // Bildirim izni iste
    if (typeof Notification === 'undefined') { console.error('[PUSH] No Notification API'); return; }
    if (Notification.permission === 'denied') { console.error('[PUSH] Permission denied'); return; }

    let perm = Notification.permission;
    console.error('[PUSH] Current permission:', perm);
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
      console.error('[PUSH] After request:', perm);
    }
    if (perm !== 'granted') { console.error('[PUSH] Still not granted'); return; }

    // Service worker hazir mi
    if (!('serviceWorker' in navigator)) { console.error('[PUSH] No SW'); return; }
    console.error('[PUSH] Waiting for SW ready...');
    const reg = await navigator.serviceWorker.ready;
    console.error('[PUSH] SW ready');

    // VAPID key
    const vapidKey = 'BJjc4yxeV5_GZkrrk70VPsvGoFJ6x3aSwRoxD5mtWOlNxJhkq99DcB56cJmzX7O-VRTlXpPJAZLEan7b_VpDtEE';
    const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
    const b64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(b64);
    const keyArr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) keyArr[i] = raw.charCodeAt(i);

    // Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArr.buffer
    });

    // Firestore'a kaydet
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./config/firebase');
    if (db) {
      const subJson = JSON.stringify(sub);
      const tokenData = {
        subscription: subJson,
        userId: userId,
        updatedAt: new Date().toISOString(),
        isActive: true
      };
      // Auth UID ile kaydet
      await setDoc(doc(db, 'push_tokens', userId), tokenData);
      // Members ID ile de kaydet (bildirim sistemi bu ID'yi kullaniyor)
      const memberId = user.memberId || user.member_id || '';
      if (memberId && memberId !== userId) {
        await setDoc(doc(db, 'push_tokens', String(memberId)), { ...tokenData, userId: String(memberId) });
        console.error('[PUSH] TOKEN SAVED for both:', userId, 'and', memberId);
      } else {
        // memberId yoksa, tum members'i tara ve esle
        try {
          const { collection: col, getDocs: gd, query: q, where: w } = await import('firebase/firestore');
          const membersSnap = await gd(col(db, 'members'));
          const authUid = userId;
          // member_users'dan bu auth uid ile eslesen member bul
          const muSnap = await gd(col(db, 'member_users'));
          let foundMemberId = null;
          muSnap.forEach((d) => {
            if (d.data().authUid === authUid || d.data().auth_uid === authUid) {
              foundMemberId = d.data().memberId || d.data().member_id || d.id;
            }
          });
          if (foundMemberId) {
            await setDoc(doc(db, 'push_tokens', String(foundMemberId)), { ...tokenData, userId: String(foundMemberId) });
            console.error('[PUSH] TOKEN SAVED for member:', foundMemberId);
          }
        } catch (_e) { /* sessiz */ }
        console.error('[PUSH] TOKEN SAVED OK for:', userId);
      }
    } else {
      console.error('[PUSH] No db!');
    }
  } catch (err) {
    console.error('[PUSH] FATAL ERROR:', err.message, err);
  }
}

// Firebase kullanımı kontrolü
const USE_FIREBASE = 
  import.meta.env.VITE_USE_FIREBASE === 'true' || 
  import.meta.env.VITE_USE_FIREBASE === true ||
  String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname.includes('render.com') && import.meta.env.VITE_USE_FIREBASE !== undefined);

// Filter out connection refused errors from console and window errors
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Filter console.error - AGGRESSIVE filtering for localhost:5000 errors
console.error = (...args) => {
  const message = args.join(' ');
  
  // Don't log connection refused errors to localhost:5182 (dev server)
  if (message.includes('ERR_CONNECTION_REFUSED') && message.includes('localhost:5182')) {
    return; // Silently ignore
  }
  
  // Don't log connection refused errors to localhost:5000 if Firebase is enabled
  if (USE_FIREBASE) {
    if (
      message.includes('ERR_CONNECTION_REFUSED') ||
      message.includes('ERR_FAILED') ||
      message.includes('Failed to fetch') ||
      message.includes('localhost:5000') ||
      message.includes('/api/') ||
      message.includes('district-officials') ||
      message.includes('visits/counts') ||
      message.includes('deputy-inspectors') ||
      message.includes('/api/health') ||
      message.includes('/api/regions') ||
      message.includes('/api/auth/admin') ||
      message.includes('/api/positions')
    ) {
      return; // Silently ignore ALL localhost:5000 related errors
    }
  }
  
  originalConsoleError.apply(console, args);
};

// Filter console.warn for localhost:5000 errors
console.warn = (...args) => {
  const message = args.join(' ');
  if (USE_FIREBASE && (
    message.includes('localhost:5000') ||
    message.includes('ERR_CONNECTION_REFUSED') ||
    message.includes('Failed to fetch') ||
    message.includes('/api/')
  )) {
    return; // Silently ignore
  }
  originalConsoleWarn.apply(console, args);
};

// Also filter console.log for network errors (some libraries log errors via console.log)
// Production'da console.log'ları tamamen kaldır (performans ve güvenlik için)
// Ancak notification debug log'larını koru
console.log = (...args) => {
  const message = args.join(' ');
  
  // Notification debug log'larını her zaman göster (🔔, 📬, ✅, ❌, 📝, 🔍, 📊 gibi emoji'lerle başlayanlar)
  const isNotificationDebug = /^[🔔📬✅❌📝🔍📊⚠️]/.test(message);
  if (isNotificationDebug) {
    originalConsoleLog.apply(console, args);
    return;
  }
  
  // Production'da diğer console.log'ları kaldır
  if (import.meta.env.PROD) {
    return; // Silently ignore all console.log in production
  }
  
  if (USE_FIREBASE && (
    message.includes('ERR_CONNECTION_REFUSED') ||
    message.includes('localhost:5000') ||
    message.includes('Failed to load resource')
  )) {
    return; // Silently ignore
  }
  originalConsoleLog.apply(console, args);
};

// Production'da console.warn ve console.info'yu da kaldır
if (import.meta.env.PROD) {
  console.warn = () => {}; // Production'da warn'ları kaldır
  console.info = () => {}; // Production'da info'ları kaldır
  console.debug = () => {}; // Production'da debug'ları kaldır
  // console.error tutuluyor - Sentry için gerekli
}

// Filter window error events for localhost connection errors
const originalErrorHandler = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
  if (message && typeof message === 'string') {
    // Ignore localhost:5182 errors (dev server)
    if (message.includes('ERR_CONNECTION_REFUSED') && message.includes('localhost:5182')) {
      return true; // Prevent default error handling
    }
    // Ignore localhost:5000 errors if Firebase is enabled
    if (USE_FIREBASE && message.includes('ERR_CONNECTION_REFUSED') && message.includes('localhost:5000')) {
      return true; // Prevent default error handling
    }
  }
  if (originalErrorHandler) {
    return originalErrorHandler.call(this, message, source, lineno, colno, error);
  }
  return false;
};

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE || 'development',
    beforeSend(event, hint) {
      // Ignore connection refused errors from localhost:5182 (dev server)
      if (hint?.originalException?.message?.includes('ERR_CONNECTION_REFUSED') ||
          hint?.originalException?.message?.includes('localhost:5182') ||
          hint?.syntheticException?.message?.includes('ERR_CONNECTION_REFUSED')) {
        return null; // Don't send to Sentry
      }
      // Ignore localhost:5000 errors if Firebase is enabled
      if (USE_FIREBASE && (hint?.originalException?.message?.includes('localhost:5000') ||
          hint?.syntheticException?.message?.includes('localhost:5000'))) {
        return null; // Don't send to Sentry
      }
      return event;
    },
    ignoreErrors: [
      'ERR_CONNECTION_REFUSED',
      'Failed to fetch',
      /localhost:5182/,
      /localhost:5000/,
      /ping.*localhost/,
    ],
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)