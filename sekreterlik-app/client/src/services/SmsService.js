/**
 * SMS Service
 * SMS gönderimini backend proxy üzerinden yapar.
 * API anahtarları backend'de tutulur, frontend'den doğrudan SMS API'sine erişim yoktur.
 */

import { USE_FIREBASE } from '../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

class SmsService {
  constructor() {
    this.provider = 'netgsm';
  }

  /**
   * Auth header'larını al
   */
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  /**
   * SMS servis yapılandırmasını yükle (sadece provider bilgisi için, anahtarlar backend'de)
   */
  async loadConfig() {
    // Config artık backend'de yönetiliyor, frontend'de sadece provider bilgisi tutulabilir
    try {
      if (USE_FIREBASE) {
        const { FirebaseService } = await import('./FirebaseService');
        try {
          const configDoc = await FirebaseService.getById('sms_config', 'main');
          if (configDoc) {
            this.provider = configDoc.provider || 'netgsm';
          }
        } catch (error) {
          console.warn('SMS config not found, using default');
        }
      }
    } catch (error) {
      console.error('Error loading SMS config:', error);
    }
  }

  /**
   * Tek bir SMS gönder (backend proxy üzerinden)
   * @param {string} phone - Telefon numarası (5XXXXXXXXX formatında)
   * @param {string} message - Gönderilecek mesaj
   * @returns {Promise<{success: boolean, message: string, data?: any}>}
   */
  async sendSms(phone, message) {
    try {
      const response = await fetch(`${API_BASE_URL}/sms/send`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ phone, message })
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.message || 'SMS gönderilemedi'
        };
      }

      return result;
    } catch (error) {
      console.error('SMS gönderme hatası:', error);
      return {
        success: false,
        message: `SMS gönderilemedi: ${error.message}`
      };
    }
  }

  /**
   * Toplu SMS gönder (backend proxy üzerinden)
   * @param {string[]} phones - Telefon numaraları array'i
   * @param {string} message - Gönderilecek mesaj
   * @returns {Promise<{success: boolean, message: string, sent: number, failed: number, errors?: any[]}>}
   */
  async sendBulkSms(phones, message) {
    try {
      const response = await fetch(`${API_BASE_URL}/sms/send-bulk`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ phones, message })
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.message || 'Toplu SMS gönderilemedi',
          sent: 0,
          failed: phones.length
        };
      }

      return result;
    } catch (error) {
      console.error('Toplu SMS gönderme hatası:', error);
      return {
        success: false,
        message: `Toplu SMS gönderilemedi: ${error.message}`,
        sent: 0,
        failed: phones.length
      };
    }
  }

  /**
   * Kişiselleştirilmiş toplu SMS gönder (backend proxy üzerinden)
   * @param {Array<{phone: string, message: string, name?: string}>} recipients - Alıcı listesi
   * @returns {Promise<{success: boolean, message: string, sent: number, failed: number, errors?: any[]}>}
   */
  async sendBulkPersonalized(recipients) {
    try {
      const response = await fetch(`${API_BASE_URL}/sms/send-bulk`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ recipients })
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.message || 'Toplu SMS gönderilemedi',
          sent: 0,
          failed: recipients.length
        };
      }

      return result;
    } catch (error) {
      console.error('Toplu SMS gönderme hatası:', error);
      return {
        success: false,
        message: `Toplu SMS gönderilemedi: ${error.message}`,
        sent: 0,
        failed: recipients.length
      };
    }
  }

  /**
   * Telefon numarasını temizle ve formatla
   * @param {string} phone - Telefon numarası (çeşitli formatlar)
   * @returns {string|null} - Formatlanmış telefon numarası (5XXXXXXXXX) veya null
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;

    // Sadece rakamları al
    const digits = phone.replace(/\D/g, '');

    // Türkiye telefon numarası formatı kontrolü
    if (digits.length === 10 && digits.startsWith('5')) {
      return digits;
    } else if (digits.length === 11 && digits.startsWith('05')) {
      return digits.substring(1);
    } else if (digits.length === 13 && digits.startsWith('905')) {
      return digits.substring(2);
    }

    return null;
  }

  /**
   * Mesaj formatını oluştur (planlanan toplantı/etkinlik için)
   */
  formatScheduledMessage(memberName, type, date, time, customText = '') {
    const typeText = type === 'meeting' ? 'toplantı' : 'etkinlik';
    let message = `Sayın ${memberName}, ${date} tarihinde ${time} saatinde ${typeText} planlanmıştır.`;
    if (customText && customText.trim()) {
      message += ` ${customText}`;
    }
    return message;
  }

  /**
   * Toplu mesaj formatını oluştur
   */
  formatBulkMessage(memberName, customText) {
    return `Sn ${memberName}, ${customText}`;
  }
}

// Singleton instance
const smsService = new SmsService();

export default smsService;
