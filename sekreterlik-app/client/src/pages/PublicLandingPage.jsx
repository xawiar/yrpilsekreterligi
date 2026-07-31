import React, { useEffect, useState, useMemo } from 'react';
import { collection, doc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import PublicApiService from '../utils/PublicApiService';

import CustomCursor from '../components/public/landing-v2/CustomCursor';
import {
  useLenis, useReveal, useCounter, useMagnetic,
  useScrollChrome, useHeroParallax, useVisionScroll,
} from '../utils/landingMotionV2';

import '../styles/landing-v2.css';

/**
 * Public Landing v2 — YRP editorial cinematic design.
 *
 * Veri kaynakları:
 *   - landing_content/main  → hero, stats, vision, applyCta, address vb.
 *   - landing_news          → editorial news (1 feature + N row)
 *
 * Tasarım: Fraunces (display serif) + Inter Tight, kırmızı/amber accent,
 * paper background. Lenis smooth scroll + custom cursor + reveal.
 */

const DEFAULTS = {
  heroTitle: 'Geleceği birlikte inşa ediyoruz',
  heroSubtitle:
    "Elazığ'ın 13 ilçesinde, 248 mahallesinde — Refah temelli yerel yönetim anlayışıyla şehrimizi yeniden inşa ediyoruz.",
  heroImage: '',
  heroCtaText: 'Aday Başvurusu',
  applyCtaTitle: 'Sen de aday ol.',
  applyCtaText:
    'Belediye meclis üyeliği, muhtarlık ve il/ilçe yönetim kurulu başvuruları açıldı. Geleceği birlikte inşa edelim.',
  visionTitle: 'Vizyonumuz',
  stats: [
    { value: '13', label: 'İlçe Teşkilatı', suffix: '' },
    { value: '248', label: 'Mahalle', suffix: '' },
    { value: '2400', label: 'Aktif Üye', suffix: '+' },
    { value: '36', label: 'Kadın Kolları Yöneticisi', suffix: '' },
  ],
  visionPanels: [
    {
      kicker: 'Birinci ilke',
      title: 'Yerelden başlayan {italic:kalkınma}.',
      body: "Her mahalle, her sokak için ayrı çözüm. Elazığ'ın doğal değerlerini koruyup ekonomik fırsata dönüştüren projelerle başlıyoruz.",
      image: '',
      meta: 'Harput · Tarihi şehir merkezi',
    },
    {
      kicker: 'İkinci ilke',
      title: 'Aileyi {italic:güçlendiren} politika.',
      body: 'Gençlerin geleceğe güvenle bakacağı, ailelerin huzurla yaşayacağı bir Elazığ için sosyal politikalar üretiyoruz.',
      image: '',
      meta: 'Sahada · Kadın Kolları buluşması',
    },
    {
      kicker: 'Üçüncü ilke',
      title: 'Şeffaf, hesap {italic:verebilir} yönetim.',
      body: 'Her kararı vatandaşla paylaşan, her kuruşu açıkça gösteren bir belediye anlayışı. Dijital yönetim, açık veri.',
      image: '',
      meta: 'Dijital yönetim · Açık veri',
    },
    {
      kicker: 'Dördüncü ilke',
      title: 'Tarih ve {italic:kültür} mirası.',
      body: "Harput'tan Keban'a, Palu'dan Sivrice'ye — şehrimizin köklerini koruyup dünyaya tanıtacak kültür projeleri.",
      image: '',
      meta: 'Keban · Baraj gölü',
    },
  ],
  address: '',
  phone: '',
  email: '',
  sections: {
    hero: true, stats: true, vision: true, news: true, applyCta: true, contact: true,
  },
};

// "Yerelden başlayan {italic:kalkınma}." → React node (kelimeleri italik amber)
const renderItalicTitle = (text) => {
  if (!text) return null;
  const parts = String(text).split(/(\{italic:[^}]+\})/g);
  return parts.map((p, i) => {
    const m = p.match(/^\{italic:([^}]+)\}$/);
    if (m) return <em key={i}>{m[1]}</em>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
};

// "Geleceği birlikte inşa ediyoruz" → hero reveal-up için word-wrapped
const splitWordsForReveal = (text, italicIndices = []) => {
  const words = String(text || '').trim().split(/\s+/);
  return words.map((w, i) => (
    <span className="word" key={i}>
      <span className={italicIndices.includes(i) ? 'italic' : ''}>{w}</span>
    </span>
  ));
};

const fmtDate = (d) => {
  try {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : (d?.toDate ? d.toDate() : d);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_) { return ''; }
};

// NOT: Türkçe normalize + divan sıralaması buradan kaldırıldı; artık
// functions/index.js içindeki buildLandingLeaders yapıyor. Sıralamayı
// değiştirmen gerekirse orayı düzenle, burada tekrar sıralama yapma.

const PublicLandingPage = () => {
  const [content, setContent] = useState(DEFAULTS);
  const [news, setNews] = useState([]);
  const [openNews, setOpenNews] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [election, setElection] = useState(null);
  const [training, setTraining] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [openLeader, setOpenLeader] = useState(null);
  const [openGalleryIdx, setOpenGalleryIdx] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore: landing_content/main
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!db) return;
        const snap = await getDoc(doc(db, 'landing_content', 'main'));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() || {};
          setContent((prev) => ({
            ...prev,
            ...data,
            stats: Array.isArray(data.stats) && data.stats.length ? data.stats : prev.stats,
            visionPanels: Array.isArray(data.visionPanels) && data.visionPanels.length
              ? data.visionPanels : prev.visionPanels,
            sections: { ...prev.sections, ...(data.sections || {}) },
          }));
        }
      } catch (e) {
        console.warn('[Landing v2] content yüklenemedi:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Firestore: landing_news (en yeni 5)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!db) return;
        const q = query(collection(db, 'landing_news'), orderBy('publishedAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        if (cancelled) return;
        setNews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('[Landing v2] news yüklenemedi:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Firestore: landing_leaders/current → İl Başkanı + Divan + İl Yönetimi
  //
  // Bu sayfa eskiden `members` koleksiyonunun TAMAMINI çekip gruplamayı burada
  // yapıyordu. Sayfa anonim olduğu için tüm üyelerin tc/phone/address/email/
  // notes alanları her ziyaretçiye iniyordu. Artık gruplama Cloud Function'da
  // (functions/index.js → buildLandingLeaders) yapılıyor ve buraya yalnızca
  // ekranda gösterilen alanlar geliyor.
  // Doküman zaten sıralı gelir; burada tekrar sıralama/gruplama YAPMA.
  useEffect(() => {
    if (content.sections?.leaders === false) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!db) return;
        const snap = await getDoc(doc(db, 'landing_leaders', 'current'));
        if (cancelled) return;
        if (!snap.exists()) {
          console.warn('[Landing v2] landing_leaders/current yok — yönetim kadrosu boş kalacak. Admin panelinden "Yönetim kadrosunu şimdi yayınla" ile üretilir.');
          return;
        }
        const list = snap.data()?.leaders;
        if (!Array.isArray(list)) {
          console.warn('[Landing v2] landing_leaders/current beklenen biçimde değil:', typeof list);
          return;
        }
        setLeaders(list);
      } catch (e) {
        console.warn('[Landing v2] leaders yüklenemedi:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [content.sections?.leaders]);

  // Galeri — landing_gallery koleksiyonu
  useEffect(() => {
    if (content.sections?.gallery === false) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!db) return;
        let snap;
        try {
          snap = await getDocs(query(collection(db, 'landing_gallery'), orderBy('date', 'desc'), limit(12)));
        } catch (_) {
          // date alanı yoksa indexsiz fallback
          snap = await getDocs(collection(db, 'landing_gallery'));
        }
        if (cancelled) return;
        setGallery(snap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 12));
      } catch (e) {
        console.warn('[Landing v2] gallery yüklenemedi:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [content.sections?.gallery]);

  // Public seçim özeti — featuredElectionId varsa
  useEffect(() => {
    if (!content.featuredElectionId) { setElection(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const detail = await PublicApiService.getElectionDetail(content.featuredElectionId);
        if (!cancelled) setElection(detail);
      } catch (e) {
        console.warn('[Landing v2] election summary yüklenemedi:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [content.featuredElectionId]);

  // Eğitim materyalleri (public audience)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!db) return;
        const snap = await getDocs(collection(db, 'training_materials'));
        if (cancelled) return;
        const arr = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => m.active !== false && (m.audience === 'public' || m.audience === 'both'))
          .slice(0, 6);
        setTraining(arr);
      } catch (e) {
        console.warn('[Landing v2] training yüklenemedi:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Motion hook'ları — Lenis kapalı (scroll çakışıyor); native scroll kullan
  useLenis(false);
  // Veri geldikçe yeniden tara — sonradan render olan sections (liderler/galeri/news/...) için
  useReveal([leaders.length, news.length, gallery.length, training.length, !!election]);
  useCounter();
  useMagnetic();
  useScrollChrome();
  useHeroParallax();
  useVisionScroll((content.visionPanels || []).length);

  // Hero ready trigger (sayfa mount sonrası ufak bir delay ile reveal-up tetikle)
  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelector('.lv-hero')?.classList.add('is-ready');
      document.querySelector('.lv-hero h1')?.classList.add('is-ready');
    }, 80);
    return () => clearTimeout(t);
  }, []);

  // KRITIK: Global CSS'te `html, body { height: 100% }` body'i sıkıştırıyor →
  // içerik 19000px ama scroll edilemiyor. data-landing-v2 attribute + CSS
  // !important ile bu kuralı override ediyoruz. Component unmount'ta temizlenir.
  useEffect(() => {
    document.documentElement.setAttribute('data-landing-v2', '');
    document.body.setAttribute('data-landing-v2', '');
    return () => {
      document.documentElement.removeAttribute('data-landing-v2');
      document.body.removeAttribute('data-landing-v2');
    };
  }, []);

  // Emniyet: 4sn sonra observer hala fire etmediyse tüm data-reveal'ları aç
  // (mobil/yavaş ağ/SW edge case'lere karşı sigorta)
  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll('.landing-v2 [data-reveal]:not(.is-visible)')
        .forEach((el) => el.classList.add('is-visible'));
    }, 4000);
    return () => clearTimeout(t);
  }, [leaders.length, news.length, gallery.length, training.length]);

  // Galeri lightbox: Esc kapatır, ←/→ önceki/sonraki
  useEffect(() => {
    if (openGalleryIdx === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenGalleryIdx(null);
      else if (e.key === 'ArrowRight') setOpenGalleryIdx((i) => (i === null ? null : (i + 1) % gallery.length));
      else if (e.key === 'ArrowLeft') setOpenGalleryIdx((i) => (i === null ? null : (i - 1 + gallery.length) % gallery.length));
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openGalleryIdx, gallery.length]);

  // Hero title için italik kelime tespiti — son kelime italik olsun
  const heroWords = useMemo(() => {
    const t = content.heroTitle || DEFAULTS.heroTitle;
    const words = t.trim().split(/\s+/);
    const italicIdx = words.length >= 4 ? [words.length - 1] : [];
    return splitWordsForReveal(t, italicIdx);
  }, [content.heroTitle]);

  const featuredNews = news[0];
  const restNews = news.slice(1, 5);

  return (
    <div className="landing-v2 has-cursor">
      <CustomCursor />

      {/* Scroll progress */}
      <div className="lv-progress"><div className="lv-progress-fill" id="lv-progress" /></div>

      {/* Nav */}
      <nav className="lv-nav" id="lv-nav">
        <a href="/" className="lv-brand" data-cursor="hover">
          <span className="lv-brand-logo-wrap">
            <img src="/yrp-logo.png" alt="Yeniden Refah Partisi" className="lv-brand-logo" />
          </span>
          Yeniden Refah Partisi Elazığ İl Başkanlığı
        </a>
        <div className="lv-nav-links">
          <a href="#hero" data-cursor="hover">Anasayfa</a>
          <a href="#vizyon" data-cursor="hover">Vizyon</a>
          <a href="#liderler" data-cursor="hover">Yönetim</a>
          <a href="#haberler" data-cursor="hover">Haberler</a>
          <a href="#galeri" data-cursor="hover">Galeri</a>
          <a href="#iletisim" data-cursor="hover">İletişim</a>
          <a href="/login" data-cursor="hover">Giriş</a>
        </div>
        <button
          type="button"
          className={`lv-burger ${mobileMenuOpen ? 'is-open' : ''}`}
          aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((v) => !v)}
          data-cursor="hover"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`lv-mobile-drawer ${mobileMenuOpen ? 'is-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div className="lv-mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
          <a href="#hero" onClick={() => setMobileMenuOpen(false)}>Anasayfa</a>
          <a href="#vizyon" onClick={() => setMobileMenuOpen(false)}>Vizyon</a>
          <a href="#liderler" onClick={() => setMobileMenuOpen(false)}>Yönetim</a>
          <a href="#haberler" onClick={() => setMobileMenuOpen(false)}>Haberler</a>
          <a href="#galeri" onClick={() => setMobileMenuOpen(false)}>Galeri</a>
          <a href="#iletisim" onClick={() => setMobileMenuOpen(false)}>İletişim</a>
          <a href="/login">Giriş</a>
        </div>
      </div>

      {/* Üst Duyuru Banner — admin Settings: bannerEnabled + bannerImage + bannerLink + bannerText */}
      {content.bannerEnabled && content.bannerImage && (
        <section className="lv-banner-section">
          <div className="lv-banner-wrap">
            <a
              href={content.bannerLink || '#'}
              target={content.bannerLink && content.bannerLink.startsWith('http') ? '_blank' : '_self'}
              rel={content.bannerLink && content.bannerLink.startsWith('http') ? 'noopener noreferrer' : undefined}
              onClick={(e) => { if (!content.bannerLink) e.preventDefault(); }}
              className="lv-banner-card"
              data-cursor="hover"
            >
              <span className="lv-banner-badge">Duyuru</span>
              <span className="lv-banner-arrow" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                </svg>
              </span>
              <img
                src={content.bannerImage}
                alt={content.bannerText || 'Duyuru'}
                className="lv-banner-img"
                loading="eager"
                decoding="async"
              />
              {content.bannerText && (
                <div className="lv-banner-text">{content.bannerText}</div>
              )}
            </a>
          </div>
        </section>
      )}

      {/* Hero */}
      {content.sections?.hero !== false && (
        <section className="lv-hero" id="hero">
          <div
            className={`lv-hero-bg ${content.heroImage ? 'has-image' : ''}`}
            style={content.heroImage ? { '--lv-hero-image': `url(${content.heroImage})` } : undefined}
          />
          <div className="lv-hero-grid" />

          <div className="lv-hero-content">
            <div className="lv-hero-eyebrow">Yeniden Refah Partisi · Elazığ İl Teşkilatı</div>
            <div className="lv-hero-row">
              <div />
              <div className="lv-hero-actions">
                <a href="#basvuru" className="lv-btn-primary" data-magnetic data-cursor="hover">
                  {content.heroCtaText || DEFAULTS.heroCtaText}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                  </svg>
                </a>
                <a href="#vizyon" className="lv-btn-ghost" data-magnetic data-cursor="hover">Vizyonumuz</a>
              </div>
            </div>
          </div>
          <div className="lv-hero-scroll">Aşağı kaydır</div>
        </section>
      )}

      {/* Stats */}
      {content.sections?.stats !== false && (
        <section className="lv-stats" data-reveal>
          <div className="lv-stats-grid">
            {(content.stats || DEFAULTS.stats).map((s, i) => (
              <div className="lv-stat" key={i}>
                <div
                  className="lv-stat-num"
                  data-counter
                  data-target={s.value || '0'}
                  data-suffix={s.suffix || ''}
                >0</div>
                <div className="lv-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hakkımızda — light editorial */}
      {content.sections?.about !== false && (content.aboutContent || content.aboutTitle) && (
        <section className="lv-light-section" id="hakkimizda" data-reveal>
          <div className="lv-section-head" style={{ marginBottom: 40 }}>
            <div>
              <div className="lv-section-eyebrow">Biz kimiz</div>
              <h2 className="lv-section-title">{content.aboutTitle || 'Hakkımızda'}</h2>
            </div>
          </div>
          <div className="lv-about-grid">
            <div className="lv-about-body">
              {(content.aboutContent || '').split(/\n+/).filter(Boolean).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            {content.aboutImage && (
              <div className="lv-about-image-wrap">
                <div className="lv-about-image" style={{ backgroundImage: `url(${content.aboutImage})` }} />
                <span className="lv-about-image-meta">YRP Elazığ</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Vision sticky scroll */}
      {content.sections?.vision !== false && (
        <section className="lv-vision" id="vizyon">
          <div className="lv-vision-track">
            <div className="lv-vision-sticky">
              <div className="lv-vision-images">
                {(content.visionPanels || []).map((p, i) => (
                  <div
                    key={i}
                    className="lv-vision-image"
                    data-panel-idx={i}
                    data-has-image={p.image ? 'true' : undefined}
                    style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
                  />
                ))}
              </div>

              <div className="lv-vision-header">
                <div className="label">{content.visionTitle || 'Vizyonumuz'}</div>
                <div className="step">
                  <em id="lv-vision-step">01</em> &nbsp;/&nbsp; {String((content.visionPanels || []).length || 4).padStart(2, '0')}
                </div>
              </div>

              <div className="lv-vision-content">
                {(content.visionPanels || []).map((p, i) => (
                  <div
                    key={i}
                    className="lv-vision-panel"
                    data-panel-idx={i}
                  >
                    <div className="lv-vision-kicker">{p.kicker || `${i + 1}. ilke`}</div>
                    <h3>{renderItalicTitle(p.title)}</h3>
                    <p>{p.body}</p>
                  </div>
                ))}
              </div>

              <div className="lv-vision-footer">
                <div className="lv-vision-progress-bar" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Yönetim Kadromuz (Liderler) — İl Başkanı + Divan + İl Yönetimi gruplu */}
      {content.sections?.leaders !== false && leaders.length > 0 && (
        <section className="lv-light-section alt" id="liderler" data-reveal>
          <div className="lv-section-head">
            <div>
              <div className="lv-section-eyebrow">Yönetim</div>
              <h2 className="lv-section-title">
                {renderItalicTitle(content.leadersTitle || '{italic:Yönetim} Kadromuz')}
              </h2>
            </div>
            <p className="lv-section-sub">
              İl başkanı, divan ve il yönetim kurulu — Elazığ teşkilatımız.
            </p>
          </div>

          {/* Grup 1 — İl Başkanı (editorial: portre + yan bilgi) */}
          {leaders.filter((m) => m._group === 'ilBaskani').length > 0 && (
            <div className="lv-leader-group">
              <div className="lv-leader-group-head">
                İl Başkanı
                <span className="count">01</span>
              </div>
              {leaders.filter((m) => m._group === 'ilBaskani').map((m) => (
                <div className="lv-president-grid" key={m.id}>
                  <div
                    className="lv-president-portrait"
                    data-cursor="hover"
                    onClick={() => setOpenLeader(m)}
                    style={m.photo ? { backgroundImage: `url(${m.photo})` } : undefined}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenLeader(m); } }}
                    aria-label={`${m.name} özgeçmişini aç`}
                  />
                  <div className="lv-president-info">
                    <div className="lv-president-eyebrow">İl Başkanı</div>
                    <h3 className="lv-president-name">{m.name}</h3>
                    {m.position && <p className="lv-president-role">{m.position}</p>}
                    {m.region && (
                      <span className="lv-president-region">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {m.region}
                      </span>
                    )}
                    <div className="lv-president-bio-card">
                      <div className="lv-president-bio-card-label">Özgeçmiş</div>
                      {m.biography && String(m.biography).trim() ? (
                        <p className="lv-president-bio">{String(m.biography).trim()}</p>
                      ) : (
                        <p className="lv-president-bio-empty">Henüz özgeçmiş bilgisi eklenmemiş.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="lv-president-cta"
                      data-cursor="hover"
                      onClick={() => setOpenLeader(m)}
                    >
                      Tam Özgeçmiş
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grup 2 — Divan */}
          {leaders.filter((m) => m._group === 'divan').length > 0 && (
            <div className="lv-leader-group">
              <div className="lv-leader-group-head">
                Divan Üyeleri
                <span className="count">{String(leaders.filter((m) => m._group === 'divan').length).padStart(2, '0')}</span>
              </div>
              <div className="lv-leaders-grid">
                {leaders.filter((m) => m._group === 'divan').map((m) => (
                  <div className="lv-leader-card" key={m.id} data-cursor="hover" style={{ cursor: 'pointer' }} onClick={() => setOpenLeader(m)}>
                    <div className="lv-leader-photo" style={m.photo ? { backgroundImage: `url(${m.photo})` } : undefined} />
                    <div className="lv-leader-info">
                      <div className="lv-leader-name">{m.name}</div>
                      <div className="lv-leader-role">{m.position}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grup 3 — İl Yönetimi (daha küçük kartlar) */}
          {leaders.filter((m) => m._group === 'ilYonetim').length > 0 && (
            <div className="lv-leader-group" style={{ marginBottom: 0 }}>
              <div className="lv-leader-group-head">
                İl Yönetim Kurulu
                <span className="count">{String(leaders.filter((m) => m._group === 'ilYonetim').length).padStart(2, '0')}</span>
              </div>
              <div className="lv-leaders-grid lv-leaders-grid--sm">
                {leaders.filter((m) => m._group === 'ilYonetim').map((m) => (
                  <div className="lv-leader-card" key={m.id} data-cursor="hover" style={{ cursor: 'pointer' }} onClick={() => setOpenLeader(m)}>
                    <div className="lv-leader-photo" style={m.photo ? { backgroundImage: `url(${m.photo})` } : undefined} />
                    <div className="lv-leader-info">
                      <div className="lv-leader-name">{m.name}</div>
                      <div className="lv-leader-role">{m.position}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Galeri — landing_gallery */}
      {content.sections?.gallery !== false && gallery.length > 0 && (
        <section className="lv-light-section" id="galeri" data-reveal>
          <div className="lv-section-head" style={{ marginBottom: 40 }}>
            <div>
              <div className="lv-section-eyebrow">Galeri</div>
              <h2 className="lv-section-title">
                {renderItalicTitle('Sahadan {italic:kareler.}')}
              </h2>
            </div>
            <p className="lv-section-sub">Etkinlik, ziyaret ve programlardan seçmeler.</p>
          </div>
          <div style={{
            maxWidth: 1400, margin: '0 auto',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16,
          }}>
            {gallery.map((g, idx) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setOpenGalleryIdx(idx)}
                data-cursor="hover"
                style={{
                  display: 'block', border: 'none', padding: 0, cursor: 'pointer',
                  aspectRatio: '4/3',
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: 'var(--lv-paper-2)',
                  backgroundImage: g.image || g.url ? `url(${g.image || g.url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                title={g.title || ''}
                aria-label={g.title || 'Galeri görseli'}
              />
            ))}
          </div>
        </section>
      )}

      {/* News editorial */}
      {content.sections?.news !== false && news.length > 0 && (
        <section className="lv-news" id="haberler">
          <div className="lv-news-bg-stamp">basın</div>

          <div className="lv-section-head" data-reveal>
            <div>
              <div className="lv-section-eyebrow">Son haberler</div>
              <h2 className="lv-section-title">Sahadan, {renderItalicTitle('{italic:doğrudan.}')}</h2>
            </div>
            <p className="lv-section-sub">
              İlçe ziyaretleri, basın açıklamaları ve etkinliklerimizden seçmeler — her hafta güncellenir.
            </p>
          </div>

          <div className="lv-news-layout">
            {featuredNews && (
              <article
                className="lv-news-feature"
                data-cursor="text"
                onClick={() => setOpenNews(featuredNews)}
              >
                <div
                  className="lv-news-feature-image"
                  style={featuredNews.image ? { backgroundImage: `url(${featuredNews.image})` } : undefined}
                />
                <div className="lv-news-feature-body">
                  <div className="lv-news-feature-top">
                    <span className="lv-news-feature-tag">{featuredNews.tag || 'Haber'}</span>
                    <span className="lv-news-feature-date">
                      {fmtDate(featuredNews.publishedAt || featuredNews.date)}
                    </span>
                  </div>
                  <h3>{featuredNews.title}</h3>
                  <p className="lv-news-feature-lede">{featuredNews.lede || featuredNews.summary || ''}</p>
                  <span className="lv-news-feature-cta">
                    Haberi oku
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                    </svg>
                  </span>
                </div>
              </article>
            )}

            <div className="lv-news-list">
              {restNews.map((n) => (
                <article
                  key={n.id}
                  className="lv-news-row"
                  data-cursor="text"
                  onClick={() => setOpenNews(n)}
                >
                  <div
                    className="lv-news-row-img"
                    style={n.image ? { backgroundImage: `url(${n.image})` } : undefined}
                  />
                  <div>
                    <div className="lv-news-row-meta">
                      {fmtDate(n.publishedAt || n.date)}
                      <span className="lv-news-row-meta-dot" />
                      {n.tag || 'Haber'}
                    </div>
                    <h4>{n.title}</h4>
                  </div>
                  <div className="lv-news-row-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                    </svg>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* News detail (FLIP-style modal) */}
      {openNews && (
        <div className="lv-news-detail is-open" onClick={() => setOpenNews(null)}>
          <div
            className="lv-news-detail-card"
            style={{ position: 'absolute', inset: '5vh 5vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="lv-news-detail-image"
              style={openNews.image ? { backgroundImage: `url(${openNews.image})` } : undefined}
            />
            <button className="lv-news-detail-close" onClick={() => setOpenNews(null)} aria-label="Kapat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
            <div className="lv-news-detail-body">
              <span className="lv-news-detail-tag">{openNews.tag || 'Haber'}</span>
              <h2 className="lv-news-detail-title">{openNews.title}</h2>
              <p className="lv-news-detail-lede">{openNews.lede || openNews.summary || ''}</p>
            </div>
          </div>
        </div>
      )}

      {/* Seçim Sonuçları Özeti — featuredElectionId varsa */}
      {content.sections?.electionSummary !== false && election && election.election && (
        <section className="lv-light-section" id="secim-sonuclari" data-reveal>
          <div className="lv-section-head" style={{ marginBottom: 40 }}>
            <div>
              <div className="lv-section-eyebrow">Seçim sonuçları</div>
              <h2 className="lv-section-title">{election.election.name}</h2>
            </div>
            <p className="lv-section-sub">
              {election.openedBallotBoxes || 0} / {election.totalBallotBoxes || 0} sandık açıldı
            </p>
          </div>
          <div className="lv-election-summary">
            <div>
              <h3>{election.election.name}</h3>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', maxWidth: 480, margin: '8px 0 0' }}>
                {election.election.date
                  ? new Date(election.election.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                  : ''} · Anlık sonuçlar
              </p>
              <div className="stat-row">
                <div className="lv-election-stat">
                  <div className="val">{(election.openedBallotBoxes || 0).toLocaleString('tr-TR')}</div>
                  <div className="lbl">Açılan Sandık</div>
                </div>
                <div className="lv-election-stat">
                  <div className="val">{(election.usedVotes || 0).toLocaleString('tr-TR')}</div>
                  <div className="lbl">Oy Kullanan</div>
                </div>
                <div className="lv-election-stat">
                  <div className="val">{(election.validVotes || 0).toLocaleString('tr-TR')}</div>
                  <div className="lbl">Geçerli Oy</div>
                </div>
              </div>
              <div className="lv-cta-row">
                <a
                  href={`/public/election-results/${content.featuredElectionId}`}
                  className="lv-link-amber"
                  data-cursor="hover"
                >
                  Detaylı Sonuçlar
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                  </svg>
                </a>
              </div>
            </div>
            <div>
              {(election.cbResults || election.mvResults || []).slice(0, 5).map((r, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, color: '#F59E0B' }}>
                      %{r.percent}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(r.percent, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #E30613, #F59E0B)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Eğitim Materyalleri */}
      {training.length > 0 && (
        <section className="lv-light-section alt" id="egitim" data-reveal>
          <div className="lv-section-head">
            <div>
              <div className="lv-section-eyebrow">Eğitim</div>
              <h2 className="lv-section-title">
                {renderItalicTitle('{italic:Bilgi} paylaşımı.')}
              </h2>
            </div>
            <p className="lv-section-sub">
              Müşahit eğitim videoları, başvuru rehberleri ve teşkilat dökümanları.
            </p>
          </div>
          <div className="lv-training-grid">
            {training.map((t) => (
              <a
                key={t.id}
                href={t.video_url || t.pdf_url || '#'}
                target={t.video_url || t.pdf_url ? '_blank' : '_self'}
                rel="noopener"
                className="lv-training-card"
                data-cursor="hover"
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(227,6,19,0.10)', color: '#E30613',
                  display: 'grid', placeItems: 'center', fontSize: 20,
                }}>
                  {t.content_type === 'video' ? '▶' : t.content_type === 'pdf' ? '📄' : '📚'}
                </div>
                <h4>{t.title}</h4>
                {t.description && <p>{t.description}</p>}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Lider Bio modal — kart tıklayınca açılır */}
      {openLeader && (
        <div
          onClick={() => setOpenLeader(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(11,11,15,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '5vh 5vw',
            cursor: 'pointer',
          }}
        >
          <div
            className="lv-leader-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              background: 'white', color: 'var(--lv-ink)',
              borderRadius: 24, overflow: 'hidden',
              maxWidth: 900, width: '100%', height: '90vh', maxHeight: '90vh',
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
              boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
          >
            <button
              onClick={() => setOpenLeader(null)}
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 5,
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                display: 'grid', placeItems: 'center', fontSize: 20, lineHeight: 1,
              }}
              aria-label="Kapat"
              data-cursor="hover"
            >×</button>
            <div style={{
              backgroundColor: 'var(--lv-paper-2)',
              backgroundImage: openLeader.photo ? `url(${openLeader.photo})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center',
              minHeight: 240,
            }} />
            <div style={{
              display: 'flex', flexDirection: 'column',
              minHeight: 0, overflow: 'hidden',
            }}>
              <div style={{ padding: '32px 36px 16px', flexShrink: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                  textTransform: 'uppercase', color: 'var(--lv-red)', marginBottom: 8,
                }}>
                  {openLeader.position}
                </div>
                <h2 style={{
                  fontFamily: "'Fraunces', serif", fontWeight: 600,
                  fontSize: 'clamp(24px, 2.6vw, 34px)', lineHeight: 1.1,
                  letterSpacing: '-0.02em', margin: '0 0 8px',
                }}>
                  {openLeader.name}
                </h2>
                {openLeader.region && (
                  <div style={{ fontSize: 13, color: 'var(--lv-muted)', marginBottom: 4 }}>
                    {openLeader.region}
                  </div>
                )}
                {openLeader.muvefettislik && (
                  <div style={{ fontSize: 13, color: 'var(--lv-muted)' }}>
                    Müfettişlik: {openLeader.muvefettislik}
                  </div>
                )}
              </div>
              <div style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                padding: '20px 36px 32px',
                borderTop: '1px solid var(--lv-line)',
                fontSize: 15, lineHeight: 1.7, color: '#2A2A2F',
                whiteSpace: 'pre-wrap',
              }}>
                {openLeader.biography
                  ? openLeader.biography
                  : <span style={{ color: 'var(--lv-muted)', fontStyle: 'italic' }}>
                      Özgeçmiş henüz eklenmemiş.
                    </span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Galeri lightbox — okla gezilir */}
      {openGalleryIdx !== null && gallery[openGalleryIdx] && (() => {
        const g = gallery[openGalleryIdx];
        const src = g.image || g.url;
        const total = gallery.length;
        const goNext = (e) => { e?.stopPropagation(); setOpenGalleryIdx((i) => (i + 1) % total); };
        const goPrev = (e) => { e?.stopPropagation(); setOpenGalleryIdx((i) => (i - 1 + total) % total); };
        return (
          <div
            onClick={() => setOpenGalleryIdx(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 220,
              background: 'rgba(11,11,15,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenGalleryIdx(null)}
              aria-label="Kapat"
              data-cursor="hover"
              style={{
                position: 'absolute', top: 24, right: 24, zIndex: 5,
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
                color: 'white', fontSize: 22, lineHeight: 1, cursor: 'pointer',
                display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)',
              }}
            >×</button>
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Önceki"
                  data-cursor="hover"
                  style={{
                    position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
                    color: 'white', cursor: 'pointer',
                    display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Sonraki"
                  data-cursor="hover"
                  style={{
                    position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
                    color: 'white', cursor: 'pointer',
                    display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', maxWidth: '92vw', maxHeight: '88vh', cursor: 'default' }}
            >
              <img
                src={src}
                alt={g.title || ''}
                style={{
                  display: 'block', maxWidth: '92vw', maxHeight: '88vh',
                  width: 'auto', height: 'auto', objectFit: 'contain',
                  borderRadius: 12, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)',
                }}
              />
              {(g.title || g.description) && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  padding: '32px 24px 20px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
                  borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
                  color: 'white',
                }}>
                  {g.title && (
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                      {g.title}
                    </div>
                  )}
                  {g.description && (
                    <div style={{ fontSize: 13, opacity: 0.8 }}>{g.description}</div>
                  )}
                </div>
              )}
            </div>
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              padding: '8px 16px', borderRadius: 999,
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
              backdropFilter: 'blur(8px)',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.1em',
              color: 'white', fontVariantNumeric: 'tabular-nums',
            }}>
              {openGalleryIdx + 1} / {total}
            </div>
          </div>
        );
      })()}

      {/* Apply CTA — admin "applyCtaTitle/Text" alanlarından */}
      {content.sections?.applyCta !== false && (
        <section className="lv-cta-section" id="basvuru">
          <div className="lv-cta-bg" />
          <div className="lv-cta-content" data-reveal>
            <h2 className="lv-cta-title">
              {content.applyCtaTitle
                ? renderItalicTitle(content.applyCtaTitle)
                : <>Sen de {renderItalicTitle('{italic:aday ol.}')}</>}
            </h2>
            <p className="lv-cta-sub">{content.applyCtaText || DEFAULTS.applyCtaText}</p>
            <a
              href="/public/apply"
              className="lv-cta-btn"
              data-magnetic
              data-magnetic-strength="0.4"
              data-cursor="hover"
            >
              Başvuru Formu
              <span className="arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                </svg>
              </span>
            </a>
          </div>
        </section>
      )}

      {/* İletişim */}
      {content.sections?.contact !== false && (content.address || content.phone || content.email) && (
        <section className="lv-light-section" data-reveal>
          <div className="lv-section-head" style={{ marginBottom: 40 }}>
            <div>
              <div className="lv-section-eyebrow">İletişim</div>
              <h2 className="lv-section-title">
                {renderItalicTitle('Bize {italic:ulaşın.}')}
              </h2>
            </div>
            <p className="lv-section-sub">
              Görüş, öneri ve başvurularınız için il başkanlığı iletişim kanalları.
            </p>
          </div>
          <div className="lv-contact-grid">
            <div>
              {content.address && (
                <div className="lv-contact-item">
                  <div className="lv-contact-label">Adres</div>
                  <div className="lv-contact-value">{content.address}</div>
                </div>
              )}
              {content.phone && (
                <div className="lv-contact-item">
                  <div className="lv-contact-label">Telefon</div>
                  <a href={`tel:${content.phone}`} className="lv-contact-value" data-cursor="hover">{content.phone}</a>
                </div>
              )}
              {content.email && (
                <div className="lv-contact-item">
                  <div className="lv-contact-label">E-posta</div>
                  <a href={`mailto:${content.email}`} className="lv-contact-value" data-cursor="hover">{content.email}</a>
                </div>
              )}
            </div>
            <div>
              <div className="lv-contact-label" style={{ marginBottom: 12 }}>Sosyal Medya</div>
              <div className="lv-social-row">
                {content.social?.facebook && (
                  <a href={content.social.facebook} target="_blank" rel="noopener" className="lv-social-pill" data-cursor="hover">Facebook</a>
                )}
                {content.social?.instagram && (
                  <a href={content.social.instagram} target="_blank" rel="noopener" className="lv-social-pill" data-cursor="hover">Instagram</a>
                )}
                {content.social?.twitter && (
                  <a href={content.social.twitter} target="_blank" rel="noopener" className="lv-social-pill" data-cursor="hover">Twitter / X</a>
                )}
                {content.social?.youtube && (
                  <a href={content.social.youtube} target="_blank" rel="noopener" className="lv-social-pill" data-cursor="hover">YouTube</a>
                )}
                {!content.social?.facebook && !content.social?.instagram && !content.social?.twitter && !content.social?.youtube && (
                  <span style={{ fontSize: 13, color: 'var(--lv-muted)' }}>Henüz sosyal medya hesabı eklenmemiş.</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="lv-footer" id="iletisim-footer">
        <div>© {new Date().getFullYear()} YRP Elazığ İl Başkanlığı · Yeniden Refah Partisi</div>
        <div>
          {content.address && <span>{content.address}</span>}
          {content.phone && <span> · {content.phone}</span>}
          {content.email && <span> · {content.email}</span>}
        </div>
      </footer>
    </div>
  );
};

export default PublicLandingPage;
