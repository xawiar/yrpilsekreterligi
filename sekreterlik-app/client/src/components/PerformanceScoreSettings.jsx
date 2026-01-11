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
    perfectEventBonus: 50,
    maxMonthlyRegistrations: null,
    useAttendanceWeightForRegistrations: false,
    minAttendanceRateForFullRegistrationPoints: 0
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
              perfectEventBonus: configDoc.perfectEventBonus || 50,
              maxMonthlyRegistrations: configDoc.maxMonthlyRegistrations || null,
              useAttendanceWeightForRegistrations: configDoc.useAttendanceWeightForRegistrations || false,
              minAttendanceRateForFullRegistrationPoints: configDoc.minAttendanceRateForFullRegistrationPoints || 0
            });
          }
        } catch (error) {
          // Offline hatası için özel mesaj
          if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.warn('Client is offline, using default performance score settings');
          } else {
            console.warn('Performance score config not found, using defaults:', error);
          }
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
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'maxMonthlyRegistrations' && value === '') ? null : parseInt(value) || 0
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
          Bu değerler hem maksimum puan hesaplamasında hem de üyelerin gerçek puan hesaplamasında kullanılacaktır.
          Örneğin, "Toplantı Katılım Puanı" için 10 yazarsanız, her toplantıya katılan üye 10 puan alacaktır.
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
              Aylık Maksimum Üye Kayıt Limiti
            </label>
            <input
              type="number"
              name="maxMonthlyRegistrations"
              value={settings.maxMonthlyRegistrations || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Boş bırakılırsa limit yok"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Bir ay içinde maksimum kaç üye kaydı için puan verileceği (ör: 15). Boş bırakılırsa sınırsız.
            </p>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <input
                type="checkbox"
                id="useAttendanceWeightForRegistrations"
                name="useAttendanceWeightForRegistrations"
                checked={settings.useAttendanceWeightForRegistrations}
                onChange={handleInputChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="useAttendanceWeightForRegistrations" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Toplantı Katılımına Göre Üye Kayıt Puanını Ağırlıklandır
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-7">
              Aktif edilirse, toplantı katılım oranı düşük olan üyelerin üye kayıt puanı azalır
            </p>
          </div>

          {settings.useAttendanceWeightForRegistrations && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tam Puan İçin Minimum Katılım Oranı (%)
              </label>
              <input
                type="number"
                name="minAttendanceRateForFullRegistrationPoints"
                value={settings.minAttendanceRateForFullRegistrationPoints}
                onChange={handleInputChange}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Bu oranın altında katılım gösteren üyelerin üye kayıt puanı katılım oranına göre azalır (ör: %50)
              </p>
            </div>
          )}
          
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

