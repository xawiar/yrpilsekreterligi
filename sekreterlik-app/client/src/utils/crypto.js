import CryptoJS from 'crypto-js';

// Encryption key - production'da environment variable'dan alınmalı
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 
  'ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security-minimum-32-characters';

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
  
  // Eğer sadece rakamlardan oluşuyorsa (TC veya telefon numarası gibi), muhtemelen şifrelenmemiş
  if (/^\d+$/.test(encryptedData)) {
    return encryptedData;
  }
  
  // Eğer çok kısa ise (11 karakterden az), muhtemelen şifrelenmemiş
  if (encryptedData.length < 11) {
    return encryptedData;
  }
  
  // "U2FsdGVkX1" ile başlıyorsa, kesinlikle şifrelenmiş - decrypt et
  if (encryptedData.startsWith('U2FsdGVkX1')) {
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
      return encryptedData;
    }
  }
  
  // Eğer şifrelenmiş görünmüyorsa ama uzunsa, yine de decrypt deneyelim
  // Çünkü bazı şifrelenmiş veriler farklı formatta olabilir
  if (encryptedData.length > 20 && !/^\d+$/.test(encryptedData)) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      // Eğer decrypt edilen veri boş değilse ve orijinalden farklıysa, kullan
      if (decrypted && decrypted.trim() !== '' && decrypted !== encryptedData) {
        // JSON parse denemesi
        try {
          return JSON.parse(decrypted);
        } catch {
          return decrypted; // String ise direkt döndür
        }
      }
    } catch (error) {
      // Decrypt başarısız, orijinal veriyi döndür
    }
  }
  
  // Muhtemelen zaten decrypt edilmiş veya şifrelenmemiş, olduğu gibi döndür
  try {
    return JSON.parse(encryptedData);
  } catch {
    return encryptedData;
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
          
          // Eğer "U2FsdGVkX1" ile başlıyorsa, kesinlikle şifrelenmiş - zorla decrypt et
          if (originalValue.startsWith('U2FsdGVkX1')) {
            try {
              const bytes = CryptoJS.AES.decrypt(originalValue, ENCRYPTION_KEY);
              const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
              
              if (decryptedStr && decryptedStr.trim() !== '') {
                // JSON parse denemesi
                try {
                  const parsed = JSON.parse(decryptedStr);
                  decrypted[field] = typeof parsed === 'string' ? parsed : decryptedStr;
                } catch {
                  decrypted[field] = decryptedStr;
                }
              } else {
                // Decrypt başarısız, decryptData ile tekrar dene
                const fallbackDecrypted = decryptData(originalValue);
                if (fallbackDecrypted && fallbackDecrypted !== originalValue) {
                  decrypted[field] = fallbackDecrypted;
                }
              }
            } catch (error) {
              // Decrypt hatası, decryptData ile tekrar dene
              const fallbackDecrypted = decryptData(originalValue);
              if (fallbackDecrypted && fallbackDecrypted !== originalValue) {
                decrypted[field] = fallbackDecrypted;
              }
            }
          } else {
            // "U2FsdGVkX1" ile başlamıyor ama uzunsa, yine de decrypt deneyelim
            if (originalValue.length > 20 && !/^\d+$/.test(originalValue)) {
              const decryptedValue = decryptData(originalValue);
              
              // Eğer decrypt edilen değer orijinalden farklıysa ve geçerli bir değerse, kullan
              if (decryptedValue && 
                  decryptedValue !== originalValue && 
                  typeof decryptedValue === 'string' &&
                  decryptedValue.length > 0 &&
                  !decryptedValue.startsWith('U2FsdGVkX1')) {
                decrypted[field] = decryptedValue;
              }
            }
          }
        }
        // Eğer field zaten object ise, olduğu gibi bırak
      } catch (error) {
        // Decryption hatası - alanı olduğu gibi bırak
        // Sessizce devam et
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

