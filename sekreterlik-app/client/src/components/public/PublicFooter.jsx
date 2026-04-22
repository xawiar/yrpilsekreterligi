import React, { useEffect, useState } from 'react';
import { getBrandingSettings, getThemeSettingsCached } from '../../utils/brandingLoader';

/**
 * PublicFooter
 * Parti adi + yil + "Tum haklari saklidir"
 * KVKK linki -> /privacy-policy
 * theme.footerText varsa goster.
 */
const PublicFooter = ({ appName: appNameProp }) => {
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
  const year = new Date().getFullYear();

  return (
    <footer className="w-full bg-gray-900 dark:bg-black text-gray-300 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-base font-semibold text-white">{appName}</p>
            <p className="mt-1 text-sm text-gray-400">
              &copy; {year} {appName}. Tum haklari saklidir.
            </p>
            {footerText && (
              <p className="mt-2 text-xs text-gray-500 max-w-2xl">
                {footerText}
              </p>
            )}
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <a
              href="/privacy-policy"
              className="min-h-[44px] inline-flex items-center text-gray-400 hover:text-white transition-colors"
            >
              KVKK / Gizlilik
            </a>
            <a
              href="/login"
              className="min-h-[44px] inline-flex items-center text-gray-400 hover:text-white transition-colors"
            >
              Giris Yap
            </a>
            <a
              href="/public/apply"
              className="min-h-[44px] inline-flex items-center text-gray-400 hover:text-white transition-colors"
            >
              Basvur
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
