/**
 * Tema CSS custom properties yardimci fonksiyonlari
 */

/**
 * Renk paletini CSS custom properties olarak uygula
 * @param {Object} colors - { 50: '#...', 100: '#...', ..., 950: '#...' }
 */
export function applyThemeColors(colors) {
  if (!colors) return;

  const root = document.documentElement;
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  for (const shade of shades) {
    const value = colors[shade];
    if (value) {
      root.style.setProperty(`--color-primary-${shade}`, value);
    }
  }

  // Ana renk olarak 600'u ayarla
  if (colors[600]) {
    root.style.setProperty('--color-primary', colors[600]);
  }

  // Manifest theme_color guncelle
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor && colors[600]) {
    metaThemeColor.content = colors[600];
  }
}

/**
 * Favicon'u dinamik olarak guncelle
 * @param {string} url - Yeni favicon URL'si
 */
export function updateFavicon(url) {
  if (!url) return;

  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;

  // Apple touch icon
  let appleLink = document.querySelector("link[rel='apple-touch-icon']");
  if (!appleLink) {
    appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    document.head.appendChild(appleLink);
  }
  appleLink.href = url;
}

/**
 * Tema ayarlarini Firestore'dan yukle ve uygula
 */
export async function loadAndApplyTheme() {
  try {
    // Oncelikle localStorage'dan yukle (hizli yikleme)
    const cached = localStorage.getItem('themeSettings');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.colors) {
        applyThemeColors(parsed.colors);
      }
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn('Error loading theme from cache:', error);
    return null;
  }
}

/**
 * Tema ayarlarini getir (localStorage'dan)
 */
export function getThemeSettings() {
  try {
    const cached = localStorage.getItem('themeSettings');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Sessizce devam
  }
  return null;
}
