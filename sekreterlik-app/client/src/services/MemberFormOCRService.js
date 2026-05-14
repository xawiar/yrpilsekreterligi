/**
 * Member Form OCR Service
 * Parti üye formlarını (elle doldurulmuş) fotoğraftan okur,
 * TC/telefon/doğum tarihi/ad-soyad/seri no çıkarır.
 *
 * - Tek fotoğrafta birden çok form olabilir → array döner
 * - Sütun yanlış kullanılmış olabilir → içeriğe göre post-process
 * - TC ve telefon ayırımı: 11 hane + 05 ile başlıyorsa telefon
 */

import GeminiKeyPool from './GeminiKeyPool';

// gemini-2.5-flash → yeni GCP projelerinde 2.0-flash deprecated.
// Billing aktif olduğu için quota limitleri kaldırılmış durumda.
const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

class MemberFormOCRService {
  static async getApiKey() {
    const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
    const mask = (k) => k ? `${k.slice(0, 10)}...${k.slice(-4)}` : '(yok)';

    // Öncelik 1: Firestore'daki OCR-özel key (admin panelden girilen)
    if (USE_FIREBASE) {
      try {
        const FirebaseService = (await import('./FirebaseService')).default;
        const ocrConfig = await FirebaseService.getById('gemini_api_config', 'ocr');
        if (ocrConfig && ocrConfig.api_key) {
          let key = ocrConfig.api_key;
          if (key.startsWith('U2FsdGVkX1')) {
            const { decryptData } = await import('../utils/crypto');
            key = decryptData(key);
          }
          if (key) {
            console.log('[OCR] Key kaynağı: Firestore /ocr →', mask(key));
            return key;
          }
        }
      } catch (err) {
        console.warn('[OCR] Firestore /ocr okunamadı:', err.message);
      }
    }

    // Öncelik 2: .env'deki OCR-özel key
    const envOcrKey = import.meta.env.VITE_GEMINI_OCR_API_KEY;
    if (envOcrKey) {
      console.log('[OCR] Key kaynağı: .env VITE_GEMINI_OCR_API_KEY →', mask(envOcrKey));
      return envOcrKey;
    }

    // Öncelik 3: Firestore'daki genel chatbot key
    if (USE_FIREBASE) {
      try {
        const FirebaseService = (await import('./FirebaseService')).default;
        const mainConfig = await FirebaseService.getById('gemini_api_config', 'main');
        if (mainConfig && mainConfig.api_key) {
          let key = mainConfig.api_key;
          if (key.startsWith('U2FsdGVkX1')) {
            const { decryptData } = await import('../utils/crypto');
            key = decryptData(key);
          }
          if (key) {
            console.log('[OCR] Key kaynağı: Firestore /main (chatbot) →', mask(key));
            return key;
          }
        }
      } catch (err) {
        console.warn('[OCR] Firestore /main okunamadı:', err.message);
      }
    }

    const envGeneralKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envGeneralKey) {
      console.log('[OCR] Key kaynağı: .env VITE_GEMINI_API_KEY →', mask(envGeneralKey));
      return envGeneralKey;
    }

