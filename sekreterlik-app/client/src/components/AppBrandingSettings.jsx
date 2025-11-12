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
      // Önce localStorage'dan yükle (hızlı erişim için)
      const cachedSettings = localStorage.getItem('appBranding');
      if (cachedSettings) {
        try {
          const cached = JSON.parse(cachedSettings);
          setSettings(cached);
          // Preview'ları da ayarla
          setPreview({
            logo: cached.logoUrl || null,
            icon192: cached.icon192Url || null,
            icon512: cached.icon512Url || null,
            badge: cached.badgeUrl || null,
            notificationIcon: cached.notificationIconUrl || null
          });
        } catch (e) {
          console.warn('Error parsing cached settings:', e);
        }
      }
      
      // Firebase veya SQLite'dan ayarları yükle
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        try {
          const allSettings = await FirebaseService.getAll('app_settings', {}, false);
          const brandingSettings = allSettings.filter(s => s.type === 'branding');
          
          if (brandingSettings && brandingSettings.length > 0) {
            const data = brandingSettings[0];
            const loadedSettings = {
              appName: data.appName || '',
              appDescription: data.appDescription || '',
              logoUrl: data.logoUrl || '',
              icon192Url: data.icon192Url || '',
              icon512Url: data.icon512Url || '',
              badgeUrl: data.badgeUrl || '',
              notificationIconUrl: data.notificationIconUrl || '',
              headerInfoText: data.headerInfoText || ''
            };
            setSettings(loadedSettings);
            // Preview'ları da ayarla
            setPreview({
              logo: loadedSettings.logoUrl || null,
              icon192: loadedSettings.icon192Url || null,
              icon512: loadedSettings.icon512Url || null,
              badge: loadedSettings.badgeUrl || null,
              notificationIcon: loadedSettings.notificationIconUrl || null
            });
            // localStorage'a da kaydet
            localStorage.setItem('appBranding', JSON.stringify(loadedSettings));
          }
        } catch (firebaseError) {
          console.error('Error loading from Firebase:', firebaseError);
        }
      } else {
        // SQLite için API çağrısı
        try {
          const response = await fetch('/api/settings/branding');
          if (response.ok) {
            const data = await response.json();
            setSettings(data);
            localStorage.setItem('appBranding', JSON.stringify(data));
          }
        } catch (apiError) {
          console.error('Error loading from API:', apiError);
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
      
      // localStorage'a önce kaydet (hızlı erişim için)
      localStorage.setItem('appBranding', JSON.stringify(settings));
      
      if (USE_FIREBASE) {
        // Firebase'e kaydet
        try {
          const allSettings = await FirebaseService.getAll('app_settings', {}, false);
          const existing = allSettings.find(s => s.type === 'branding');
          
          const settingsData = {
            type: 'branding',
            ...settings,
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          if (existing && existing.id) {
            await FirebaseService.update('app_settings', existing.id, settingsData, false);
            console.log('✅ Branding settings updated in Firebase');
          } else {
            await FirebaseService.create('app_settings', null, settingsData, false);
            console.log('✅ Branding settings created in Firebase');
          }
        } catch (firebaseError) {
          console.error('Error saving to Firebase:', firebaseError);
          throw firebaseError;
        }
      } else {
        // SQLite için API çağrısı
        try {
          const response = await fetch('/api/settings/branding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
          });
          if (!response.ok) {
            throw new Error('API request failed');
          }
        } catch (apiError) {
          console.error('Error saving to API:', apiError);
          throw apiError;
        }
      }
      
      // Manifest.json'u güncelle
      await updateManifest();
      
      // Service Worker'ı güncelle (PWA güncellemesi için)
      await triggerServiceWorkerUpdate();
      
      // Branding updated event'i gönder (diğer component'lerin güncellenmesi için)
      window.dispatchEvent(new Event('brandingUpdated'));
      
      alert('Ayarlar kaydedildi! Uygulama güncellemesi için "Uygulama Güncelle" butonuna tıklayın.');
    } catch (error) {
      console.error('Error saving branding settings:', error);
      alert('Ayarlar kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateManifest = async () => {
    try {
      const manifest = {
        name: settings.appName || 'Sekreterlik Yönetim Sistemi',
        short_name: settings.appName?.substring(0, 12) || 'Sekreterlik',
        description: settings.appDescription || 'Parti sekreterlik yönetim sistemi',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#3b82f6',
        orientation: 'portrait-primary',
        scope: '/',
        lang: 'tr',
        dir: 'ltr',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: settings.icon192Url || '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: settings.icon512Url || '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      };
      
      // Manifest'i localStorage'a kaydet (runtime'da kullanmak için)
      localStorage.setItem('appManifest', JSON.stringify(manifest));
      
      // Document title'ı güncelle
      if (settings.appName) {
        document.title = settings.appName;
      }
      
      // Meta description'ı güncelle
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.content = settings.appDescription || 'Parti sekreterlik yönetim sistemi';
      
      console.log('✅ Manifest updated');
    } catch (error) {
      console.error('Error updating manifest:', error);
    }
  };

  const triggerServiceWorkerUpdate = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        // Service Worker'ı güncellemek için unregister edip yeniden register et
        await registration.update();
        console.log('✅ Service Worker update triggered');
      }
    } catch (error) {
      console.error('Error triggering service worker update:', error);
    }
  };

  const handleUpdateApp = async () => {
    try {
      // Tüm kullanıcılara in-app notification oluştur (güncelleme bildirimi)
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        try {
          const { default: FirebaseService } = await import('../services/FirebaseService');
          
          // Tüm aktif üyeleri al
          const allMembers = await FirebaseService.getAll('members', {
            where: [{ field: 'archived', operator: '==', value: false }]
          }, false);
          
          if (allMembers && allMembers.length > 0) {
            const notificationData = {
              title: 'Uygulama Güncellemesi',
              body: 'Yeni bir güncelleme mevcut! Uygulamayı yenileyin.',
              type: 'update',
              data: JSON.stringify({
                action: 'reload',
                url: window.location.href
              }),
              read: false,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 gün sonra expire
            };
            
            // Her üye için notification oluştur
            let successCount = 0;
            for (const member of allMembers) {
              try {
                const memberId = member.id || member.memberId || member.member_id;
                if (!memberId) continue;
                
                await FirebaseService.create(
                  'notifications',
                  null,
                  {
                    ...notificationData,
                    memberId: String(memberId)
                  },
                  false
                );
                successCount++;
              } catch (memberError) {
                console.error(`Error creating update notification for member ${member.id}:`, memberError);
              }
            }
            
            console.log(`✅ Update notification created for ${successCount}/${allMembers.length} members`);
          }
        } catch (notificationError) {
          console.warn('Error creating update notifications:', notificationError);
          // Notification hatası güncellemeyi engellemez
        }
      }
      
      // Service Worker güncellemesi
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Tüm service worker'ları unregister et
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        
        // Cache'i temizle
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // Yeni service worker'ı register et
        await navigator.serviceWorker.register('/sw.js');
        
        // Branding updated event'i gönder
        window.dispatchEvent(new Event('brandingUpdated'));
        
        alert('Uygulama güncellemesi başlatıldı! Tüm kullanıcılara bildirim gönderildi. Sayfa yenilenecek...');
        window.location.reload();
      } else {
        alert('Service Worker desteklenmiyor. Sayfa yenilenecek...');
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating app:', error);
      alert('Uygulama güncellenirken hata oluştu. Sayfa yenilenecek...');
      window.location.reload();
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
            <img src={preview.logo} alt="Logo Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
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
            <img src={preview.icon192} alt="Icon 192 Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
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
            <img src={preview.icon512} alt="Icon 512 Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
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
            <img src={preview.badge} alt="Badge Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
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
            <img src={preview.notificationIcon} alt="Notification Icon Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
          )}
        </div>
      </div>

      {/* Save and Update Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleUpdateApp}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
        >
          <span className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Uygulama Güncelle
          </span>
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
      
      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Not:</strong> Ayarları kaydettikten sonra, mobil uygulamada değişikliklerin görünmesi için "Uygulama Güncelle" butonuna tıklayın. 
          Bu işlem tüm kullanıcılara güncelleme bildirimi gönderecektir.
        </p>
      </div>
    </div>
  );
};

export default AppBrandingSettings;

