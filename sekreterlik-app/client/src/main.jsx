import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'
import * as Sentry from '@sentry/react'
import { loadBrandingSettings, loadThemeSettings } from './utils/brandingLoader'

// Uygulama basladiginda branding ve tema ayarlarini yukle
loadBrandingSettings().then(settings => {
  if (settings) {
  }
});

loadThemeSettings().then(theme => {
  if (theme) {
  }
});

// FCM foreground mesaj dinleyicisini baslat
import('./utils/fcmTokenManager').then(({ listenToFcmMessages }) => {
  listenToFcmMessages((payload) => {
  });
}).catch(() => {});

// Push setup moved to AuthContext.jsx login flow

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