    throw new Error(
      'Gemini API key bulunamadı. Admin → Ayarlar → Gemini AI → OCR Key alanına girin.'
    );
  }

  /** File (input) → base64 data string */
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result;
        if (typeof raw !== 'string') {
          reject(new Error('Dosya okunamadı (boş içerik)'));
          return;
        }
        resolve(raw.includes(',') ? raw.split(',')[1] : raw);
      };
      reader.onerror = () => reject(reader.error || new Error('Dosya okuma hatası'));
      reader.readAsDataURL(file);
    });
  }

  static buildPrompt() {
    return `Bu fotoğrafta bir veya birden fazla "Yeniden Refah Partisi Üye Formu" var.
Her formu AYRI AYRI analiz et. Formlar elle doldurulmuştur, el yazısıdır.

ÇIKARILACAK ALANLAR (her form için):
- seri_no: Form üzerinde yazan seri numarası. Forma önceden basılı değilse elle yazılmış bir köşede/üstte olabilir. Bazı formlarda "seri no yok" yazabilir, o zaman boş bırak.
- ad: Kişinin ADI (sadece ad, soyad olmadan)
- soyad: Kişinin SOYADI
- tc: 11 haneli T.C. kimlik numarası
- telefon: Türkiye cep telefonu (05XX XXX XX XX veya 5XX XXX XX XX)
- dogum_tarihi: Doğum tarihi (gg.aa.yyyy veya gg/aa/yyyy veya gg aa yyyy formatında — normalize et: "gg.aa.yyyy")
- notlar: Form üstünde/kenarında özel notlar varsa (örn "TC yok", "TC hatalı", "Doğum tarihi yok"). Yoksa boş.

ÇOK ÖNEMLİ KURALLAR:
1. Form sütun başlıklarına GÜVENME. İnsanlar yanlış sütuna yazmış olabilir — ör. "T.C. Kimlik No" satırına telefon yazılmış olabilir.
2. Sayıları İÇERİĞE göre ayır:
   - 11 haneli sayı + "05" ile başlıyor → TELEFON'dur
   - 10 haneli sayı + "5" ile başlıyor → TELEFON'dur (sistem başına 0 ekleyecek)
   - 11 haneli sayı + "05" ile başlamıyor → TC'dir
3. Tarih formatlarını normalize et → "gg.aa.yyyy" (tek/çift hane olsa bile 2 haneye tamamla). Ör: "2-3 1960" → "02.03.1960", "9 4 1996" → "09.04.1996"
4. Ad-Soyad tek satırda yazılmışsa DOĞRU ayır (son kelime soyad değil, gerektiğinde 2+ kelimeli soyadlar olabilir).
5. Bulamadığın her alanı BOŞ STRING ("") olarak bırak. Asla uydurmam, tahmin etme.
6. TC görünüşte hatalı olsa bile (10 hane, 12 hane, harf içeriyor) GÖRDÜĞÜN NE İSE ONU yaz — yanlışını düzeltme, kullanıcı sonra elle düzeltecek.
7. Fotoğraftaki TÜM formları bul, sayı ne kadarsa o kadar obje döndür.

ÇIKTI: SADECE aşağıdaki JSON formatında dön, başka METİN/AÇIKLAMA ekleme:
{
  "forms": [
    {
      "seri_no": "",
      "ad": "",
      "soyad": "",
      "tc": "",
      "telefon": "",
      "dogum_tarihi": "",
      "notlar": ""
    }
  ]
}`;
  }

  static sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Fotoğraf dosyasını OCR yap → form array
   * 429 (rate limit) hatasında exponential backoff ile 3 kez dener.
   * @param {File} file
   * @returns {Promise<Array<Object>>}
   */
  static async readFromFile(file) {
    const base64 = await this.fileToBase64(file);
    const prompt = this.buildPrompt();

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    });

    // GeminiKeyPool: 429/401/403 alındığında otomatik başka key'e geçer.
    // Hepsi düşerse error fırlatır.
    const response = await GeminiKeyPool.fetchWithFallback((apiKey) =>
      fetch(`${API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })
    );

    if (!response.ok) {
      let errMsg = '';
      try {
        const errJson = await response.clone().json();
        errMsg = errJson.error?.message || '';
      } catch (_) { /* ignore */ }
      throw new Error(errMsg || `Gemini API hatası: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Gemini\'den geçerli yanıt alınamadı');

    let jsonText = content.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error('OCR JSON parse error:', e, content);
      throw new Error('AI yanıtı parse edilemedi');
    }

    const rawForms = Array.isArray(parsed?.forms) ? parsed.forms : [];
    return rawForms.map((f) => this.postProcess(f));
  }

  /**
   * TC/telefon ayrımı + normalize.
   * Kurallar:
   *  - 11 hane + "05" ile başlar → telefon
   *  - 10 hane + "5" ile başlar → telefon (başına 0 ekle)
   *  - 11 hane + "05" ile başlamaz → TC
   * TC alanına telefon, telefon alanına TC konmuş olabilir — swap yap.
   */
  static postProcess(form) {
    const out = {
      seri_no: String(form.seri_no || '').trim(),
      ad: String(form.ad || '').trim(),
      soyad: String(form.soyad || '').trim(),
      tc: String(form.tc || '').replace(/\D/g, ''),
      telefon: String(form.telefon || '').replace(/\D/g, ''),
      dogum_tarihi: String(form.dogum_tarihi || '').trim(),
      notlar: String(form.notlar || '').trim(),
      tcGecerli: false,
      uyarilar: []
    };

    const isPhone = (s) =>
      (s.length === 11 && s.startsWith('05')) ||
      (s.length === 10 && s.startsWith('5'));

    const isTC = (s) => s.length === 11 && !s.startsWith('05') && !s.startsWith('0');

    const normalizePhone = (s) => {
      if (s.length === 10 && s.startsWith('5')) return '0' + s;
      return s;
    };

    // tc alanında telefon varsa swap
    if (out.tc && isPhone(out.tc)) {
      if (!out.telefon) out.telefon = normalizePhone(out.tc);
      out.tc = '';
    }
    // telefon alanında TC varsa swap
    if (out.telefon && isTC(out.telefon)) {
      if (!out.tc) out.tc = out.telefon;
      out.telefon = '';
    }
    // telefon'u normalize et
    out.telefon = normalizePhone(out.telefon);

    // TC validation (Türk kimlik algoritması)
    out.tcGecerli = this.isValidTC(out.tc);
    if (out.tc && !out.tcGecerli) out.uyarilar.push('TC geçersiz');
    if (!out.tc) out.uyarilar.push('TC eksik');
    if (!out.telefon) out.uyarilar.push('Telefon eksik');
    if (!out.ad || !out.soyad) out.uyarilar.push('Ad/Soyad eksik');

    return out;
  }

  /** Türk T.C. kimlik numarası algoritma kontrolü */
  static isValidTC(tc) {
    if (!tc || tc.length !== 11 || !/^\d+$/.test(tc)) return false;
    if (tc[0] === '0') return false;
    const d = tc.split('').map(Number);
    const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8];
    const sumEven = d[1] + d[3] + d[5] + d[7];
    const ten = ((sumOdd * 7) - sumEven) % 10;
    if (ten < 0 || ten !== d[9]) return false;
    const eleven = (sumOdd + sumEven + d[9]) % 10;
    return eleven === d[10];
  }
}

export default MemberFormOCRService;
