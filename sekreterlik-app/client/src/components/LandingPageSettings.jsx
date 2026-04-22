import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../utils/ApiService';
import FirebaseApiService from '../utils/FirebaseApiService';
import FirebaseStorageService from '../utils/FirebaseStorageService';

/**
 * Landing Page CMS Admin Panel
 * Firestore path: landing_content/main
 *
 * Tasarim notlari:
 * - Her bolum icin collapsible kart (details/summary)
 * - Ustte Canli Onizleme ve Kaydet butonlari
 * - Gorseller Firebase Storage'da landing_media/ altinda
 */

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const DEFAULT_CONTENT = {
  heroTitle: '',
  heroSubtitle: '',
  heroImage: '',
  heroCtaText: '',

  aboutTitle: '',
  aboutContent: '',
  aboutImage: '',

  leadersEnabled: true,
  leadersTitle: 'Yönetim Kadromuz',

  electionSummaryEnabled: true,
  featuredElectionId: '',

  applyCtaTitle: '',
  applyCtaText: '',

  address: '',
  phone: '',
  email: '',
  social: {
    facebook: '',
    instagram: '',
    twitter: '',
    youtube: ''
  },

  sections: {
    hero: true,
    about: true,
    leaders: true,
    electionSummary: true,
    applyCta: true,
    contact: true
  }
};

// Basit deep-merge: remote'dan gelen kismi dokuman varsayilanlari ezer.
const mergeContent = (base, incoming) => {
  if (!incoming || typeof incoming !== 'object') return { ...base };
  return {
    ...base,
    ...incoming,
    social: { ...base.social, ...(incoming.social || {}) },
    sections: { ...base.sections, ...(incoming.sections || {}) }
  };
};

const getExt = (file) => {
  const part = (file?.name || '').split('.').pop();
  return (part || 'png').toLowerCase();
};

