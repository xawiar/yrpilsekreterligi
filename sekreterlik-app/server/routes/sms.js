const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const { requireAdmin } = require('../middleware/auth');

const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY;

/**
 * Firestore'dan SMS yapılandırmasını al ve decrypt et
 */
async function getSmsConfig() {
  const { getAdmin } = require('../config/firebaseAdmin');
  const admin = getAdmin();
  if (!admin) {
    throw new Error('Firebase Admin SDK başlatılmadı');
  }

  const db = admin.firestore();
  const doc = await db.collection('sms_config').doc('main').get();

  if (!doc.exists) {
    throw new Error('SMS yapılandırması bulunamadı. Lütfen ayarlardan SMS yapılandırmasını tamamlayın.');
  }

  const config = doc.data();

  // Client-side CryptoJS ile şifrelenmiş anahtarları çöz
  let apiKey = config.apiKey;
  let apiSecret = config.apiSecret;

  if (ENCRYPTION_KEY) {
    if (apiKey && apiKey.startsWith('U2FsdGVkX1')) {
      try {
        const bytes = CryptoJS.AES.decrypt(apiKey, ENCRYPTION_KEY);
        apiKey = bytes.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        console.error('SMS apiKey decrypt hatası:', e.message);
      }
    }
    if (apiSecret && apiSecret.startsWith('U2FsdGVkX1')) {
      try {
        const bytes = CryptoJS.AES.decrypt(apiSecret, ENCRYPTION_KEY);
        apiSecret = bytes.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        console.error('SMS apiSecret decrypt hatası:', e.message);
      }
    }
  }

  return {
    provider: config.provider || 'netgsm',
    apiKey,
    apiSecret,
    sender: config.sender || 'NETGSM'
  };
}

/**
 * Telefon numarasını temizle ve formatla
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
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
 * Netgsm üzerinden tek SMS gönder
 */
async function sendViaNetgsm(config, phone, message) {
  const { apiKey, apiSecret, sender } = config;

  const params = new URLSearchParams({
    usercode: apiKey,
    password: apiSecret,
    gsmno: phone,
    message: message,
    msgheader: sender || 'NETGSM',
    dil: 'TR'
  });

  const apiUrl = 'https://api.netgsm.com.tr/sms/send/get';
  const response = await fetch(`${apiUrl}?${params.toString()}`);
  const responseText = await response.text();

  if (responseText.startsWith('00')) {
    return {
      success: true,
      message: 'SMS başarıyla gönderildi',
      data: { messageId: responseText.trim() }
    };
  }

  const errorMessages = {
    '20': 'Mesaj metni hatalı veya boş',
    '30': 'Geçersiz kullanıcı adı, şifre veya hesap',
    '40': 'Mesaj başlığı (sender) kayıtlı değil',
    '50': 'Abone hesabında yeterli kredi yok',
    '51': 'Gönderilecek numara formatı hatalı',
    '70': 'Hatalı sorgu. Gönderdiğiniz parametrelerden birisi hatalı veya zorunlu alanlardan birisi eksik'
  };

  return {
    success: false,
    message: errorMessages[responseText.trim()] || `SMS gönderilemedi: ${responseText.trim()}`
  };
}

/**
 * Netgsm üzerinden toplu SMS gönder
 */
async function sendBulkViaNetgsm(config, phones, message) {
  const { apiKey, apiSecret, sender } = config;

  const gsmno = phones.join(',');
  const params = new URLSearchParams({
    usercode: apiKey,
    password: apiSecret,
    gsmno: gsmno,
    message: message,
    msgheader: sender || 'NETGSM',
    dil: 'TR'
  });

  const apiUrl = 'https://api.netgsm.com.tr/sms/send/bulk';
  const response = await fetch(`${apiUrl}?${params.toString()}`);
  const responseText = await response.text();

  if (responseText.startsWith('00')) {
    return { success: true, sent: phones.length, failed: 0, errors: [] };
  }

  // Toplu gönderim başarısız, tek tek dene
  const results = { sent: 0, failed: 0, errors: [] };
  for (const phone of phones) {
    try {
      const result = await sendViaNetgsm(config, phone, message);
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ phone, error: result.message });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.failed++;
      results.errors.push({ phone, error: error.message });
    }
  }
  return results;
}

