import React, { useEffect, useState, useCallback, useRef } from 'react';
import { collection, doc, getDoc, getDocs, query, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
// Anonim push banner artık app-shell'de (AnonymousPushBanner) — burada import yok

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
import TrainingSection from '../components/public/landing/TrainingSection';
import LandingBridge from '../components/public/landing/LandingBridge';

import '../styles/landing-animations.css';
import { initLandingAnimations } from '../utils/landingAnimations';

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
  chairmanPhoto: '',
  chairmanName: '',
  chairmanTitle: 'Genel Başkan',

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
  biography: m.biography || '',
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

  // Anonim push aboneligi banner state
  // Push state'leri kaldırıldı — AnonymousPushBanner app-shell'de yönetiyor

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
            const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Türkçe normalize (hem dedupe hem filtreleme için)
            const normalizeTr = (s) => (s || '').toLocaleLowerCase('tr-TR')
              .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o')
              .replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ğ/g, 'g');

            // Duplicate üyeleri ele: TC varsa TC, yoksa normalize(name+position+region)
            const seen = new Map();
            const all = [];
            for (const m of raw) {
              const tc = String(m.tc || m.tcNo || '').trim();
              const key = tc && tc.length >= 10
                ? `tc:${tc}`
                : `np:${normalizeTr(m.name)}|${normalizeTr(m.position)}|${normalizeTr(m.region)}`;
              if (seen.has(key)) continue;
              seen.set(key, true);
              all.push(m);
            }
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

        // 3) Secim sonucu — public_election_cache'den hazir aggregate oku
        //    Cache yoksa fallback: election_results'tan aggregate et
        if (merged.sections?.electionSummary !== false && merged.electionSummaryEnabled !== false) {
          try {
            let cacheLoaded = false;

            // Cloud Function API'den seçim sonuçlarını çek (rules bypass, CDN cache)
            try {
              const eid = merged.featuredElectionId;
              const apiUrl = eid ? '/api/election-results?id=' + encodeURIComponent(eid) : '/api/election-results';
              const apiResp = await fetch(apiUrl);
              if (apiResp.ok) {
                const apiJson = await apiResp.json();
                if (apiJson.success && apiJson.data) {
                  const d = apiJson.data;
                  // Eger tek secim detayi geldiyse
                  if (d.election) {
                    const allResults = [
                      ...(d.cbResults || []),
                      ...(d.mvResults || []),
                      ...(d.mayorResults || []),
                    ];
                    // En dolu sonucu bul
                    let primaryResults = d.cbResults && d.cbResults.length > 0 ? d.cbResults : (d.mvResults && d.mvResults.length > 0 ? d.mvResults : d.mayorResults || []);
                    setElection({
                      id: d.election.id || eid,
                      title: d.election.name || d.election.title || 'Secim Sonuclari',
                      date: d.election.date || '',
                      results: primaryResults,
                      total_votes: primaryResults.reduce((s, r) => s + (r.votes || 0), 0),
                      total_ballot_boxes: d.totalBallotBoxes || 0,
                      opened_ballot_boxes: d.openedBallotBoxes || 0,
                      participation_rate: d.totalVoters > 0 ? parseFloat(((d.usedVotes / d.totalVoters) * 100).toFixed(2)) : null,
                      _fromApi: true,
                    });
                    cacheLoaded = true;
                  }
                  // Eger secim listesi geldiyse, ilk secimin detayini cek
                  if (!cacheLoaded && Array.isArray(apiJson.data) && apiJson.data.length > 0) {
                    const firstId = apiJson.data[0].id;
                    const detailResp = await fetch('/api/election-results?id=' + encodeURIComponent(firstId));
                    if (detailResp.ok) {
                      const detailJson = await detailResp.json();
                      if (detailJson.success && detailJson.data && detailJson.data.election) {
                        const dd = detailJson.data;
                        let pr = dd.cbResults && dd.cbResults.length > 0 ? dd.cbResults : (dd.mvResults && dd.mvResults.length > 0 ? dd.mvResults : dd.mayorResults || []);
                        setElection({
                          id: dd.election.id || firstId,
                          title: dd.election.name || 'Secim Sonuclari',
                          date: dd.election.date || '',
                          results: pr,
                          total_votes: pr.reduce((s, r) => s + (r.votes || 0), 0),
                          total_ballot_boxes: dd.totalBallotBoxes || 0,
                          opened_ballot_boxes: dd.openedBallotBoxes || 0,
                          participation_rate: dd.totalVoters > 0 ? parseFloat(((dd.usedVotes / dd.totalVoters) * 100).toFixed(2)) : null,
                          _fromApi: true,
                        });
                        cacheLoaded = true;
                      }
                    }
                  }
                }
              }
            } catch (apiErr) {
              // API hatasi — sessiz devam, fallback'e dusecek
            }

            // Oncelik 2: Fallback — election_results koleksiyonundan aggregate et
            if (!cacheLoaded) {
              const aggregateResults = (docs, electionMeta = {}) => {
                const voteFields = ['cb_votes', 'mv_votes', 'mayor_votes',
                  'provincial_assembly_votes', 'municipal_council_votes'];
                const totals = {};
                let pickedField = null;
                for (const field of voteFields) {
                  let fieldTotal = {};
                  let hasData = false;
                  docs.forEach(d => {
                    const data = d.data ? d.data() : d;
                    const votes = data[field];
                    if (votes && typeof votes === 'object') {
                      Object.entries(votes).forEach(([key, val]) => {
                        const n = parseInt(val) || 0;
                        if (n > 0) {
                          fieldTotal[key] = (fieldTotal[key] || 0) + n;
                          hasData = true;
                        }
                      });
                    }
                  });
                  if (hasData && !pickedField) {
                    Object.assign(totals, fieldTotal);
                    pickedField = field;
                  }
                }
                if (Object.keys(totals).length === 0) return null;
                const results = Object.entries(totals)
                  .map(([name, votes]) => ({ name, votes }))
                  .sort((a, b) => b.votes - a.votes);
                return {
                  ...electionMeta,
                  results,
                  total_votes: results.reduce((s, r) => s + r.votes, 0),
                  total_ballot_boxes: docs.length,
                };
              };

              // Seçim sonucu sadece admin Settings'te featuredElectionId açıkça
              // seçtiyse gösterilir. Boş ise public sayfada hiç görünmez.
              // (Eskiden boş ise otomatik en son seçim yükleniyordu — admin
              // kontrolünü kırıyordu, kaldırıldı.)
              if (merged.featuredElectionId) {
                let electionMeta = {};
                try {
                  const eSnap = await getDoc(doc(db, 'elections', merged.featuredElectionId));
                  if (eSnap.exists()) {
                    const d = eSnap.data() || {};
                    electionMeta = {
                      id: eSnap.id,
                      title: d.name || d.title || 'Secim Sonuclari',
                      date: d.date || d.election_date || '',
                    };
                  }
                } catch {}

                try {
                  const allResults = await getDocs(collection(db, 'election_results'));
                  const matched = allResults.docs.filter(d => {
                    const data = d.data();
                    return String(data.electionId || data.election_id || data.election) === String(merged.featuredElectionId);
                  });
                  if (matched.length > 0) {
                    const agg = aggregateResults(matched, electionMeta);
                    if (agg) setElection(agg);
                  } else {
                    const single = await getDoc(doc(db, 'election_results', merged.featuredElectionId));
                    if (single.exists()) {
                      setElection({ id: single.id, ...single.data(), ...electionMeta });
                    }
                  }
                } catch (err) {
                  console.warn('Election aggregate failed:', err.message);
                }
              } else {
                // featuredElectionId boş → public'te seçim sonucu gösterme
                setElection(null);
              }
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

  // Secim sonuclari real-time listener — public_election_cache'i dinle
  // Cache yoksa election_results'a fallback (30sn polling)
  useEffect(() => {
    if (!db) return;
    const featuredId = content?.featuredElectionId;

    // Cache'den hizli refresh
    const refreshFromCache = async () => {
      if (!featuredId) return false;
      try {
        const cacheSnap = await getDoc(doc(db, 'public_election_cache', featuredId));
        if (cacheSnap.exists()) {
          const cacheData = cacheSnap.data();
          setElection({
            id: cacheData.electionId || cacheSnap.id,
            title: cacheData.electionName || 'Secim Sonuclari',
            date: cacheData.electionDate || '',
            results: cacheData.results || [],
            total_votes: cacheData.total_votes || 0,
            total_ballot_boxes: cacheData.total_ballot_boxes || cacheData.totalBallotBoxes || 0,
            participation_rate: cacheData.participation_rate || null,
            _fromCache: true,
          });
          return true;
        }
      } catch {}
      return false;
    };

    // aggregateResults — fallback icin
    const aggregateResults = (docs, electionMeta = {}) => {
      const voteFields = ['cb_votes', 'mv_votes', 'mayor_votes',
        'provincial_assembly_votes', 'municipal_council_votes'];
      const totals = {};
      let pickedField = null;
      for (const field of voteFields) {
        let fieldTotal = {};
        let hasData = false;
        docs.forEach(d => {
          const data = d.data ? d.data() : d;
          const votes = data[field];
          if (votes && typeof votes === 'object') {
            Object.entries(votes).forEach(([key, val]) => {
              const n = parseInt(val) || 0;
              if (n > 0) {
                fieldTotal[key] = (fieldTotal[key] || 0) + n;
                hasData = true;
              }
            });
          }
        });
        if (hasData && !pickedField) {
          Object.assign(totals, fieldTotal);
          pickedField = field;
        }
      }
      if (Object.keys(totals).length === 0) return null;
      const results = Object.entries(totals)
        .map(([name, votes]) => ({ name, votes }))
        .sort((a, b) => b.votes - a.votes);
      return {
        ...electionMeta,
        results,
        total_votes: results.reduce((s, r) => s + r.votes, 0),
        total_ballot_boxes: docs.length,
      };
    };

    const refreshElection = async (electionMeta) => {
      // Oncelik: cache'den oku
      const fromCache = await refreshFromCache();
      if (fromCache) return;

      // Fallback: election_results'tan aggregate
      try {
        if (featuredId) {
          const allResults = await getDocs(collection(db, 'election_results'));
          const matched = allResults.docs.filter(d => {
            const data = d.data();
            return String(data.electionId || data.election_id || data.election) === String(featuredId);
          });
          if (matched.length > 0) {
            const agg = aggregateResults(matched, electionMeta);
            if (agg) setElection(agg);
          }
        } else {
          let loaded = null;
          try {
            const q1 = query(collection(db, 'election_results'), orderBy('created_at', 'desc'), limit(1));
            const s1 = await getDocs(q1);
            if (!s1.empty) {
              const d = s1.docs[0];
              loaded = { id: d.id, ...d.data() };
            }
          } catch {
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
        console.warn('Election polling refresh error:', err.message);
      }
    };

    let electionMeta = {};
    let unsubscribe = null;
    let pollingInterval = null;
    let cancelled = false;

    // featuredId boş ise listener/polling kurma — public sayfada
    // hiç seçim sonucu gösterilmesin (admin Settings'te seçmeden eski
    // davranış otomatik en son sonucu gösteriyordu, kaldırıldı).
    if (!featuredId) {
      setElection(null);
      return () => { cancelled = true; };
    }

    const setup = async () => {
      try {
        const eSnap = await getDoc(doc(db, 'elections', featuredId));
        if (eSnap.exists()) {
          const d = eSnap.data() || {};
          electionMeta = {
            id: eSnap.id,
            title: d.name || d.title || 'Secim Sonuclari',
            date: d.date || d.election_date || '',
          };
        }
      } catch {}

      if (cancelled) return;

      // Oncelik: landing_content/main dokümanini dinle (electionCache alani)
      // Admin "Sonuçları Yayınla" butonuna bastığında bu doc güncellenir.
      // TEK doc dinleniyor — fan-out yok. 1000 ziyaretçi olsa da Firestore
      // aynı doc'u tek aboneliğe push'lar.
      try {
        const mainDocRef = doc(db, 'landing_content', 'main');
        let initialCacheLoad = true;
        unsubscribe = onSnapshot(mainDocRef, (snap) => {
          if (initialCacheLoad) {
            initialCacheLoad = false;
            return;
          }
          if (snap.exists() && snap.data().electionCache) {
            const cacheData = snap.data().electionCache;
            setElection({
              id: cacheData.electionId || snap.data().featuredElectionId,
              title: cacheData.electionName || 'Secim Sonuclari',
              date: cacheData.electionDate || '',
              results: cacheData.results || [],
              total_votes: cacheData.total_votes || 0,
              total_ballot_boxes: cacheData.total_ballot_boxes || cacheData.totalBallotBoxes || 0,
              participation_rate: cacheData.participation_rate || null,
              _fromCache: true,
            });
          }
        }, () => {
          // Cache listener fail — election_results 2000 doc fan-out'u
          // YERINE düşük frekanslı polling. 1000 ziyaretçi senaryosunda
          // election_results'ı dinlemek 2M push event/sn yaratıyordu.
          if (!pollingInterval && !cancelled) {
            pollingInterval = setInterval(
              () => refreshElection(electionMeta), 30000,
            );
          }
        });
        return;
      } catch {
        // Cache listener kurulamadi, fallback polling
        if (!cancelled) {
          pollingInterval = setInterval(
            () => refreshElection(electionMeta), 30000,
          );
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [content?.featuredElectionId]);

  // ===== Landing animasyonları — scroll reveal, magnetic, tilt, counter, parallax =====
  useEffect(() => {
    // Sayfa render olduktan sonra observer'ları init et (timeout ile DOM hazır olsun)
    const t = setTimeout(() => {
      window.__landingAnimationsCleanup = initLandingAnimations(document);
    }, 100);
    return () => {
      clearTimeout(t);
      if (typeof window.__landingAnimationsCleanup === 'function') {
        window.__landingAnimationsCleanup();
        window.__landingAnimationsCleanup = null;
      }
    };
  }, []);

  // Anonim push akışı app-shell'e (AnonymousPushBanner) taşındı

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
    <div className="landing-animated landing-snap min-h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      {/* Scroll progress bar */}
      <div className="landing-progress" aria-hidden="true">
        <div className="landing-progress-fill" />
      </div>

      <PublicHeader appName={content.appName} />

      <main className="flex-1">
        {/* Üst duyuru banner'ı — full-width section, kurumsal palette,
            diğer landing section'larıyla aynı geçiş tarzında */}
        {content.bannerEnabled && content.bannerImage && (
          <section className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 pt-24 sm:pt-28 pb-12 sm:pb-16 overflow-hidden">
            {/* Dekoratif arka plan dokusu — hero ile aynı dil */}
            <svg
              className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              viewBox="0 0 1200 400"
              aria-hidden="true"
            >
              <defs>
                <pattern id="banner-grid" width="64" height="64" patternUnits="userSpaceOnUse">
                  <path d="M 64 0 L 0 0 0 64" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="1200" height="400" fill="url(#banner-grid)" />
            </svg>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <a
                href={content.bannerLink || '#'}
                target={content.bannerLink && content.bannerLink.startsWith('http') ? '_blank' : '_self'}
                rel={content.bannerLink && content.bannerLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="block relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20 hover:ring-white/40 transition-all"
                onClick={(e) => { if (!content.bannerLink) e.preventDefault(); }}
              >
                <img
                  src={content.bannerImage}
                  alt={content.bannerText || 'Duyuru'}
                  className="w-full h-auto block"
                  loading="eager"
                  decoding="async"
                />
                {content.bannerText && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-6 px-4 sm:px-8">
                    <p className="text-white text-base sm:text-2xl md:text-3xl font-bold drop-shadow-lg max-w-4xl">
                      {content.bannerText}
                    </p>
                  </div>
                )}
              </a>
            </div>

            {/* Alt geçiş dalgası — hero/about pattern'i ile uyumlu */}
            <svg
              className="absolute bottom-0 left-0 right-0 w-full h-12 sm:h-16 text-white dark:text-gray-900"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              viewBox="0 0 1440 100"
              aria-hidden="true"
            >
              <path
                d="M0,60 C240,100 480,20 720,40 C960,60 1200,100 1440,60 L1440,100 L0,100 Z"
                fill="currentColor"
              />
            </svg>
          </section>
        )}

        {s.hero !== false && (
          <HeroSection
            title={content.heroTitle || DEFAULTS.heroTitle}
            image={content.heroImage || ''}
            ctaText={content.heroCtaText || DEFAULTS.heroCtaText}
            ctaLink="/public/apply"
            chairmanPhoto={content.chairmanPhoto || ''}
            chairmanName={content.chairmanName || ''}
            chairmanTitle={content.chairmanTitle || DEFAULTS.chairmanTitle}
            social={content.social || {}}
          />
        )}

        {/* Hero alt dalgası HeroSection içinde var; Hero → About arası ek bridge gerekmez */}

        {s.about !== false && (
          <AboutSection
            title={content.aboutTitle || DEFAULTS.aboutTitle}
            content={content.aboutContent || ''}
            image={content.aboutImage || ''}
          />
        )}

        {/* About (bg-white) → News (bg-gray-50) bridge */}
        <LandingBridge fillColor="#f9fafb" variant={2} height={80} />

        {s.news !== false && (
          <NewsSection news={news} />
        )}

        {/* News (gray-50) → Gallery (bg-white) bridge */}
        <LandingBridge fillColor="#ffffff" variant={3} height={80} />

        {s.gallery !== false && (
          <GallerySection gallery={gallery} />
        )}

        {/* Gallery (white) → Training bridge */}
        <LandingBridge fillColor="#f9fafb" variant={4} height={80} />

        {/* Eğitim ve Bilgilendirme — admin public materyal yüklediyse görünür */}
        <TrainingSection />


        {/* Seçim özeti yalnızca admin Settings'te featuredElectionId
            seçtiyse VE veri yüklendiyse görünür. Aksi halde tamamen gizli. */}
        {s.electionSummary !== false && election && content.featuredElectionId && (
          <>
            <ElectionSummarySection electionResult={election} />
            {/* Detaylı sonuçlar sayfasına CTA — sandık bazlı kırılım, filtreler */}
            <section className="px-4 sm:px-6 lg:px-8 -mt-4 mb-12">
              <div className="max-w-6xl mx-auto">
                <a
                  href={`/public/election-results/${content.featuredElectionId}`}
                  className="block w-full sm:w-auto sm:inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white text-base sm:text-lg font-bold rounded-xl shadow-lg active:scale-95 transition"
                >
                  <span>📊</span>
                  <span>Detaylı Seçim Sonuçları</span>
                  <span aria-hidden>→</span>
                </a>
              </div>
            </section>
          </>
        )}

        {/* Training → ApplyCTA bridge */}
        <LandingBridge fillColor="#f9fafb" variant={5} height={80} />

        {s.applyCta !== false && (
          <ApplyCTASection
            title={content.applyCtaTitle || DEFAULTS.applyCtaTitle}
            text={content.applyCtaText || DEFAULTS.applyCtaText}
            buttonText="Basvur"
            buttonLink="/public/apply"
          />
        )}

        {/* ApplyCTA → Leaders bridge */}
        <LandingBridge fillColor="#ffffff" variant={6} height={80} />

        {s.leaders !== false && (
          <LeadersSection
            members={leaders}
            title={content.leadersTitle || DEFAULTS.leadersTitle}
          />
        )}

        {/* Leaders → Contact bridge */}
        <LandingBridge fillColor="#f9fafb" variant={7} height={80} />

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

      {/* Anonim push banner ve toast artık app-shell-level'da
          (App.jsx → AnonymousPushBanner). Tüm route'larda görünür,
          iOS standalone değilse "Add to Home Screen" yönergesi gösterilir. */}
    </div>
  );
};

export default PublicLandingPage;
