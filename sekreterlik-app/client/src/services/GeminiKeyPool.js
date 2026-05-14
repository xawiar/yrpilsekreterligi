/**
 * Gemini API Key Pool
 *
 * Round-robin key seçimi + 429 (rate limit) ve 401/403 (geçersiz key) için
 * cooldown listesi. Seçim günü gibi yüksek yükte tek key'in kotasını
 * patlatmamak için 5 keye kadar paralel çalışılabilir.
 *
 * Firestore yapısı:
 *   gemini_api_config/pool → { keys: [enc1, enc2, ...], updated_at }
 *
 * Geri uyumluluk:
 *   pool boşsa /ocr ve /main key'leri kullanılır.
 */

const COOLDOWN_RATE_LIMIT_MS = 60 * 1000; // 1 dk
const COOLDOWN_INVALID_MS = 24 * 60 * 60 * 1000; // 24 saat (yanlış key uzun süre cezalı)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dk pool cache

class GeminiKeyPoolService {
  constructor() {
    this._keys = [];
    this._cooldown = new Map();
    this._cursor = 0;
    this._cachedAt = 0;
    this._loadingPromise = null;
    this._stats = {
      requestCount: 0,
      successCount: 0,
      rateLimitCount: 0,
      invalidKeyCount: 0,
      lastError: null,
    };
  }

  async _loadKeys(force = false) {
    const now = Date.now();
    if (!force && this._keys.length > 0 && now - this._cachedAt < CACHE_TTL_MS) {
      return;
    }
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = (async () => {
      const collected = [];
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

      if (USE_FIREBASE) {
        try {
          const FirebaseService = (await import('./FirebaseService')).default;
          const { decryptData } = await import('../utils/crypto');

          const decode = (enc) => {
            if (!enc) return null;
            try {
              return enc.startsWith('U2FsdGVkX1') ? decryptData(enc) : enc;
            } catch (_) {
              return null;
            }
          };

          // 1) pool doc
          try {
            const poolDoc = await FirebaseService.getById('gemini_api_config', 'pool');
            if (poolDoc && Array.isArray(poolDoc.keys)) {
              for (const enc of poolDoc.keys) {
                const k = decode(enc);
                if (k && !collected.includes(k)) collected.push(k);
              }
            }
          } catch (_) { /* ignore */ }

          // 2) ocr fallback
          try {
            const ocrDoc = await FirebaseService.getById('gemini_api_config', 'ocr');
            if (ocrDoc && ocrDoc.api_key) {
              const k = decode(ocrDoc.api_key);
              if (k && !collected.includes(k)) collected.push(k);
            }
          } catch (_) { /* ignore */ }

          // 3) main fallback
          try {
            const mainDoc = await FirebaseService.getById('gemini_api_config', 'main');
            if (mainDoc && mainDoc.api_key) {
              const k = decode(mainDoc.api_key);
              if (k && !collected.includes(k)) collected.push(k);
            }
          } catch (_) { /* ignore */ }
        } catch (err) {
          console.warn('[GeminiKeyPool] Firestore okuma hatası:', err.message);
        }
      }

      // 4) env fallback
      const envOcr = import.meta.env.VITE_GEMINI_OCR_API_KEY;
      if (envOcr && !collected.includes(envOcr)) collected.push(envOcr);
      const envGen = import.meta.env.VITE_GEMINI_API_KEY;
      if (envGen && !collected.includes(envGen)) collected.push(envGen);

      this._keys = collected;
      this._cachedAt = Date.now();

      const masked = collected.map((k) => `${k.slice(0, 10)}…${k.slice(-4)}`);
      console.log(`[GeminiKeyPool] ${collected.length} key yüklendi:`, masked);
    })();

    try {
      await this._loadingPromise;
    } finally {
      this._loadingPromise = null;
    }
  }

  /** Cooldown'da olmayan key'lerin listesini döner. */
  _availableKeys() {
    const now = Date.now();
    return this._keys.filter((k) => {
      const until = this._cooldown.get(k);
      if (!until) return true;
      if (now >= until) {
        this._cooldown.delete(k);
        return true;
      }
      return false;
    });
  }

