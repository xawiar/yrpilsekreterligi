/**
 * Google Gemini API Service
 * Gemini API ile chat completions için
 */

import GroqService from './GroqService';

class GeminiService {
  static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  
  /**
   * Gemini API ile chat completion
   * @param {string} userMessage - Kullanıcı mesajı
   * @param {Array} context - Site verileri ve tüzük bilgileri context'i
   * @param {Array} conversationHistory - Konuşma geçmişi
   * @returns {Promise<string>} AI yanıtı
   */
  static async chat(userMessage, context = [], conversationHistory = []) {
    try {
      // Önce Firebase'den API key'i al, yoksa environment variable'dan al
      let apiKey = null;
      
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      if (USE_FIREBASE) {
        try {
          const FirebaseService = (await import('../services/FirebaseService')).default;
          const configDoc = await FirebaseService.getById('gemini_api_config', 'main');
          if (configDoc && configDoc.api_key) {
            // API key şifrelenmiş olabilir, decrypt et
            if (configDoc.api_key.startsWith('U2FsdGVkX1')) {
              const { decryptData } = await import('../utils/crypto');
              apiKey = decryptData(configDoc.api_key);
            } else {
              apiKey = configDoc.api_key;
            }
          }
        } catch (error) {
          console.warn('Firebase\'den Gemini API key alınamadı, environment variable kullanılıyor:', error);
        }
      }
      
      // Eğer Firebase'de yoksa, environment variable'dan al
      if (!apiKey) {
        apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      }
      
      if (!apiKey) {
        throw new Error('Gemini API key bulunamadı. Lütfen Ayarlar > Chatbot API sayfasından API anahtarını girin veya VITE_GEMINI_API_KEY environment variable\'ını ayarlayın.');
      }

      // Context'i token limitine göre kısalt (Gemini için daha yüksek limit var)
      const MAX_CONTEXT_LENGTH = 100000; // Gemini için daha yüksek limit
      let contextText = context.length > 0 ? context.join('\n') : 'Henüz context bilgisi yok.';
      
      // Eğer context çok büyükse, kısalt
      if (contextText.length > MAX_CONTEXT_LENGTH) {
        contextText = contextText.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context kısaltıldı - token limiti nedeniyle]';
        console.warn('Context çok büyük, kısaltıldı:', contextText.length, 'karakter');
      }

      // Few-shot examples for better training
      const fewShotExamples = `
ÖRNEK SORU-CEVAP ÇİFTLERİ (Bu örnekleri takip et):

Soru: "Toplam kaç üye var?"
Cevap: "Context'teki üye bilgilerine göre toplam X üye kayıtlı başkanım."

Soru: "Ahmet'in katıldığı toplantılar neler?"
Cevap: "Ahmet'in üye kartı bilgilerine göre, katıldığı toplantılar şunlar:
- Toplantı 1 (Tarih: ...)
- Toplantı 2 (Tarih: ...)
Toplam X toplantıya katılmış başkanım."

Soru: "Bu ay kaç toplantı yapıldı?"
Cevap: "Bu ayın toplantı istatistiklerine göre X toplantı yapılmış başkanım. Ortalama katılım oranı %Y."

Soru: "En aktif üyeler kimler?"
Cevap: "Performans puanlarına göre en aktif üyeler:
1. Üye Adı - X yıldız, Y puan
2. Üye Adı - X yıldız, Y puan
... başkanım."

Soru: "Seçim sonuçları nasıl?"
Cevap: "Seçim sonuçlarına göre:
- Toplam X sandık sonucu girilmiş
- En yüksek oy alan parti/aday: ...
- Mahalle bazında toplam oylar: ...
başkanım."

Soru: "Tüzükte üyelik şartları neler?"
Cevap: "Tüzük bilgilerine göre üyelik şartları şunlar:
1. ...
2. ...
... başkanım."

ÖNEMLİ: Bu örnekleri takip ederek benzer sorulara benzer formatlarda cevap ver.
`;

      // System prompt - AI'nın kimliği ve sınırları (geliştirilmiş - eğitim odaklı)
      const systemPrompt = `Sen "Yeniden Refah Partisi Elazığ Sekreteri" adlı bir yapay zeka asistanısın. Görevin site içi bilgileri ve yüklenen siyasi parti tüzüğünü kullanarak kullanıcılara yardımcı olmaktır.

${fewShotExamples}

ÖNEMLİ KURALLAR (SOHBET MODU):
1. Kullanıcı senin başkanındır. Her cevabının SONUNA mutlaka "başkanım" ekle.
2. SADECE verilen context'i kullan - Context dışında bilgi uydurma.
3. Site bilgileri ve tüzük dışında bilgi verme - Genel bilgi verme, sadece context'teki bilgileri kullan.
4. Bilgi yoksa açıkça belirt: "Bu bilgiyi context'te bulamadım başkanım. Lütfen site içi bilgiler, site işlevleri veya tüzük ile ilgili sorular sorun."
5. Eğer tüzük için web linki verilmişse, kullanıcıya tüzük hakkında sorular sorduğunda bu linki paylaşabilirsin: "Parti tüzüğü hakkında detaylı bilgi için şu linki ziyaret edebilirsiniz: [link] başkanım"
6. Hassas bilgileri (TC, telefon, adres vb.) sadece yetkili kullanıcılar sorduğunda paylaş
7. Türkçe, samimi ve sohbet eder gibi cevap ver - Çok formal olma, ama saygılı kal.
8. Yanıtlarını kısa ve öz tut, gereksiz detay verme
9. Sayısal sorular için (kaç üye var, kaç etkinlik yapıldı vb.) context'teki verileri kullanarak hesapla
10. Site işlevleri hakkında sorular sorulduğunda (örnek: "sandık nasıl eklenir", "toplantı nasıl oluşturulur"), context'teki "SİTE İŞLEVLERİ VE KULLANIM KILAVUZU" bölümündeki bilgileri kullanarak adım adım açıkla
11. Kullanıcılar site işlevlerini nasıl kullanacaklarını sorduğunda, hangi sayfaya gitmeleri gerektiğini, hangi butona tıklamaları gerektiğini ve hangi bilgileri girmeleri gerektiğini detaylıca anlat
12. Tüm site sayfalarındaki tüm bilgilere erişimin var (üyeler, toplantılar, etkinlikler, mahalleler, köyler, sandıklar, müşahitler, temsilciler, sorumlular, STK'lar, camiler, arşiv belgeleri, kişisel belgeler, üye kayıtları, ziyaret sayıları, yönetim kurulu üyeleri, SEÇİMLER, SEÇİM SONUÇLARI, BAŞMÜŞAHİTLER, SANDIK TUTANAKLARI vb.)
13. Seçim sonuçları hakkında sorular sorulduğunda, context'teki "SEÇİMLER" ve "SEÇİM SONUÇLARI" bölümlerindeki bilgileri kullan. Her seçim için sandık bazında oy sayıları, başmüşahit bilgileri ve tutanak durumları context'te mevcuttur.

SOHBET MODU KURALLARI:
- Önceki konuşmaları hatırla ve referans ver (örn: "Az önce bahsettiğiniz...", "Daha önce konuştuğumuz...")
- Kendi görüşlerini ve yorumlarını ekle (örn: "Bence...", "Şöyle düşünüyorum...", "Önerim...")
- Samimi ve sohbet eder gibi konuş, ama saygılı kal
- Kullanıcı "önceki konu", "az önce", "daha önce" gibi ifadeler kullanırsa, önceki konuşmalara referans ver
- Devam eden sohbet: Önceki mesajlarda bahsedilen konuları hatırla ve bağlantı kur
- Sadece bilgi verme, aynı zamanda yorum yap ve öner

CEVAP FORMATI:
- Soruya doğrudan cevap ver
- Önceki konuşmaları hatırla ve referans ver
- Kendi görüşlerini ve önerilerini ekle
- Gerekirse liste formatında göster (1., 2., 3. şeklinde)
- Sayısal veriler varsa açıkça belirt ve yorum yap
- Context'teki bilgileri kullan, tahmin yapma
- Samimi ama saygılı bir dil kullan
- Her zaman "başkanım" ile bitir

CONTEXT BİLGİLERİ:
${contextText}`;

      // Gemini API için mesaj formatı
      // Konuşma geçmişini ve kullanıcı mesajını birleştir
      const fullPrompt = `${systemPrompt}\n\nKullanıcı: ${userMessage}`;
      
      // Gemini API çağrısı - X-goog-api-key header kullan
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.8, // Sohbet modu için biraz daha yaratıcı
            maxOutputTokens: 2048
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error?.message || response.statusText;
        
        // 402 hatası için özel mesaj
        if (response.status === 402) {
          errorMessage = 'Gemini API ücretsiz tier limiti aşıldı veya ödeme gerekiyor. Lütfen Google AI Studio\'dan hesabınızı kontrol edin veya başka bir AI servisi (Groq, DeepSeek) kullanın.';
        }
        
        throw new Error(`Gemini API hatası: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Gemini API yanıt formatı beklenmedik');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  /**
   * Site verilerini context'e çevir (GroqService'ten alınan metod)
   */
  static buildSiteContext(siteData) {
    // GroqService'ten buildSiteContext metodunu kullan
    return GroqService.buildSiteContext(siteData);
  }

  /**
   * Üye bilgilerini context'e ekle (GroqService'ten alınan metod)
   */
  static buildMemberContext(members, searchTerm, siteData) {
    // GroqService'ten buildMemberContext metodunu kullan
    return GroqService.buildMemberContext(members, searchTerm, siteData);
  }
}

export default GeminiService;

