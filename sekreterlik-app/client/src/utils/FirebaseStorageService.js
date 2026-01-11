/**
 * Firebase Storage Service
 * Dosya yükleme ve indirme işlemleri için
 * 
 * NOT: ElectionResultForm için UploadQueue kullanılmalı (concurrent limit ve retry için)
 * Bu service diğer upload'lar için kullanılabilir
 */

import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import uploadQueue from './UploadQueue';

class FirebaseStorageService {
  /**
   * Dosyayı Firebase Storage'a yükle
   * @param {File} file - Yüklenecek dosya
   * @param {string} path - Storage path (örn: 'photos/member-123.jpg')
   * @param {Object} metadata - Ek metadata (contentType, customMetadata vb.)
   * @param {Function} onProgress - Progress callback (0-100) - optional
   * @param {boolean} useQueue - UploadQueue kullanılsın mı? (default: false, küçük dosyalar için)
   * @returns {Promise<string>} Download URL
   */
  static async uploadFile(file, path, metadata = {}, onProgress = null, useQueue = false) {
    try {
      console.log('📤 Uploading file to Firebase Storage:', { path, size: file.size, type: file.type, useQueue });
      
      // Büyük dosyalar veya eşzamanlı upload riski varsa queue kullan
      if (useQueue || file.size > 1024 * 1024) { // 1MB'dan büyükse queue kullan
        return await uploadQueue.add(file, path, metadata, onProgress, 5);
      }
      
      // Küçük dosyalar için direkt upload (hızlı)
      const storageRef = ref(storage, path);
      
      // Metadata'yı hazırla
      const uploadMetadata = {
        contentType: file.type || metadata.contentType || 'application/octet-stream',
        ...metadata
      };
      
      // Dosyayı yükle
      const snapshot = await uploadBytes(storageRef, file, uploadMetadata);
      
      // Download URL'i al
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('✅ File uploaded successfully:', { path, downloadURL });
      
      return downloadURL;
    } catch (error) {
      console.error('❌ Firebase Storage upload error:', error);
      
      // Retry yapılabilir hatalar için queue'ya ekle
      const retryableErrors = ['quota-exceeded', 'unauthenticated', 'unauthorized', 'retry-limit-exceeded', 'network', 'QUIC'];
      const isRetryable = retryableErrors.some(err => 
        error.code?.includes(err) || error.message?.includes(err)
      );
      
      if (isRetryable && !useQueue) {
        console.log('⚠️ Retryable error detected, retrying with queue...');
        return await uploadQueue.add(file, path, metadata, onProgress, 5);
      }
      
      throw new Error(`Dosya yüklenirken hata oluştu: ${error.message}`);
    }
  }

  /**
   * Dosyayı Firebase Storage'dan sil
   * @param {string} path - Storage path
   */
  static async deleteFile(path) {
    try {
      console.log('🗑️ Deleting file from Firebase Storage:', path);
      
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      
      console.log('✅ File deleted successfully:', path);
    } catch (error) {
      // Dosya bulunamazsa hata verme (zaten silinmiş olabilir)
      if (error.code !== 'storage/object-not-found') {
        console.error('❌ Firebase Storage delete error:', error);
        throw new Error(`Dosya silinirken hata oluştu: ${error.message}`);
      } else {
        console.log('ℹ️ File not found (may already be deleted):', path);
      }
    }
  }

  /**
   * Download URL'i al
   * @param {string} path - Storage path
   * @returns {Promise<string>} Download URL
   */
  static async getDownloadURL(path) {
    try {
      const storageRef = ref(storage, path);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('❌ Firebase Storage getDownloadURL error:', error);
      throw new Error(`Dosya URL'i alınırken hata oluştu: ${error.message}`);
    }
  }

  /**
   * Klasördeki tüm dosyaları listele
   * @param {string} folderPath - Klasör path
   * @returns {Promise<Array>} Dosya listesi
   */
  static async listFiles(folderPath) {
    try {
      const folderRef = ref(storage, folderPath);
      const result = await listAll(folderRef);
      
      const files = await Promise.all(
        result.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return {
            name: itemRef.name,
            fullPath: itemRef.fullPath,
            url
          };
        })
      );
      
      return files;
    } catch (error) {
      console.error('❌ Firebase Storage listFiles error:', error);
      throw new Error(`Dosya listesi alınırken hata oluştu: ${error.message}`);
    }
  }

  /**
   * Üye fotoğrafı yükle
   * @param {string|number} memberId - Üye ID
   * @param {File} file - Fotoğraf dosyası
   * @returns {Promise<string>} Download URL
   */
  static async uploadMemberPhoto(memberId, file) {
    const memberIdStr = String(memberId);
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const path = `members/${memberIdStr}/photo_${timestamp}.${extension}`;
    
    return await this.uploadFile(file, path, {
      contentType: file.type,
      customMetadata: {
        memberId: memberIdStr,
        uploadedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Kişisel belge yükle
   * @param {string|number} memberId - Üye ID
   * @param {string} documentName - Belge adı
   * @param {File} file - Belge dosyası
   * @returns {Promise<string>} Download URL
   */
  static async uploadPersonalDocument(memberId, documentName, file) {
    const memberIdStr = String(memberId);
    const timestamp = Date.now();
    const sanitizedDocName = documentName.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = file.name.split('.').pop() || 'pdf';
    const path = `personal-documents/${memberIdStr}/${sanitizedDocName}_${timestamp}.${extension}`;
    
    return await this.uploadFile(file, path, {
      contentType: file.type,
      customMetadata: {
        memberId: memberIdStr,
        documentName: documentName,
        uploadedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Arşiv belgesi yükle
   * @param {string} documentName - Belge adı
   * @param {File} file - Belge dosyası
   * @returns {Promise<string>} Download URL
   */
  static async uploadArchiveDocument(documentName, file) {
    const timestamp = Date.now();
    const sanitizedDocName = documentName.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = file.name.split('.').pop() || 'pdf';
    const path = `archive/${sanitizedDocName}_${timestamp}.${extension}`;
    
    return await this.uploadFile(file, path, {
      contentType: file.type,
      customMetadata: {
        documentName: documentName,
        uploadedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Storage path'den dosya URL'i al (eğer zaten URL ise direkt döndür)
   * @param {string} pathOrUrl - Storage path veya URL
   * @returns {Promise<string>} Download URL
   */
  static async getFileURL(pathOrUrl) {
    // Eğer zaten bir URL ise (http/https ile başlıyorsa), direkt döndür
    if (pathOrUrl && (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://'))) {
      return pathOrUrl;
    }
    
    // Eğer storage path ise, download URL'i al
    if (pathOrUrl) {
      return await this.getDownloadURL(pathOrUrl);
    }
    
    return null;
  }
}

export default FirebaseStorageService;

