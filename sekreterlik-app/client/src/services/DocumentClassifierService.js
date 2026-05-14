/**
 * Document Classifier Service
 * Yüklenen evrak fotoğrafının türünü Gemini Vision ile sınıflandırır.
 * Çıktı tipleri: 'signed_protocol' (imzalı seçim tutanağı),
 *                'objection_protocol' (itiraz tutanağı),
 *                'other' (genel evrak / kimlik / vs.)
 */

import GeminiKeyPool from './GeminiKeyPool';

class DocumentClassifierService {
  static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  static async getApiKey() {
    let apiKey = null;
    const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
    if (USE_FIREBASE) {
      try {
        const FirebaseService = (await import('./FirebaseService')).default;
        const configDoc = await FirebaseService.getById('gemini_api_config', 'main');
        if (configDoc && configDoc.api_key) {
          if (configDoc.api_key.startsWith('U2FsdGVkX1')) {
            const { decryptData } = await import('../utils/crypto');
            apiKey = decryptData(configDoc.api_key);
          } else {
            apiKey = configDoc.api_key;
          }
        }
      } catch (_) { /* ignore */ }
    }
    if (!apiKey) apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key bulunamadı.');
    return apiKey;
  }

  /**
   * File → base64 (sadece veri kısmı, prefix'siz)
   */
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result;
        if (typeof raw !== 'string') {
          reject(new Error('Dosya okunamadı'));
          return;
        }
        resolve(raw.includes(',') ? raw.split(',')[1] : raw);
      };
      reader.onerror = () => reject(reader.error || new Error('Dosya okuma hatası'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Fotoğrafın evrak tipini tahmin et.
   * @param {File} file - Görsel dosyası
   * @returns {Promise<{type: 'signed_protocol'|'objection_protocol'|'other', confidence: number, reasoning: string}>}
   */
  static async classify(file) {
    const base64 = await this.fileToBase64(file);

    const prompt = `Bu fotoğraf bir Türkiye seçim sürecine ait bir evrakı gösteriyor olabilir. Lütfen evrak türünü belirle.

ÇIKTI: SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "type": "signed_protocol" | "objection_protocol" | "other",
  "confidence": 0.0-1.0 arası bir sayı,
  "reasoning": "Kısa Türkçe açıklama (max 200 karakter)"
}

KURALLAR:
- "signed_protocol": Sandık başmüşahidi, sandık kurulu üyeleri ve gözlemcilerin imzaladığı, parti/aday oy sayılarının yazıldığı resmi sayım/birleştirme tutanağı.
- "objection_protocol": Bir veya birkaç gözlemcinin/üyenin sandık sayım sonucuna itiraz ettiğine dair ayrı bir itiraz tutanağı/dilekçesi (genelde "İTİRAZ" başlıklı veya el yazısıyla itiraz açıklamaları içeren).
- "other": Yukarıdakilerden hiçbiri değilse (kimlik fotokopisi, başka bir form, ekran görüntüsü, alakasız resim vb.).

Sadece JSON döndür, açıklama veya kod bloğu ekleme.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: 'application/json'
      }
    };

    const response = await GeminiKeyPool.fetchWithFallback((apiKey) =>
      fetch(`${this.API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
    );

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Gemini API hatası (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { type: 'other', confidence: 0, reasoning: 'AI yanıt vermedi' };
    }

    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const validTypes = ['signed_protocol', 'objection_protocol', 'other'];
      const type = validTypes.includes(parsed.type) ? parsed.type : 'other';
      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
      const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 250) : '';
      return { type, confidence, reasoning };
    } catch (e) {
      console.warn('[DocumentClassifier] JSON parse hatası, ham yanıt:', text);
      return { type: 'other', confidence: 0, reasoning: 'AI yanıtı parse edilemedi' };
    }
  }
}

export default DocumentClassifierService;
