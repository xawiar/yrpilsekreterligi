import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { applyThemeColors } from '../utils/themeUtils';

// Hazir tema sablonlari
const THEME_TEMPLATES = {
  'yrp-yesil': {
    primary: '#16a34a',
    name: 'YRP Yesil',
    colors: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16' }
  },
  'akp-turuncu': {
    primary: '#ea580c',
    name: 'AKP Turuncu',
    colors: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407' }
  },
  'chp-kirmizi': {
    primary: '#dc2626',
    name: 'CHP Kirmizi',
    colors: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' }
  },
  'mhp-kirmizi': {
    primary: '#b91c1c',
    name: 'MHP Kirmizi',
    colors: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' }
  },
  'iyi-mavi': {
    primary: '#2563eb',
    name: 'IYI Mavi',
    colors: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' }
  },
  'deva-mor': {
    primary: '#7c3aed',
    name: 'DEVA Mor',
    colors: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' }
  },
  'gelecek-lacivert': {
    primary: '#1e3a5f',
    name: 'Gelecek Lacivert',
    colors: { 50: '#f0f5fa', 100: '#dae4f2', 200: '#b5c9e5', 300: '#8faed8', 400: '#6a93cb', 500: '#4578be', 600: '#2d5f9e', 700: '#1e3a5f', 800: '#162d4a', 900: '#0e1f35', 950: '#071120' }
  },
  'varsayilan': {
    primary: '#4f46e5',
    name: 'Varsayilan (Indigo)',
    colors: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4e' }
  }
};

