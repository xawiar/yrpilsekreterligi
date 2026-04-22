import React, { useEffect, useState } from 'react';
import { getBrandingSettings, getThemeSettingsCached } from '../../utils/brandingLoader';

/**
 * PublicFooter
 * 4 kolonlu kurumsal footer:
 *   1) Marka (logo + isim + kisa metin)
 *   2) Hizli Linkler (hash scroll'lar)
 *   3) Kurumsal (KVKK, Giris, Basvur)
 *   4) Iletisim (adres/telefon/email - landing_content/main'den)
 * Alt serit: copyright + (opsiyonel) footerText
 */

const socialIcons = {
  facebook: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  ),
  instagram: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.849.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.849c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.265.058-1.645.069-4.849.069s-3.584-.012-4.849-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.647 2.163 15.267 2.163 12s.012-3.584.07-4.849c.062-1.366.336-2.633 1.311-3.608C4.519 2.569 5.786 2.295 7.152 2.233 8.417 2.175 8.796 2.163 12 2.163zm0 3.838a4.162 4.162 0 110 8.324 4.162 4.162 0 010-8.324zm0 1.837a2.325 2.325 0 100 4.65 2.325 2.325 0 000-4.65zm4.406-2.29a.973.973 0 110 1.946.973.973 0 010-1.947z" />
    </svg>
  ),
  twitter: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  youtube: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
};

const socialLabels = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  youtube: 'YouTube',
};

const QUICK_LINKS = [
  { id: 'about', label: 'Hakkımızda' },
  { id: 'leaders', label: 'Yönetim Kadromuz' },
  { id: 'news', label: 'Haberler' },
  { id: 'gallery', label: 'Galeri' },
  { id: 'election', label: 'Seçim Sonuçları' },
];

const PublicFooter = ({
  appName: appNameProp,
  address = '',
  phone = '',
  email = '',
  social = {},
}) => {
  const [branding, setBranding] = useState(null);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    try {
      setBranding(getBrandingSettings());
      setTheme(getThemeSettingsCached());
    } catch {
      // ignore
    }
  }, []);

  const appName = appNameProp || branding?.appName || 'Yeniden Refah Partisi';
  const footerText = branding?.footerText || theme?.footerText || '';
  const logoUrl = branding?.logoUrl || '';
  const year = new Date().getFullYear();

  const telHref = phone
    ? 'tel:' + phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
    : '';

  const scrollTo = (id) => (e) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const hasSocial = social && Object.values(social).some(Boolean);

  return (
    <footer className="w-full bg-gray-950 text-gray-300 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12">
          {/* 1) Marka */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={appName}
                  className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white font-bold text-lg shadow">
                  {appName.charAt(0)}
                </div>
              )}
              <div className="leading-tight">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary-400">
                  YRP
                </p>
                <p className="text-base font-semibold text-white truncate max-w-[240px]">
                  {appName}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-gray-400 max-w-sm">
              Elazığ İl Sekreterliği olarak; adaletli, hizmetkâr ve güvenilir bir siyaset anlayışıyla
              vatandaşımızın yanındayız.
            </p>

            {hasSocial && (
              <div className="mt-6 flex items-center gap-2">
                {Object.entries(social).map(([key, url]) => {
                  if (!url || !socialIcons[key]) return null;
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={socialLabels[key] || key}
                      className="w-9 h-9 rounded-lg bg-white/5 hover:bg-primary-600 text-gray-300 hover:text-white flex items-center justify-center transition-colors border border-white/5 hover:border-primary-600"
                    >
                      {socialIcons[key]}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2) Hizli Linkler */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-5">
              Keşfet
            </h4>
            <nav className="flex flex-col gap-2">
              {QUICK_LINKS.map(l => (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={scrollTo(l.id)}
                  className="text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center group"
                >
                  <span className="w-0 group-hover:w-2 h-px bg-primary-500 mr-0 group-hover:mr-2 transition-all" />
                  {l.label}
                </a>
              ))}
            </nav>
          </div>

          {/* 3) Kurumsal */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-5">
              Kurumsal
            </h4>
            <nav className="flex flex-col gap-2">
              <a
                href="/public/apply"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Yönetime Başvur
              </a>
              <a
                href="/login"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Giriş Yap
              </a>
              <a
                href="/privacy-policy"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                KVKK / Gizlilik
              </a>
              <a
                href="/public/election-results"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Seçim Sonuçları
              </a>
            </nav>
          </div>

          {/* 4) Iletisim */}
          <div className="lg:col-span-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-5">
              İletişim
            </h4>
            <ul className="space-y-4 text-sm">
              {address && (
                <li className="flex gap-3">
                  <svg className="w-4 h-4 shrink-0 mt-0.5 text-primary-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-400 whitespace-pre-line break-words leading-relaxed">
                    {address}
                  </span>
                </li>
              )}
              {phone && (
                <li>
                  <a
                    href={telHref}
                    className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0 text-primary-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
                    </svg>
                    <span className="break-all">{phone}</span>
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0 text-primary-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="break-all">{email}</span>
                  </a>
                </li>
              )}
              {!address && !phone && !email && (
                <li className="text-gray-500 italic text-sm">
                  İletişim bilgileri yakında güncellenecek.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Alt serit */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs md:text-sm text-gray-500">
            &copy; {year} {appName}. Tüm hakları saklıdır.
          </p>
          {footerText && (
            <p className="text-xs text-gray-500 max-w-xl md:text-right">
              {footerText}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
