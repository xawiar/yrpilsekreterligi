import React, { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import ApiService from '../utils/ApiService';
import FirebaseService from '../services/FirebaseService';

const FirebaseAuthUsersPage = () => {
  const [authUsers, setAuthUsers] = useState([]);
  const [memberUsers, setMemberUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAuthUsers();
  }, []);

  const fetchAuthUsers = async () => {
    try {
      setLoading(true);
      setError('');

      // Firestore'daki member_users'ları al
      const memberUsersData = await FirebaseService.getAll('member_users');
      setMemberUsers(memberUsersData || []);

      // Firebase Auth'daki kullanıcıları almak için Admin SDK gerekir
      // Client-side'da bu mümkün değil, bu yüzden Firestore'daki authUid'leri kontrol ediyoruz
      // Admin kullanıcısını al
      const adminDoc = await FirebaseService.getById('admin', 'main');
      const adminUid = adminDoc?.uid || null;

      // Firestore'daki authUid'leri topla (admin hariç)
      const authUids = [];
      if (memberUsersData && memberUsersData.length > 0) {
        memberUsersData.forEach(memberUser => {
          if (memberUser.authUid && memberUser.authUid !== adminUid) {
            authUids.push({
              authUid: memberUser.authUid,
              username: memberUser.username,
              memberId: memberUser.memberId,
              observerId: memberUser.observerId,
              userType: memberUser.userType,
              isActive: memberUser.isActive,
              memberUserId: memberUser.id // member_user ID'si (silme için)
            });
          }
        });
      }

      setAuthUsers(authUids);
    } catch (err) {
      console.error('Error fetching auth users:', err);
      setError('Kullanıcılar alınırken hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAuthUser = async (authUid, memberUserId, username) => {
    if (!window.confirm(`Bu Firebase Auth kullanıcısını silmek istediğinize emin misiniz?\n\nUsername: ${username}\nAuth UID: ${authUid}`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Backend üzerinden Firebase Auth kullanıcısını sil
      let API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      if (!API_BASE_URL) {
        if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
          API_BASE_URL = 'https://yrpilsekreterligi.onrender.com/api';
        } else {
          API_BASE_URL = 'http://localhost:5000/api';
        }
      }
      const response = await fetch(`${API_BASE_URL}/auth/firebase-auth-user/${authUid}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Eğer member_user varsa, onu da sil
        if (memberUserId) {
          try {
            await FirebaseService.delete('member_users', memberUserId);
            console.log('✅ Member user deleted from Firestore:', memberUserId);
          } catch (memberUserError) {
            console.warn('⚠️ Member user deletion failed (non-critical):', memberUserError);
          }
        }

        alert('Firebase Auth kullanıcısı başarıyla silindi');
        fetchAuthUsers(); // Listeyi yenile
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Firebase Auth kullanıcısı silinemedi');
      }
    } catch (err) {
      console.error('Error deleting auth user:', err);
      setError('Kullanıcı silinirken hata oluştu: ' + err.message);
      alert('Hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupOrphanedAuthUsers = async () => {
    if (!window.confirm('Firestore\'da olmayan ama Firebase Auth\'da olan kullanıcıları temizlemek istediğinize emin misiniz?\n\nBu işlem:\n- @ilsekreterlik.local email\'li kullanıcıları kontrol eder\n- Firestore/SQLite\'da authUid olmayan kullanıcıları siler\n- Admin kullanıcısını korur\n\nDevam etmek istiyor musunuz?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Backend cleanup endpoint'ini çağır
      let API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      if (!API_BASE_URL) {
        if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
          API_BASE_URL = 'https://yrpilsekreterligi.onrender.com/api';
        } else {
          API_BASE_URL = 'http://localhost:5000/api';
        }
      }
      const response = await fetch(`${API_BASE_URL}/auth/cleanup-orphaned-auth-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Temizleme tamamlandı!\n\nSilinen: ${result.deleted} kullanıcı\nHata: ${result.errors || 0} kullanıcı`);
        fetchAuthUsers(); // Listeyi yenile
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Temizleme işlemi başarısız oldu');
      }
    } catch (err) {
      console.error('Error cleaning up orphaned auth users:', err);
      setError('Temizleme işlemi sırasında hata oluştu: ' + err.message);
      alert('Hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMemberInfo = (memberId) => {
    // Member bilgisini bulmak için member_users'dan memberId'ye bakabiliriz
    // Ama member zaten silinmiş olabilir, bu yüzden sadece memberId gösteriyoruz
    return memberId || 'Bilinmeyen';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Firebase Auth Kullanıcıları</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Firestore'daki authUid'lere göre Firebase Auth'daki kullanıcılar (Admin hariç)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCleanupOrphanedAuthUsers}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                Temizle (Orphaned)
              </button>
              <button
                onClick={fetchAuthUsers}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Yenile
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Firebase Auth Kullanıcıları ({authUsers.length})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Not: Client-side'dan Firebase Auth'daki kullanıcıları direkt listeleyemeyiz. 
              Bu liste Firestore'daki authUid'lere göre oluşturulmuştur.
              Firebase Console'dan tüm kullanıcıları görebilirsiniz.
            </p>
          </div>

          {authUsers.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Firebase Auth'da kullanıcı bulunamadı (admin hariç).
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Tüm üyeler silinmiş olabilir veya Firebase Auth'da kullanıcı oluşturulmamış olabilir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Auth UID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Member ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      User Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {authUsers.map((user, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                        {user.authUid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {user.username || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {user.memberId || user.observerId || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {user.userType || 'member'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {user.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteAuthUser(user.authUid, user.memberUserId, user.username)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Firebase Auth kullanıcısını sil"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            ⚠️ Önemli Not:
          </h3>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
            <li>Bu liste Firestore'daki authUid'lere göre oluşturulmuştur.</li>
            <li>Firebase Auth'daki gerçek kullanıcı sayısını görmek için Firebase Console'a bakmanız gerekir.</li>
            <li>Firestore'da authUid olmayan ama Firebase Auth'da olan kullanıcılar bu listede görünmez.</li>
            <li>Firebase Auth'dan kullanıcı silmek için backend/Cloud Functions gerekir.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FirebaseAuthUsersPage;