// ============================================
// ROUTES - Tümü admin only
// ============================================

/**
 * POST /api/sms/send
 * Tek SMS gönder
 * Body: { phone, message }
 */
router.post('/send', requireAdmin, async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Telefon numarası ve mesaj gereklidir' });
    }

    const cleanPhone = formatPhoneNumber(phone);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, message: 'Geçersiz telefon numarası formatı' });
    }

    const config = await getSmsConfig();
    if (!config.apiKey || !config.apiSecret) {
      return res.status(400).json({ success: false, message: 'SMS yapılandırması eksik. Lütfen ayarlardan SMS yapılandırmasını tamamlayın.' });
    }

    const result = await sendViaNetgsm(config, cleanPhone, message);
    res.json(result);
  } catch (error) {
    console.error('SMS gönderme hatası:', error);
    res.status(500).json({ success: false, message: error.message || 'SMS gönderilirken hata oluştu' });
  }
});

/**
 * POST /api/sms/send-bulk
 * Toplu SMS gönder
 * Body: { phones: [{phone, message}], defaultMessage? }
 * Veya: { phones: [string], message: string }
 */
router.post('/send-bulk', requireAdmin, async (req, res) => {
  try {
    const { phones, message, recipients } = req.body;

    if (!phones && !recipients) {
      return res.status(400).json({ success: false, message: 'Alıcı listesi gereklidir' });
    }

    const config = await getSmsConfig();
    if (!config.apiKey || !config.apiSecret) {
      return res.status(400).json({ success: false, message: 'SMS yapılandırması eksik.' });
    }

    const results = { sent: 0, failed: 0, errors: [] };

    // recipients: [{phone, message, name}] formatı - kişiselleştirilmiş mesajlar
    if (recipients && Array.isArray(recipients)) {
      for (const recipient of recipients) {
        const cleanPhone = formatPhoneNumber(recipient.phone);
        if (!cleanPhone) {
          results.failed++;
          results.errors.push({ phone: recipient.phone, name: recipient.name, error: 'Geçersiz telefon numarası' });
          continue;
        }

        try {
          const result = await sendViaNetgsm(config, cleanPhone, recipient.message);
          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ phone: recipient.phone, name: recipient.name, error: result.message });
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.failed++;
          results.errors.push({ phone: recipient.phone, name: recipient.name, error: error.message });
        }
      }
    }
    // phones: [string], message: string formatı - aynı mesaj herkese
    else if (phones && Array.isArray(phones) && message) {
      const cleanPhones = phones.map(p => formatPhoneNumber(p)).filter(Boolean);
      if (cleanPhones.length === 0) {
        return res.status(400).json({ success: false, message: 'Geçerli telefon numarası bulunamadı', sent: 0, failed: phones.length });
      }

      const bulkResult = await sendBulkViaNetgsm(config, cleanPhones, message);
      results.sent = bulkResult.sent;
      results.failed = bulkResult.failed;
      results.errors = bulkResult.errors;
    } else {
      return res.status(400).json({ success: false, message: 'Geçersiz istek formatı' });
    }

    results.success = results.failed === 0;
    results.message = results.sent > 0
      ? `${results.sent} SMS gönderildi${results.failed > 0 ? `, ${results.failed} başarısız` : ''}`
      : 'Hiçbir SMS gönderilemedi';

    res.json(results);
  } catch (error) {
    console.error('Toplu SMS gönderme hatası:', error);
    res.status(500).json({ success: false, message: error.message || 'Toplu SMS gönderilirken hata oluştu' });
  }
});

module.exports = router;
