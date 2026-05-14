import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBrandingSettings, getThemeSettingsCached } from '../../utils/brandingLoader';

const LoginHeader = () => {
  const [branding, setBranding] = useState(null);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setBranding(getBrandingSettings());
    setTheme(getThemeSettingsCached());
    const handleUpdate = () => {
      setBranding(getBrandingSettings());
      setTheme(getThemeSettingsCached());
    };
    window.addEventListener('brandingUpdated', handleUpdate);
    window.addEventListener('themeUpdated', handleUpdate);
    return () => {
      window.removeEventListener('brandingUpdated', handleUpdate);
      window.removeEventListener('themeUpdated', handleUpdate);
    };
  }, []);

  const logoUrl = branding?.logoUrl;
  const loginTitle = theme?.loginTitle || 'Yeniden Refah Partisi';
  const loginSlogan = theme?.loginSlogan || 'İl Sekreterlik Sistemi';

  return (
    <div className="text-center mb-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center mb-6"
      >
        <div className="relative group">
          {/* Professional Subtle Glow */}
          <div className="absolute inset-0 bg-primary-500/10 blur-2xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative bg-white dark:bg-[#1e293b] p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-14 w-14 object-contain" />
            ) : (
              <div className="h-14 w-14 flex items-center justify-center bg-primary-600 rounded-xl text-white font-bold text-xl">
                YRP
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
          {loginTitle}
        </h2>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {loginSlogan}
        </p>
      </motion.div>
    </div>
  );
};

export default LoginHeader;
