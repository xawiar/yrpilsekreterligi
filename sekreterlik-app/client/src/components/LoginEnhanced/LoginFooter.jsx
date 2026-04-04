import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getThemeSettingsCached } from '../../utils/brandingLoader';

const LoginFooter = () => {
  const [footerData, setFooterData] = useState({
    companyName: 'DAT Dijital',
    companyUrl: 'https://www.datdijital.com/',
    loginTitle: 'Yeniden Refah Partisi',
    loginSlogan: 'Il Sekreterlik Sistemi'
  });

  useEffect(() => {
    const loadData = () => {
      const theme = getThemeSettingsCached();
      if (theme) {
        setFooterData({
          companyName: theme.footerCompanyName || 'DAT Dijital',
          companyUrl: theme.footerCompanyUrl || 'https://www.datdijital.com/',
          loginTitle: theme.loginTitle || 'Yeniden Refah Partisi',
          loginSlogan: theme.loginSlogan || 'Il Sekreterlik Sistemi'
        });
      }
    };

    loadData();
    window.addEventListener('themeUpdated', loadData);
    window.addEventListener('storage', loadData);
    return () => {
      window.removeEventListener('themeUpdated', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <div className="mt-8">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {footerData.loginTitle} {footerData.loginSlogan}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <Link
          to="/public/apply"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:underline transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Yonetime Basvur
        </Link>
        <Link
          to="/privacy-policy"
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:underline transition-colors"
        >
          Kisisel Verilerin Korunmasi Hakkinda Aydinlatma Metni
        </Link>
      </div>

      <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>
          &copy; {currentYear}{' '}
          <a
            href={footerData.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors font-medium"
          >
            {footerData.companyName}
          </a>
          . Tum haklari saklidir.
        </p>
      </div>
    </div>
  );
};

export default LoginFooter;
