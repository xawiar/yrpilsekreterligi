import React, { useState, useEffect } from 'react';
import FirebaseService from '../services/FirebaseService';
import { decryptData, encryptData } from '../utils/crypto';
import ApiService from '../utils/ApiService';

const POOL_SLOT_COUNT = 5;

const GeminiApiSettings = () => {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [ocrApiKey, setOcrApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOcr, setSavingOcr] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOcrKey, setShowOcrKey] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [ocrAdminPassword, setOcrAdminPassword] = useState('');

  // Pool: 5 yedek key slotu (round-robin + 429 cooldown)
  const [poolKeys, setPoolKeys] = useState(Array(POOL_SLOT_COUNT).fill(''));
  const [poolAdminPassword, setPoolAdminPassword] = useState('');
  const [savingPool, setSavingPool] = useState(false);
  const [showPoolKeys, setShowPoolKeys] = useState(false);

  useEffect(() => {
    loadApiKey();
    loadOcrApiKey();
    loadPoolKeys();
  }, []);

  const loadPoolKeys = async () => {
    try {
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      if (!USE_FIREBASE) return;
      const cfg = await FirebaseService.getById('gemini_api_config', 'pool');
      if (cfg && Array.isArray(cfg.keys)) {
        const decoded = cfg.keys.slice(0, POOL_SLOT_COUNT).map((enc) => {
          if (!enc) return '';
          try {
            return enc.startsWith('U2FsdGVkX1') ? decryptData(enc) : enc;
          } catch (_) {
            return '';
          }
        });
        const padded = [...decoded, ...Array(POOL_SLOT_COUNT - decoded.length).fill('')];
        setPoolKeys(padded);
      }
    } catch (err) {
      console.warn('Pool keys load error:', err.message);
    }
  };

  const handlePoolKeyChange = (idx, value) => {
    setPoolKeys((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleSavePool = async () => {
    try {
      setSavingPool(true);
      setMessage('');

      const cleanKeys = poolKeys.map((k) => k.trim()).filter(Boolean);
      const invalid = cleanKeys.find((k) => !k.startsWith('AIzaSy'));
      if (invalid) {
        setMessage('Geçersiz key formatı (her key "AIzaSy" ile başlamalı)');
        setMessageType('error');
        return;
      }
      if (!poolAdminPassword.trim()) {
        setMessage('Admin şifresi gerekli');
        setMessageType('error');
        return;
      }

      const v = await ApiService.verifyAdminPassword(poolAdminPassword.trim());
      if (!v.success) {
        setMessage(v.message || 'Admin şifresi yanlış');
        setMessageType('error');
        setPoolAdminPassword('');
        return;
      }

      const encryptedKeys = cleanKeys.map((k) => encryptData(k));

      await FirebaseService.create('gemini_api_config', 'pool', {
        keys: encryptedKeys,
        updated_at: new Date().toISOString()
      }, false);

      // Live pool'a refresh sinyali (sayfa yenilenmeden devreye girer)
      try {
        const { default: GeminiKeyPool } = await import('../services/GeminiKeyPool');
        await GeminiKeyPool.refresh();
      } catch (_) { /* ignore */ }

      setMessage(`${cleanKeys.length} yedek key kaydedildi ✅`);
      setMessageType('success');
      setPoolAdminPassword('');
    } catch (err) {
      console.error('Pool save error:', err);
      setMessage('Pool kayıt hatası: ' + err.message);
      setMessageType('error');
    } finally {
      setSavingPool(false);
    }
  };

  const loadOcrApiKey = async () => {
    try {
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      if (USE_FIREBASE) {
        try {
          const cfg = await FirebaseService.getById('gemini_api_config', 'ocr');
          if (cfg && cfg.api_key) {
            const decrypted = cfg.api_key.startsWith('U2FsdGVkX1')
              ? decryptData(cfg.api_key)
              : cfg.api_key;
            setOcrApiKey(decrypted);
            return;
          }
        } catch (_) { /* ignore */ }
      }
      const envKey = import.meta.env.VITE_GEMINI_OCR_API_KEY;
      if (envKey) setOcrApiKey(envKey);
    } catch (err) {
      console.error('OCR key load error:', err);
    }
  };

  const handleSaveOcr = async () => {
    try {
      setSavingOcr(true);
      setMessage('');
      if (!ocrApiKey.trim()) {
        setMessage('Lütfen OCR API anahtarını girin');
        setMessageType('error');
        return;
      }
      if (!ocrApiKey.trim().startsWith('AIzaSy')) {
        setMessage('Geçersiz Gemini API anahtarı formatı ("AIzaSy" ile başlamalı)');
        setMessageType('error');
        return;
      }
      if (!ocrAdminPassword.trim()) {
        setMessage('Lütfen admin şifresini girin');
        setMessageType('error');
        return;
      }
      const v = await ApiService.verifyAdminPassword(ocrAdminPassword.trim());
      if (!v.success) {
        setMessage(v.message || 'Admin şifresi yanlış');
        setMessageType('error');
        setOcrAdminPassword('');
        return;
      }
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      if (USE_FIREBASE) {
        await FirebaseService.create('gemini_api_config', 'ocr', {
          api_key: encryptData(ocrApiKey.trim()),
          updated_at: new Date().toISOString()
        }, false);
        setMessage('OCR API anahtarı kaydedildi ✅');
        setMessageType('success');
        setOcrAdminPassword('');
      } else {
        setMessage('Firebase kullanılmıyor.');
        setMessageType('error');
      }
    } catch (err) {
      console.error('OCR key save error:', err);
      setMessage('Kayıt hatası: ' + err.message);
      setMessageType('error');
      setOcrAdminPassword('');
    } finally {
      setSavingOcr(false);
    }
  };

  const loadApiKey = async () => {
    try {
      setLoading(true);
      setMessage('');

      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

      if (USE_FIREBASE) {
        try {
          const geminiConfig = await FirebaseService.getById('gemini_api_config', 'main');
          if (geminiConfig && geminiConfig.api_key) {
            const decryptedKey = geminiConfig.api_key.startsWith('U2FsdGVkX1')
              ? decryptData(geminiConfig.api_key)
              : geminiConfig.api_key;
            setGeminiApiKey(decryptedKey);
          } else {
            const envKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (envKey) setGeminiApiKey(envKey);
          }
        } catch (error) {
          const envKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (envKey) setGeminiApiKey(envKey);
        }
      } else {
        setGeminiApiKey(import.meta.env.VITE_GEMINI_API_KEY || '');
      }
    } catch (error) {
      console.error('Error loading Gemini API key:', error);
      setMessage('API anahtarı yüklenirken hata oluştu');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');

      if (!geminiApiKey.trim()) {
        setMessage('Lütfen Gemini API anahtarını girin');
        setMessageType('error');
        return;
      }

      if (!geminiApiKey.trim().startsWith('AIzaSy')) {
        setMessage('Geçersiz Gemini API anahtarı formatı. API anahtarı "AIzaSy" ile başlamalıdır.');
        setMessageType('error');
        return;
      }

      // Admin şifresi doğrulama
      if (!adminPassword.trim()) {
        setMessage('Lütfen admin şifresini girin');
        setMessageType('error');
        return;
      }

      // Admin şifresini doğrula
      const verifyResult = await ApiService.verifyAdminPassword(adminPassword.trim());
      if (!verifyResult.success) {
        setMessage(verifyResult.message || 'Admin şifresi yanlış');
        setMessageType('error');
        setAdminPassword('');
        return;
      }

      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

      if (USE_FIREBASE) {
        const encryptedKey = encryptData(geminiApiKey.trim());

        const configData = {
          api_key: encryptedKey,
          updated_at: new Date().toISOString()
        };

        await FirebaseService.create('gemini_api_config', 'main', configData, false);

        // Ensure provider is set to gemini
        await FirebaseService.create('ai_provider_config', 'main', {
          provider: 'gemini',
          updated_at: new Date().toISOString()
        }, false);

        setMessage('Gemini API anahtarı başarıyla kaydedildi');
        setMessageType('success');
        setAdminPassword('');
      } else {
        setMessage('Firebase kullanılmıyor. API anahtarı environment variable olarak ayarlanmalıdır.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving Gemini API key:', error);
      setMessage('API anahtarı kaydedilirken hata oluştu: ' + error.message);
      setMessageType('error');
      setAdminPassword('');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setMessage('');

      if (!geminiApiKey.trim()) {
        setMessage('Lütfen önce API anahtarını kaydedin');
        setMessageType('error');
        return;
      }

      const testResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Test' }] }]
          })
        }
      );

      if (testResponse.ok) {
        setMessage('API anahtarı geçerli ve çalışıyor! ✅');
        setMessageType('success');
      } else {
        const errorData = await testResponse.json().catch(() => ({}));
        setMessage('API anahtarı geçersiz: ' + (errorData.error?.message || 'Bilinmeyen hata'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error testing Gemini API key:', error);
      setMessage('API anahtarı test edilirken hata oluştu: ' + error.message);
      setMessageType('error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Gemini AI API Ayarları
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Google Gemini API anahtarınızı girin. API anahtarı değiştiğinde buraya yeni anahtarı girebilirsiniz.
        </p>
      </div>

      {/* API Key Input */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
        <div className="space-y-4">
          <div>
            <label htmlFor="setting-gemini-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Google Gemini API Anahtarı
            </label>
            <div className="flex items-center space-x-2">
              <input
                id="setting-gemini-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {showApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.736m-16.822 0a10.025 10.025 0 01-1.563-3.029M15.59 15.59l-3.29-3.29m0 0l-3.29-3.29m3.29 3.29L12 12m-3.29-3.29L12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              API anahtarınızı{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Google AI Studio
              </a>
              'dan alabilirsiniz.
            </p>
          </div>

          {/* Admin Password */}
          <div>
            <label htmlFor="setting-gemini-admin-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Admin Şifresi <span className="text-red-500">*</span>
            </label>
            <input
              id="setting-gemini-admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="API anahtarını kaydetmek için admin şifresini girin"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              API anahtarı değişiklikleri için admin şifresi gereklidir
            </p>
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${
              messageType === 'success'
                ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700'
            }`}>
              {message}
            </div>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              disabled={saving || !geminiApiKey.trim() || !adminPassword.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              onClick={handleTest}
              disabled={!geminiApiKey.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Test Et
            </button>
          </div>
        </div>
      </div>

      {/* === ÜYE FORMU OCR İÇİN AYRI API KEY === */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
        <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100 mb-1">
          Üye Formu OCR için Ayrı API Key
        </h3>
        <p className="text-xs text-amber-800 dark:text-amber-200 mb-3">
          Chatbot ile kota paylaşmamak için OCR özelliği ayrı bir Gemini API key kullanır. Boş bırakırsanız yukarıdaki genel key kullanılır.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              OCR API Anahtarı
            </label>
            <div className="flex items-center space-x-2">
              <input
                type={showOcrKey ? 'text' : 'password'}
                value={ocrApiKey}
                onChange={(e) => setOcrApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowOcrKey(!showOcrKey)}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {showOcrKey ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Admin Şifresi <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={ocrAdminPassword}
              onChange={(e) => setOcrAdminPassword(e.target.value)}
              placeholder="Admin şifreniz"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            onClick={handleSaveOcr}
            disabled={savingOcr || !ocrApiKey.trim() || !ocrAdminPassword.trim()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {savingOcr ? 'Kaydediliyor...' : 'OCR Key Kaydet'}
          </button>
        </div>
      </div>

      {/* === YEDEK KEY HAVUZU (POOL) === */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-purple-900 dark:text-purple-100">
            Yedek API Key Havuzu (Round-Robin)
          </h3>
          <button
            type="button"
            onClick={() => setShowPoolKeys(!showPoolKeys)}
            className="text-xs px-2 py-1 border border-purple-300 dark:border-purple-600 rounded text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-800/30"
          >
            {showPoolKeys ? 'Gizle' : 'Göster'}
          </button>
        </div>
        <p className="text-xs text-purple-800 dark:text-purple-200 mb-3">
          Seçim günü gibi yüksek yükte tek key kotaya takılınca otomatik bir
          sonrakine geçilir. 429 alan key 60 sn cooldown'a girer. 5 farklı
          Google hesabıyla key alıp buraya ekleyin (5 × 1000 RPM = 5000 RPM
          kapasite).
        </p>
        <div className="space-y-2">
          {poolKeys.map((k, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-mono text-purple-700 dark:text-purple-300 w-6">#{idx + 1}</span>
              <input
                type={showPoolKeys ? 'text' : 'password'}
                value={k}
                onChange={(e) => handlePoolKeyChange(idx, e.target.value)}
                placeholder={`Yedek key ${idx + 1} (AIzaSy...) — boş bırakılabilir`}
                className="flex-1 px-3 py-1.5 text-sm border border-purple-300 dark:border-purple-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">
              Admin Şifresi <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={poolAdminPassword}
              onChange={(e) => setPoolAdminPassword(e.target.value)}
              placeholder="Admin şifreniz"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            onClick={handleSavePool}
            disabled={savingPool || !poolAdminPassword.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {savingPool ? 'Kaydediliyor...' : 'Havuzu Kaydet'}
          </button>
        </div>
        <div className="mt-3 text-xs text-purple-700 dark:text-purple-300">
          ℹ️ Boş slotlar yok sayılır. Ana key (üstteki) ve OCR key de havuza
          otomatik dahil edilir — burada onları tekrar girmenize gerek yok.
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Bilgi</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>API anahtarı şifrelenmiş olarak Firebase'de saklanır</li>
          <li>Chatbot Gemini AI servisini kullanmaktadır</li>
          <li>API anahtarı değiştiğinde buraya yeni anahtarı girebilirsiniz</li>
          <li>Test butonu ile API anahtarının geçerli olup olmadığını kontrol edebilirsiniz</li>
          <li>Gemini API anahtarı "AIzaSy" ile başlamalıdır</li>
        </ul>
      </div>
    </div>
  );
};

export default GeminiApiSettings;
