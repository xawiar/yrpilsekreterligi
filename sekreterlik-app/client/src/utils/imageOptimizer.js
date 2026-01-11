/**
 * Image Optimization Utility
 * Tutanak fotoğrafları için compression ve optimization
 */

/**
 * Resmi optimize et ve sıkıştır
 * @param {File} file - Orijinal resim dosyası
 * @param {Object} options - Optimizasyon seçenekleri
 * @param {number} options.maxWidth - Maksimum genişlik (default: 1920)
 * @param {number} options.maxHeight - Maksimum yükseklik (default: 1920)
 * @param {number} options.quality - JPEG kalitesi 0-1 arası (default: 0.85)
 * @param {number} options.maxSizeMB - Maksimum dosya boyutu MB (default: 2)
 * @returns {Promise<File>} Optimize edilmiş resim dosyası
 */
export async function optimizeImage(file, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxSizeMB = 2
  } = options;

  return new Promise((resolve, reject) => {
    // Sadece resim dosyaları için optimize et
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    // Dosya zaten küçükse optimize etme
    if (file.size <= maxSizeMB * 1024 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Canvas oluştur
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Boyutları hesapla (aspect ratio korunarak)
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Resmi canvas'a çiz
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Canvas'ı blob'a çevir
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Resim optimize edilemedi'));
              return;
            }

            // Dosya adını koru
            const optimizedFile = new File(
              [blob],
              file.name,
              {
                type: file.type,
                lastModified: Date.now()
              }
            );

            resolve(optimizedFile);
          },
          file.type,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Resim yüklenemedi'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Dosya okunamadı'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Resim için thumbnail oluştur
 * @param {File} file - Orijinal resim dosyası
 * @param {number} maxSize - Thumbnail maksimum boyutu (default: 300)
 * @returns {Promise<string>} Thumbnail data URL
 */
export async function createThumbnail(file, maxSize = 300) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Geçersiz dosya tipi'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Thumbnail boyutunu hesapla
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        resolve(thumbnail);
      };

      img.onerror = () => {
        reject(new Error('Resim yüklenemedi'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Dosya okunamadı'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Resim boyutunu formatla (MB, KB)
 * @param {number} bytes - Byte cinsinden boyut
 * @returns {string} Formatlanmış boyut
 */
export function formatImageSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

