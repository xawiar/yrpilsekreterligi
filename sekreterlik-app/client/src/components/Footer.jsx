import React, { useState, useEffect } from 'react';
import { getThemeSettingsCached } from '../utils/brandingLoader';

const Footer = () => {
  const [footerData, setFooterData] = useState({
    companyName: 'DAT Dijital',
    companyUrl: 'https://www.datdijital.com/',
    footerText: ''
  });

  useEffect(() => {
    const loadFooter = () => {
      const theme = getThemeSettingsCached();
      if (theme) {
        setFooterData({
          companyName: theme.footerCompanyName || 'DAT Dijital',
          companyUrl: theme.footerCompanyUrl || 'https://www.datdijital.com/',
          footerText: theme.footerText || ''
        });
      }
    };

    loadFooter();

    // Tema guncellendiginde dinle
    window.addEventListener('themeUpdated', loadFooter);
    window.addEventListener('storage', loadFooter);
    return () => {
      window.removeEventListener('themeUpdated', loadFooter);
      window.removeEventListener('storage', loadFooter);
    };
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center md:text-left">
            <p>
              &copy; {currentYear}{' '}
              <a
                href={footerData.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium transition-colors"
              >
                {footerData.companyName}
              </a>
              . {footerData.footerText || 'Tum haklari saklidir.'}
            </p>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center md:text-right">
            <p>
              Teknik destek ve iletisim icin:{' '}
              <a
                href={footerData.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium transition-colors"
              >
                {footerData.companyName}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
