/**
 * Branding ayarlarını yükleyip uygulamaya uygular
 */
export const loadBrandingSettings = async () => {
  try {
    const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
    let settings = null;
    
    // Önce localStorage'dan yükle
    const cached = localStorage.getItem('appBranding');
    if (cached) {
      try {
        settings = JSON.parse(cached);
      } catch (e) {
        console.warn('Error parsing cached branding:', e);
      }
    }
    
    // Firebase'den yükle (eğer varsa)
    if (USE_FIREBASE) {
      try {
        const { default: FirebaseService } = await import('../services/FirebaseService');
        const allSettings = await FirebaseService.getAll('app_settings', {}, false);
        const brandingSettings = allSettings.find(s => s.type === 'branding');
        
        if (brandingSettings) {
          settings = {
            appName: brandingSettings.appName || '',
            appDescription: brandingSettings.appDescription || '',
            logoUrl: brandingSettings.logoUrl || '',
            icon192Url: brandingSettings.icon192Url || '',
            icon512Url: brandingSettings.icon512Url || '',
            badgeUrl: brandingSettings.badgeUrl || '',
            notificationIconUrl: brandingSettings.notificationIconUrl || '',
            headerInfoText: brandingSettings.headerInfoText || ''
          };
          // localStorage'a kaydet
          localStorage.setItem('appBranding', JSON.stringify(settings));
        }
      } catch (error) {
        console.warn('Error loading branding from Firebase:', error);
      }
    }
    
    // Ayarları uygula
    if (settings) {
      // Document title
      if (settings.appName) {
        document.title = settings.appName;
      }
      
      // Meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.content = settings.appDescription || 'Parti sekreterlik yönetim sistemi';
      
      // Apple meta tags
      let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (!appleTitle) {
        appleTitle = document.createElement('meta');
        appleTitle.name = 'apple-mobile-web-app-title';
        document.head.appendChild(appleTitle);
      }
      appleTitle.content = settings.appName?.substring(0, 12) || 'Sekreterlik';
      
      // Manifest'i güncelle (runtime'da)
      const manifest = {
        name: settings.appName || 'Sekreterlik Yönetim Sistemi',
        short_name: settings.appName?.substring(0, 12) || 'Sekreterlik',
        description: settings.appDescription || 'Parti sekreterlik yönetim sistemi',
        icons: [
          {
            src: settings.icon192Url || '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: settings.icon512Url || '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      };
      localStorage.setItem('appManifest', JSON.stringify(manifest));
      
      return settings;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading branding settings:', error);
    return null;
  }
};

/**
 * Branding ayarlarını al (localStorage'dan)
 */
export const getBrandingSettings = () => {
  try {
    const cached = localStorage.getItem('appBranding');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Error getting branding settings:', e);
  }
  return null;
};

