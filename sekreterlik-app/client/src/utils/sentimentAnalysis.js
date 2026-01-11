/**
 * Duygu Analizi Utility
 * Kullanıcı mesajlarından duygu tespiti yapar
 */

/**
 * Duygu analizi yap
 * @param {string} message - Kullanıcı mesajı
 * @returns {Object} - { sentiment: 'positive'|'negative'|'neutral', emotion: string, intensity: number }
 */
export function analyzeSentiment(message) {
  if (!message || typeof message !== 'string') {
    return { sentiment: 'neutral', emotion: 'neutral', intensity: 0 };
  }

  const lowerMessage = message.toLowerCase();

  // Pozitif kelimeler
  const positiveWords = [
    'teşekkür', 'teşekkürler', 'sağol', 'sağolun', 'iyi', 'güzel', 'harika', 'mükemmel',
    'başarılı', 'başarı', 'iyi gidiyor', 'güzel olmuş', 'beğendim', 'hoşuma gitti',
    'yardımcı', 'faydalı', 'yararlı', 'çok iyi', 'süper', 'müthiş', 'harika',
    'başarılar', 'kolay gelsin', 'iyi çalışmalar', 'çok güzel', 'çok iyi',
    'tamam', 'olur', 'evet', 'kesinlikle', 'tabii', 'elbette'
  ];

  // Negatif kelimeler
  const negativeWords = [
    'kötü', 'berbat', 'kötü olmuş', 'beğenmedim', 'hoşuma gitmedi', 'yetersiz',
    'eksik', 'hata', 'hatalı', 'yanlış', 'olmadı', 'çalışmıyor', 'bozuk',
    'sorun', 'problem', 'sıkıntı', 'zor', 'zorlanıyorum', 'anlamadım',
    'karışık', 'karmaşık', 'hayır', 'olmaz', 'yapamam', 'yapamıyorum',
    'frustrated', 'stres', 'stresli', 'sinir', 'sinirli', 'kızgın', 'üzgün',
    'hayal kırıklığı', 'memnun değilim', 'memnun değil', 'rahatsız'
  ];

  // Duygu kelimeleri
  const emotionWords = {
    'mutlu': ['mutlu', 'sevinçli', 'neşeli', 'keyifli', 'huzurlu'],
    'üzgün': ['üzgün', 'mutsuz', 'kederli', 'hüzünlü'],
    'kızgın': ['kızgın', 'sinirli', 'öfkeli', 'hiddetli'],
    'endişeli': ['endişeli', 'kaygılı', 'tedirgin', 'stresli'],
    'heyecanlı': ['heyecanlı', 'coşkulu', 'enerjik'],
    'yorgun': ['yorgun', 'bitkin', 'tükenmiş']
  };

  // Pozitif/Negatif skor hesapla
  let positiveScore = 0;
  let negativeScore = 0;
  let detectedEmotion = 'neutral';
  let maxEmotionScore = 0;

  positiveWords.forEach(word => {
    if (lowerMessage.includes(word)) {
      positiveScore += 1;
    }
  });

  negativeWords.forEach(word => {
    if (lowerMessage.includes(word)) {
      negativeScore += 1;
    }
  });

  // Duygu tespiti
  Object.entries(emotionWords).forEach(([emotion, words]) => {
    let score = 0;
    words.forEach(word => {
      if (lowerMessage.includes(word)) {
        score += 1;
      }
    });
    if (score > maxEmotionScore) {
      maxEmotionScore = score;
      detectedEmotion = emotion;
    }
  });

  // Soru işareti varsa genellikle nötr veya merak
  const hasQuestion = lowerMessage.includes('?') || 
    lowerMessage.includes('neden') || 
    lowerMessage.includes('nasıl') || 
    lowerMessage.includes('ne zaman') ||
    lowerMessage.includes('kim') ||
    lowerMessage.includes('hangi');

  // Büyük harf kullanımı (kızgınlık göstergesi)
  const hasCaps = message !== message.toLowerCase() && message.length > 5;
  const allCaps = message === message.toUpperCase() && message.length > 3;
  
  if (allCaps) {
    negativeScore += 2;
    detectedEmotion = 'kızgın';
  } else if (hasCaps && (negativeScore > 0 || lowerMessage.includes('!'))) {
    negativeScore += 1;
  }

  // Ünlem işareti (duygusal yoğunluk)
  const exclamationCount = (message.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    if (positiveScore > negativeScore) {
      positiveScore += 1;
    } else if (negativeScore > 0) {
      negativeScore += 1;
    }
  }

  // Sonuç belirleme
  let sentiment = 'neutral';
  let intensity = 0;

  if (positiveScore > negativeScore) {
    sentiment = 'positive';
    intensity = Math.min(positiveScore / 3, 1); // 0-1 arası
  } else if (negativeScore > positiveScore) {
    sentiment = 'negative';
    intensity = Math.min(negativeScore / 3, 1);
  } else {
    sentiment = hasQuestion ? 'curious' : 'neutral';
    intensity = 0.3;
  }

  // Eğer duygu tespit edildiyse, sentiment'i güncelle
  if (detectedEmotion === 'kızgın' || detectedEmotion === 'üzgün' || detectedEmotion === 'endişeli') {
    sentiment = 'negative';
    intensity = Math.max(intensity, 0.5);
  } else if (detectedEmotion === 'mutlu' || detectedEmotion === 'heyecanlı') {
    sentiment = 'positive';
    intensity = Math.max(intensity, 0.5);
  }

  return {
    sentiment,
    emotion: detectedEmotion,
    intensity: Math.round(intensity * 100) / 100,
    hasQuestion,
    positiveScore,
    negativeScore
  };
}

/**
 * Duyguya göre uygun yanıt tonu öner
 * @param {Object} sentimentResult - analyzeSentiment sonucu
 * @returns {string} - Yanıt tonu önerisi
 */
export function getResponseTone(sentimentResult) {
  const { sentiment, emotion, intensity } = sentimentResult;

  if (sentiment === 'positive') {
    if (intensity > 0.7) {
      return 'coşkulu ve mutlu';
    }
    return 'samimi ve olumlu';
  } else if (sentiment === 'negative') {
    if (emotion === 'kızgın') {
      return 'sakinleştirici ve profesyonel';
    } else if (emotion === 'üzgün') {
      return 'destekleyici ve empatik';
    } else if (emotion === 'endişeli') {
      return 'güven verici ve açıklayıcı';
    }
    return 'anlayışlı ve yardımcı';
  } else if (sentiment === 'curious') {
    return 'bilgilendirici ve detaylı';
  }

  return 'normal ve samimi';
}

