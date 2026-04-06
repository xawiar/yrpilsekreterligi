import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center md:text-left">
            <p>
              &copy; {new Date().getFullYear()}{' '}
              <a href="https://www.datdijital.com/" target="_blank" rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium transition-colors">
                DAT Dijital
              </a>
              . {t('footer.allRightsReserved')}
            </p>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center md:text-right">
            <p>
              {t('footer.technicalSupport')}{' '}
              <a href="https://www.datdijital.com/" target="_blank" rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium transition-colors">
                DAT Dijital
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
