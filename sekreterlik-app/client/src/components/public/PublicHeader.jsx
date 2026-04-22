import React, { useState, useEffect } from 'react';
import { getBrandingSettings } from '../../utils/brandingLoader';

/**
 * PublicHeader
 * Sticky top, backdrop blur. Logo + nav + mobil hamburger + Giris Yap.
 * Nav: Hakkimizda / Liderler / Basvur / Iletisim (scroll to section).
 * Props: { appName } (opsiyonel, yoksa brandingLoader'dan cekilir)
 */
const NAV_ITEMS = [
  { id: 'about', label: 'Hakkimizda' },
  { id: 'leaders', label: 'Liderler' },
  { id: 'apply', label: 'Basvur' },
  { id: 'contact', label: 'Iletisim' },
];

const PublicHeader = ({ appName: appNameProp }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    try {
      const b = getBrandingSettings();
      if (b) setBranding(b);
    } catch {
      // Sessizce gec
    }
  }, []);

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

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + isim */}
          <button
            onClick={() => scrollTo('hero')}
            className="flex items-center gap-2 min-h-[44px] pr-2"
            aria-label="Ana sayfaya git"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={appName}
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {appName.charAt(0)}
              </div>
            )}
            <span className="hidden sm:inline text-base font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
              {appName}
            </span>
          </button>

          {/* Nav masaustu */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {item.label}
              </button>
            ))}
            <a
              href="/login"
              className="ml-2 px-4 py-2 min-h-[44px] inline-flex items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              Giris Yap
            </a>
          </nav>

          {/* Hamburger mobil */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Menuyu ac"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobil menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-left px-4 py-3 min-h-[44px] rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {item.label}
              </button>
            ))}
            <a
              href="/login"
              className="mt-2 px-4 py-3 min-h-[44px] inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold transition-colors"
            >
              Giris Yap
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