  /**
   * Round-robin ile bir key döner. Pool boşsa veya hepsi cooldown'daysa
   * Error fırlatır. Çağıran fetch sonrası markRateLimited/markInvalid çağırmalı.
   * @returns {Promise<string>}
   */
  async getNextAvailableKey() {
    await this._loadKeys();

    if (this._keys.length === 0) {
      throw new Error(
        'Gemini API key bulunamadı. Admin → Ayarlar → Gemini AI\'dan key ekleyin.'
      );
    }

    const available = this._availableKeys();
    if (available.length === 0) {
      const earliest = Math.min(...Array.from(this._cooldown.values()));
      const waitSec = Math.max(1, Math.ceil((earliest - Date.now()) / 1000));
      throw new Error(
        `Tüm Gemini API anahtarları kotada — ${waitSec} sn sonra tekrar deneyin. ` +
        'Ayarlar → Gemini AI\'dan yeni key ekleyebilirsiniz.'
      );
    }

    this._cursor = (this._cursor + 1) % available.length;
    this._stats.requestCount++;
    return available[this._cursor];
  }

  markSuccess() {
    this._stats.successCount++;
  }

  /** 429 → 60 sn cooldown */
  markRateLimited(key) {
    if (!key) return;
    this._cooldown.set(key, Date.now() + COOLDOWN_RATE_LIMIT_MS);
    this._stats.rateLimitCount++;
    this._stats.lastError = { type: '429', at: new Date().toISOString() };
    const masked = `${key.slice(0, 10)}…${key.slice(-4)}`;
    console.warn(`[GeminiKeyPool] ${masked} 60sn cooldown'da (429)`);
  }

  /** 401/403 → 24 saat cooldown (geçersiz key) */
  markInvalid(key, status) {
    if (!key) return;
    this._cooldown.set(key, Date.now() + COOLDOWN_INVALID_MS);
    this._stats.invalidKeyCount++;
    this._stats.lastError = { type: String(status || 'invalid'), at: new Date().toISOString() };
    const masked = `${key.slice(0, 10)}…${key.slice(-4)}`;
    console.warn(`[GeminiKeyPool] ${masked} 24 saat cooldown'da (${status})`);
  }

  /**
   * 429 ya da 5xx aldığında otomatik fallback için. Çağıran try/catch içinde
   * call eder, fonksiyon başka key ile retry eder. Hepsi düşerse error.
   *
   * @param {(apiKey: string) => Promise<Response>} fetchFn
   * @returns {Promise<Response>} ok response
   */
  async fetchWithFallback(fetchFn) {
    await this._loadKeys();
    if (this._keys.length === 0) {
      throw new Error('Gemini API key bulunamadı.');
    }

    let lastError = null;
    let attempts = 0;
    const maxAttempts = Math.max(1, Math.min(this._keys.length, 5));

    while (attempts < maxAttempts) {
      attempts++;
      let key;
      try {
        key = await this.getNextAvailableKey();
      } catch (err) {
        lastError = err;
        break;
      }

      let resp;
      try {
        resp = await fetchFn(key);
      } catch (err) {
        lastError = err;
        continue;
      }

      if (resp.ok) {
        this.markSuccess();
        return resp;
      }

      if (resp.status === 429) {
        this.markRateLimited(key);
        lastError = new Error(`429 rate limit (key ${key.slice(-4)})`);
        continue;
      }

      if (resp.status === 401 || resp.status === 403) {
        this.markInvalid(key, resp.status);
        lastError = new Error(`${resp.status} invalid key`);
        continue;
      }

      // Diğer hatalar — retry etmeye değmez, üst katmana bırak
      return resp;
    }

    throw lastError || new Error('Tüm Gemini key denemeleri başarısız.');
  }

  getStatus() {
    const available = this._availableKeys().length;
    return {
      total: this._keys.length,
      available,
      cooldown: this._keys.length - available,
      stats: { ...this._stats },
    };
  }

  /** Admin UI'dan key güncellendikten sonra çağrılır → cache invalidate */
  async refresh() {
    this._cachedAt = 0;
    await this._loadKeys(true);
  }
}

const GeminiKeyPool = new GeminiKeyPoolService();
export default GeminiKeyPool;
