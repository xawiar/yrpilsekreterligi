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
   * CORS sorununu bypass etmek için backend proxy kullanır
   */
  static async imageToBase64(imageUrl) {
    try {
      // Eğer zaten base64 ise direkt dön
      if (imageUrl.startsWith('data:image')) {
        return imageUrl;
      }

      // Firebase Storage URL'leri için backend proxy kullan
      if (imageUrl.includes('firebasestorage.googleapis.com')) {
        // API_BASE_URL'i al - /api prefix'i olabilir veya olmayabilir
        let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        
        // Eğer /api yoksa ekle
        if (!API_BASE_URL.endsWith('/api') && !API_BASE_URL.includes('/api/')) {
          API_BASE_URL = API_BASE_URL.endsWith('/') 
            ? `${API_BASE_URL}api` 
            : `${API_BASE_URL}/api`;
        }
        
        const proxyUrl = `${API_BASE_URL}/election-results/proxy-image?imageUrl=${encodeURIComponent(imageUrl)}`;
        
        try {
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(`Proxy request failed: ${response.status}`);
          }
          
          const blob = await response.blob();
          
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (proxyError) {
          console.error('Proxy error, trying direct fetch:', proxyError);
          // Fallback: Direct fetch (CORS hatası olabilir)
          return this.imageToBase64Direct(imageUrl);
        }
      }

      // Diğer URL'ler için direkt fetch
      return this.imageToBase64Direct(imageUrl);
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Fotoğraf yüklenirken hata oluştu');
    }
  }

  /**
   * Direkt fetch ile base64'e çevir (fallback)
   */
  static async imageToBase64Direct(imageUrl) {
    try {
      const response = await fetch(imageUrl, { 
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Direct fetch error:', error);
      throw new Error('Fotoğraf yüklenirken hata oluştu. Lütfen fotoğrafın erişilebilir olduğundan emin olun.');
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
      
      // Base64 yöntemi (proxy veya direkt) - Gemini API file_uri desteklemiyor, sadece base64 kullan
      const base64Image = await this.imageToBase64(imageUrl);
      
      // Base64'ten sadece data kısmını al (data:image/jpeg;base64, kısmını çıkar)
      const base64Data = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;

      // Seçim türüne ve tutanak tipine göre prompt hazırla
      const electionType = electionInfo.type || 'genel';
      const prompt = this.buildPromptForElectionType(electionType, electionInfo);

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
   * Seçim türüne göre prompt oluştur
   */
  static buildPromptForElectionType(electionType, electionInfo = {}) {
    // Tüm tutanaklarda ortak olan bilgiler
    let prompt = `Bu bir seçim tutanağı fotoğrafıdır. Lütfen tutanaktaki tüm bilgileri okuyup aşağıdaki JSON formatında döndür. SADECE JSON döndür, başka açıklama yapma.

TÜM TUTANAKLARDA ORTAK OLAN BİLGİLER (Tutanak üst kısmı):
- sandik_numarasi: Sandık numarası
- toplam_secmen: Sandık seçmen listesinde yazılı olan seçmenlerin sayısı
- kullanilan_oy: Oy kullanan seçmenlerin toplam sayısı (kullanılan zarf sayısı)
- gecerli_oy: Geçerli oy pusulası toplamı
- gecersiz_oy: Geçersiz sayılan veya hesaba katılmayan oy sayısı

`;

    // Seçim türüne göre özel alanlar
    if (electionType === 'cb') {
      // Sadece Cumhurbaşkanı Seçimi
      prompt += `CUMHURBAŞKANI SEÇİMİ TUTANAĞI:
- cb_oylari: Cumhurbaşkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Tutanakta "Cumhurbaşkanı Adayı" veya "Başkan Adayı" bölümündeki tüm adayları ve aldıkları oyları oku.
  Örnek: {"Recep Tayyip Erdoğan": 150, "Kemal Kılıçdaroğlu": 120, "Sinan Oğan": 50}`;
    } else if (electionType === 'mv') {
      // Sadece Milletvekili Genel Seçimi
      prompt += `MİLLETVEKİLİ GENEL SEÇİMİ TUTANAĞI:
- mv_oylari: Milletvekili partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Tutanakta "Siyasi Partinin Adı" veya "Parti Adı" bölümündeki tüm partileri ve aldıkları oyları oku.
  Örnek: {"AK PARTİ": 140, "CHP": 100, "MHP": 30, "İYİ PARTİ": 25}`;
    } else if (electionType === 'genel') {
      // Genel seçim: CB ve MV birlikte
      prompt += `CUMHURBAŞKANI SEÇİMİ VE MİLLETVEKİLİ GENEL SEÇİMİ TUTANAĞI (BİRLEŞİK):
- cb_oylari: Cumhurbaşkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Örnek: {"Recep Tayyip Erdoğan": 150, "Kemal Kılıçdaroğlu": 120}
- mv_oylari: Milletvekili partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Örnek: {"AK PARTİ": 140, "CHP": 100, "MHP": 30}`;
    } else if (electionType === 'yerel_metropolitan_mayor') {
      // Büyükşehir Belediye Başkanı
      prompt += `BÜYÜKŞEHİR BELEDİYE BAŞKANI SEÇİMİ TUTANAĞI:
- belediye_baskani_oylari: Büyükşehir Belediye Başkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Tutanakta "Büyükşehir Belediye Başkanı" veya "Belediye Başkanı" bölümündeki tüm adayları ve aldıkları oyları oku.`;
    } else if (electionType === 'yerel_city_mayor') {
      // İl Belediye Başkanı
      prompt += `İL BELEDİYE BAŞKANI SEÇİMİ TUTANAĞI:
- belediye_baskani_oylari: İl Belediye Başkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Tutanakta "İl Belediye Başkanı" veya "Belediye Başkanı" bölümündeki tüm adayları ve aldıkları oyları oku.`;
    } else if (electionType === 'yerel_district_mayor') {
      // İlçe Belediye Başkanı
      prompt += `İLÇE BELEDİYE BAŞKANI SEÇİMİ TUTANAĞI:
- belediye_baskani_oylari: İlçe Belediye Başkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Tutanakta "İlçe Belediye Başkanı" bölümündeki tüm adayları ve aldıkları oyları oku.`;
    } else if (electionType === 'yerel_provincial_assembly') {
      // İl Genel Meclisi Üyesi
      prompt += `İL GENEL MECLİSİ ÜYESİ SEÇİMİ TUTANAĞI:
- il_genel_meclisi_oylari: İl Genel Meclisi Üyesi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Tutanakta "İl Genel Meclisi Üyesi" bölümündeki tüm partileri ve aldıkları oyları oku.`;
    } else if (electionType === 'yerel_municipal_council') {
      // Belediye Meclisi Üyesi
      prompt += `BELEDİYE MECLİSİ ÜYESİ SEÇİMİ TUTANAĞI:
- belediye_meclisi_oylari: Belediye Meclisi Üyesi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Tutanakta "Belediye Meclisi Üyesi" bölümündeki tüm partileri ve aldıkları oyları oku.`;
    } else if (electionType === 'yerel') {
      // Yerel seçim: Birden fazla tutanak tipi olabilir
      const isMetropolitan = electionInfo.is_metropolitan || false;
      const isVillage = electionInfo.is_village || false;
      const hasMayor = electionInfo.mayor_candidates && electionInfo.mayor_candidates.length > 0;
      const hasProvincialAssembly = electionInfo.provincial_assembly_parties && electionInfo.provincial_assembly_parties.length > 0;
      const hasMunicipalCouncil = electionInfo.municipal_council_parties && electionInfo.municipal_council_parties.length > 0;
      
      prompt += `YEREL SEÇİM TUTANAĞI:\n`;
      
      if (isVillage) {
        // Köy: Sadece İl Genel Meclisi
        prompt += `KÖY YEREL SEÇİM TUTANAĞI (Sadece İl Genel Meclisi):
- il_genel_meclisi_oylari: İl Genel Meclisi Üyesi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Tutanakta "İl Genel Meclisi Üyesi" bölümündeki tüm partileri ve aldıkları oyları oku.`;
      } else {
        // Şehir/Mahalle: Birden fazla tutanak olabilir
        if (isMetropolitan) {
          // Büyükşehir
          if (hasMayor) {
            prompt += `- belediye_baskani_oylari: Büyükşehir Belediye Başkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Tutanakta "Büyükşehir Belediye Başkanı" veya "Belediye Başkanı" bölümündeki tüm adayları ve aldıkları oyları oku.\n`;
          }
          if (hasMunicipalCouncil) {
            prompt += `- belediye_meclisi_oylari: Belediye Meclisi Üyesi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Tutanakta "Belediye Meclisi Üyesi" bölümündeki tüm partileri ve aldıkları oyları oku.\n`;
          }
        } else {
          // Büyükşehir değil
          if (hasMayor) {
            prompt += `- belediye_baskani_oylari: İl Belediye Başkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Tutanakta "İl Belediye Başkanı" veya "Belediye Başkanı" bölümündeki tüm adayları ve aldıkları oyları oku.\n`;
          }
          if (hasProvincialAssembly) {
            prompt += `- il_genel_meclisi_oylari: İl Genel Meclisi Üyesi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Tutanakta "İl Genel Meclisi Üyesi" bölümündeki tüm partileri ve aldıkları oyları oku.\n`;
          }
          if (hasMunicipalCouncil) {
            prompt += `- belediye_meclisi_oylari: Belediye Meclisi Üyesi partiler ve oyları (JSON object: {"Parti Adı": oy_sayısı})
  Tutanakta "Belediye Meclisi Üyesi" bölümündeki tüm partileri ve aldıkları oyları oku.\n`;
          }
        }
        
        // İlçe Belediye Başkanı (varsa)
        if (electionInfo.district_mayor_candidates && electionInfo.district_mayor_candidates.length > 0) {
          prompt += `- ilce_belediye_baskani_oylari: İlçe Belediye Başkanı adayları ve oyları (JSON object: {"Aday Adı Soyadı": oy_sayısı})
  Tutanakta "İlçe Belediye Başkanı" bölümündeki tüm adayları ve aldıkları oyları oku.\n`;
        }
      }
    } else if (electionType === 'referandum') {
      prompt += `REFERANDUM TUTANAĞI:
- evet_oy: Evet oyu sayısı
- hayir_oy: Hayır oyu sayısı`;
    }

    prompt += `

ÖNEMLİ KURALLAR:
1. Tüm sayıları tam olarak oku, tahmin yapma veya yuvarlama yapma
2. Tutanak üst kısmındaki ortak bilgileri (toplam seçmen, kullanılan oy, geçerli oy, geçersiz oy) mutlaka oku
3. Tutanak alt kısmındaki seçim türüne özel bilgileri (adaylar, partiler, oylar) mutlaka oku
4. Eğer bir bilgi okunamıyorsa null veya 0 yaz
5. Parti adlarını ve aday adlarını tam olarak yaz (kısaltma yapma)
6. SADECE JSON döndür, başka metin ekleme
7. JSON formatı şöyle olmalı:
{
  "sandik_numarasi": "4104",
  "toplam_secmen": 369,
  "kullanilan_oy": 333,
  "gecerli_oy": 329,
  "gecersiz_oy": 4,
  ... (seçim türüne göre diğer alanlar)
}`;

    return prompt;
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

    if (electionType === 'cb') {
      result.cb_votes = data.cb_oylari || {};
    } else if (electionType === 'mv') {
      result.mv_votes = data.mv_oylari || {};
    } else if (electionType === 'genel') {
      result.cb_votes = data.cb_oylari || {};
      result.mv_votes = data.mv_oylari || {};
    } else if (electionType === 'yerel_metropolitan_mayor' || electionType === 'yerel_city_mayor' || electionType === 'yerel_district_mayor') {
      result.mayor_votes = data.belediye_baskani_oylari || {};
    } else if (electionType === 'yerel_provincial_assembly') {
      result.provincial_assembly_votes = data.il_genel_meclisi_oylari || {};
    } else if (electionType === 'yerel_municipal_council') {
      result.municipal_council_votes = data.belediye_meclisi_oylari || {};
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

