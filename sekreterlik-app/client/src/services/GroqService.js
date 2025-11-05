/**
 * Groq API Service
 * Ücretsiz ve hızlı AI chat completions için Groq API kullanır
 */

class GroqService {
  static API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  
  /**
   * Groq API ile chat completion
   * @param {string} userMessage - Kullanıcı mesajı
   * @param {Array} context - Site verileri ve tüzük bilgileri context'i
   * @param {Array} conversationHistory - Konuşma geçmişi
   * @returns {Promise<string>} AI yanıtı
   */
  static async chat(userMessage, context = [], conversationHistory = []) {
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      
      if (!apiKey) {
        throw new Error('Groq API key bulunamadı. Lütfen VITE_GROQ_API_KEY environment variable\'ını ayarlayın.');
      }

      // System prompt - AI'nın kimliği ve sınırları
      const systemPrompt = `Sen "İlçe Sekreterlik Asistanı" adlı bir yapay zeka asistanısın. Görevin site içi bilgileri ve yüklenen siyasi parti tüzüğünü kullanarak kullanıcılara yardımcı olmaktır.

KURALLAR:
1. SADECE verilen bilgileri (context) kullanarak cevap ver
2. Site içi bilgiler (üyeler, etkinlikler, toplantılar, bölgeler vb.) ve tüzük bilgileri dışında bilgi verme
3. Eğer sorulan bilgi context'te yoksa, "Bu bilgiyi bulamadım. Lütfen site içi bilgiler veya tüzük ile ilgili sorular sorun." de
4. Eğer tüzük için web linki verilmişse, kullanıcıya tüzük hakkında sorular sorduğunda bu linki paylaşabilirsin: "Parti tüzüğü hakkında detaylı bilgi için şu linki ziyaret edebilirsiniz: [link]"
5. Hassas bilgileri (TC, telefon, adres vb.) sadece yetkili kullanıcılar sorduğunda paylaş
6. Türkçe yanıt ver, samimi ve yardımcı ol
7. Yanıtlarını kısa ve öz tut, gereksiz detay verme
8. Sayısal sorular için (kaç üye var, kaç etkinlik yapıldı vb.) context'teki verileri kullanarak hesapla

CONTEXT BİLGİLERİ:
${context.length > 0 ? context.map((item, index) => `${index + 1}. ${item}`).join('\n') : 'Henüz context bilgisi yok.'}`;

      // Konuşma geçmişini formatla
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile', // veya 'mixtral-8x7b-32768' - ücretsiz ve hızlı
          messages: messages,
          temperature: 0.7,
          max_tokens: 1024,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Groq API hatası: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      } else {
        throw new Error('Groq API yanıt formatı beklenmedik');
      }
    } catch (error) {
      console.error('Groq API error:', error);
      throw error;
    }
  }

  /**
   * Site verilerini context'e çevir
   * @param {Object} siteData - Firestore'dan çekilen site verileri
   * @returns {Array<string>} Context array'i
   */
  static buildSiteContext(siteData) {
    const context = [];
    
    if (siteData.members) {
      context.push(`Toplam ${siteData.members.length} üye kayıtlı.`);
      if (siteData.members.length > 0) {
        const sampleMembers = siteData.members.slice(0, 5).map(m => m.name).join(', ');
        context.push(`Örnek üyeler: ${sampleMembers}${siteData.members.length > 5 ? ' ve diğerleri...' : ''}`);
      }
    }
    
    if (siteData.events) {
      const activeEvents = siteData.events.filter(e => !e.archived);
      context.push(`Toplam ${activeEvents.length} aktif etkinlik var.`);
      if (activeEvents.length > 0) {
        const eventNames = activeEvents.slice(0, 3).map(e => e.name || 'İsimsiz etkinlik').join(', ');
        context.push(`Örnek etkinlikler: ${eventNames}${activeEvents.length > 3 ? ' ve diğerleri...' : ''}`);
      }
    }
    
    if (siteData.meetings) {
      const activeMeetings = siteData.meetings.filter(m => !m.archived);
      context.push(`Toplam ${activeMeetings.length} aktif toplantı var.`);
      
      // Cuma programı sayısını hesapla
      const fridayPrograms = activeMeetings.filter(m => 
        m.name && (m.name.toLowerCase().includes('cuma') || m.name.toLowerCase().includes('program'))
      ).length;
      if (fridayPrograms > 0) {
        context.push(`${fridayPrograms} adet cuma programı yapılmış.`);
      }
    }
    
    if (siteData.districts) {
      context.push(`${siteData.districts.length} ilçe kayıtlı.`);
    }
    
    if (siteData.towns) {
      context.push(`${siteData.towns.length} belde kayıtlı.`);
    }
    
    if (siteData.neighborhoods) {
      context.push(`${siteData.neighborhoods.length} mahalle kayıtlı.`);
    }
    
    if (siteData.villages) {
      context.push(`${siteData.villages.length} köy kayıtlı.`);
    }
    
    return context;
  }

  /**
   * Üye bilgilerini context'e ekle
   * @param {Array} members - Üye listesi
   * @param {string} searchTerm - Arama terimi
   * @returns {Array<string>} Context array'i
   */
  static buildMemberContext(members, searchTerm = '') {
    const context = [];
    
    if (!searchTerm) {
      return context;
    }
    
    // Üye arama
    const searchLower = searchTerm.toLowerCase();
    const matchingMembers = members.filter(m => 
      m.name && m.name.toLowerCase().includes(searchLower)
    );
    
    if (matchingMembers.length > 0) {
      matchingMembers.slice(0, 3).forEach(member => {
        const info = [`Üye: ${member.name}`];
        if (member.phone) {
          info.push(`Telefon: ${member.phone}`);
        }
        if (member.region) {
          info.push(`Bölge: ${member.region}`);
        }
        context.push(info.join(', '));
      });
    }
    
    return context;
  }
}

export default GroqService;

