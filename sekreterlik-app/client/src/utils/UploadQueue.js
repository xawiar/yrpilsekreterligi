/**
 * Upload Queue System
 * Firebase Storage'a eşzamanlı upload limitini yönetmek için queue sistemi
 * 
 * Özellikler:
 * - Maksimum eşzamanlı upload sayısı kontrolü (default: 100)
 * - Otomatik retry mechanism (exponential backoff)
 * - Progress tracking
 * - Error handling
 */

import { storage } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

class UploadQueue {
  constructor(maxConcurrent = 100) {
    this.queue = [];
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  }

  /**
   * Upload'u queue'ya ekle
   * @param {File} file - Yüklenecek dosya
   * @param {string} path - Storage path
   * @param {Object} options - Upload seçenekleri
   * @param {Function} onProgress - Progress callback (0-100)
   * @param {number} maxRetries - Maksimum retry sayısı (default: 5)
   * @returns {Promise<string>} Download URL
   */
  async add(file, path, options = {}, onProgress = null, maxRetries = 5) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        file,
        path,
        options,
        onProgress,
        maxRetries,
        retryCount: 0,
        resolve,
        reject,
        addedAt: Date.now()
      });
      
      // Queue'yu işle
      this.process();
    });
  }

  /**
   * Queue'daki upload'ları işle
   */
  async process() {
    // Maksimum eşzamanlı upload'a ulaşıldıysa veya queue boşsa dur
    if (this.active >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Sıradaki upload'ı al
    const uploadItem = this.queue.shift();
    this.active++;

    try {
      // Upload'u dene
      const url = await this.uploadWithRetry(
        uploadItem.file,
        uploadItem.path,
        uploadItem.options,
        uploadItem.onProgress,
        uploadItem.maxRetries,
        uploadItem.retryCount
      );
      
      uploadItem.resolve(url);
    } catch (error) {
      // Tüm retry'lar tükendiyse hata döndür
      uploadItem.reject(error);
    } finally {
      this.active--;
      // Sıradaki upload'ı işle
      this.process();
    }
  }

  /**
   * Retry mechanism ile upload yap
   * @param {File} file - Yüklenecek dosya
   * @param {string} path - Storage path
   * @param {Object} options - Upload seçenekleri
   * @param {Function} onProgress - Progress callback
   * @param {number} maxRetries - Maksimum retry sayısı
   * @param {number} retryCount - Mevcut retry sayısı
   * @returns {Promise<string>} Download URL
   */
  async uploadWithRetry(file, path, options = {}, onProgress = null, maxRetries = 5, retryCount = 0) {
    try {
      return await this.uploadFile(file, path, options, onProgress);
    } catch (error) {
      // Retry yapılabilir hatalar
      const retryableErrors = [
        'storage/quota-exceeded',
        'storage/unauthenticated',
        'storage/unauthorized',
        'storage/retry-limit-exceeded',
        'storage/canceled',
        'unavailable',
        'network',
        'QUIC'
      ];

      const isRetryable = retryableErrors.some(err => 
        error.code?.includes(err) || 
        error.message?.includes(err) ||
        error.code === err
      );

      // Retry yapılabilir hata ve retry sayısı limit içindeyse
      if (isRetryable && retryCount < maxRetries) {
        const delay = this.retryDelays[Math.min(retryCount, this.retryDelays.length - 1)];
        
        console.warn(`⚠️ Upload retry ${retryCount + 1}/${maxRetries} after ${delay}ms:`, error.message);
        
        // Exponential backoff ile bekle
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Tekrar dene
        return await this.uploadWithRetry(file, path, options, onProgress, maxRetries, retryCount + 1);
      }

      // Retry yapılamazsa veya retry limit aşıldıysa hata fırlat
      throw error;
    }
  }

  /**
   * Dosyayı Firebase Storage'a yükle (uploadBytesResumable ile progress tracking)
   * @param {File} file - Yüklenecek dosya
   * @param {string} path - Storage path
   * @param {Object} options - Upload seçenekleri
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<string>} Download URL
   */
  async uploadFile(file, path, options = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      
      // Metadata hazırla
      const metadata = {
        contentType: file.type || options.contentType || 'application/octet-stream',
        ...options.metadata
      };

      // Upload task oluştur (resumable upload için)
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      // Progress tracking
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress hesapla (0-100)
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          
          if (onProgress) {
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          // Upload hatası
          console.error('❌ Upload error:', error);
          reject(error);
        },
        async () => {
          // Upload başarılı
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('✅ Upload successful:', { path, downloadURL });
            resolve(downloadURL);
          } catch (error) {
            console.error('❌ Error getting download URL:', error);
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Queue durumunu al
   * @returns {Object} Queue durumu
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      active: this.active,
      maxConcurrent: this.maxConcurrent,
      total: this.queue.length + this.active
    };
  }

  /**
   * Queue'yu temizle (tüm bekleyen upload'ları iptal et)
   */
  clear() {
    this.queue.forEach(item => {
      item.reject(new Error('Upload queue cleared'));
    });
    this.queue = [];
  }
}

// Singleton instance (tüm uygulama için tek queue)
const uploadQueue = new UploadQueue(100); // Maksimum 100 eşzamanlı upload

export default uploadQueue;

