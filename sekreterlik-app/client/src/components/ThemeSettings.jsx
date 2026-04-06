import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { applyThemeColors } from '../utils/themeUtils';

// ---- Hex <-> HSL donusumleri ----
function hexToHSL(hex) {
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

function hslToHex(h, s, l) {
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
 * Verilen hex rengi 500 shade olarak kabul eder ve
 * diger shade'leri HSL lightness degerleriyle hesaplar.
 */
function generatePalette(hexColor) {
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

// ---- Parti renk preset'leri ----
const THEME_PRESETS = [
  { id: 'yrp-yesil',       name: 'YRP Yesil',        color: '#00843D' },
  { id: 'akp-turuncu',     name: 'AKP Turuncu',      color: '#FFA500' },
  { id: 'chp-kirmizi',     name: 'CHP Kirmizi',      color: '#ED1C24' },
  { id: 'mhp-kirmizi',     name: 'MHP Kirmizi',      color: '#CC0000' },
  { id: 'iyi-mavi',        name: 'IYI Parti Mavi',   color: '#0066B3' },
  { id: 'varsayilan-mavi', name: 'Varsayilan Mavi',   color: '#3B82F6' },
  { id: 'deva-mor',        name: 'DEVA Mor',          color: '#7c3aed' },
  { id: 'varsayilan',      name: 'Varsayilan (Indigo)', color: '#4f46e5' },
];

// Her preset icin otomatik palet uret
const THEME_TEMPLATES = {};
THEME_PRESETS.forEach(p => {
  THEME_TEMPLATES[p.id] = {
    primary: p.color,
    name: p.name,
    colors: generatePalette(p.color),
  };
});

const ThemeSettings = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('varsayilan');
  const [customColor, setCustomColor] = useState('#4f46e5');
  const [hexInput, setHexInput] = useState('#4f46e5');
  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#4f46e5',
    templateId: 'varsayilan',
    preset: 'varsayilan',
    footerText: '',
    footerCompanyName: '',
    footerCompanyUrl: '',
    loginSlogan: '',
    loginTitle: ''
  });
  const [previewActive, setPreviewActive] = useState(false);
  const [originalTheme, setOriginalTheme] = useState(null);

  // Secili rengin paleti (canli hesaplama)
  const currentPalette = useMemo(() => {
    const template = THEME_TEMPLATES[selectedTemplate];
    return template ? template.colors : generatePalette(customColor);
  }, [selectedTemplate, customColor]);

  // Firestore'dan tema ayarlarini yukle
  useEffect(() => {
    loadThemeSettingsFromStore();
  }, []);

  const loadThemeSettingsFromStore = async () => {
    try {
      setLoading(true);

      // Oncelikle localStorage'dan yukle
      const cached = localStorage.getItem('themeSettings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setThemeSettings(parsed);
          setSelectedTemplate(parsed.templateId || parsed.preset || 'varsayilan');
          setCustomColor(parsed.primaryColor || '#4f46e5');
          setHexInput(parsed.primaryColor || '#4f46e5');
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
          templateId: data.templateId || data.preset || 'varsayilan',
          preset: data.preset || data.templateId || 'varsayilan',
          footerText: data.footerText || '',
          footerCompanyName: data.footerCompanyName || '',
          footerCompanyUrl: data.footerCompanyUrl || '',
          loginSlogan: data.loginSlogan || '',
          loginTitle: data.loginTitle || ''
        };
        setThemeSettings(settings);
        setSelectedTemplate(settings.templateId);
        setCustomColor(settings.primaryColor);
        setHexInput(settings.primaryColor);
        localStorage.setItem('themeSettings', JSON.stringify({ ...settings, colors: data.colors }));
      }
    } catch (error) {
      console.error('Error loading theme settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tema sablonu / preset secildiginde
  const handleTemplateSelect = (templateId) => {
    const template = THEME_TEMPLATES[templateId];
    if (!template) return;

    setSelectedTemplate(templateId);
    setCustomColor(template.primary);
    setHexInput(template.primary);
    setThemeSettings(prev => ({
      ...prev,
      templateId,
      preset: templateId,
      primaryColor: template.primary
    }));

    // Canli onizleme aktifse hemen uygula
    if (previewActive) {
      applyThemeColors(template.colors);
    }
  };

  // Ozel renk secildiginde (color picker)
  const handleCustomColorChange = (color) => {
    setCustomColor(color);
    setHexInput(color);
    setSelectedTemplate('custom');
    setThemeSettings(prev => ({
      ...prev,
      templateId: 'custom',
      preset: 'custom',
      primaryColor: color
    }));

    // Canli onizleme aktifse hemen uygula
    if (previewActive) {
      applyThemeColors(generatePalette(color));
    }
  };

  // Hex input ile renk degistirme
  const handleHexInputChange = (value) => {
    setHexInput(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      handleCustomColorChange(value);
    }
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
      applyThemeColors(currentPalette);
      setPreviewActive(true);
    } else {
      // Orijinal temayi geri yukle
      if (originalTheme) {
        applyThemeColors(originalTheme);
      }
      setPreviewActive(false);
    }
  }, [previewActive, currentPalette, originalTheme]);

  // Kaydet
  const handleSave = async () => {
    try {
      setSaving(true);

      const saveData = {
        ...themeSettings,
        primaryColor: customColor,
        palette: currentPalette,
        colors: currentPalette,
        preset: selectedTemplate,
        templateId: selectedTemplate,
        updatedAt: new Date().toISOString()
      };

      // Firestore'a kaydet
      await setDoc(doc(db, 'settings', 'theme'), saveData, { merge: true });

      // localStorage'a kaydet
      localStorage.setItem('themeSettings', JSON.stringify(saveData));

      // CSS variable'lari uygula
      applyThemeColors(currentPalette);
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
    setHexInput(template.primary);
    setThemeSettings({
      primaryColor: template.primary,
      templateId: defaultTemplate,
      preset: defaultTemplate,
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

      {/* Parti Renk Preset'leri */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
          Parti Renk Preset'leri
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleTemplateSelect(preset.id)}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                selectedTemplate === preset.id
                  ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div
                className="w-full h-8 rounded-lg mb-2"
                style={{ backgroundColor: preset.color }}
              />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {preset.name}
              </p>
              <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-0.5">
                {preset.color}
              </p>
              {selectedTemplate === preset.id && (
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
        <div className="flex items-center gap-4 flex-wrap">
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
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="setting-hex-input" className="text-sm text-gray-700 dark:text-gray-300">Hex:</label>
            <input
              id="setting-hex-input"
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              className="w-28 px-3 py-1.5 text-sm font-mono bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:text-gray-100"
              placeholder="#000000"
              maxLength={7}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>HSL:</span>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              {(() => { const hsl = hexToHSL(customColor); return `${hsl.h}, ${hsl.s}%, ${hsl.l}%`; })()}
            </code>
          </div>
          <div
            className="flex-1 min-w-[80px] h-10 rounded-lg shadow-inner"
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
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
            <div
              key={shade}
              className="flex-1 h-14 relative group cursor-pointer"
              style={{ backgroundColor: currentPalette[shade] || customColor }}
              title={`${shade}: ${currentPalette[shade] || customColor}`}
            >
              <span className="absolute inset-0 flex flex-col items-center justify-center text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity text-white mix-blend-difference leading-tight">
                <span>{shade}</span>
                <span>{currentPalette[shade]}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Canli Onizleme Butonu + Panel */}
      <div className="space-y-4">
        <div className="flex gap-3 items-center">
          <button
            onClick={togglePreview}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              previewActive
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {previewActive ? 'Onizlemeyi Kapat (CSS Geri Al)' : 'Sayfaya Canli Uygula'}
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

        {/* Canli Onizleme Paneli -- her zaman gosterilir, palet degisince aninda guncellenir */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            Canli Onizleme Paneli
          </div>
          <div className="p-6 bg-white dark:bg-gray-900 space-y-6">
            {/* Ornek Kart */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: currentPalette[200] }}>
              <div className="px-5 py-3 text-white text-sm font-semibold" style={{ background: `linear-gradient(135deg, ${currentPalette[600]}, ${currentPalette[700]})` }}>
                Ornek Kart Basligi
              </div>
              <div className="px-5 py-4 space-y-2" style={{ backgroundColor: currentPalette[50] }}>
                <p className="text-sm" style={{ color: currentPalette[900] }}>
                  Bu bir ornek kart icerigidir. Renklerin nasil gorunecegini buradan kontrol edebilirsiniz.
                </p>
                <p className="text-xs" style={{ color: currentPalette[500] }}>
                  Alt bilgi metni - 500 tonu
                </p>
              </div>
            </div>

            {/* Buton Onizlemeleri */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Butonlar</p>
              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: currentPalette[600] }}>
                  Primary
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors" style={{ backgroundColor: currentPalette[50], color: currentPalette[700], borderColor: currentPalette[200] }}>
                  Secondary
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 transition-colors">
                  Danger
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: currentPalette[700] }}>
                  Dark Primary
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: currentPalette[100], color: currentPalette[800] }}>
                  Subtle
                </button>
              </div>
            </div>

            {/* Metin Onizlemesi */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Metin Renkleri</p>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold" style={{ color: currentPalette[900] }}>Baslik metni (900)</p>
                <p className="text-sm" style={{ color: currentPalette[700] }}>Normal metin (700)</p>
                <p className="text-sm" style={{ color: currentPalette[500] }}>Aciklama metni (500)</p>
                <p className="text-sm" style={{ color: currentPalette[400] }}>Deaktif metin (400)</p>
              </div>
            </div>

            {/* Arka Plan Onizlemesi */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Arka Plan Tonlari</p>
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 200, 300, 400].map(shade => (
                  <div key={shade} className="px-3 py-2 rounded-lg text-xs font-mono" style={{ backgroundColor: currentPalette[shade], color: shade >= 300 ? '#fff' : currentPalette[800] }}>
                    bg-{shade}
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar Benzeri Onizleme */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sidebar Menu Onizleme</p>
              <div className="w-64 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                <div className="px-4 py-3 text-sm font-bold" style={{ color: currentPalette[700] }}>
                  Parti Sekreterligi
                </div>
                <div className="px-2 py-1">
                  <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium" style={{ background: `linear-gradient(to right, ${currentPalette[50]}, ${currentPalette[100]})`, color: currentPalette[700], border: `1px solid ${currentPalette[100]}` }}>
                    <span className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: currentPalette[600] }}></span>
                    Aktif Menu Ogesi
                  </div>
                  <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                    <span className="w-4 h-4 mr-2 rounded bg-gray-300 dark:bg-gray-600"></span>
                    Diger Menu Ogesi
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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

      {/* Footer sabit -- DAT Dijital (gelistirici bilgisi, degistirilemez) */}

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

export { THEME_TEMPLATES, THEME_PRESETS, generatePalette, hexToHSL, hslToHex };
export default ThemeSettings;
