import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const DataRetentionSettings = () => {
  const [retentionMonths, setRetentionMonths] = useState('never');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchRetentionSetting = async () => {
      try {
        if (db) {
          const docRef = doc(db, 'settings', 'data_retention');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().retention_months) {
            setRetentionMonths(docSnap.data().retention_months);
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
      if (db) {
        const docRef = doc(db, 'settings', 'data_retention');
        await setDoc(docRef, {
          retention_months: retentionMonths,
          updated_at: new Date().toISOString()
        }, { merge: true });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Veri saklama ayari kaydedilemedi:', error);
      alert('Ayar kaydedilirken hata olustu');
    } finally {
      setSaving(false);
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
          <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              Not: Bu ayar su an sadece politika kaydi olarak saklanmaktadir.
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
              Otomatik silme mekanizmasi Faz 6'da eklenecektir. Simdilik arsivlenen verilerin saklama suresi ayarini belirleyebilirsiniz.
            </p>
          </div>
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

      <div className="flex items-center space-x-3">
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
    </div>
  );
};

export default DataRetentionSettings;
