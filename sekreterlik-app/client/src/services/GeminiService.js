/**
 * Gemini AI Service — Tek AI provider
 * Gemini 2.0 Flash ile chat, function calling, streaming desteği
 */

import { buildSiteContext, buildMemberContext, maskSensitiveData } from '../utils/aiContextBuilder';
import { SYSTEM_PROMPT } from '../utils/aiPrompts';
import { TOOL_DECLARATIONS, executeToolCall } from '../utils/aiTools';

class GeminiService {
  static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  static STREAM_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';
  static apiKey = null;
  static rateLimitCounter = { count: 0, resetTime: 0 };
  static _siteData = null;

  /**
   * Araç çağrılarında kullanılacak site verisini sakla
   */
  static setSiteData(data) { this._siteData = data; }

  /**
   * API key'i al (Firebase veya env variable)
   */
  static async getApiKey() {
    if (this.apiKey) return this.apiKey;

    const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
    if (USE_FIREBASE) {
      try {
        const FirebaseService = (await import('../services/FirebaseService')).default;
        const configDoc = await FirebaseService.getById('gemini_api_config', 'main');
        if (configDoc?.api_key) {
          let key = configDoc.api_key;
          if (key.startsWith('U2FsdGVkX1')) {
            const { decryptData } = await import('../utils/crypto');
            key = decryptData(key);
          }
          this.apiKey = key;
          return key;
        }
      } catch (e) {
        console.warn('Firebase API key yüklenemedi, env variable kullanılıyor');
      }
    }

    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    return this.apiKey;
  }

  /**
   * Rate limiting kontrolü (20 istek/dakika)
   */
  static checkRateLimit() {
    const now = Date.now();
    if (now > this.rateLimitCounter.resetTime) {
      this.rateLimitCounter = { count: 0, resetTime: now + 60000 };
    }
    this.rateLimitCounter.count++;
    if (this.rateLimitCounter.count > 20) {
      throw new Error('Çok fazla istek gönderildi. Lütfen bir dakika bekleyin.');
    }
  }

  /**
   * Context builder delegasyonu
   */
  static buildSiteContext(siteData) {
    return buildSiteContext(siteData);
  }

  static buildMemberContext(member, siteData) {
    return buildMemberContext(member, siteData);
  }

  /**
   * Konuşma geçmişini Gemini formatına çevir
   */
  static formatHistory(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) return [];

    return conversationHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'model')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || msg.message || '' }]
      }));
  }

  /**
   * Ana chat fonksiyonu — Gemini native API
   */
  static async chat(userMessage, context = [], conversationHistory = []) {
    try {
      this.checkRateLimit();
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        throw new Error('Gemini API anahtarı bulunamadı. Lütfen Ayarlar > Chatbot API sayfasından API anahtarını girin veya VITE_GEMINI_API_KEY environment variable\'ını ayarlayın.');
      }

      // Context'i birleştir ve maskele
      const contextText = Array.isArray(context) ? context.join('\n\n') : String(context);
      const maskedContext = maskSensitiveData(contextText);
      const maskedMessage = maskSensitiveData(userMessage);

      // Gemini native format — systemInstruction ayrı alan
      const requestBody = {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT + '\n\n--- SİTE VERİLERİ ---\n\n' + maskedContext }]
        },
        contents: [
          ...this.formatHistory(conversationHistory),
          {
            role: 'user',
            parts: [{ text: maskedMessage }]
          }
        ],
        tools: [{
          functionDeclarations: TOOL_DECLARATIONS
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          topP: 0.95,
          topK: 40
        }
      };

      const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error?.message || `API hatası: ${response.status}`;

        // 402 hatası için özel mesaj
        if (response.status === 402) {
          errorMessage = 'Gemini API ücretsiz tier limiti aşıldı veya ödeme gerekiyor. Lütfen Google AI Studio\'dan hesabınızı kontrol edin.';
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const content = candidate?.content;

      // Function call kontrolü — Gemini bir araç çağırmak istiyorsa işle
      if (content?.parts?.[0]?.functionCall) {
        const functionCall = content.parts[0].functionCall;
        const toolResult = await executeToolCall(functionCall.name, functionCall.args, this._siteData);

        // Araç sonucunu Gemini'ye geri gönder; doğal dil yanıtı al
        const followUpBody = {
          systemInstruction: requestBody.systemInstruction,
          contents: [
            ...requestBody.contents,
            { role: 'model', parts: [{ functionCall }] },
            { role: 'user', parts: [{ functionResponse: { name: functionCall.name, response: { result: toolResult } } }] }
          ],
          generationConfig: requestBody.generationConfig
        };

        const followUpResponse = await fetch(`${this.API_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(followUpBody)
        });

        const followUpData = await followUpResponse.json();
        return followUpData.candidates?.[0]?.content?.parts?.[0]?.text || toolResult;
      }

      // Normal metin yanıtı
      const text = content?.parts?.[0]?.text;

      if (!text) throw new Error('Gemini yanıt üretemedi');
      return text;

    } catch (error) {
      console.error('Gemini chat hatası:', error.message);
      throw error;
    }
  }

  /**
   * Streaming chat — kelime kelime yanıt
   */
  static async chatStream(userMessage, context = [], conversationHistory = [], onChunk) {
    try {
      this.checkRateLimit();
      const apiKey = await this.getApiKey();
      if (!apiKey) throw new Error('Gemini API anahtarı bulunamadı');

      const contextText = Array.isArray(context) ? context.join('\n\n') : String(context);
      const maskedContext = maskSensitiveData(contextText);
      const maskedMessage = maskSensitiveData(userMessage);

      const requestBody = {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT + '\n\n--- SİTE VERİLERİ ---\n\n' + maskedContext }]
        },
        contents: [
          ...this.formatHistory(conversationHistory),
          { role: 'user', parts: [{ text: maskedMessage }] }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          topP: 0.95,
          topK: 40
        }
      };

      const response = await fetch(`${this.STREAM_URL}?key=${apiKey}&alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API hatası: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullText += text;
                onChunk?.(text, fullText);
              }
            } catch (e) {
              // Skip unparseable chunks
            }
          }
        }
      }

      return fullText;

    } catch (error) {
      console.error('Gemini streaming hatası:', error.message);
      throw error;
    }
  }

  /**
   * Görüntü analizi (chatbot'ta fotoğraf gönderme)
   */
  static async analyzeImage(imageBase64, mimeType, prompt = 'Bu görseli analiz et') {
    try {
      this.checkRateLimit();
      const apiKey = await this.getApiKey();
      if (!apiKey) throw new Error('Gemini API anahtarı bulunamadı');

      const requestBody = {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
          role: 'user',
          parts: [
            { text: maskSensitiveData(prompt) },
            { inlineData: { mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048
        }
      };

      const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) throw new Error(`API hatası: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Görsel analiz edilemedi';

    } catch (error) {
      console.error('Gemini görüntü analizi hatası:', error.message);
      throw error;
    }
  }
}

export default GeminiService;
