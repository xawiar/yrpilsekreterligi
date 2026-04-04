import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' || import.meta.env.VITE_USE_FIREBASE === true || String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

const DataRetentionSettings = () => {
  const [retentionMonths, setRetentionMonths] = useState('never');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  useEffect(() => {
    const fetchRetentionSetting = async () => {
      try {
        if (USE_FIREBASE && db) {
          const docRef = doc(db, 'settings', 'data_retention');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().retention_months) {
            setRetentionMonths(docSnap.data().retention_months);
          }
        } else if (!USE_FIREBASE) {
          try {
            const res = await fetch(`${API_BASE_URL}/settings/data-retention`, { headers: getAuthHeaders() });
            if (res.ok) {
              const data = await res.json();
              if (data && data.retention_months) {
                setRetentionMonths(data.retention_months);
              }
            }
          } catch (err) {
            console.warn('Backend veri saklama ayari yuklenemedi:', err);
          }
        }
      } catch (error) {
        console.warn('Veri saklama ayari yuklenemedi:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRetentionSetting();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      if (USE_FIREBASE && db) {
        const docRef = doc(db, 'settings', 'data_retention');
        await setDoc(docRef, {
          retention_months: retentionMonths,
          updated_at: new Date().toISOString()
        }, { merge: true });
      } else {
        const res = await fetch(`${API_BASE_URL}/settings/data-retention`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ retention_months: retentionMonths })
        });
        if (!res.ok) throw new Error('Ayar kaydedilemedi');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Veri saklama ayari kaydedilemedi:', error);
      alert('Ayar kaydedilirken hata olustu');
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeExpired = async () => {
    if (!window.confirm('Suresi dolmus arsivlenmis kayitlari kalici olarak silmek istediginize emin misiniz? Bu islem geri alinamaz.')) {
      return;
    }

    if (retentionMonths === 'never') {
      alert('Veri saklama suresi "Asla" olarak ayarli. Otomatik silme yapilmaz.');
      return;
    }

    setPurging(true);
    setPurgeResult(null);
    try {
      const months = parseInt(retentionMonths);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      let deletedCount = 0;

      if (USE_FIREBASE && db) {
        // Firebase modunda arsivlenmis ve suresi dolmus kayitlari sil
        const membersRef = collection(db, 'members');
        const membersSnap = await getDocs(membersRef);
        for (const memberDoc of membersSnap.docs) {
          const data = memberDoc.data();
          if (data.archived && data.archived_at) {
            const archivedDate = new Date(data.archived_at);
            if (archivedDate < cutoffDate) {
              await deleteDoc(memberDoc.ref);
              deletedCount++;
            }
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/settings/purge-expired-data`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ retention_months: months })
        });
        if (!res.ok) throw new Error('Temizleme basarisiz');
        const resData = await res.json();
        deletedCount = resData?.deleted_count || 0;
      }

      setPurgeResult({ success: true, count: deletedCount });
      setTimeout(() => setPurgeResult(null), 5000);
    } catch (error) {
      console.error('Suresi dolmus veriler temizlenirken hata:', error);
      setPurgeResult({ success: false, message: error.message || 'Temizleme sirasinda hata olustu' });
      setTimeout(() => setPurgeResult(null), 5000);
    } finally {
      setPurging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <svg className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Veri Saklama Suresi (KVKK)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Arsivlenen verilerin otomatik silinme suresini belirleyin. Bu ayar KVKK kapsaminda veri saklama suresi politikanizi tanimlar.
        </p>
      </div>

      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            KVKK kapsamında arşivlenen verilerin saklama süresini belirleyin. Süre dolduğunda veriler otomatik olarak kalıcı silinecektir.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Arsivlenen veriler ne kadar sure sonra otomatik silinsin?
        </label>
        <select
          value={retentionMonths}
          onChange={(e) => setRetentionMonths(e.target.value)}
          className="w-full max-w-xs px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="6">6 ay sonra</option>
          <option value="12">12 ay sonra</option>
          <option value="24">24 ay sonra</option>
          <option value="never">Asla (manuel silme)</option>
        </select>
      </div>

      <div className="flex items-center space-x-3 flex-wrap gap-y-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Kaydedildi
          </span>
        )}
      </div>

      {/* Suresi dolmus verileri temizle */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-3 mb-3">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Suresi Dolmus Verileri Temizle
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Arsivlenmis ve yukarida belirlenen saklama suresi dolmus kayitlari kalici olarak siler. Bu islem geri alinamaz.
            </p>
          </div>
        </div>
        <button
          onClick={handlePurgeExpired}
          disabled={purging || retentionMonths === 'never'}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {purging ? 'Temizleniyor...' : 'Suresi Dolmus Verileri Simdi Temizle'}
        </button>
        {purgeResult && (
          <div className={`mt-2 text-sm ${purgeResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {purgeResult.success
              ? `${purgeResult.count} kayit basariyla temizlendi.`
              : purgeResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataRetentionSettings;
