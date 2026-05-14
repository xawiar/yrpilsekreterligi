import React, { useState, useEffect } from 'react';
import { getQueueCount } from '../utils/offlineQueue';
import { setSyncStatusCallback } from '../utils/offlineSync';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  // Sync tamamlandığında 5 sn süreyle toast göster — müşahit
  // çevrimdışı kaydettiği sonuçların sunucuya gittiğini görmeli.
  const [syncToast, setSyncToast] = useState(null); // { synced, failed }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const count = await getQueueCount();
        setQueueCount(count);
      } catch (e) {
        // IndexedDB unavailable — ignore silently
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Offline sync sonrası toast — müşahit "çevrimdışı kaydettiklerim gitti mi?" görsün
  useEffect(() => {
    setSyncStatusCallback((status, stats) => {
      if ((status === 'done' || status === 'partial') && stats && stats.synced > 0) {
        setSyncToast({ synced: stats.synced, failed: stats.failed || 0 });
        setTimeout(() => setSyncToast(null), 6000);
      }
    });
    return () => setSyncStatusCallback(null);
  }, []);

  // Hiçbir durum yoksa hiç render etme
  if (isOnline && queueCount === 0 && !syncToast) return null;

  return (
    <>
      {(!isOnline || queueCount > 0) && (
        <div className={`fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 rounded-xl shadow-lg p-3 text-sm font-medium ${
          !isOnline
            ? 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            : 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }`}>
          {!isOnline ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Çevrimdışı — Veriler yerel olarak kaydediliyor</span>
              {queueCount > 0 && <span className="ml-auto font-bold">{queueCount} bekliyor</span>}
            </div>
          ) : queueCount > 0 ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>{queueCount} sonuç senkronize ediliyor...</span>
            </div>
          ) : null}
        </div>
      )}

      {syncToast && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 rounded-xl shadow-lg p-4 text-sm font-medium bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100">
          <div className="flex items-start gap-2">
            <div className="text-xl">✅</div>
            <div className="flex-1">
              <div className="font-semibold">
                Çevrimdışı sonuç{syncToast.synced > 1 ? 'larınız' : 'unuz'} sunucuya gönderildi
              </div>
              <div className="text-xs opacity-80 mt-0.5">
                {syncToast.synced} kayıt başarıyla gönderildi
                {syncToast.failed > 0 && ` (${syncToast.failed} hata)`}.
              </div>
            </div>
            <button
              onClick={() => setSyncToast(null)}
              className="text-green-700 dark:text-green-300 opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineIndicator;