const LandingPageSettings = () => {
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({}); // { heroImage: true, aboutImage: true }
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [elections, setElections] = useState([]);
  const [electionsLoading, setElectionsLoading] = useState(false);

  // ========= YUKLEME =========
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const remote = await FirebaseApiService.getLandingContent();
        if (!cancelled) {
          setContent((prev) => mergeContent(DEFAULT_CONTENT, remote));
        }
      } catch (err) {
        console.error('Landing icerik yuklenemedi:', err);
        if (!cancelled) toast.error('Tanıtım sayfası içeriği yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadElections = async () => {
      try {
        setElectionsLoading(true);
        const list = await ApiService.getElections();
        if (!cancelled && Array.isArray(list)) {
          setElections(list);
        }
      } catch (err) {
        console.warn('Secimler yuklenemedi:', err?.message || err);
      } finally {
        if (!cancelled) setElectionsLoading(false);
      }
    };

    load();
    loadElections();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========= ALAN GUNCELLEYICILER =========
  const setField = (field, value) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const setSocial = (key, value) => {
    setContent((prev) => ({ ...prev, social: { ...(prev.social || {}), [key]: value } }));
  };

  const setSection = (key, value) => {
    setContent((prev) => ({ ...prev, sections: { ...(prev.sections || {}), [key]: !!value } }));
  };

  // ========= IMAGE UPLOAD =========
  const handleImageUpload = async (field, file, storagePrefix) => {
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Sadece JPG, PNG veya WebP dosyaları yükleyebilirsiniz');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return;
    }

    try {
      setUploading((prev) => ({ ...prev, [field]: true }));
      const ext = getExt(file);
      const path = `landing_media/${storagePrefix}_${Date.now()}.${ext}`;
      const url = await FirebaseStorageService.uploadFile(file, path, {
        contentType: file.type,
        customMetadata: {
          field,
          uploadedAt: new Date().toISOString()
        }
      });
      setField(field, url);
      toast.success('Görsel yüklendi');
    } catch (err) {
      console.error('Landing gorsel yukleme hatasi:', err);
      toast.error('Görsel yüklenemedi: ' + (err?.message || 'bilinmeyen hata'));
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  // ========= KAYDET =========
  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...content,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.username || user?.email || user?.uid || 'admin'
      };
      const result = await FirebaseApiService.updateLandingContent(payload);
      if (result && result.success) {
        toast.success('Tanıtım sayfası kaydedildi');
      } else {
        throw new Error(result?.message || 'Kaydetme başarısız');
      }
    } catch (err) {
      console.error('Landing kaydet hatasi:', err);
      toast.error('Kaydetme hatası: ' + (err?.message || 'bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  // ========= ONIZLEME =========
  const handlePreview = () => {
    try {
      window.open('/', '_blank', 'noopener,noreferrer');
    } catch (e) {
      window.location.assign('/');
    }
  };

  // Select icin duzenli secim listesi
  const electionOptions = useMemo(() => {
    return (elections || []).map((el) => {
      const label = [el.name || el.title || 'Seçim', el.round ? `Tur ${el.round}` : null, el.date ? new Date(el.date).getFullYear() : null]
        .filter(Boolean)
        .join(' - ');
      return { id: el.id, label };
    });
  }, [elections]);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-600 dark:text-gray-300">
        Tanıtım sayfası yükleniyor...
      </div>
    );
  }

  // Ortak sinif kisayollari
  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const cardCls = 'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden';
  const summaryCls = 'flex items-center justify-between gap-4 px-4 py-3 cursor-pointer select-none bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';
  const cardBodyCls = 'p-4 space-y-4 border-t border-gray-200 dark:border-gray-700';

  return (
    <div className="space-y-6">
      {/* Baslik + aksiyon butonlari */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Tanıtım Sayfası CMS
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ziyaretçilere gösterilen genel tanıtım sayfasının içeriğini buradan düzenleyin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePreview}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Canlı Önizleme
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* KART 1: HERO */}
      <details className={cardCls} open>
        <summary className={summaryCls}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">1. Hero (Üst Banner)</span>
            {!content.sections?.hero && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Gizli</span>
            )}
          </div>
          <SectionToggle
            checked={!!content.sections?.hero}
            onChange={(v) => setSection('hero', v)}
            ariaLabel="Hero bölümünü göster/gizle"
          />
        </summary>
        <div className={cardBodyCls}>
          <div>
            <label className={labelCls} htmlFor="lp-hero-title">Başlık <span className="text-red-500">*</span></label>
            <input
              id="lp-hero-title"
              type="text"
              className={inputCls}
              value={content.heroTitle || ''}
              onChange={(e) => setField('heroTitle', e.target.value)}
              placeholder="Örn: YRP Elazığ İl Sekreterliği"
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="lp-hero-subtitle">Alt Başlık</label>
            <input
              id="lp-hero-subtitle"
              type="text"
              className={inputCls}
              value={content.heroSubtitle || ''}
              onChange={(e) => setField('heroSubtitle', e.target.value)}
              placeholder="Kısa açıklama metni"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="lp-hero-image">Banner Görseli (jpg/png/webp, maks 5MB)</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                id="lp-hero-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!!uploading.heroImage}
                onChange={(e) => handleImageUpload('heroImage', e.target.files?.[0], 'hero')}
                className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/40 dark:file:text-primary-200 hover:file:bg-primary-100"
              />
              {uploading.heroImage && <span className="text-xs text-primary-600 animate-pulse">Yükleniyor...</span>}
              {content.heroImage && (
                <img
                  src={content.heroImage}
                  alt="Hero önizleme"
                  className="h-16 w-28 object-cover rounded border border-gray-200 dark:border-gray-700"
                  loading="lazy"
                />
              )}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="lp-hero-cta">CTA Buton Metni</label>
            <input
              id="lp-hero-cta"
              type="text"
              className={inputCls}
              value={content.heroCtaText || ''}
              onChange={(e) => setField('heroCtaText', e.target.value)}
              placeholder="Örn: Bize Katılın"
            />
          </div>
        </div>
      </details>

      {/* KART 2: HAKKIMIZDA */}
      <details className={cardCls}>
        <summary className={summaryCls}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">2. Hakkımızda</span>
            {!content.sections?.about && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Gizli</span>
            )}
          </div>
          <SectionToggle
            checked={!!content.sections?.about}
            onChange={(v) => setSection('about', v)}
            ariaLabel="Hakkımızda bölümünü göster/gizle"
          />
        </summary>
        <div className={cardBodyCls}>
          <div>
            <label className={labelCls} htmlFor="lp-about-title">Başlık</label>
            <input
              id="lp-about-title"
              type="text"
              className={inputCls}
              value={content.aboutTitle || ''}
              onChange={(e) => setField('aboutTitle', e.target.value)}
              placeholder="Örn: Hakkımızda"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="lp-about-content">İçerik Metni</label>
            <textarea
              id="lp-about-content"
              rows={6}
              className={inputCls}
              value={content.aboutContent || ''}
              onChange={(e) => setField('aboutContent', e.target.value)}
              placeholder="Teşkilat tanıtım metni"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="lp-about-image">Resim (opsiyonel, maks 5MB)</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                id="lp-about-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!!uploading.aboutImage}
                onChange={(e) => handleImageUpload('aboutImage', e.target.files?.[0], 'about')}
                className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/40 dark:file:text-primary-200 hover:file:bg-primary-100"
              />
              {uploading.aboutImage && <span className="text-xs text-primary-600 animate-pulse">Yükleniyor...</span>}
              {content.aboutImage && (
                <img
                  src={content.aboutImage}
                  alt="Hakkımızda önizleme"
                  className="h-16 w-28 object-cover rounded border border-gray-200 dark:border-gray-700"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </div>
      </details>

      {/* KART 3: LIDERLER */}
      <details className={cardCls}>
        <summary className={summaryCls}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">3. Liderler</span>
            {!content.sections?.leaders && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Gizli</span>
            )}
          </div>
          <SectionToggle
            checked={!!content.sections?.leaders}
            onChange={(v) => setSection('leaders', v)}
            ariaLabel="Liderler bölümünü göster/gizle"
          />
        </summary>
        <div className={cardBodyCls}>
          <div>
            <label className={labelCls} htmlFor="lp-leaders-title">Başlık</label>
            <input
              id="lp-leaders-title"
              type="text"
              className={inputCls}
              value={content.leadersTitle || ''}
              onChange={(e) => setField('leadersTitle', e.target.value)}
              placeholder="Yönetim Kadromuz"
            />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            Not: Liderler otomatik olarak divan üyelerinden çekilir. Ayrıca düzenleme gerekmez.
          </p>
        </div>
      </details>

      {/* KART 4: SECIM SONUCLARI OZETI */}
      <details className={cardCls}>
        <summary className={summaryCls}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">4. Seçim Sonuçları Özeti</span>
            {!content.sections?.electionSummary && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Gizli</span>
            )}
          </div>
          <SectionToggle
            checked={!!content.sections?.electionSummary}
            onChange={(v) => setSection('electionSummary', v)}
            ariaLabel="Seçim özeti bölümünü göster/gizle"
          />
        </summary>
        <div className={cardBodyCls}>
          <div>
            <label className={labelCls} htmlFor="lp-featured-election">Öne Çıkarılacak Seçim</label>
            <select
              id="lp-featured-election"
              className={inputCls}
              value={content.featuredElectionId || ''}
              onChange={(e) => setField('featuredElectionId', e.target.value)}
              disabled={electionsLoading}
            >
              <option value="">{electionsLoading ? 'Seçimler yükleniyor...' : 'Seçim seçiniz'}</option>
              {electionOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            {!electionsLoading && electionOptions.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Henüz tanımlı seçim yok. Seçim ekledikten sonra buradan seçebilirsiniz.
              </p>
            )}
          </div>
        </div>
      </details>

      {/* KART 5: YONETIME BASVUR CTA */}
      <details className={cardCls}>
        <summary className={summaryCls}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">5. Yönetime Başvur CTA</span>
            {!content.sections?.applyCta && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Gizli</span>
            )}
          </div>
          <SectionToggle
            checked={!!content.sections?.applyCta}
            onChange={(v) => setSection('applyCta', v)}
            ariaLabel="Başvuru CTA bölümünü göster/gizle"
          />
        </summary>
        <div className={cardBodyCls}>
          <div>
            <label className={labelCls} htmlFor="lp-apply-title">Başlık</label>
            <input
              id="lp-apply-title"
              type="text"
              className={inputCls}
              value={content.applyCtaTitle || ''}
              onChange={(e) => setField('applyCtaTitle', e.target.value)}
              placeholder="Örn: Yönetime Başvur"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="lp-apply-text">Açıklama Metni</label>
            <textarea
              id="lp-apply-text"
              rows={4}
              className={inputCls}
              value={content.applyCtaText || ''}
              onChange={(e) => setField('applyCtaText', e.target.value)}
              placeholder="Başvuru çağrısı metni"
            />
          </div>
        </div>
      </details>

      {/* KART 6: ILETISIM */}
      <details className={cardCls}>
        <summary className={summaryCls}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">6. İletişim</span>
            {!content.sections?.contact && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Gizli</span>
            )}
          </div>
          <SectionToggle
            checked={!!content.sections?.contact}
            onChange={(v) => setSection('contact', v)}
            ariaLabel="İletişim bölümünü göster/gizle"
          />
        </summary>
        <div className={cardBodyCls}>
          <div>
            <label className={labelCls} htmlFor="lp-address">Adres</label>
            <input
              id="lp-address"
              type="text"
              className={inputCls}
              value={content.address || ''}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Tam adres"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="lp-phone">Telefon</label>
              <input
                id="lp-phone"
                type="tel"
                className={inputCls}
                value={content.phone || ''}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+90 ..."
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lp-email">E-posta</label>
              <input
                id="lp-email"
                type="email"
                className={inputCls}
                value={content.email || ''}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="iletisim@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="lp-facebook">Facebook URL</label>
              <input
                id="lp-facebook"
                type="url"
                className={inputCls}
                value={content.social?.facebook || ''}
                onChange={(e) => setSocial('facebook', e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lp-instagram">Instagram URL</label>
              <input
                id="lp-instagram"
                type="url"
                className={inputCls}
                value={content.social?.instagram || ''}
                onChange={(e) => setSocial('instagram', e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lp-twitter">Twitter URL</label>
              <input
                id="lp-twitter"
                type="url"
                className={inputCls}
                value={content.social?.twitter || ''}
                onChange={(e) => setSocial('twitter', e.target.value)}
                placeholder="https://x.com/..."
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lp-youtube">YouTube URL</label>
              <input
                id="lp-youtube"
                type="url"
                className={inputCls}
                value={content.social?.youtube || ''}
                onChange={(e) => setSocial('youtube', e.target.value)}
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>
        </div>
      </details>

      {/* Kart 7: Analytics (Google Analytics 4) */}
      <details className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <summary className="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <span className="font-semibold text-gray-900 dark:text-gray-100">7. Ziyaretçi İstatistikleri (Google Analytics)</span>
          <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="p-4 pt-0 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Google Analytics hesabınızdan aldığınız <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">G-XXXXXXX</code> formatındaki Measurement ID'yi girin.
            Boş bırakırsanız ziyaretçi takibi yapılmaz.
          </p>
          <div>
            <label className={labelCls} htmlFor="lp-ga-id">Google Analytics 4 Measurement ID</label>
            <input
              id="lp-ga-id"
              type="text"
              className={inputCls}
              value={content.gaMeasurementId || ''}
              onChange={(e) => setField('gaMeasurementId', e.target.value.trim())}
              placeholder="G-XXXXXXXXXX"
              pattern="G-[A-Z0-9]+"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              GA4 hesabı oluşturmak için: <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">analytics.google.com</a>
            </p>
          </div>
        </div>
      </details>

      {/* Alt kaydet butonu (uzun sayfa icin) */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Tüm Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  );
};

// Summary icinde click propagation'i durduran toggle (details'in acilip kapanmasini engeller)
const SectionToggle = ({ checked, onChange, ariaLabel }) => {
  const stop = (e) => {
    e.stopPropagation();
  };
  return (
    <label
      onClick={stop}
      className="relative inline-flex items-center cursor-pointer"
    >
      <input
        type="checkbox"
        className="sr-only peer"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        onClick={stop}
        aria-label={ariaLabel}
      />
      <span className="w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-primary-600 transition-colors" />
      <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transform transition-transform peer-checked:translate-x-5" />
    </label>
  );
};

export default LandingPageSettings;
