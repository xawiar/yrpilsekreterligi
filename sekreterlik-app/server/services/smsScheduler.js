/**
 * SMS Scheduler Service
 * Her dakika kontrol: scheduled_at <= now AND status='pending' -> gonder
 */

let isRunning = false;

async function processPendingScheduledSms() {
  if (isRunning) return;
  isRunning = true;

  try {
    const db = require('../config/database');
    const now = new Date().toISOString();

    // Pending ve zamani gelmis SMS'leri bul
    const pendingSms = await db.all(
      'SELECT * FROM scheduled_sms WHERE status = ? AND scheduled_at <= ?',
      ['pending', now]
    );

    if (pendingSms.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`[SMS Scheduler] ${pendingSms.length} adet planlanmis SMS isleniyor...`);

    for (const sms of pendingSms) {
      try {
        // Status'u 'processing' yap
        await db.run('UPDATE scheduled_sms SET status = ? WHERE id = ?', ['processing', sms.id]);

        const recipients = JSON.parse(sms.recipients);
        const message = sms.message;

        if (!recipients || recipients.length === 0 || !message) {
          await db.run('UPDATE scheduled_sms SET status = ? WHERE id = ?', ['failed', sms.id]);
          continue;
        }

        // SMS gondermek icin sms route'undaki fonksiyonlari kullan
        // Burada dogrudan Netgsm API'sini cagirabiliriz
        const CryptoJS = require('crypto-js');
        const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY;
        const { getAdmin } = require('../config/firebaseAdmin');

        let config;
        try {
          const admin = getAdmin();
          if (!admin) throw new Error('Firebase Admin SDK yok');

          const fbDb = admin.firestore();
          const doc = await fbDb.collection('sms_config').doc('main').get();
          if (!doc.exists) throw new Error('SMS config yok');

          const configData = doc.data();
          let apiKey = configData.apiKey;
          let apiSecret = configData.apiSecret;

          if (ENCRYPTION_KEY) {
            if (apiKey && apiKey.startsWith('U2FsdGVkX1')) {
              const bytes = CryptoJS.AES.decrypt(apiKey, ENCRYPTION_KEY);
              apiKey = bytes.toString(CryptoJS.enc.Utf8);
            }
            if (apiSecret && apiSecret.startsWith('U2FsdGVkX1')) {
              const bytes = CryptoJS.AES.decrypt(apiSecret, ENCRYPTION_KEY);
              apiSecret = bytes.toString(CryptoJS.enc.Utf8);
            }
          }

          config = {
            provider: configData.provider || 'netgsm',
            apiKey,
            apiSecret,
            sender: configData.sender || 'NETGSM'
          };
        } catch (configError) {
          console.error('[SMS Scheduler] Config hatasi:', configError.message);
          await db.run('UPDATE scheduled_sms SET status = ? WHERE id = ?', ['failed', sms.id]);
          continue;
        }

        // SMS gonder
        let sentCount = 0;
        let failedCount = 0;

        for (const recipient of recipients) {
          try {
            const phone = formatPhoneNumber(typeof recipient === 'string' ? recipient : recipient.phone);
            if (!phone) {
              failedCount++;
              continue;
            }

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
              sentCount++;
            } else {
              failedCount++;
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (sendError) {
            failedCount++;
          }
        }

        const status = failedCount === 0 ? 'sent' : (sentCount === 0 ? 'failed' : 'partial');
        await db.run('UPDATE scheduled_sms SET status = ? WHERE id = ?', [status, sms.id]);

        // Tarihceye kaydet
        await db.run(
          'INSERT INTO sms_history (sender_id, recipient_count, message, status) VALUES (?, ?, ?, ?)',
          [null, recipients.length, message, status]
        );

        console.log(`[SMS Scheduler] Planlanmis SMS #${sms.id}: ${sentCount} gonderildi, ${failedCount} basarisiz`);
      } catch (smsError) {
        console.error(`[SMS Scheduler] SMS #${sms.id} isleme hatasi:`, smsError.message);
        try {
          const db = require('../config/database');
          await db.run('UPDATE scheduled_sms SET status = ? WHERE id = ?', ['failed', sms.id]);
        } catch (e) {}
      }
    }
  } catch (error) {
    console.error('[SMS Scheduler] Genel hata:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Telefon numarasini formatla
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
 * Scheduler'i baslat (her 60 saniye)
 */
function startSmsScheduler() {
  console.log('[SMS Scheduler] Basladi - Her 60 saniyede bir kontrol edilecek');
  setInterval(processPendingScheduledSms, 60000);
  // Ilk calistirmayi 10 saniye sonra yap (server baslangicini bekleme)
  setTimeout(processPendingScheduledSms, 10000);
}

module.exports = { startSmsScheduler, processPendingScheduledSms };
