import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc
} from "firebase/firestore";
import { auth, db } from '../config/firebase';

function CreateAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);

  // Sayfa yüklendiğinde otomatik olarak admin kullanıcısını oluştur
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!adminInfo && !loading) {
        console.log('🚀 CreateAdminPage: Admin kullanıcısı otomatik oluşturuluyor...');
        createAdmin();
      }
    }, 1000); // 1 saniye bekle, Firebase'in initialize olması için

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createAdmin = async () => {
    setLoading(true);
    setResult(null);
    setAdminInfo(null);

    try {
      const adminUsername = 'admin';
      const adminPassword = '1491aaa1491';
      const adminEmail = `${adminUsername}@sekreterlikapp.com`;

      let userCredential;

      try {
        // Firebase Auth'da kullanıcı oluştur
        userCredential = await createUserWithEmailAndPassword(
          auth,
          adminEmail,
          adminPassword
        );
        setResult({ type: 'success', message: '✅ Firebase Authentication kullanıcısı oluşturuldu!' });
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          // Kullanıcı zaten varsa giriş yap
          userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          setResult({ type: 'info', message: 'ℹ️ Kullanıcı zaten mevcut, giriş yapıldı.' });
        } else {
          throw error;
        }
      }

      // Firestore'da admin bilgilerini kaydet
      console.log('💾 Firestore\'da admin bilgileri kaydediliyor...');
      const adminDocRef = doc(db, 'admin', 'main');

      await setDoc(adminDocRef, {
        username: adminUsername,
        email: adminEmail,
        uid: userCredential.user.uid,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log('✅ Admin bilgileri Firestore\'a kaydedildi!');
      setResult({
        type: 'success',
        message: '✅ Admin bilgileri Firestore\'a kaydedildi!'
      });

      // Bağlantıyı test et
      console.log('🧪 Bağlantı test ediliyor...');
      const testDoc = await getDoc(adminDocRef);
      if (testDoc.exists()) {
        console.log('✅ Admin dokümanı başarıyla okundu:', testDoc.data());
        setAdminInfo({
          username: adminUsername,
          email: adminEmail,
          password: adminPassword,
          uid: userCredential.user.uid
        });
        setResult({
          type: 'success',
          message: '🎉 Admin kullanıcısı başarıyla oluşturuldu ve bağlantı test edildi!'
        });
      } else {
        console.warn('⚠️ Admin dokümanı okunamadı');
      }

    } catch (error) {
      console.error('Error:', error);
      let errorMsg = `❌ Hata: ${error.message}`;
      if (error.code === 'auth/operation-not-allowed') {
        errorMsg = '❌ HATA: Firebase Console\'da "Email/Password" sağlayıcısı aktif değil! Lütfen Firebase Console > Authentication > Sign-in Method kısmından Email/Password seçeneğini etkinleştirin.';
      }
      setResult({
        type: 'error',
        message: errorMsg
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          🔥 Firebase Admin Kullanıcısı Oluştur
        </h1>

        <p className="text-gray-600 mb-4">
          Bu sayfa Firebase Authentication ve Firestore bağlantısını test eder ve ilk admin kullanıcısını oluşturur.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Önemli:</strong> Giriş hatası alıyorsanız, Firebase Console'da <strong>"Email/Password"</strong> sağlayıcısının açık olduğundan ve mevcut domaininizin <strong>"Authorized Domains"</strong> listesinde olduğundan emin olun.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={createAdmin}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Oluşturuluyor...
            </>
          ) : (
            'Admin Kullanıcısı Oluştur'
          )}
        </button>

        {result && (
          <div className={`mt-6 p-4 rounded-lg ${result.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
            result.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
              'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
            <p className="font-medium">{result.message}</p>
          </div>
        )}

        {adminInfo && (
          <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              ✅ Admin Kullanıcısı Başarıyla Oluşturuldu!
            </h2>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Username:</span>
                <span className="font-bold text-gray-800">{adminInfo.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-bold text-gray-800">{adminInfo.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Password:</span>
                <span className="font-bold text-gray-800">{adminInfo.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">UID:</span>
                <span className="font-bold text-gray-800 text-xs break-all">{adminInfo.uid}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
              <p className="text-yellow-800 text-sm">
                ⚠️ <strong>Önemli:</strong> Production ortamında mutlaka şifreyi değiştirin!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateAdminPage;

