import React, { useState, useEffect } from 'react';
import FirebaseService from '../services/FirebaseService';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';
import { updateFavicon } from '../utils/themeUtils';
import { getMemberId } from '../utils/normalizeId';
import FirebaseStorageService from '../utils/FirebaseStorageService';

const AppBrandingSettings = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
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
    faviconUrl: '',
    headerInfoText: '',
    footerText: ''
  });
  const [useStorageUpload, setUseStorageUpload] = useState(true);
  const [uploading, setUploading] = useState({});
  const [preview, setPreview] = useState({
    logo: null,
    icon192: null,
    icon512: null,
    badge: null,
    notificationIcon: null,
    favicon: null
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
            notificationIcon: cached.notificationIconUrl || null,
            favicon: cached.faviconUrl || null
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
              faviconUrl: data.faviconUrl || '',
              headerInfoText: data.headerInfoText || '',
              footerText: data.footerText || ''
            };
            setSettings(loadedSettings);
            // Preview'ları da ayarla
            setPreview({
              logo: loadedSettings.logoUrl || null,
              icon192: loadedSettings.icon192Url || null,
              icon512: loadedSettings.icon512Url || null,
              badge: loadedSettings.badgeUrl || null,
              notificationIcon: loadedSettings.notificationIconUrl || null,
              favicon: loadedSettings.faviconUrl || null
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

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  const handleFileChange = async (field, file) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Dosya boyutu 2MB\'dan kucuk olmalidir');
      return;
    }

    const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

    if (useStorageUpload && USE_FIREBASE) {
      // Firebase Storage'a yukle
      try {
        setUploading(prev => ({ ...prev, [field]: true }));
        const storagePath = `branding/${field.replace('Url', '')}_${Date.now()}.${file.name.split('.').pop() || 'png'}`;
        const downloadURL = await FirebaseStorageService.uploadFile(file, storagePath, {
          contentType: file.type,
          customMetadata: { field, uploadedAt: new Date().toISOString() }
        });
        setSettings(prev => ({ ...prev, [field]: downloadURL }));
        setPreview(prev => ({ ...prev, [field.replace('Url', '')]: downloadURL }));
        toast.success(`${field.replace('Url', '')} Firebase Storage'a yuklendi`);
      } catch (error) {
        console.error('Storage upload error:', error);
        toast.error('Storage yuklemesi basarisiz, base64 olarak kaydediliyor...');
        // Fallback to base64
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target.result;
          setSettings(prev => ({ ...prev, [field]: imageUrl }));
          setPreview(prev => ({ ...prev, [field.replace('Url', '')]: imageUrl }));
        };
        reader.readAsDataURL(file);
      } finally {
        setUploading(prev => ({ ...prev, [field]: false }));
      }
    } else {
      // Base64 olarak kaydet (eski davranis)
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target.result;
        setSettings(prev => ({ ...prev, [field]: imageUrl }));
        setPreview(prev => ({ ...prev, [field.replace('Url', '')]: imageUrl }));
      };
      reader.readAsDataURL(file);
    }
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
          } else {
            await FirebaseService.create('app_settings', null, settingsData, false);
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
      
      // Favicon guncelle (ozel favicon > icon192 > logo sirasi ile)
      const faviconSource = settings.faviconUrl || settings.icon192Url || settings.logoUrl;
      if (faviconSource) {
        updateFavicon(faviconSource);
      }

      // Branding updated event'i gönder (diğer component'lerin güncellenmesi için)
      window.dispatchEvent(new Event('brandingUpdated'));

      toast.success('Ayarlar kaydedildi! Uygulama güncellemesi için "Uygulama Güncelle" butonuna tıklayın.');
    } catch (error) {
      console.error('Error saving branding settings:', error);
      toast.error('Ayarlar kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateManifest = async () => {
    try {
      // Tema rengini al
      const { getThemeSettings } = await import('../utils/themeUtils');
      const themeData = getThemeSettings();
      const themeColor = themeData?.primaryColor || '#3b82f6';

      const manifest = {
        name: settings.appName || 'Sekreterlik Yönetim Sistemi',
        short_name: settings.appName?.substring(0, 12) || 'Sekreterlik',
        description: settings.appDescription || 'Parti sekreterlik yönetim sistemi',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: themeColor,
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
      
      // Manifest'i localStorage'a kaydet (runtime'da kullanmak icin)
      localStorage.setItem('appManifest', JSON.stringify(manifest));

      // Manifest link'ini DOM'da guncelle (blob URL ile)
      try {
        const { updateManifest: updateManifestDOM } = await import('../utils/brandingLoader');
        updateManifestDOM(manifest);
      } catch (e) {
        console.warn('Error updating manifest DOM link:', e);
      }

      // Document title'i guncelle
      if (settings.appName) {
        document.title = settings.appName;
      }

      // Meta description'i guncelle
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.content = settings.appDescription || 'Parti sekreterlik yonetim sistemi';

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
      }
    } catch (error) {
      console.error('Error triggering service worker update:', error);
    }
  };

  const handleUpdateApp = async () => {
    try {
      // Önce manifest'i güncelle
      await updateManifest();
      
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
                const memberId = getMemberId(member);
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
        
        toast.success('Uygulama güncellemesi başlatıldı! Tüm kullanıcılara bildirim gönderildi. Sayfa yenilenecek...');
        window.location.reload();
      } else {
        toast.warning('Service Worker desteklenmiyor. Sayfa yenilenecek...');
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating app:', error);
      toast.error('Uygulama güncellenirken hata oluştu. Sayfa yenilenecek...');
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
        <label htmlFor="setting-app-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Uygulama Adı
        </label>
        <input
          id="setting-app-name"
          type="text"
          value={settings.appName}
          onChange={(e) => setSettings(prev => ({ ...prev, appName: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          placeholder="Örn: YRP İlçe Sekreterliği"
        />
      </div>

      {/* Uygulama Açıklaması */}
      <div className="space-y-2">
        <label htmlFor="setting-app-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Uygulama Açıklaması
        </label>
        <textarea
          id="setting-app-description"
          value={settings.appDescription}
          onChange={(e) => setSettings(prev => ({ ...prev, appDescription: e.target.value }))}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          placeholder="Uygulamanın kısa açıklaması"
        />
      </div>

      {/* Header Bilgilendirme Metni */}
      <div className="space-y-2">
        <label htmlFor="setting-header-info-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Web Sayfasi Ustundeki Bilgilendirme Metni
        </label>
        <textarea
          id="setting-header-info-text"
          value={settings.headerInfoText}
          onChange={(e) => setSettings(prev => ({ ...prev, headerInfoText: e.target.value }))}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          placeholder="Orn: Resmi web sitesi bilgilendirme metni"
        />
      </div>

      {/* Footer Metni */}
      <div className="space-y-2">
        <label htmlFor="setting-footer-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Footer Metni
        </label>
        <input
          id="setting-footer-text"
          type="text"
          value={settings.footerText}
          onChange={(e) => setSettings(prev => ({ ...prev, footerText: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          placeholder={`© ${new Date().getFullYear()} Firma Adi`}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Bos birakilirsa varsayilan "DAT Dijital" metni gosterilir.
        </p>
      </div>

      {/* Firebase Storage Upload Toggle */}
      <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <input
          id="use-storage-upload"
          type="checkbox"
          checked={useStorageUpload}
          onChange={(e) => setUseStorageUpload(e.target.checked)}
          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
        />
        <label htmlFor="use-storage-upload" className="text-sm text-gray-700 dark:text-gray-300">
          Gorselleri Firebase Storage'a yukle (onerilen)
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Kapali olursa base64 olarak Firestore'a kaydedilir
        </span>
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <label htmlFor="setting-logo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Logo (Ana Logo)
        </label>
        <div className="flex items-center space-x-4">
          <input
            id="setting-logo"
            type="file"
            accept="image/*"
            disabled={uploading.logoUrl}
            onChange={(e) => handleFileChange('logoUrl', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {uploading.logoUrl && <span className="text-xs text-indigo-600 animate-pulse">Yukleniyor...</span>}
          {preview.logo && (
            <img src={preview.logo} alt="Logo Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
          )}
        </div>
      </div>

      {/* Icon 192x192 */}
      <div className="space-y-2">
        <label htmlFor="setting-icon192" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Icon (192x192) - PWA ve bildirimler için
        </label>
        <div className="flex items-center space-x-4">
          <input
            id="setting-icon192"
            type="file"
            accept="image/*"
            disabled={uploading.icon192Url}
            onChange={(e) => handleFileChange('icon192Url', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {uploading.icon192Url && <span className="text-xs text-indigo-600 animate-pulse">Yukleniyor...</span>}
          {preview.icon192 && (
            <img src={preview.icon192} alt="Icon 192 Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
          )}
        </div>
      </div>

      {/* Icon 512x512 */}
      <div className="space-y-2">
        <label htmlFor="setting-icon512" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Icon (512x512) - PWA için
        </label>
        <div className="flex items-center space-x-4">
          <input
            id="setting-icon512"
            type="file"
            accept="image/*"
            disabled={uploading.icon512Url}
            onChange={(e) => handleFileChange('icon512Url', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {uploading.icon512Url && <span className="text-xs text-indigo-600 animate-pulse">Yukleniyor...</span>}
          {preview.icon512 && (
            <img src={preview.icon512} alt="Icon 512 Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
          )}
        </div>
      </div>

      {/* Badge Icon */}
      <div className="space-y-2">
        <label htmlFor="setting-badge-icon" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Badge Icon (72x72) - Bildirim rozeti için
        </label>
        <div className="flex items-center space-x-4">
          <input
            id="setting-badge-icon"
            type="file"
            accept="image/*"
            disabled={uploading.badgeUrl}
            onChange={(e) => handleFileChange('badgeUrl', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {uploading.badgeUrl && <span className="text-xs text-indigo-600 animate-pulse">Yukleniyor...</span>}
          {preview.badge && (
            <img src={preview.badge} alt="Badge Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
          )}
        </div>
      </div>

      {/* Notification Icon */}
      <div className="space-y-2">
        <label htmlFor="setting-notification-icon" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Bildirim Icon - Push bildirimler için
        </label>
        <div className="flex items-center space-x-4">
          <input
            id="setting-notification-icon"
            type="file"
            accept="image/*"
            disabled={uploading.notificationIconUrl}
            onChange={(e) => handleFileChange('notificationIconUrl', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {uploading.notificationIconUrl && <span className="text-xs text-indigo-600 animate-pulse">Yukleniyor...</span>}
          {preview.notificationIcon && (
            <img src={preview.notificationIcon} alt="Notification Icon Preview" className="w-16 h-16 object-contain rounded" loading="lazy" decoding="async" />
          )}
        </div>
      </div>

      {/* Favicon */}
      <div className="space-y-2">
        <label htmlFor="setting-favicon" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Favicon - Tarayici sekmesindeki kucuk ikon
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Bos birakilirsa Icon 192x192 veya Logo otomatik olarak favicon olarak kullanilir.
        </p>
        <div className="flex items-center space-x-4">
          <input
            id="setting-favicon"
            type="file"
            accept="image/*"
            disabled={uploading.faviconUrl}
            onChange={(e) => handleFileChange('faviconUrl', e.target.files[0])}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
          />
          {uploading.faviconUrl && <span className="text-xs text-indigo-600 animate-pulse">Yukleniyor...</span>}
          {preview.favicon && (
            <img src={preview.favicon} alt="Favicon Preview" className="w-8 h-8 object-contain rounded" loading="lazy" decoding="async" />
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
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
      
      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Not:</strong> Ayarları kaydettikten sonra, mobil uygulamada değişikliklerin görünmesi için "Uygulama Güncelle" butonuna tıklayın. 
          Bu işlem tüm kullanıcılara güncelleme bildirimi gönderecektir.
        </p>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default AppBrandingSettings;

