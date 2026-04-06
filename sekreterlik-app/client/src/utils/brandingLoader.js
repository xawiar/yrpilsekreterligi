/**
 * PWA manifest'ini dinamik olarak guncelle (blob URL ile)
 * @param {Object} manifestData - Manifest icerigi (name, short_name, icons, vb.)
 */
export function updateManifest(manifestData) {
  try {
    let manifestLink = document.querySelector('link[rel="manifest"]');

    const manifest = {
      name: manifestData.name || 'Sekreterlik Yonetim Sistemi',
      short_name: manifestData.short_name || 'Sekreterlik',
      description: manifestData.description || 'Parti sekreterlik yonetim sistemi',
      theme_color: manifestData.theme_color || '#3b82f6',
      background_color: manifestData.background_color || '#ffffff',
      display: manifestData.display || 'standalone',
      start_url: manifestData.start_url || '/',
      orientation: manifestData.orientation || 'portrait-primary',
      scope: '/',
      lang: 'tr',
      dir: 'ltr',
      categories: ['productivity', 'business'],
      icons: manifestData.icons || [
        { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);

    if (manifestLink) {
      // Eski blob URL'i temizle
      if (manifestLink.href && manifestLink.href.startsWith('blob:')) {
        URL.revokeObjectURL(manifestLink.href);
      }
      manifestLink.href = blobUrl;
    } else {
      // Manifest link yoksa olustur
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = blobUrl;
      document.head.appendChild(manifestLink);
    }
  } catch (error) {
    console.warn('Error updating manifest link:', error);
  }
}

/**
 * Branding ayarlarini yukleyip uygulamaya uygular
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
    
    // Firebase'den yukle (eger varsa)
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
            faviconUrl: brandingSettings.faviconUrl || '',
            headerInfoText: brandingSettings.headerInfoText || '',
            footerText: brandingSettings.footerText || ''
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
      
      // Tema rengini al
      let themeColor = '#3b82f6';
      try {
        const cachedTheme = localStorage.getItem('themeSettings');
        if (cachedTheme) {
          const parsed = JSON.parse(cachedTheme);
          themeColor = parsed?.primaryColor || parsed?.colors?.primary || '#3b82f6';
        }
      } catch (_) {}

      // Manifest'i guncelle (runtime'da)
      const manifest = {
        name: settings.appName || 'Sekreterlik Yonetim Sistemi',
        short_name: settings.appName?.substring(0, 12) || 'Sekreterlik',
        description: settings.appDescription || 'Parti sekreterlik yonetim sistemi',
        theme_color: themeColor,
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: settings.icon192Url || '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: settings.icon512Url || '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      };
      localStorage.setItem('appManifest', JSON.stringify(manifest));

      // PWA manifest link'ini DOM'da dinamik olarak guncelle
      updateManifest(manifest);

      // Favicon guncelle (ozel favicon > icon192 > logo sirasi ile)
      const faviconSource = settings.faviconUrl || settings.icon192Url || settings.logoUrl;
      if (faviconSource) {
        try {
          const { updateFavicon } = await import('./themeUtils');
          updateFavicon(faviconSource);
        } catch (_) {}
      }

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

/**
 * Tema verisinden renk paletini coz.
 * Oncelik: colors > palette > primaryColor'dan uret
 */
function resolveColors(data) {
  if (data.colors && typeof data.colors === 'object' && data.colors[500]) {
    return data.colors;
  }
  if (data.palette && typeof data.palette === 'object' && data.palette[500]) {
    return data.palette;
  }
  // primaryColor varsa HSL tabanli palet uret
  if (data.primaryColor) {
    try {
      // Async import yapmamak icin basit inline hesaplama
      const hex = data.primaryColor;
      let r = parseInt(hex.slice(1, 3), 16) / 255;
      let g = parseInt(hex.slice(3, 5), 16) / 255;
      let b = parseInt(hex.slice(5, 7), 16) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (mx + mn) / 2;
      if (mx !== mn) {
        const d = mx - mn;
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        switch (mx) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      const hDeg = Math.round(h * 360), sPct = Math.round(s * 100);
      const toHex = (hh, ss, ll) => {
        ss /= 100; ll /= 100;
        const a2 = ss * Math.min(ll, 1 - ll);
        const f2 = (n) => {
          const k = (n + hh / 30) % 12;
          const c = ll - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
          return Math.round(255 * c).toString(16).padStart(2, '0');
        };
        return `#${f2(0)}${f2(8)}${f2(4)}`;
      };
      return {
        50:  toHex(hDeg, Math.min(sPct + 10, 100), 97),
        100: toHex(hDeg, Math.min(sPct + 5, 100), 93),
        200: toHex(hDeg, sPct, 85),
        300: toHex(hDeg, sPct, 73),
        400: toHex(hDeg, sPct, 60),
        500: toHex(hDeg, sPct, 48),
        600: toHex(hDeg, sPct, 40),
        700: toHex(hDeg, sPct, 33),
        800: toHex(hDeg, sPct, 25),
        900: toHex(hDeg, sPct, 18),
        950: toHex(hDeg, sPct, 10),
      };
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Tema ayarlarini yukle ve CSS custom properties olarak uygula
 */
export const loadThemeSettings = async () => {
  try {
    const { applyThemeColors, updateFavicon } = await import('./themeUtils');

    // Oncelikle localStorage'dan hizli yukle
    const cached = localStorage.getItem('themeSettings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const colors = resolveColors(parsed);
        if (colors) {
          applyThemeColors(colors);
        }
        // Favicon guncelle
        if (parsed.faviconUrl) {
          updateFavicon(parsed.faviconUrl);
        }
        return parsed;
      } catch (e) {
        console.warn('Error parsing cached theme:', e);
      }
    }

    // Firebase'den yukle
    const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
    if (USE_FIREBASE) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const themeDoc = await getDoc(doc(db, 'settings', 'theme'));

        if (themeDoc.exists()) {
          const data = themeDoc.data();
          const colors = resolveColors(data);
          if (colors) {
            applyThemeColors(colors);
          }
          // Favicon guncelle
          if (data.faviconUrl) {
            updateFavicon(data.faviconUrl);
          }
          localStorage.setItem('themeSettings', JSON.stringify(data));
          return data;
        }
      } catch (error) {
        console.warn('Error loading theme from Firebase:', error);
      }
    }

    return null;
  } catch (error) {
    console.warn('Error loading theme settings:', error);
    return null;
  }
};

/**
 * Tema ayarlarini al (localStorage'dan)
 */
export const getThemeSettingsCached = () => {
  try {
    const cached = localStorage.getItem('themeSettings');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Sessizce devam
  }
  return null;
};

