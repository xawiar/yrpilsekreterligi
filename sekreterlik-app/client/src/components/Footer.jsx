import React, { useState, useEffect } from 'react';

const Footer = () => {
  const [footerText, setFooterText] = useState(null);

  useEffect(() => {
    const loadFooter = async () => {
      try {
        // Once localStorage'dan hizli yukle
        const cached = localStorage.getItem('appBranding');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.footerText) {
              setFooterText(parsed.footerText);
              return;
            }
          } catch (e) { /* varsayilan kullan */ }
        }

        // Firebase'den yukle
        const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
        if (USE_FIREBASE) {
          try {
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');
            if (db) {
              // Once app_settings koleksiyonundan dene (mevcut branding yapisi)
              const { default: FirebaseService } = await import('../services/FirebaseService');
              const allSettings = await FirebaseService.getAll('app_settings', {}, false);
              const brandingSettings = allSettings.find(s => s.type === 'branding');
              if (brandingSettings && brandingSettings.footerText) {
                setFooterText(brandingSettings.footerText);
              }
            }
          } catch (e) { /* varsayilan kullan */ }
        }
      } catch (e) { /* varsayilan kullan */ }
    };

    loadFooter();

    // Branding guncellendiginde footer'i yeniden yukle
    const handleBrandingUpdate = () => {
      try {
        const cached = localStorage.getItem('appBranding');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.footerText) {
            setFooterText(parsed.footerText);
          }
        }
      } catch (e) { /* sessiz */ }
    };

    window.addEventListener('brandingUpdated', handleBrandingUpdate);
    return () => window.removeEventListener('brandingUpdated', handleBrandingUpdate);
  }, []);

  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 mt-auto flex-shrink-0 py-2">
      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        {footerText || (
          <>
            &copy; {new Date().getFullYear()}{' '}
            <a href="https://www.datdijital.com/" target="_blank" rel="noopener noreferrer"
              className="hover:text-primary-500 transition-colors">
              DAT Dijital
            </a>
          </>
        )}
      </p>
    </footer>
  );
};

export default Footer;
