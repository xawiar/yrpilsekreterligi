import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import HeroSection from '../components/public/landing/HeroSection';
import AboutSection from '../components/public/landing/AboutSection';
import LeadersSection from '../components/public/landing/LeadersSection';
import ElectionSummarySection from '../components/public/landing/ElectionSummarySection';
import ApplyCTASection from '../components/public/landing/ApplyCTASection';
import ContactSection from '../components/public/landing/ContactSection';

/**
 * PublicLandingPage
 * Tek sayfa scroll landing. Mobile-first, dark mode auto-detect.
 * Veri kaynaklari:
 *   - landing_content/main     (anasayfa icerikleri)
 *   - members (collection)     (Il Baskani + region "divan" icerenler)
 *   - election_results         (featuredElectionId veya son)
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
});

const PublicLandingPage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [content, setContent] = useState(DEFAULTS);
  const [leaders, setLeaders] = useState([]);
  const [election, setElection] = useState(null);
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

        // 2) Liderler (Il Baskani + region "divan")
        if (merged.sections?.leaders !== false && merged.leadersEnabled !== false) {
          try {
            const snap = await getDocs(collection(db, 'members'));
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const ilBaskani = all.filter(m =>
              typeof m.position === 'string' &&
              m.position.toLocaleLowerCase('tr-TR').includes('baskan')
            );
            const divan = all.filter(m =>
              typeof m.region === 'string' &&
              m.region.toLocaleLowerCase('tr-TR').includes('divan')
            );

            // Unique + sirala: il baskani once, sonra divan (ada gore)
            const ids = new Set();
            const list = [];
            for (const m of ilBaskani) {
              if (!ids.has(m.id)) { ids.add(m.id); list.push(m); }
            }
            for (const m of divan) {
              if (!ids.has(m.id)) { ids.add(m.id); list.push(m); }
            }

            // Safe pick
            setLeaders(list.map(safeMember));
          } catch (err) {
            console.warn('Liderler yuklenemedi:', err.message);
          }
        }

        // 3) Secim sonucu
        if (merged.sections?.electionSummary !== false && merged.electionSummaryEnabled !== false) {
          try {
            if (merged.featuredElectionId) {
              const elSnap = await getDoc(doc(db, 'election_results', merged.featuredElectionId));
              if (elSnap.exists()) {
                setElection({ id: elSnap.id, ...elSnap.data() });
              }
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

        {s.leaders !== false && leaders.length > 0 && (
          <LeadersSection
            members={leaders}
            title={content.leadersTitle || DEFAULTS.leadersTitle}
          />
        )}

        {s.electionSummary !== false && election && (
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

        {s.contact !== false && (
          <ContactSection
            address={content.address || ''}
            phone={content.phone || ''}
            email={content.email || ''}
            social={content.social || {}}
          />
        )}
      </main>

      <PublicFooter appName={content.appName} />
    </div>
  );
};

export default PublicLandingPage;
