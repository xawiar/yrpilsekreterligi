import React, { useState, useEffect } from 'react';
import { getQueueCount } from '../utils/offlineQueue';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);

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
      const count = await getQueueCount();
      setQueueCount(count);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isOnline && queueCount === 0) return null;

  return (
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
  );
};

export default OfflineIndicator;
