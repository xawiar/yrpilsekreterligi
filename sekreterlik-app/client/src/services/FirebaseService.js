import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { encryptObject, decryptObject, SENSITIVE_FIELDS } from '../utils/crypto';

/**
 * Firebase Firestore Service
 * Tüm veriler şifrelenmiş olarak kaydedilir ve okunur
 */
class FirebaseService {
  /**
   * Authentication durumunu kontrol eder
   * @returns {Promise<boolean>} Kullanıcı authenticated mı?
   */
  static async checkAuth() {
    return new Promise((resolve) => {
      if (auth.currentUser) {
        resolve(true);
      } else {
        // onAuthStateChanged ile kısa bir süre bekle
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          if (user) {
            resolve(true);
          } else {
            console.warn('⚠️ User is NOT authenticated');
            resolve(false);
          }
        });
        
        // 1 saniye sonra timeout
        setTimeout(() => {
          unsubscribe();
          resolve(false);
        }, 1000);
      }
    });
  }

  /**
   * Veriyi Firestore'a kaydeder
   * Collection otomatik oluşturulur (Firestore özelliği)
   * @param {string} collectionName - Koleksiyon adı
   * @param {string} docId - Doküman ID (opsiyonel, yoksa otomatik oluşturulur)
   * @param {object} data - Kaydedilecek veri
   * @param {boolean} encrypt - Şifreleme yapılsın mı (default: false - artık şifreleme yapılmıyor)
   * @returns {Promise<string>} Doküman ID
   */
  static async create(collectionName, docId, data, encrypt = false) {
    try {
      // Authentication kontrolü
      const isAuthenticated = await this.checkAuth();
      if (!isAuthenticated) {
        throw new Error('Kullanıcı giriş yapmamış. Lütfen önce giriş yapın.');
      }
      
      
      // Collection referansı oluştur (collection yoksa otomatik oluşturulur)
      const collectionRef = collection(db, collectionName);
      
      // Doküman ID'si yoksa otomatik oluştur (timestamp + random)
      const autoId = docId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const docRef = doc(collectionRef, autoId);
      
      // Şifreleme yapılıyorsa hassas alanları şifrele
      const dataToSave = encrypt 
        ? encryptObject(data, SENSITIVE_FIELDS)
        : data;
      
      // Timestamp ve metadata ekle
      const finalData = {
        ...dataToSave,
        id: autoId, // ID'yi veri içinde de sakla
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        _collection: collectionName, // Hangi collection'da olduğunu işaretle
        _createdBy: auth.currentUser?.uid || null // Kim oluşturdu
      };
      
      // Dokümanı kaydet (collection yoksa otomatik oluşturulur)
      // Retry mekanizması ile QUIC hatalarını handle et
      let retries = 3;
      let lastError = null;
      
      while (retries > 0) {
        try {
          await setDoc(docRef, finalData);
          break; // Başarılı, döngüden çık
        } catch (error) {
          lastError = error;
          // QUIC hatası veya network hatası ise retry yap
          if (error.message && (error.message.includes('QUIC') || error.message.includes('network') || error.code === 'unavailable')) {
            retries--;
            if (retries > 0) {
              console.warn(`⚠️ Retry creating document (${3 - retries + 1}/3):`, error.message);
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
              continue;
            }
          }
          // QUIC hatası değilse veya retry bittiyse throw et
          throw error;
        }
      }
      
      // Son retry'de de başarısız olduysa
      if (retries === 0 && lastError) {
        // QUIC hatası ise uyarı ver ama devam et (işlem başarılı olabilir)
        if (lastError.message && lastError.message.includes('QUIC')) {
          console.warn('⚠️ QUIC protokol hatası, ancak doküman kaydedilmiş olabilir');
          // Hata fırlatma, işlem devam etsin
        } else {
          throw lastError;
        }
      }
      return autoId;
    } catch (error) {
      console.error(`❌ Error creating document in collection "${collectionName}":`, error);
      
      // Permission hatası için daha açıklayıcı mesaj
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        throw new Error('Firebase Security Rules hatası. Lütfen Firebase Console\'da Firestore Rules\'u güncelleyin. Detaylar için docs/archive/FIREBASE_SECURITY_RULES.md dosyasına bakın.');
      }
      
      throw error;
    }
  }

  /**
   * Dokümanı günceller
   * @param {string} collectionName - Koleksiyon adı
   * @param {string} docId - Doküman ID
   * @param {object} data - Güncellenecek veri
   * @param {boolean} encrypt - Şifreleme yapılsın mı (default: false - artık şifreleme yapılmıyor)
   * @returns {Promise<void>}
   */
  static async update(collectionName, docId, data, encrypt = false) {
    try {
      const docRef = doc(db, collectionName, docId);
      
      // Şifreleme yapılıyorsa hassas alanları şifrele
      const dataToUpdate = encrypt 
        ? encryptObject(data, SENSITIVE_FIELDS)
        : data;
      
      // ID ve collection bilgisini koru
      const finalData = {
        ...dataToUpdate,
        id: docId, // ID'yi koru
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(docRef, finalData);
    } catch (error) {
      console.error(`❌ Error updating document in collection "${collectionName}":`, error);
      throw error;
    }
  }

  /**
   * Dokümanı okur ve çözer
   * @param {string} collectionName - Koleksiyon adı
   * @param {string} docId - Doküman ID
   * @param {boolean} decrypt - Çözme yapılsın mı
   * @returns {Promise<object|null>} Doküman verisi
   */
  static async getById(collectionName, docId, decrypt = true) {
    try {
      // Ensure collectionName and docId are strings
      const safeCollectionName = String(collectionName || '').trim();
      const safeDocId = String(docId || '').trim();
      
      if (!safeCollectionName || !safeDocId) {
        throw new Error(`Invalid params for getById: collection="${safeCollectionName}", id="${safeDocId}"`);
      }
      
      if (typeof safeCollectionName !== 'string' || typeof safeDocId !== 'string') {
        throw new Error(`Params not strings for getById: collection type=${typeof safeCollectionName}, id type=${typeof safeDocId}`);
      }
      
      const docRef = doc(db, safeCollectionName, safeDocId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      let data = { 
        id: docSnap.id, 
        ...docSnap.data() 
      };
      
      // Timestamp'leri dönüştür
      if (data.createdAt?.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      if (data.updatedAt?.toDate) {
        data.updatedAt = data.updatedAt.toDate().toISOString();
      }
      
      // Çözme yapılıyorsa hassas alanları çöz
      return decrypt 
        ? decryptObject(data, SENSITIVE_FIELDS)
        : data;
    } catch (error) {
      // Offline hatası için özel handling - varsayılan değerler kullanılacak
      if (error.code === 'unavailable' || error.code === 'failed-precondition' || error.message?.includes('offline') || error.message?.includes('Failed to get document because the client is offline')) {
        console.warn(`[FirebaseService] Offline — returning cached or null for ${collectionName}`);
        return { _offline: true, _error: error.message };
      }
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Koleksiyondaki tüm dokümanları okur ve çözer
   * Collection yoksa boş array döner
   * @param {string} collectionName - Koleksiyon adı
   * @param {object} options - Query seçenekleri (where, orderBy, limit)
   * @param {boolean} decrypt - Çözme yapılsın mı
   * @returns {Promise<Array>} Doküman listesi
   * @throws {Error} Collection okunamazsa hata fırlatır
   */
  // Basit in-memory cache (60 saniye TTL)
  static _cache = new Map();
  static _getCached(key) {
    const entry = this._cache.get(key);
    if (entry && Date.now() - entry.ts < 60000) return entry.data;
    this._cache.delete(key);
    return null;
  }
  static _setCache(key, data) {
    this._cache.set(key, { data, ts: Date.now() });
  }
  static clearCache(prefix) {
    if (!prefix) { this._cache.clear(); return; }
    for (const k of this._cache.keys()) { if (k.startsWith(prefix)) this._cache.delete(k); }
  }

  static async getAll(collectionName, options = {}, decrypt = true) {
    try {
      // Cache kontrolu — sadece filtresiz sorgular icin
      const cacheKey = 'fs_' + collectionName + '_' + JSON.stringify(options);
      if (!options.where && !options.startAfter) {
        const cached = this._getCached(cacheKey);
        if (cached) return cached;
      }

      const collectionRef = collection(db, collectionName);
      let q = query(collectionRef);
      
      // Where clauses
      if (options.where && Array.isArray(options.where)) {
        options.where.forEach(w => {
          q = query(q, where(w.field, w.operator || '==', w.value));
        });
      }
      
      // Order by
      if (options.orderBy) {
        q = query(q, orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
      }
      
      // Limit - Sadece açıkça belirtilirse uygula
      // Varsayılan limit yok - tüm veriler getirilir (veri kaybını önlemek için)
      if (options.limit) {
        q = query(q, limit(options.limit));
      }
      // Not: Production'da da varsayılan limit yok - veri eksikliği olmaması için
      // Performans sorunu olursa, belirli sayfalarda (dashboard, analytics gibi) limit kullanılabilir
      
      // Pagination support - startAfter için
      if (options.startAfter) {
        // startAfter için last document snapshot gerekir
        // Bu durumda options.startAfter bir document snapshot olmalı
        // Şimdilik basit bir implementasyon
        // TODO: Daha gelişmiş pagination için document snapshot kullan
      }
      
      const querySnapshot = await getDocs(q);
      const docs = [];
      
      querySnapshot.forEach((docSnap) => {
        let data = { 
          id: String(docSnap.id), // ID'yi mutlaka string'e çevir
          ...docSnap.data() 
        };
        
        // Eğer data içinde id property'si varsa, onu da string'e çevir
        if (data.id) {
          data.id = String(data.id);
        }
        
        // Timestamp'leri dönüştür
        if (data.createdAt?.toDate) {
          data.createdAt = data.createdAt.toDate().toISOString();
        }
        if (data.updatedAt?.toDate) {
          data.updatedAt = data.updatedAt.toDate().toISOString();
        }
        
        // Çözme yapılıyorsa hassas alanları çöz
        let decryptedData = decrypt 
          ? decryptObject(data, SENSITIVE_FIELDS)
          : data;
        
        // CRITICAL: After decrypt, ensure ID is ALWAYS a string
        // decryptObject might change the ID format
        if (decryptedData) {
          // Use docSnap.id as the source of truth (it's always a string from Firestore)
          decryptedData.id = String(docSnap.id);
          
          // Double check: if decryptedData.id exists, ensure it's also a string
          if (decryptedData.id && typeof decryptedData.id !== 'string') {
            decryptedData.id = String(decryptedData.id);
          }
          
          // Final validation: ID must be string and not empty
          if (!decryptedData.id || typeof decryptedData.id !== 'string' || decryptedData.id.trim() === '') {
            console.error(`⚠️ Invalid ID after decrypt:`, {
              docSnapId: docSnap.id,
              docSnapIdType: typeof docSnap.id,
              decryptedDataId: decryptedData.id,
              decryptedDataIdType: typeof decryptedData.id
            });
            // Use docSnap.id as fallback (it's always valid)
            decryptedData.id = String(docSnap.id);
          }
        } else {
          // If decrypt failed, use original data
          decryptedData = data;
          decryptedData.id = String(docSnap.id);
        }
        
        docs.push(decryptedData);
      });
      
      // Cache'e kaydet
      if (!options.where && !options.startAfter) {
        this._setCache(cacheKey, docs);
      }
      return docs;
    } catch (error) {
      // Collection yoksa boş array döner (hata değil)
      if (error.code === 'not-found' || error.code === 'permission-denied' || error.message?.includes('collection')) {
        // Silently return empty array for missing collections
        return [];
      }
      console.warn(`⚠️ Error getting documents from collection "${collectionName}":`, error.message || error);
      return [];
    }
  }

  /**
   * Dokümanı siler
   * @param {string} collectionName - Koleksiyon adı
   * @param {string} docId - Doküman ID
   * @returns {Promise<void>}
   */
  static async delete(collectionName, docId) {
    try {
      // CRITICAL: Log raw parameters BEFORE any conversion
      
      // Collection name'i string'e çevir
      const stringCollectionName = String(collectionName || '').trim();
      if (!stringCollectionName) {
        throw new Error(`Geçersiz collection name: ${collectionName}`);
      }
      
      // ID'yi mutlaka string'e çevir (Firebase string bekler)
      let stringId;
      
      if (docId === null || docId === undefined) {
        throw new Error(`Doküman ID null veya undefined: ${docId}`);
      }
      
      // ID'nin tipine göre string'e çevir
      if (typeof docId === 'object') {
        if (Array.isArray(docId)) {
          throw new Error(`Doküman ID array olamaz: ${JSON.stringify(docId)}`);
        }
        if (docId.id) {
          stringId = String(docId.id);
        } else if (docId.toString && typeof docId.toString === 'function') {
          stringId = String(docId.toString());
        } else {
          stringId = JSON.stringify(docId);
        }
      } else if (typeof docId === 'number') {
        stringId = String(docId);
      } else {
        stringId = String(docId);
      }
      
      // Boş string kontrolü
      if (!stringId || stringId.trim() === '' || stringId === 'undefined' || stringId === 'null' || stringId === '[object Object]') {
        throw new Error(`Geçersiz doküman ID: ${docId} (stringId: ${stringId}, type: ${typeof docId})`);
      }
      
      // Trim yap
      stringId = stringId.trim();
      
      // Final validation: Kesinlikle string olmalılar
      if (typeof stringCollectionName !== 'string' || typeof stringId !== 'string') {
        throw new Error(`Parametreler string değil! Collection: ${typeof stringCollectionName}, ID: ${typeof stringId}`);
      }
      
      // db instance kontrolü
      if (!db || typeof db !== 'object') {
        throw new Error(`Firebase db instance geçersiz! Type: ${typeof db}`);
      }
      
      
      // CRITICAL FIX: Firebase'in doc() fonksiyonunu 3 parametre ile çağır
      // doc(db, collectionPath, documentPath) - TÜM parametreler string olmalı
      // Bu Firebase'in resmi API'si ve path parsing sorunlarını önler
      
      // Son kontrol: Tüm parametreler kesinlikle string ve geçerli mi?
      // Triple-check: Her parametreyi 3 kez string'e çevir
      let finalCollectionName = stringCollectionName;
      let finalDocId = stringId;
      
      // İlk dönüşüm
      finalCollectionName = String(finalCollectionName || '').trim();
      finalDocId = String(finalDocId || '').trim();
      
      // İkinci dönüşüm (güvenlik için)
      finalCollectionName = String(finalCollectionName).trim();
      finalDocId = String(finalDocId).trim();
      
      // Üçüncü kontrol
      if (!finalCollectionName || !finalDocId) {
        throw new Error(`Final params invalid: collection="${finalCollectionName}", id="${finalDocId}"`);
      }
      
      // Type kontrolü
      if (typeof finalCollectionName !== 'string' || typeof finalDocId !== 'string') {
        throw new Error(`Final params not strings: collection type=${typeof finalCollectionName}, id type=${typeof finalDocId}`);
      }
      
      // Boş string kontrolü
      if (finalCollectionName.length === 0 || finalDocId.length === 0) {
        throw new Error(`Final params empty: collection length=${finalCollectionName.length}, id length=${finalDocId.length}`);
      }
      
      
      // ALTERNATIVE METHOD: Use collection() then doc() pattern
      // This is the recommended Firebase pattern and avoids path parsing issues
      let docRef;
      try {
        // Final validation: All params must be strings
        if (typeof finalCollectionName !== 'string' || typeof finalDocId !== 'string') {
          throw new Error(`Params not strings before doc() call: collection=${typeof finalCollectionName}, id=${typeof finalDocId}`);
        }
        
        // Validate string values are not empty
        if (!finalCollectionName || !finalDocId || finalCollectionName.length === 0 || finalDocId.length === 0) {
          throw new Error(`Params empty: collection="${finalCollectionName}", id="${finalDocId}"`);
        }
        
        // CRITICAL: Validate params one more time RIGHT before doc() call
        // This is the last chance to catch any type issues
        const validatedCollectionName = String(finalCollectionName).trim();
        const validatedDocId = String(finalDocId).trim();
        
        if (typeof validatedCollectionName !== 'string' || typeof validatedDocId !== 'string') {
          throw new Error(`FINAL CHECK FAILED: collection type=${typeof validatedCollectionName}, id type=${typeof validatedDocId}`);
        }
        
        if (validatedCollectionName.length === 0 || validatedDocId.length === 0) {
          throw new Error(`FINAL CHECK FAILED: collection length=${validatedCollectionName.length}, id length=${validatedDocId.length}`);
        }
        
        // CRITICAL: Use the SAME pattern as create() function
        // create() uses: collection(db, collectionName) then doc(collectionRef, docId)
        // delete() should use the SAME pattern for consistency
        
        // EXTREME VALIDATION: Create new variables with explicit string conversion
        const firebaseCollectionName = String(validatedCollectionName).trim();
        const firebaseDocId = String(validatedDocId).trim();
        
        // Validate one more time
        if (typeof firebaseCollectionName !== 'string' || typeof firebaseDocId !== 'string') {
          throw new Error(`FIREBASE CALL FAILED: collection type=${typeof firebaseCollectionName}, id type=${typeof firebaseDocId}`);
        }
        
        if (firebaseCollectionName.length === 0 || firebaseDocId.length === 0) {
          throw new Error(`FIREBASE CALL FAILED: collection length=${firebaseCollectionName.length}, id length=${firebaseDocId.length}`);
        }
        
        // EXACT COPY of create() pattern - NO CHANGES
        // Collection referansı oluştur (collection yoksa otomatik oluşturulur)
        // This is EXACTLY how create() does it - line 76
        const collectionRef = collection(db, firebaseCollectionName);
        
        // This is EXACTLY how create() does it - line 80
        docRef = doc(collectionRef, firebaseDocId);
        
        if (!docRef) {
          throw new Error('DocumentReference oluşturulamadı - docRef null/undefined');
        }
        
      } catch (docError) {
        console.error('❌ Firebase doc() CALL FAILED:', docError);
        console.error('❌ doc() error details:', {
          db: !!db,
          dbType: typeof db,
          dbIsNull: db === null,
          dbIsUndefined: db === undefined,
          collection: finalCollectionName,
          collectionType: typeof finalCollectionName,
          collectionValue: finalCollectionName,
          collectionLength: finalCollectionName?.length,
          id: finalDocId,
          idType: typeof finalDocId,
          idValue: finalDocId,
          idLength: finalDocId?.length,
          errorMessage: docError.message,
          errorStack: docError.stack?.substring(0, 500)
        });
        throw new Error(`Firebase doc() hatası: ${docError.message}. Collection: "${finalCollectionName}", ID: "${finalDocId}"`);
      }
      
      // Dokümanı sil
      try {
        
      await deleteDoc(docRef);
      } catch (deleteError) {
        console.error('❌ deleteDoc() CALL FAILED:', deleteError);
        console.error('❌ deleteDoc() error details:', {
          errorMessage: deleteError.message,
          errorCode: deleteError.code,
          errorStack: deleteError.stack?.substring(0, 500),
          docRefType: typeof docRef,
          docRefId: docRef?.id,
          docRefPath: docRef?.path,
          collection: finalCollectionName,
          id: finalDocId
        });
        throw new Error(`Firebase deleteDoc() hatası: ${deleteError.message}. Collection: "${finalCollectionName}", ID: "${finalDocId}"`);
      }
    } catch (error) {
      console.error(`❌ Error deleting document from ${collectionName}:`, error);
      console.error(`❌ Delete error details:`, {
        collectionName,
        collectionNameType: typeof collectionName,
        docId,
        docIdType: typeof docId,
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack?.substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Belirli bir alana göre doküman bulur
   * @param {string} collectionName - Koleksiyon adı
   * @param {string} field - Alan adı
   * @param {any} value - Değer
   * @param {boolean} decrypt - Çözme yapılsın mı
   * @returns {Promise<Array>} Doküman listesi
   */
  static async findByField(collectionName, field, value, decrypt = true) {
    try {
      // value undefined ise boş array döndür (Firebase where() undefined kabul etmez)
      if (value === undefined || value === null) {
        console.warn(`⚠️ findByField called with undefined/null value for field "${field}" in collection "${collectionName}"`);
        return [];
      }
      
      return await this.getAll(
        collectionName, 
        { 
          where: [{ field, operator: '==', value }] 
        }, 
        decrypt
      );
    } catch (error) {
      console.error(`❌ Error finding documents by field "${field}" in collection "${collectionName}":`, error);
      return [];
    }
  }

  /**
   * Collection'ın var olup olmadığını kontrol eder
   * @param {string} collectionName - Koleksiyon adı
   * @returns {Promise<boolean>} Collection var mı?
   */
  static async collectionExists(collectionName) {
    try {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(query(collectionRef, limit(1)));
      return !snapshot.empty;
    } catch (error) {
      return false;
    }
  }

  /**
   * Seçmen listesi - Toplu yükleme (Excel/CSV)
   * @param {Array} voters - Seçmen verileri array'i
   * @returns {Promise<Object>} İşlem sonucu
   */
  static async uploadVoters(voters) {
    try {
      const isAuthenticated = await this.checkAuth();
      if (!isAuthenticated) {
        throw new Error('Kullanıcı giriş yapmamış. Lütfen önce giriş yapın.');
      }

      const collectionName = 'voters';
      const collectionRef = collection(db, collectionName);
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Batch işlemleri için (Firestore batch limit: 500)
      const batchSize = 500;
      for (let i = 0; i < voters.length; i += batchSize) {
        const batch = voters.slice(i, i + batchSize);
        
        // Her voter için upsert işlemi
        for (const voter of batch) {
          try {
            const tc = String(voter.tc || '').replace(/\D/g, '');
            if (!tc || tc.length < 10) {
              errorCount++;
              errors.push(`Geçersiz TC: ${voter.tc}`);
              continue;
            }

            // TC'yi doc ID olarak kullan (unique)
            const docRef = doc(collectionRef, tc);
            
            const voterData = {
              tc: tc,
              fullName: String(voter.fullName || '').trim(),
              phone: String(voter.phone || '').replace(/\s+/g, '').trim(),
              district: String(voter.district || '').trim(),
              region: String(voter.region || '').trim(),
              role: String(voter.role || '').trim(),
              province: String(voter.province || '').trim(),
              city: String(voter.city || '').trim(),
              village: String(voter.village || '').trim(),
              neighborhood: String(voter.neighborhood || '').trim(),
              birthDate: String(voter.birthDate || '').trim(),
              sourceFile: voter.sourceFile || '',
              updatedAt: serverTimestamp(),
              _collection: collectionName,
              _updatedBy: auth.currentUser?.uid || null
            };

            // Eğer createdAt yoksa ekle
            const existingDoc = await getDoc(docRef);
            if (!existingDoc.exists()) {
              voterData.createdAt = serverTimestamp();
              voterData._createdBy = auth.currentUser?.uid || null;
            }

            await setDoc(docRef, voterData, { merge: true });
            successCount++;
          } catch (err) {
            errorCount++;
            errors.push(`TC ${voter.tc}: ${err.message}`);
          }
        }
      }

      return {
        success: true,
        globalStats: {
          totalProcessed: voters.length,
          upsertedCount: successCount,
          skippedRows: errorCount
        },
        errors: errors.slice(0, 10) // İlk 10 hatayı göster
      };
    } catch (error) {
      console.error('Firebase voter upload error:', error);
      throw error;
    }
  }

  /**
   * Seçmen arama
   * @param {string} query - Arama sorgusu (TC, İsim, Telefon)
   * @returns {Promise<Array>} Bulunan seçmenler
   */
  static async searchVoters(query) {
    try {
      const isAuthenticated = await this.checkAuth();
      if (!isAuthenticated) {
        throw new Error('Kullanıcı giriş yapmamış. Lütfen önce giriş yapın.');
      }

      if (!query || query.length < 2) {
        return [];
      }

      const collectionName = 'voters';
      const collectionRef = collection(db, collectionName);
      
      const searchLower = query.toLowerCase();
      const allVoters = await getDocs(collectionRef);
      
      const results = [];
      allVoters.forEach((doc) => {
        const data = doc.data();
        const tc = (data.tc || '').toLowerCase();
        const fullName = (data.fullName || '').toLowerCase();
        const phone = (data.phone || '').toLowerCase();
        
        if (tc.includes(searchLower) || 
            fullName.includes(searchLower) || 
            phone.includes(searchLower)) {
          results.push({
            id: doc.id,
            ...data,
            _id: doc.id // MongoDB uyumluluğu için
          });
        }
      });

      // İsme göre sırala ve limit uygula
      results.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      return results.slice(0, 50);
    } catch (error) {
      console.error('Firebase voter search error:', error);
      throw error;
    }
  }
}

export default FirebaseService;

