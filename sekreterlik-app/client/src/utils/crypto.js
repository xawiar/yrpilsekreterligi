import CryptoJS from 'crypto-js';

// Encryption key - production'da environment variable'dan alınmalı
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 
  'ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security';

/**
 * Veriyi şifreler
 * @param {any} data - Şifrelenecek veri
 * @returns {string} Şifrelenmiş string
 */
export function encryptData(data) {
  if (data === null || data === undefined) return null;
  
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(dataString, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return data; // Hata durumunda orijinal veriyi döndür
  }
}

/**
 * Verinin şifrelenmiş olup olmadığını kontrol eder
 * Şifrelenmiş veriler genellikle base64 formatında ve "U2FsdGVkX1" ile başlar
 */
function isEncrypted(data) {
  if (typeof data !== 'string') return false;
  
  // CryptoJS ile şifrelenmiş veriler "U2FsdGVkX1" ile başlar
  if (data.startsWith('U2FsdGVkX1')) {
    return true;
  }
  
  // Eğer string çok kısa ise, muhtemelen şifrelenmemiş
  if (data.length < 20) return false;
  
  // Eğer sadece rakamlardan oluşuyorsa (TC veya telefon numarası gibi), şifrelenmemiş
  if (/^\d+$/.test(data)) {
    return false;
  }
  
  // JSON parse edilebiliyorsa, muhtemelen decrypt edilmiş
  try {
    JSON.parse(data);
    return false;
  } catch {
    // JSON parse edilemiyorsa ve uzunsa, şifrelenmiş olabilir
    return data.length > 20;
  }
}

/**
 * Şifrelenmiş veriyi çözer
 * @param {string} encryptedData - Şifrelenmiş veri
 * @returns {any} Çözülmüş veri
 */
export function decryptData(encryptedData) {
  if (!encryptedData) return null;
  
  // Eğer string değilse, olduğu gibi döndür
  if (typeof encryptedData !== 'string') {
    return encryptedData;
  }
  
  // Eğer "U2FsdGVkX1" ile başlıyorsa, kesinlikle şifrelenmiş - decrypt et
  if (encryptedData.startsWith('U2FsdGVkX1')) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      // Eğer decrypt edilen veri boş veya geçersizse, orijinal veriyi döndür
      if (!decrypted || decrypted.trim() === '') {
        console.warn('⚠️ Decrypt edilen veri boş, orijinal veri döndürülüyor');
        return encryptedData;
      }
      
      // JSON parse denemesi
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted; // String ise direkt döndür
      }
    } catch (error) {
      console.warn('⚠️ Decrypt hatası, orijinal veri döndürülüyor:', error.message);
      return encryptedData;
    }
  }
  
  // Eğer şifrelenmiş görünmüyorsa ama kontrol edelim
  if (!isEncrypted(encryptedData)) {
    // Muhtemelen zaten decrypt edilmiş, olduğu gibi döndür
    try {
      return JSON.parse(encryptedData);
    } catch {
      return encryptedData;
    }
  }
  
  // Şifrelenmiş görünüyor ama "U2FsdGVkX1" ile başlamıyor - yine de decrypt deneyelim
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // Eğer decrypt edilen veri boş veya geçersizse, orijinal veriyi döndür
    if (!decrypted || decrypted.trim() === '') {
      return encryptedData;
    }
    
    // JSON parse denemesi
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted; // String ise direkt döndür
    }
  } catch (error) {
    // Decryption hatası - muhtemelen veri zaten decrypt edilmiş veya hiç şifrelenmemiş
    return encryptedData; // Hata durumunda orijinal veriyi döndür
  }
}

/**
 * Nesneyi şifrelenmiş hale getirir (recursive)
 * @param {object} obj - Şifrelenecek nesne
 * @param {string[]} fieldsToEncrypt - Şifrelenecek alan isimleri
 * @returns {object} Şifrelenmiş nesne
 */
export function encryptObject(obj, fieldsToEncrypt = []) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const encrypted = { ...obj };
  
  fieldsToEncrypt.forEach(field => {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      encrypted[field] = encryptData(encrypted[field]);
    }
  });
  
  return encrypted;
}

/**
 * Şifrelenmiş nesneyi çözer (recursive)
 * @param {object} obj - Şifrelenmiş nesne
 * @param {string[]} fieldsToDecrypt - Çözülecek alan isimleri
 * @returns {object} Çözülmüş nesne
 */
export function decryptObject(obj, fieldsToDecrypt = []) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const decrypted = { ...obj };
  
  fieldsToDecrypt.forEach(field => {
    if (decrypted[field] !== undefined && decrypted[field] !== null) {
      try {
        // Sadece string alanları decrypt et (object'ler zaten decrypt edilmiş olabilir)
        if (typeof decrypted[field] === 'string') {
          const originalValue = decrypted[field];
          const decryptedValue = decryptData(originalValue);
          
          // Eğer decrypt edilen değer farklıysa (yani başarılı decrypt olduysa), kullan
          // Aksi halde orijinal değeri koru
          if (decryptedValue !== originalValue || originalValue.startsWith('U2FsdGVkX1')) {
            decrypted[field] = decryptedValue;
          }
        }
        // Eğer field zaten object ise, olduğu gibi bırak
      } catch (error) {
        // Decryption hatası - alanı olduğu gibi bırak
        console.warn(`⚠️ Decrypt hatası (${field}):`, error.message);
      }
    }
  });
  
  return decrypted;
}

/**
 * Hassas alanlar listesi (varsayılan)
 */
export const SENSITIVE_FIELDS = [
  'password',
  'phone',
  'email',
  'tc',      // TC kimlik numarası
  'tcNo',    // Alternatif TC alan adı
  'address',
  'notes',
  'description',
  'content',
  'message'
];

