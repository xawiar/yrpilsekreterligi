import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import { createAdminUser, syncMemberUsersToFirebaseAuth } from '../utils/createFirebaseUsers';

// Firebase config'i import et
const firebaseConfig = {
  apiKey: "AIzaSyA0wDM5fXHtm0uDlALRhkQzF7tpsZ-7BZI",
  authDomain: "spilsekreterligi.firebaseapp.com",
  projectId: "spilsekreterligi",
  storageBucket: "spilsekreterligi.firebasestorage.app",
  messagingSenderId: "692841027309",
  appId: "1:692841027309:web:d702e7f55031de5eef5ee4",
  measurementId: "G-0X605S84W1"
};

const FirebaseTestPage = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [adminResult, setAdminResult] = useState(null);

  const testFirebaseConnection = async () => {
    try {
      setLoading(true);
      setResults([]);
      setAdminResult(null);

      // Test 1: Firebase Auth bağlantısı
      const test1 = { test: 'Firebase Auth Bağlantısı', status: 'testing', message: '' };
      setResults([test1]);

      try {
        
        // Auth instance'ı kontrol et
        if (!auth) {
          throw new Error('Firebase Auth instance bulunamadı - auth null veya undefined');
        }
        
        // Auth'un app'ine erişim kontrolü
        if (auth.app) {
        }
        
        test1.status = 'success';
        test1.message = `✅ Firebase Auth bağlantısı başarılı (Project: ${firebaseConfig.projectId})`;
      } catch (error) {
        console.error('❌ Firebase Auth test hatası:', error);
        test1.status = 'error';
        test1.message = `❌ Firebase Auth bağlantı hatası: ${error.message}`;
      }
      setResults([test1]);

      // Test 2: Firestore bağlantısı
      const test2 = { test: 'Firestore Bağlantısı', status: 'testing', message: '' };
      setResults(prev => [...prev, test2]);

      try {
        
        if (!db) {
          throw new Error('Firestore instance bulunamadı - db null veya undefined');
        }
        
        // Test dokümanı oluştur
        const testDocRef = doc(db, 'test', 'connection');
        
        await setDoc(testDocRef, {
          timestamp: new Date().toISOString(),
          test: true,
          projectId: firebaseConfig.projectId
        });
        
        const testDoc = await getDoc(testDocRef);
        
        if (testDoc.exists()) {
          test2.status = 'success';
          test2.message = '✅ Firestore bağlantısı başarılı - Yazma ve okuma test edildi';
        } else {
          throw new Error('Test dokümanı okunamadı - Doküman mevcut değil');
        }
      } catch (error) {
        console.error('❌ Firestore test hatası:', error);
        console.error('❌ Hata kodu:', error.code);
        console.error('❌ Hata mesajı:', error.message);
        console.error('❌ Hata stack:', error.stack);
        
        let errorMessage = `❌ Firestore bağlantı hatası: ${error.message}`;
        if (error.code) {
          errorMessage += ` (Kod: ${error.code})`;
        }
        
        // Özel hata mesajları
        if (error.code === 'permission-denied') {
          errorMessage += '\n💡 Çözüm: Firestore güvenlik kurallarını kontrol edin. Test koleksiyonu için yazma izni verin.';
        } else if (error.code === 'unavailable') {
          errorMessage += '\n💡 Çözüm: İnternet bağlantınızı kontrol edin.';
        } else if (error.message.includes('instance')) {
          errorMessage += '\n💡 Çözüm: Firebase yapılandırmasını kontrol edin.';
        }
        
        test2.status = 'error';
        test2.message = errorMessage;
      }
      setResults(prev => [...prev.slice(0, -1), test2]);

      // Test 3: Firebase Storage bağlantısı
      const test3 = { test: 'Firebase Storage Bağlantısı', status: 'testing', message: '' };
      setResults(prev => [...prev, test3]);

      try {
        
        if (!storage) {
          throw new Error('Firebase Storage instance bulunamadı - storage null veya undefined');
        }
        
        // Test dosyası oluştur ve yükle
        const testFileName = `test/connection_${Date.now()}.txt`;
        const testFileRef = ref(storage, testFileName);
        const testContent = new Blob(['Firebase Storage test - ' + new Date().toISOString()], { type: 'text/plain' });
        
        const snapshot = await uploadBytes(testFileRef, testContent, {
          contentType: 'text/plain',
          customMetadata: {
            test: 'true',
            projectId: firebaseConfig.projectId
          }
        });
        
        // Download URL'i al
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Test dosyasını sil
        await deleteObject(testFileRef);
        
        test3.status = 'success';
        test3.message = `✅ Firebase Storage bağlantısı başarılı (Bucket: ${firebaseConfig.storageBucket}) - Yazma, okuma ve silme test edildi`;
      } catch (error) {
        console.error('❌ Firebase Storage test hatası:', error);
        console.error('❌ Hata kodu:', error.code);
        console.error('❌ Hata mesajı:', error.message);
        
        let errorMessage = `❌ Firebase Storage bağlantı hatası: ${error.message}`;
        if (error.code) {
          errorMessage += ` (Kod: ${error.code})`;
        }
        
        // Özel hata mesajları
        if (error.code === 'storage/unauthorized') {
          errorMessage += '\n💡 Çözüm: Firebase Storage güvenlik kurallarını kontrol edin.';
        } else if (error.code === 'storage/quota-exceeded') {
          errorMessage += '\n💡 Çözüm: Firebase Storage kotası dolmuş olabilir.';
        } else if (error.code === 'storage/unauthenticated') {
          errorMessage += '\n💡 Çözüm: Kullanıcı kimlik doğrulaması gerekli.';
        }
        
        test3.status = 'error';
        test3.message = errorMessage;
      }
      setResults(prev => [...prev.slice(0, -1), test3]);

      // Test 4: Admin kullanıcısı oluştur
      const test4 = { test: 'Admin Kullanıcısı Oluşturma', status: 'testing', message: '' };
      setResults(prev => [...prev, test4]);

      try {
        const adminResult = await createAdminUser();
        if (adminResult.success) {
          test4.status = 'success';
          test4.message = `✅ Admin kullanıcısı oluşturuldu: ${adminResult.email}`;
          setAdminResult(adminResult);
        } else {
          throw new Error(adminResult.message || 'Admin kullanıcısı oluşturulamadı');
        }
      } catch (error) {
        test4.status = 'error';
        test4.message = `❌ Admin kullanıcısı oluşturma hatası: ${error.message}`;
      }
      setResults(prev => [...prev.slice(0, -1), test4]);

    } catch (error) {
      console.error('Firebase test hatası:', error);
      setResults(prev => [...prev, {
        test: 'Genel Hata',
        status: 'error',
        message: `❌ ${error.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const syncAllUsers = async () => {
    try {
      setLoading(true);
      setResults([]);

      const result = await syncMemberUsersToFirebaseAuth();
      
      if (result.success) {
        setResults([{
          test: 'Üye Kullanıcıları Firebase Auth\'a Aktarım',
          status: 'success',
          message: `✅ Başarılı: ${result.successCount} kullanıcı, Hata: ${result.errorCount} kullanıcı`
        }]);
      } else {
        setResults([{
          test: 'Üye Kullanıcıları Firebase Auth\'a Aktarım',
          status: 'error',
          message: `❌ ${result.message}`
        }]);
      }
    } catch (error) {
      console.error('Sync hatası:', error);
      setResults([{
        test: 'Üye Kullanıcıları Firebase Auth\'a Aktarım',
        status: 'error',
        message: `❌ ${error.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Firebase Bağlantı Testi</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Firebase bağlantısını test edin ve admin kullanıcısını oluşturun.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex space-x-3">
          <button
            onClick={testFirebaseConnection}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {loading ? 'Test Ediliyor...' : 'Firebase Bağlantısını Test Et ve Admin Oluştur'}
          </button>
          <button
            onClick={syncAllUsers}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? 'Aktarılıyor...' : 'Tüm Üye Kullanıcılarını Firebase Auth\'a Aktar'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Test Sonuçları</h3>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  result.status === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : result.status === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{result.test}</span>
                  <span className={`text-sm ${
                    result.status === 'success'
                      ? 'text-green-700 dark:text-green-300'
                      : result.status === 'error'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}>
                    {result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⏳'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{result.message}</p>
              </div>
            ))}
          </div>
        )}

        {adminResult && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Admin Kullanıcı Bilgileri</h3>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Username:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{adminResult.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{adminResult.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Password:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{adminResult.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">UID:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100 text-xs break-all">{adminResult.uid}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirebaseTestPage;

