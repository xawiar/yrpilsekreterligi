import { lazy } from 'react';

// Yeni deploy sonrası tarayıcı eski hash'li chunk'ı arıyor → 404 → server SPA fallback ile
// index.html dönüyor → "Failed to load module script: ... MIME type 'text/html'" hatası.
// Tek seferlik reload ile yeni manifest'i çekip kurtarıyoruz.
const STORAGE_KEY = 'app-chunk-refreshed';

export const lazyWithRetry = (componentImport) => {
  return lazy(async () => {
    const alreadyRefreshed = (() => {
      try {
        return window.sessionStorage.getItem(STORAGE_KEY) === '1';
      } catch (_) {
        return false;
      }
    })();

    try {
      const component = await componentImport();
      try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
      return component;
    } catch (error) {
      const msg = String(error?.message || '');
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Failed to load module script') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('MIME type');

      if (isChunkError && !alreadyRefreshed) {
        try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
        window.location.reload();
        return new Promise(() => {}); // reload sırasında suspense askıda kalsın
      }
      throw error;
    }
  });
};

export default lazyWithRetry;
