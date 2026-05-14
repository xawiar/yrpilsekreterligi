import React, { useEffect, useState, useCallback } from 'react';
import { subscribeAnonymousPush, ANON_PUSH_KEYS } from '../services/NotificationService';

/**
 * App-shell-level anonim push aboneliği banner'ı.
 *
 * - Tek bir route'a değil tüm uygulamaya tutturulu (App.jsx en altta render edilir).
 * - Login durumundan bağımsız çalışır — login olanlar AuthContext'te ayrı akışla
 *   abone olur, bu banner sadece anonim ziyaretçiler için.
 * - "anon_push_dismissed" localStorage flag'i 30 gün sonra expire olur — kullanıcı
 *   fikir değiştirebilsin diye süre sınırlı.
 * - iOS Safari'de PWA standalone değilse "Önce Ana Ekrana Ekle" yönergesi gösterir
 *   (iOS push 16.4+'da sadece standalone PWA'da çalışıyor).
 */

const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün
const SHOW_DELAY_MS = 6000;

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPad iPadOS 13+'da MacIntel olarak görünür, touchPoints kontrolü ile yakala
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || isIPadOS;
}

function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  // iOS legacy
  if (window.navigator && window.navigator.standalone === true) return true;
  // Modern matchMedia
  try {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  } catch (_) {
    return false;
  }
}

function isDismissedFresh() {
  try {
    const raw = localStorage.getItem(ANON_PUSH_KEYS.DISMISSED);
    if (!raw) return false;
    // Yeni format: timestamp string. Eski: "true". Geriye uyum.
    if (raw === 'true') {
      // Eski format, hemen geçersiz say (30 gün TTL'ye geçiş için)
      try { localStorage.removeItem(ANON_PUSH_KEYS.DISMISSED); } catch (_) {}
      return false;
    }
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch (_) {
    return false;
  }
}

function markDismissed() {
  try { localStorage.setItem(ANON_PUSH_KEYS.DISMISSED, String(Date.now())); } catch (_) {}
}

const AnonymousPushBanner = () => {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [toast, setToast] = useState(null);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  const evaluateAndShow = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Tarayıcı destek kontrolü
    if (typeof Notification === 'undefined') {
      // iOS Safari < 16.4 — Notification API yok. iOS standalone değilse "Add to Home Screen" yönergesi.
      if (isIOSDevice() && !isStandalonePWA()) {
        if (!isDismissedFresh()) setIosNeedsInstall(true);
      }
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // Permission DENIED → hiçbir şey yapma
    if (Notification.permission === 'denied') return;

    // Permission GRANTED → SESSIZ otomatik abone ol (banner gerek yok)
    // Bu kritik: kullanıcı zaten izin vermiş, banner'ı tekrar gösterip
    // soru sormaya gerek yok. Anon doc oluştur, çıkış yapmış üyelere ve
    // henüz hiç login olmamış indirenlere bildirim akışını garantile.
    if (Notification.permission === 'granted') {
      try {
        const ANON_KEY = 'anon_push_id';
        const existingAnonId = localStorage.getItem(ANON_KEY);
        // Eğer anon doc zaten oluşturulmuşsa Firestore'da kontrol etmeye gerek yok
        // (subscribeAnonymousPush idempotent — overwrite eder, zarar yok)
        const r = await subscribeAnonymousPush();
        if (r?.success) {
          console.log('[ANON-PUSH] Sessiz auto-subscribe başarılı:', r.anonId,
            existingAnonId ? '(mevcut ID kullanıldı)' : '(yeni ID oluşturuldu)');
        } else {
          console.warn('[ANON-PUSH] Auto-subscribe başarısız:', r?.error);
        }
      } catch (e) {
        console.warn('[ANON-PUSH] Auto-subscribe hatası:', e);
      }
      return; // Banner gösterme
    }

    // Permission DEFAULT → banner göster (kullanıcı izin verecek)
    if (isDismissedFresh()) return;

    // iOS Safari sekmesinde (standalone değil) push subscribe çalışmıyor
    if (isIOSDevice() && !isStandalonePWA()) {
      setIosNeedsInstall(true);
      return;
    }

    setVisible(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(evaluateAndShow, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [evaluateAndShow]);

  const handleAccept = async () => {
    setSubscribing(true);
    try {
      const res = await subscribeAnonymousPush();
      if (res.success) {
        setToast({ type: 'success', message: 'Bildirim aboneliğiniz açıldı.' });
        markDismissed();
        setVisible(false);
      } else {
        const msg = res.error === 'permission-denied'
          ? 'Bildirim izni reddedildi. Tarayıcı ayarlarından açabilirsiniz.'
          : res.error === 'unsupported'
            ? 'Tarayıcınız bildirim desteklemiyor.'
            : 'Abonelik başarısız. Lütfen tekrar deneyin.';
        setToast({ type: 'error', message: msg });
      }
    } catch (_) {
      setToast({ type: 'error', message: 'Abonelik sırasında hata oluştu.' });
    } finally {
      setSubscribing(false);
      setTimeout(() => setToast(null), 4500);
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setVisible(false);
    setIosNeedsInstall(false);
  };

  // iOS install yönergesi — standalone değilse
  if (iosNeedsInstall) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 rounded-2xl shadow-2xl p-4 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-2xl">
            📱
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Bildirim almak için Ana Ekrana Ekleyin
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              iOS'ta bildirimler sadece "Ana Ekrana Ekle" ile yüklenmiş uygulamalarda çalışıyor:
            </p>
            <ol className="text-xs text-gray-700 dark:text-gray-300 mt-2 space-y-1 list-decimal list-inside">
              <li>Safari'de altta paylaş ikonuna <span className="font-mono">⬆️</span> dokunun</li>
              <li>"Ana Ekrana Ekle" seçeneğine basın</li>
              <li>Eklenen uygulamayı ana ekrandan açın</li>
              <li>Bildirim izni o zaman açılacak</li>
            </ol>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (!visible && !toast) return null;

  return (
    <>
      {visible && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-white dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl shadow-2xl p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl">
              🔔
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Bildirimleri açmak ister misiniz?
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                Önemli duyurular, anketler ve toplantı bildirimleri size ulaşsın.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  disabled={subscribing}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {subscribing ? 'Açılıyor...' : 'Evet, aç'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Şimdi değil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[60] rounded-xl shadow-lg p-3 text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100'
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
        }`}>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slideUp 0.4s ease-out; }
      `}</style>
    </>
  );
};

export default AnonymousPushBanner;
