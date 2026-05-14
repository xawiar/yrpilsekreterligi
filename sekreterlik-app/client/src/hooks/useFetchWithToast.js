import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';

/**
 * Sessiz fetch hatası pattern'ini çözen yardımcı hook.
 *
 * 120+ yerde şu pattern var:
 *   try { ... } catch (e) { console.error('Error fetching X:', e); }
 * Sonuç: kullanıcı boş ekran görür, niye yüklenmediğini bilmez.
 *
 * Bu hook ile:
 *   const fetchWithToast = useFetchWithToast();
 *   const data = await fetchWithToast(
 *     () => ApiService.getMeetings(),
 *     { errorMessage: 'Toplantılar yüklenemedi' }
 *   );
 *
 * Hata olursa: console.error log + toast.error('Toplantılar yüklenemedi: ...')
 * Başarı: data döner.
 *
 * Mevcut sayfaları refactor etmek zorunda değilsin — sadece yeni eklenenler veya
 * sorun çıkanlar için kullan. Eski catch bloklarına manuel toast.error eklemek de
 * yeterli (bu hook onu DRY-ifiye eder).
 */
export function useFetchWithToast() {
  const toast = useToast();

  return useCallback(async (fetchFn, options = {}) => {
    const {
      errorMessage = 'Veri yüklenemedi',
      logContext = 'fetchWithToast',
      throwOnError = false,
      defaultValue = null,
    } = options;

    try {
      return await fetchFn();
    } catch (err) {
      console.error(`[${logContext}]`, err);
      const detail = err?.message ? `: ${err.message}` : '';
      try {
        toast?.error?.(errorMessage + detail);
      } catch (_) { /* toast yoksa sessiz geç */ }
      if (throwOnError) throw err;
      return defaultValue;
    }
  }, [toast]);
}

export default useFetchWithToast;
