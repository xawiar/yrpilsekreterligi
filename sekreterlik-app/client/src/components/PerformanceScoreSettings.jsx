import React, { useState, useEffect } from 'react';
import FirebaseService from '../services/FirebaseService';
import { encryptData, decryptData } from '../utils/crypto';

const PerformanceScoreSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  
  const [settings, setSettings] = useState({
    meetingAttendancePoints: 10,
    eventAttendancePoints: 10,
    absencePenalty: -5,
    memberRegistrationPoints: 5,
    perfectMeetingBonus: 50,
    perfectEventBonus: 50
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        try {
          const configDoc = await FirebaseService.getById('performance_score_config', 'main');
          if (configDoc) {
            setSettings({
              meetingAttendancePoints: configDoc.meetingAttendancePoints || 10,
              eventAttendancePoints: configDoc.eventAttendancePoints || 10,
              absencePenalty: configDoc.absencePenalty || -5,
              memberRegistrationPoints: configDoc.memberRegistrationPoints || 5,
              perfectMeetingBonus: configDoc.perfectMeetingBonus || 50,
              perfectEventBonus: configDoc.perfectEventBonus || 50
            });
          }
        } catch (error) {
          console.warn('Performance score config not found, using defaults');
        }
      }
    } catch (error) {
      console.error('Error loading performance score settings:', error);
      setMessage('Ayarlar yüklenirken hata oluştu');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        await FirebaseService.create('performance_score_config', 'main', {
          ...settings,
          updated_at: new Date().toISOString()
        }, false);
        
        // Cache'i temizle ki yeni ayarlar kullanılsın
        const { clearPerformanceScoreSettingsCache } = await import('../utils/performanceScore');
        clearPerformanceScoreSettingsCache();
        
        setMessage('Yıldız hesaplama ayarları başarıyla kaydedildi. Üye puanları yeniden hesaplanacak.');
        setMessageType('success');
      } else {
        setMessage('Firebase kullanılmıyor. Ayarlar environment variable olarak ayarlanmalıdır.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving performance score settings:', error);
      setMessage('Ayarlar kaydedilirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Ayarlar yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Yıldız Hesaplama Ayarları
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Üye performans puanı hesaplamasında kullanılacak puan değerlerini buradan ayarlayabilirsiniz.
          Bu değerler maksimum puan hesaplamasında da kullanılacaktır.
        </p>
        
        {message && (
          <div className={`mb-4 p-3 rounded-lg shadow-sm ${
            messageType === 'success' 
              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700' 
              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
          }`}>
            {message}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Toplantı Katılım Puanı
            </label>
            <input
              type="number"
              name="meetingAttendancePoints"
              value={settings.meetingAttendancePoints}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="10"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Katıldığı her toplantı için verilecek puan
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Etkinlik Katılım Puanı
            </label>
            <input
              type="number"
              name="eventAttendancePoints"
              value={settings.eventAttendancePoints}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="10"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Katıldığı her etkinlik için verilecek puan
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mazeretsiz Yokluk Cezası
            </label>
            <input
              type="number"
              name="absencePenalty"
              value={settings.absencePenalty}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="-5"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Mazeretsiz katılmadığı her toplantı için düşülecek puan (negatif değer)
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Üye Kayıt Puanı
            </label>
            <input
              type="number"
              name="memberRegistrationPoints"
              value={settings.memberRegistrationPoints}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="5"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Kaydettiği her üye için verilecek puan
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mükemmel Toplantı Bonusu (Aylık)
            </label>
            <input
              type="number"
              name="perfectMeetingBonus"
              value={settings.perfectMeetingBonus}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="50"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              O ay tüm toplantılara katılmışsa verilecek bonus puan
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mükemmel Etkinlik Bonusu (Aylık)
            </label>
            <input
              type="number"
              name="perfectEventBonus"
              value={settings.perfectEventBonus}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="50"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              O ay tüm etkinliklere katılmışsa verilecek bonus puan
            </p>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {saving ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Kaydediliyor...
              </div>
            ) : (
              'Ayarları Kaydet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceScoreSettings;

