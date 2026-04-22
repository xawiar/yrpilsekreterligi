import React, { useState, useEffect } from 'react';
import { getBrandingSettings } from '../../utils/brandingLoader';

/**
 * PublicHeader — Kurumsal, sticky, scroll ile transparan -> solid gecisi.
 * - Sol: logo + parti adi
 * - Orta/sag: smooth scroll nav
 * - Sag en: Giris Yap (outline)
 * - Mobil: hamburger -> fullscreen overlay (backdrop blur)
 */
const NAV_ITEMS = [
  { id: 'about', label: 'Hakkımızda' },
  { id: 'leaders', label: 'Yönetim' },
  { id: 'news', label: 'Haberler' },
  { id: 'gallery', label: 'Galeri' },
  { id: 'election', label: 'Seçimler' },
  { id: 'apply', label: 'Başvur' },
  { id: 'contact', label: 'İletişim' },
];

const PublicHeader = ({ appName: appNameProp }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    try {
      const b = getBrandingSettings();
      if (b) setBranding(b);
    } catch {
      // ignore
    }
  }, []);

  // Scroll izle: 24px sonrasi solid
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mobil menu acikken body scroll kilidi
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const appName = appNameProp || branding?.appName || 'Yeniden Refah Partisi';
  const logoUrl = branding?.logoUrl || '';

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = `#${id}`;
    }
  };

  const headerBg = scrolled
    ? 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800'
    : 'bg-transparent border-b border-transparent';

  const linkColor = scrolled
    ? 'text-gray-700 hover:text-primary-700 dark:text-gray-300 dark:hover:text-white'
    : 'text-white/90 hover:text-white';

  const brandText = scrolled
    ? 'text-gray-900 dark:text-white'
    : 'text-white';

  return (
    <header className={`fixed top-0 inset-x-0 z-40 w-full transition-colors duration-300 ${headerBg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo + isim */}
          <button
            onClick={() => scrollTo('hero')}
            className="flex items-center gap-3 min-h-[44px] pr-2 group"
            aria-label="Ana sayfaya git"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={appName}
                className="h-10 w-10 rounded-lg object-cover ring-1 ring-black/5"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white font-bold text-base shadow-sm">
                {appName.charAt(0)}
              </div>
            )}
            <div className="hidden sm:flex flex-col leading-tight text-left">
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${scrolled ? 'text-primary-700 dark:text-primary-400' : 'text-white/70'}`}>
                YRP
              </span>
              <span className={`text-sm md:text-base font-semibold truncate max-w-[220px] ${brandText}`}>
                {appName}
              </span>
            </div>
          </button>

          {/* Masaustu nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`px-4 py-2 min-h-[44px] rounded-md text-sm font-medium transition-colors ${linkColor}`}
              >
                {item.label}
              </button>
            ))}
            <a
              href="/login"
              className={`ml-3 px-5 py-2.5 min-h-[44px] inline-flex items-center rounded-md text-sm font-semibold border-2 transition-colors ${
                scrolled
                  ? 'border-primary-600 text-primary-700 hover:bg-primary-600 hover:text-white dark:border-primary-500 dark:text-primary-400 dark:hover:bg-primary-500 dark:hover:text-white'
                  : 'border-white/80 text-white hover:bg-white hover:text-primary-700'
              }`}
            >
              Giriş Yap
            </a>
          </nav>

          {/* Hamburger mobil */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={`lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-md transition-colors ${
              scrolled
                ? 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'text-white hover:bg-white/10'
            }`}
            aria-label="Menüyü aç"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobil fullscreen overlay */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 top-20 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl animate-fade-in">
          <nav className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-1">
            {NAV_ITEMS.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-left px-5 py-4 min-h-[56px] rounded-lg text-xl font-semibold text-gray-900 dark:text-white hover:bg-primary-50 dark:hover:bg-gray-800 hover:text-primary-700 dark:hover:text-primary-400 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {item.label}
              </button>
            ))}
            <a
              href="/login"
              className="mt-6 px-5 py-4 min-h-[56px] inline-flex items-center justify-center rounded-lg bg-primary-700 hover:bg-primary-800 active:scale-95 text-white text-lg font-semibold transition-all shadow-lg"
            >
              Giriş Yap
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
