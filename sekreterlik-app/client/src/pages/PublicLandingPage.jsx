import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import HeroSection from '../components/public/landing/HeroSection';
import AboutSection from '../components/public/landing/AboutSection';
import LeadersSection from '../components/public/landing/LeadersSection';
import NewsSection from '../components/public/landing/NewsSection';
import GallerySection from '../components/public/landing/GallerySection';
import ElectionSummarySection from '../components/public/landing/ElectionSummarySection';
import ApplyCTASection from '../components/public/landing/ApplyCTASection';
import ContactSection from '../components/public/landing/ContactSection';

/**
 * PublicLandingPage
 * Tek sayfa scroll landing. Mobile-first, dark mode auto-detect.
 * Veri kaynaklari:
 *   - landing_content/main     (anasayfa icerikleri)
 *   - members (collection)     (Il Baskani + Divan + Il Yonetimi)
 *   - election_results         (featuredElectionId veya son)
 *   - landing_news             (haberler / duyurular)
 *   - landing_gallery          (etkinlik galerisi)
 *
 * Kullanim (App.jsx tarafindan):
 *   <Route path="/" element={<PublicLandingPage />} />
 */

const DEFAULTS = {
  heroTitle: 'Yeniden Refah Partisi',
  heroSubtitle: 'Il Sekreterligi',
  heroImage: '',
  heroCtaText: 'Yonetime Basvur',

  aboutTitle: 'Hakkimizda',
  aboutContent: 'Icerik admin tarafindan eklenecek.',
  aboutImage: '',

  leadersEnabled: true,
  leadersTitle: 'Yonetim Kademesi',

  electionSummaryEnabled: true,
  featuredElectionId: '',

  applyCtaTitle: 'Yonetimde Siz Olun',
  applyCtaText: 'Partimizin yonetim kademelerinde gorev almak icin basvurun.',

  address: '',
  phone: '',
  email: '',
  social: {},

  sections: {
    hero: true,
    about: true,
    leaders: true,
    news: true,
    gallery: true,
    electionSummary: true,
    applyCta: true,
    contact: true,
  },
};

// Sadece halka acik alanlari pick et (TC/telefon/email/adres GOSTERILMEZ)
const safeMember = (m) => ({
  id: m.id,
  name: m.name || '',
  position: m.position || '',
  region: m.region || '',
  photo: m.photo || '',
  muvefettislik: m.muvefettislik || '',
  _group: m._group || '',
});

// Divan pozisyon oncelik sirasi (ust -> alt)
const DIVAN_ORDER = [
  'il sekreter', 'teskilat baskan', 'siyasi isler', 'mali isler',
  'tanitim medya', 'seçim isleri', 'secim isleri', 'sosyal isler', 'stk', 'hukuk',
  'egitim', 'ar-ge', 'yurt disi', 'engelliler', 'halkla iliskiler',
  'mahalli idareler', 'kadin kollari', 'genclik kollari',
];

const divanPriority = (pos) => {
  const p = (pos || '').toLocaleLowerCase('tr-TR');
  for (let i = 0; i < DIVAN_ORDER.length; i++) {
    if (p.includes(DIVAN_ORDER[i])) return i;
  }
  return 99;
};

