/**
 * Tema CSS custom properties yardimci fonksiyonlari
 */

// ---- Hex <-> HSL donusumleri ----
export function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * HSL tabanli renk paleti uretici.
 * Verilen hex rengi ana renk olarak kabul eder ve
 * diger shade'leri HSL lightness degerleriyle hesaplar.
 */
export function generatePalette(hexColor) {
  const hsl = hexToHSL(hexColor);
  return {
    50:  hslToHex(hsl.h, Math.min(hsl.s + 10, 100), 97),
    100: hslToHex(hsl.h, Math.min(hsl.s + 5, 100), 93),
    200: hslToHex(hsl.h, hsl.s, 85),
    300: hslToHex(hsl.h, hsl.s, 73),
    400: hslToHex(hsl.h, hsl.s, 60),
    500: hslToHex(hsl.h, hsl.s, 48),
    600: hslToHex(hsl.h, hsl.s, 40),
    700: hslToHex(hsl.h, hsl.s, 33),
    800: hslToHex(hsl.h, hsl.s, 25),
    900: hslToHex(hsl.h, hsl.s, 18),
    950: hslToHex(hsl.h, hsl.s, 10),
  };
}

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
