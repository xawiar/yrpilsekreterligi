import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import FirebaseService from '../services/FirebaseService';

const AppBrandingSettings = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    appName: '',
    appDescription: '',
    logoUrl: '',
    icon192Url: '',
    icon512Url: '',
    badgeUrl: '',
    notificationIconUrl: '',
    headerInfoText: ''
  });
  const [preview, setPreview] = useState({
    logo: null,
    icon192: null,
    icon512: null,
    badge: null,
    notificationIcon: null
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Firebase veya SQLite'dan ayarları yükle
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        const brandingSettings = await FirebaseService.findByField(
          'app_settings',
          'type',
          'branding'
        );
        
        if (brandingSettings && brandingSettings.length > 0) {
          const data = brandingSettings[0];
          setSettings({
            appName: data.appName || '',
            appDescription: data.appDescription || '',
            logoUrl: data.logoUrl || '',
            icon192Url: data.icon192Url || '',
            icon512Url: data.icon512Url || '',
            badgeUrl: data.badgeUrl || '',
            notificationIconUrl: data.notificationIconUrl || '',
            headerInfoText: data.headerInfoText || ''
          });
        }
      } else {
        // SQLite için API çağrısı
        const response = await fetch('/api/settings/branding');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      }
    } catch (error) {
      console.error('Error loading branding settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (field, file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target.result;
      setSettings(prev => ({ ...prev, [field]: imageUrl }));
      setPreview(prev => ({ ...prev, [field.replace('Url', '')]: imageUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        // Firebase'e kaydet
        const existing = await FirebaseService.findByField(
          'app_settings',
          'type',
          'branding'
        );
        
        const settingsData = {
          type: 'branding',
          ...settings,
          updatedAt: new Date().toISOString()
        };
        
        if (existing && existing.length > 0) {
          await FirebaseService.update('app_settings', existing[0].id, settingsData, false);
        } else {
          await FirebaseService.create('app_settings', null, settingsData, false);
        }
      } else {
        // SQLite için API çağrısı
        await fetch('/api/settings/branding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
      }
      
      // localStorage'a da kaydet (hızlı erişim için)
      localStorage.setItem('appBranding', JSON.stringify(settings));
      
      // Sayfayı yenile (değişikliklerin görünmesi için)
      alert('Ayarlar kaydedildi! Sayfa yenilenecek...');
      window.location.reload();
    } catch (error) {
      console.error('Error saving branding settings:', error);
      alert('Ayarlar kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Uygulama Görünümü Ayarları
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Logo, icon, uygulama adı ve bilgilendirme metni gibi görsel ayarları buradan düzenleyebilirsiniz.
        </p>
      </div>

      {/* Uygulama Adı */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Uygulama Adı
        </label>
        <input
          type="text"
          value={settings.appName}
          onChange={(e) => setSettings(prev => ({ ...prev, appName: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          placeholder="Örn: YRP İlçe Sekreterliği"
        />
      </div>

      {/* Uygulama Açıklaması */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Uygulama Açıklaması
        </label>
        <textarea
          value={settings.appDescription}
          onChange={(e) => setSettings(prev => ({ ...prev, appDescription: e.target.value }))}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          placeholder="Uygulamanın kısa açıklaması"
        />
      </div>

      {/* Header Bilgilendirme Metni */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Web Sayfası Üstündeki Bilgilendirme Metni
        </label>
        <textarea
          value={settings.headerInfoText}
          onChange={(e) => setSettings(prev => ({ ...prev, headerInfoText: e.target.value }))}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          placeholder="Örn: Resmi web sitesi bilgilendirme metni"
        />
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Logo (Ana Logo)
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange('logoUrl', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {preview.logo && (
            <img src={preview.logo} alt="Logo Preview" className="w-16 h-16 object-contain rounded" />
          )}
        </div>
      </div>

      {/* Icon 192x192 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Icon (192x192) - PWA ve bildirimler için
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange('icon192Url', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {preview.icon192 && (
            <img src={preview.icon192} alt="Icon 192 Preview" className="w-16 h-16 object-contain rounded" />
          )}
        </div>
      </div>

      {/* Icon 512x512 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Icon (512x512) - PWA için
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange('icon512Url', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {preview.icon512 && (
            <img src={preview.icon512} alt="Icon 512 Preview" className="w-16 h-16 object-contain rounded" />
          )}
        </div>
      </div>

      {/* Badge Icon */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Badge Icon (72x72) - Bildirim rozeti için
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange('badgeUrl', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {preview.badge && (
            <img src={preview.badge} alt="Badge Preview" className="w-16 h-16 object-contain rounded" />
          )}
        </div>
      </div>

      {/* Notification Icon */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Bildirim Icon - Push bildirimler için
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange('notificationIconUrl', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {preview.notificationIcon && (
            <img src={preview.notificationIcon} alt="Notification Icon Preview" className="w-16 h-16 object-contain rounded" />
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
};

export default AppBrandingSettings;