const PublicLandingPage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [content, setContent] = useState(DEFAULTS);
  const [leaders, setLeaders] = useState([]);
  const [election, setElection] = useState(null);
  const [news, setNews] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(false);

  // Dark mode auto-detect
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mq.matches);
    const handler = (e) => setDarkMode(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    // Eski Safari fallback
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  // html.dark class toggle (Tailwind dark: utility icin)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Google Analytics 4 — content.gaMeasurementId varsa yükle
  useEffect(() => {
    const gaId = content?.gaMeasurementId;
    if (!gaId || !/^G-[A-Z0-9]+$/.test(gaId)) return;
    if (document.getElementById('ga4-script')) return;
    const s1 = document.createElement('script');
    s1.async = true;
    s1.id = 'ga4-script';
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(s1);
    const s2 = document.createElement('script');
    s2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
    document.head.appendChild(s2);
  }, [content?.gaMeasurementId]);

  // landing_content/main yukle
  useEffect(() => {
    const fetchAll = async () => {
      try {
        if (!db) {
          setLoading(false);
          return;
        }

        // 1) landing_content/main
        let merged = { ...DEFAULTS };
        try {
          const snap = await getDoc(doc(db, 'landing_content', 'main'));
          if (snap.exists()) {
            const data = snap.data() || {};
            merged = {
              ...DEFAULTS,
              ...data,
              social: { ...DEFAULTS.social, ...(data.social || {}) },
              sections: { ...DEFAULTS.sections, ...(data.sections || {}) },
            };
          }
        } catch (err) {
          console.warn('landing_content/main yuklenemedi:', err.message);
        }
        setContent(merged);

        // 2) Liderler: Il Baskani + Divan + Il Yonetimi (3 grup, sirali)
        if (merged.sections?.leaders !== false && merged.leadersEnabled !== false) {
          try {
            const snap = await getDocs(collection(db, 'members'));
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // 1. Il Baskani (Türkçe karakter normalize edilerek arama)
            const normalizeTr = (s) => (s || '').toLocaleLowerCase('tr-TR')
              .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o')
              .replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ğ/g, 'g');
            const ilBaskani = all.filter(m => {
              const pos = normalizeTr(m.position);
              return typeof m.position === 'string' &&
                (pos.includes('il baskan') || pos === 'il baskani');
            });

            // 2. Divan uyeleri (region=Divan), pozisyon onceligi sirali
            const divan = all
              .filter(m =>
                typeof m.region === 'string' &&
                normalizeTr(m.region).includes('divan') &&
                !ilBaskani.find(ib => ib.id === m.id)
              )
              .sort((a, b) => {
                const pa = divanPriority(a.position);
                const pb = divanPriority(b.position);
                if (pa !== pb) return pa - pb;
                return (a.name || '').localeCompare(b.name || '', 'tr');
              });

            // 3. Il Yonetimi uyeleri (region "il yonetim" veya "il yönet")
            const used = new Set([...ilBaskani.map(m => m.id), ...divan.map(m => m.id)]);
            const ilYonetim = all
              .filter(m =>
                !used.has(m.id) &&
                typeof m.region === 'string' &&
                normalizeTr(m.region).includes('il yonetim')
              )
              .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

            // Her uyeye _group ekle
            const tagged = [
              ...ilBaskani.map(m => ({ ...m, _group: 'ilBaskani' })),
              ...divan.map(m => ({ ...m, _group: 'divan' })),
              ...ilYonetim.map(m => ({ ...m, _group: 'ilYonetim' })),
            ];

            setLeaders(tagged.map(safeMember));
          } catch (err) {
            console.warn('Liderler yuklenemedi:', err.message);
          }
        }

        // 3) Secim sonucu
        if (merged.sections?.electionSummary !== false && merged.electionSummaryEnabled !== false) {
          try {
            if (merged.featuredElectionId) {
              // Once election_results koleksiyonunda ara (dogrudan id ile)
              let found = null;
              try {
                const elSnap = await getDoc(doc(db, 'election_results', merged.featuredElectionId));
                if (elSnap.exists()) {
                  found = { id: elSnap.id, ...elSnap.data() };
                }
              } catch {}
              // Bulunamazsa: featuredElectionId 'elections' koleksiyonundan secilmis olabilir
              // election_results'ta electionId veya election_id alanina esitlikle ara
              if (!found) {
                try {
                  const allResults = await getDocs(collection(db, 'election_results'));
                  const match = allResults.docs.find(d => {
                    const data = d.data();
                    return String(data.electionId || data.election_id || data.election) === String(merged.featuredElectionId);
                  });
                  if (match) found = { id: match.id, ...match.data() };
                } catch {}
              }
              if (found) setElection(found);
            } else {
              // En son eklenen (created_at desc, yoksa date desc)
              let loaded = null;
              try {
                const q1 = query(collection(db, 'election_results'), orderBy('created_at', 'desc'), limit(1));
                const s1 = await getDocs(q1);
                if (!s1.empty) {
                  const d = s1.docs[0];
                  loaded = { id: d.id, ...d.data() };
                }
              } catch {
                // orderBy hata verirse basit getDocs
                const s2 = await getDocs(collection(db, 'election_results'));
                if (!s2.empty) {
                  const arr = s2.docs.map(d => ({ id: d.id, ...d.data() }));
                  arr.sort((a, b) => {
                    const da = new Date(a.date || a.election_date || 0).getTime();
                    const dbb = new Date(b.date || b.election_date || 0).getTime();
                    return dbb - da;
                  });
                  loaded = arr[0] || null;
                }
              }
              if (loaded) setElection(loaded);
            }
          } catch (err) {
            console.warn('Secim sonucu yuklenemedi:', err.message);
          }
        }

        // 4) Haberler (landing_news koleksiyonu)
        if (merged.sections?.news !== false) {
          try {
            const q = query(collection(db, 'landing_news'), orderBy('date', 'desc'), limit(6));
            const snap = await getDocs(q);
            setNews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (err) {
            try {
              const snap = await getDocs(collection(db, 'landing_news'));
              const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
              setNews(arr.slice(0, 6));
            } catch {
              setNews([]);
            }
          }
        }

        // 5) Galeri (landing_gallery koleksiyonu)
        if (merged.sections?.gallery !== false) {
          try {
            const q = query(collection(db, 'landing_gallery'), orderBy('date', 'desc'), limit(12));
            const snap = await getDocs(q);
            setGallery(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (err) {
            try {
              const snap = await getDocs(collection(db, 'landing_gallery'));
              setGallery(snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 12));
            } catch {
              setGallery([]);
            }
          }
        }
      } catch (err) {
        console.error('PublicLandingPage fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Loading bloğu kaldırıldı — içerik DEFAULTS ile anında render, fetch geldikçe güncellenir
  if (false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-indigo-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-400">Yukleniyor...</p>
        </div>
      </div>
    );
  }

  const s = content.sections || {};

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <PublicHeader appName={content.appName} />

      <main className="flex-1">
        {s.hero !== false && (
          <HeroSection
            title={content.heroTitle || DEFAULTS.heroTitle}
            subtitle={content.heroSubtitle || DEFAULTS.heroSubtitle}
            image={content.heroImage || ''}
            ctaText={content.heroCtaText || DEFAULTS.heroCtaText}
            ctaLink="/public/apply"
          />
        )}

        {s.about !== false && (
          <AboutSection
            title={content.aboutTitle || DEFAULTS.aboutTitle}
            content={content.aboutContent || ''}
            image={content.aboutImage || ''}
          />
        )}

        {s.news !== false && (
          <NewsSection news={news} />
        )}

        {s.gallery !== false && (
          <GallerySection gallery={gallery} />
        )}

        {s.electionSummary !== false && (
          <ElectionSummarySection electionResult={election} />
        )}

        {s.applyCta !== false && (
          <ApplyCTASection
            title={content.applyCtaTitle || DEFAULTS.applyCtaTitle}
            text={content.applyCtaText || DEFAULTS.applyCtaText}
            buttonText="Basvur"
            buttonLink="/public/apply"
          />
        )}

        {s.leaders !== false && (
          <LeadersSection
            members={leaders}
            title={content.leadersTitle || DEFAULTS.leadersTitle}
          />
        )}

        {s.contact !== false && (
          <ContactSection
            address={content.address || ''}
            phone={content.phone || ''}
            email={content.email || ''}
            social={content.social || {}}
          />
        )}
      </main>

      <PublicFooter
        appName={content.appName}
        address={content.address || ''}
        phone={content.phone || ''}
        email={content.email || ''}
        social={content.social || {}}
      />
    </div>
  );
};

export default PublicLandingPage;