const ThemeSettings = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('varsayilan');
  const [customColor, setCustomColor] = useState('#4f46e5');
  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#4f46e5',
    templateId: 'varsayilan',
    footerText: '',
    footerCompanyName: '',
    footerCompanyUrl: '',
    loginSlogan: '',
    loginTitle: ''
  });
  const [previewActive, setPreviewActive] = useState(false);
  const [originalTheme, setOriginalTheme] = useState(null);

  // Firestore'dan tema ayarlarini yukle
  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      setLoading(true);

      // Oncelikle localStorage'dan yukle
      const cached = localStorage.getItem('themeSettings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setThemeSettings(parsed);
          setSelectedTemplate(parsed.templateId || 'varsayilan');
          setCustomColor(parsed.primaryColor || '#4f46e5');
        } catch (e) {
          // Sessizce devam
        }
      }

      // Firebase'den yukle
      const themeDoc = await getDoc(doc(db, 'settings', 'theme'));
      if (themeDoc.exists()) {
        const data = themeDoc.data();
        const settings = {
          primaryColor: data.primaryColor || '#4f46e5',
          templateId: data.templateId || 'varsayilan',
          footerText: data.footerText || '',
          footerCompanyName: data.footerCompanyName || '',
          footerCompanyUrl: data.footerCompanyUrl || '',
          loginSlogan: data.loginSlogan || '',
          loginTitle: data.loginTitle || ''
        };
        setThemeSettings(settings);
        setSelectedTemplate(settings.templateId);
        setCustomColor(settings.primaryColor);
        localStorage.setItem('themeSettings', JSON.stringify(settings));
      }
    } catch (error) {
      console.error('Error loading theme settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tema sablonu secildiginde
  const handleTemplateSelect = (templateId) => {
    const template = THEME_TEMPLATES[templateId];
    if (!template) return;

    setSelectedTemplate(templateId);
    setCustomColor(template.primary);
    setThemeSettings(prev => ({
      ...prev,
      templateId,
      primaryColor: template.primary
    }));

    // Canli onizleme uygula
    if (previewActive) {
      applyThemeColors(template.colors);
    }
  };

  // Ozel renk secildiginde
  const handleCustomColorChange = (color) => {
    setCustomColor(color);
    setSelectedTemplate('custom');
    setThemeSettings(prev => ({
      ...prev,
      templateId: 'custom',
      primaryColor: color
    }));
  };

  // Canli onizleme ac/kapat
  const togglePreview = useCallback(() => {
    if (!previewActive) {
      // Mevcut temayi kaydet
      const root = document.documentElement;
      const current = {};
      for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
        current[shade] = getComputedStyle(root).getPropertyValue(`--color-primary-${shade}`).trim();
      }
      setOriginalTheme(current);

      // Secili tema onizlemesini uygula
      const template = THEME_TEMPLATES[selectedTemplate];
      if (template) {
        applyThemeColors(template.colors);
      } else {
        applyThemeColors(generatePalette(customColor));
      }
      setPreviewActive(true);
    } else {
      // Orijinal temayi geri yukle
      if (originalTheme) {
        applyThemeColors(originalTheme);
      }
      setPreviewActive(false);
    }
  }, [previewActive, selectedTemplate, customColor, originalTheme]);

  // Kaydet
  const handleSave = async () => {
    try {
      setSaving(true);

      // Renk paleti olustur
      const template = THEME_TEMPLATES[selectedTemplate];
      const colors = template ? template.colors : generatePalette(customColor);

      const saveData = {
        ...themeSettings,
        colors,
        updatedAt: new Date().toISOString()
      };

      // Firestore'a kaydet
      await setDoc(doc(db, 'settings', 'theme'), saveData, { merge: true });

      // localStorage'a kaydet
      localStorage.setItem('themeSettings', JSON.stringify(saveData));

      // CSS variable'lari uygula
      applyThemeColors(colors);
      setPreviewActive(false);

      // Diger componentlere bildir
      window.dispatchEvent(new Event('themeUpdated'));

      toast.success('Tema ayarlari kaydedildi!');
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Tema ayarlari kaydedilirken hata olustu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Varsayilana sifirla
  const handleReset = async () => {
    const defaultTemplate = 'varsayilan';
    const template = THEME_TEMPLATES[defaultTemplate];

    setSelectedTemplate(defaultTemplate);
    setCustomColor(template.primary);
    setThemeSettings({
      primaryColor: template.primary,
      templateId: defaultTemplate,
      footerText: '',
      footerCompanyName: '',
      footerCompanyUrl: '',
      loginSlogan: '',
      loginTitle: ''
    });

    applyThemeColors(template.colors);
    setPreviewActive(false);
    toast.info('Varsayilan tema yuklendi. Kaydetmeyi unutmayin.');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Baslik */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Tema Ozellestirme
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Uygulamanin renk temasini, login sayfasi ve footer bilgilerini buradan ozellestirin.
        </p>
      </div>

      {/* Hazir Tema Sablonlari */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
          Hazir Tema Sablonlari
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Object.entries(THEME_TEMPLATES).map(([id, template]) => (
            <button
              key={id}
              onClick={() => handleTemplateSelect(id)}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                selectedTemplate === id
                  ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div
                className="w-full h-8 rounded-lg mb-2"
                style={{ backgroundColor: template.primary }}
              />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {template.name}
              </p>
              {selectedTemplate === id && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Ozel Renk Secimi */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
          Ozel Renk Secimi
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="setting-theme-color" className="sr-only">Ozel renk sec</label>
            <input
              id="setting-theme-color"
              type="color"
              value={customColor}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
              title="Ozel renk sec"
            />
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">Secili renk:</p>
              <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {customColor}
              </code>
            </div>
          </div>
          <div
            className="flex-1 h-10 rounded-lg shadow-inner"
            style={{ backgroundColor: customColor }}
          />
        </div>
      </div>

      {/* Renk Paleti Onizleme */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
          Renk Paleti Onizleme
        </h3>
        <div className="flex gap-1 rounded-lg overflow-hidden">
          {(() => {
            const template = THEME_TEMPLATES[selectedTemplate];
            const colors = template ? template.colors : generatePalette(customColor);
            return [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
              <div
                key={shade}
                className="flex-1 h-12 relative group cursor-pointer"
                style={{ backgroundColor: colors[shade] || customColor }}
                title={`${shade}: ${colors[shade] || customColor}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity text-white mix-blend-difference">
                  {shade}
                </span>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Canli Onizleme Butonu */}
      <div className="flex gap-3">
        <button
          onClick={togglePreview}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            previewActive
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {previewActive ? 'Onizlemeyi Kapat' : 'Canli Onizleme'}
        </button>
        {previewActive && (
          <p className="flex items-center text-sm text-amber-600 dark:text-amber-400">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Onizleme modu aktif - Kaydetmeden degisiklikler kaybolur
          </p>
        )}
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Login Sayfasi Ozellestirme */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
          Login Sayfasi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="setting-login-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Login Basligi
            </label>
            <input
              id="setting-login-title"
              type="text"
              value={themeSettings.loginTitle}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, loginTitle: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="Orn: Yeniden Refah Partisi"
            />
          </div>
          <div>
            <label htmlFor="setting-login-slogan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Login Slogani
            </label>
            <input
              id="setting-login-slogan"
              type="text"
              value={themeSettings.loginSlogan}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, loginSlogan: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="Orn: Il Sekreterlik Sistemi"
            />
          </div>
        </div>
      </div>

      {/* Footer sabit — DAT Dijital (gelistirici bilgisi, degistirilemez) */}

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Kaydet / Sifirla */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
        >
          Varsayilana Sifirla
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Tema Kaydet'}
        </button>
      </div>

      {/* Bilgi Notu */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Not:</strong> Tema degisiklikleri tum kullanicilar icin gecerli olacaktir.
          Kaydettikten sonra sayfayi yenileyen kullanicilar yeni temayi gorecektir.
        </p>
      </div>
    </div>
  );
};

/**
 * Tek bir hex renkten tam palet uretir (basit hesaplama)
 */
function generatePalette(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const lighten = (r, g, b, amt) => {
    return [
      Math.min(255, Math.round(r + (255 - r) * amt)),
      Math.min(255, Math.round(g + (255 - g) * amt)),
      Math.min(255, Math.round(b + (255 - b) * amt))
    ];
  };

  const darken = (r, g, b, amt) => {
    return [
      Math.max(0, Math.round(r * (1 - amt))),
      Math.max(0, Math.round(g * (1 - amt))),
      Math.max(0, Math.round(b * (1 - amt)))
    ];
  };

  const toHex = ([r, g, b]) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

  return {
    50: toHex(lighten(r, g, b, 0.95)),
    100: toHex(lighten(r, g, b, 0.88)),
    200: toHex(lighten(r, g, b, 0.75)),
    300: toHex(lighten(r, g, b, 0.55)),
    400: toHex(lighten(r, g, b, 0.3)),
    500: toHex(lighten(r, g, b, 0.1)),
    600: hex,
    700: toHex(darken(r, g, b, 0.15)),
    800: toHex(darken(r, g, b, 0.3)),
    900: toHex(darken(r, g, b, 0.45)),
    950: toHex(darken(r, g, b, 0.65))
  };
}

export { THEME_TEMPLATES, generatePalette };
export default ThemeSettings;
