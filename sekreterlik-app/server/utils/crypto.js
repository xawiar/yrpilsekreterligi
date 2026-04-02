const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_HEX = (process.env.FIELD_ENCRYPTION_KEY || '').trim();

if (!KEY_HEX) {
  console.error('[crypto] 🔴 KRİTİK: FIELD_ENCRYPTION_KEY tanımlı değil! Veriler şifrelenmeden saklanıyor.');
}

const KEY = KEY_HEX ? Buffer.from(KEY_HEX, 'hex') : null;

let keyMissingLogged = false;

function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;

  if (!KEY) {
    if (!keyMissingLogged) {
      console.error('[crypto] 🔴 KRİTİK: Şifreleme anahtarı tanımlı değil! Veriler şifrelenmeden saklanıyor.');
      keyMissingLogged = true;
    }
    return plaintext;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decryptField(ciphertext) {
  if (!ciphertext) return null;

  if (!KEY) {
    if (!keyMissingLogged) {
      console.error('[crypto] 🔴 KRİTİK: Şifreleme anahtarı tanımlı değil! Veriler şifrelenmeden saklanıyor.');
      keyMissingLogged = true;
    }
    return ciphertext;
  }

  try {
    const [ivB64, tagB64, dataB64] = String(ciphertext).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return ciphertext; // already plaintext
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  } catch (_) {
    // Return original if not decryptable
    return ciphertext;
  }
}

module.exports = { encryptField, decryptField };


