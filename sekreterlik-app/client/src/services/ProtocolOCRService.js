/**
 * Protocol OCR Service
 * Seçim tutanağı fotoğraflarını AI ile okur ve yapılandırılmış veri çıkarır
 * Google Gemini Vision API kullanır
 */

class ProtocolOCRService {
  static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  /**
   * Gemini API key'ini al
   */
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
      } catch (error) {
        console.warn('Firebase\'den Gemini API key alınamadı:', error);
      }
    }
    
    if (!apiKey) {
      apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    }
    
    if (!apiKey) {
      throw new Error('Gemini API key bulunamadı. Lütfen Ayarlar > Chatbot API sayfasından API anahtarını girin.');
    }
    
    return apiKey;
  }

  /**
   * Fotoğrafı base64'e çevir
   * CORS sorununu bypass etmek için img element ve canvas kullanır
   */
  static async imageToBase64(imageUrl) {
    try {
      // Eğer zaten base64 ise direkt dön
      if (imageUrl.startsWith('data:image')) {
        return imageUrl;
      }

      // CORS sorununu bypass etmek için img element ve canvas kullan
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // CORS için
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // Canvas'tan base64'e çevir
            const base64 = canvas.toDataURL('image/jpeg', 0.9);
            resolve(base64);
          } catch (error) {
            console.error('Canvas conversion error:', error);
            // Fallback: fetch ile dene (CORS hatası olabilir)
            fetch(imageUrl)
              .then(response => response.blob())
              .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              })
              .catch(reject);
          }
        };
        
        img.onerror = (error) => {
          console.error('Image load error:', error);
          // Fallback: fetch ile dene
          fetch(imageUrl, { mode: 'cors' })
            .then(response => {
              if (!response.ok) throw new Error('Failed to fetch image');
              return response.blob();
            })
            .then(blob => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            })
            .catch((fetchError) => {
              console.error('Fetch fallback error:', fetchError);
              // Son çare: URL'yi direkt kullan (Gemini bazı durumlarda URL'yi direkt kabul edebilir)
              reject(new Error('Fotoğraf yüklenirken hata oluştu. Lütfen fotoğrafın erişilebilir olduğundan emin olun.'));
            });
        };
        
        // Firebase Storage URL'lerinde token varsa, crossOrigin ayarı çalışmayabilir
        // Bu durumda direkt fetch ile dene
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          // Firebase Storage için özel işlem
          fetch(imageUrl, { 
            mode: 'cors',
            credentials: 'omit'
          })
            .then(response => {
              if (!response.ok) throw new Error('Failed to fetch from Firebase Storage');
              return response.blob();
            })
            .then(blob => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            })
            .catch(() => {
              // Firebase Storage CORS hatası varsa, img element ile dene
              img.src = imageUrl;
            });
        } else {
          img.src = imageUrl;
        }
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Fotoğraf yüklenirken hata oluştu');
    }
  }

  /**
   * Tutanak fotoğrafını oku ve yapılandırılmış veri çıkar
   * @param {string} imageUrl - Tutanak fotoğrafı URL'i veya base64
   * @param {Object} electionInfo - Seçim bilgileri (type, candidates, parties vb.)
   * @returns {Promise<Object>} Yapılandırılmış veri
   */
  static async readProtocol(imageUrl, electionInfo = {}) {
    try {
      const apiKey = await this.getApiKey();
      
      // Fotoğrafı base64'e çevir
      const base64Image = await this.imageToBase64(imageUrl);
      
      // Base64'ten sadece data kısmını al (data:image/jpeg;base64, kısmını çıkar)
      const base64Data = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;

      // Seçim türüne göre prompt hazırla
      const electionType = electionInfo.type || 'genel';
      let prompt = `Bu bir seçim tutanağı fotoğrafıdır. Lütfen tutanaktaki tüm bilgileri okuyup aşağıdaki JSON formatında döndür. SADECE JSON döndür, başka açıklama yapma.

GEREKLİ ALANLAR:
- sandik_numarasi: Sandık numarası (varsa)
- toplam_secmen: Toplam seçmen sayısı
- kullanilan_oy: Kullanılan oy sayısı
- gecersiz_oy: Geçersiz oy sayısı
- gecerli_oy: Geçerli oy sayısı`;

      if (electionType === 'genel') {
        prompt += `
- cb_oylari: Cumhurbaşkanı adayları ve oyları (JSON object: {"Aday Adı": oy_sayısı})
- mv_oylari: Milletvekili partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})`;
      } else if (electionType === 'yerel') {
        prompt += `
- belediye_baskani_oylari: Belediye başkanı adayları ve oyları (JSON object: {"Aday Adı": oy_sayısı})
- il_genel_meclisi_oylari: İl genel meclisi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
- belediye_meclisi_oylari: Belediye meclisi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})`;
      } else if (electionType === 'referandum') {
        prompt += `
- evet_oy: Evet oyu sayısı
- hayir_oy: Hayır oyu sayısı`;
      }

      prompt += `

ÖNEMLİ:
1. Tüm sayıları tam olarak oku, tahmin yapma
2. Eğer bir bilgi okunamıyorsa null veya 0 yaz
3. SADECE JSON döndür, başka metin ekleme
4. JSON formatı şöyle olmalı:
{
  "sandik_numarasi": "1234",
  "toplam_secmen": 500,
  "kullanilan_oy": 450,
  "gecersiz_oy": 10,
  "gecerli_oy": 440,
  ... (seçim türüne göre diğer alanlar)
}`;

      // Gemini Vision API çağrısı
      const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API hatası: ${response.status}`);
      }

      const data = await response.json();
      
      // Gemini'nin yanıtını parse et
      let extractedData = {};
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const content = data.candidates[0].content.parts[0].text;
        
        // JSON'u extract et (code block içinde olabilir)
        let jsonText = content.trim();
        
        // ```json veya ``` ile başlayıp bitiyorsa temizle
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        
        try {
          extractedData = JSON.parse(jsonText);
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'Content:', content);
          throw new Error('AI yanıtı parse edilemedi. Lütfen tekrar deneyin.');
        }
      } else {
        throw new Error('AI\'dan geçerli yanıt alınamadı');
      }

      // Veriyi sistem formatına çevir
      return this.convertToSystemFormat(extractedData, electionType);
      
    } catch (error) {
      console.error('Protocol OCR error:', error);
      throw new Error(`Tutanak okuma hatası: ${error.message}`);
    }
  }

  /**
   * AI'dan gelen veriyi sistem formatına çevir
   */
  static convertToSystemFormat(data, electionType) {
    const result = {
      total_voters: parseInt(data.toplam_secmen) || 0,
      used_votes: parseInt(data.kullanilan_oy) || 0,
      invalid_votes: parseInt(data.gecersiz_oy) || 0,
      valid_votes: parseInt(data.gecerli_oy) || 0,
      ballot_number: data.sandik_numarasi || null
    };

    if (electionType === 'genel') {
      result.cb_votes = data.cb_oylari || {};
      result.mv_votes = data.mv_oylari || {};
    } else if (electionType === 'yerel') {
      result.mayor_votes = data.belediye_baskani_oylari || {};
      result.provincial_assembly_votes = data.il_genel_meclisi_oylari || {};
      result.municipal_council_votes = data.belediye_meclisi_oylari || {};
    } else if (electionType === 'referandum') {
      result.referendum_votes = {
        'Evet': parseInt(data.evet_oy) || 0,
        'Hayır': parseInt(data.hayir_oy) || 0
      };
    }

    return result;
  }
}

export default ProtocolOCRService;

