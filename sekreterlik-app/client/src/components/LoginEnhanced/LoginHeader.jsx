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
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('brandingUpdated', handleUpdate);
      window.removeEventListener('themeUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const logoUrl = branding?.logoUrl;
  const loginTitle = theme?.loginTitle || 'Yeniden Refah Partisi';
  const loginSlogan = theme?.loginSlogan || 'Il Sekreterlik Sistemi';
  const primaryColor = theme?.primaryColor || null;

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.1
        }}
        className="flex justify-center mb-6"
      >
        <div className="relative">
          {/* 3D Shadow Layers */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-500 rounded-3xl transform rotate-6 blur-xl opacity-40 -z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-3xl transform -rotate-3 blur-lg opacity-30 -z-10"></div>
          {/* Main Icon Container */}
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="relative bg-gradient-to-br from-primary-600 via-primary-600 to-primary-700 rounded-3xl p-5 shadow-2xl"
            style={{
              boxShadow: `0 20px 60px -15px ${primaryColor || 'rgba(16, 185, 129, 0.5)'}80, 0 0 0 1px rgba(255,255,255,0.1) inset, 0 1px 0 rgba(255,255,255,0.2) inset`
            }}
          >
            {logoUrl ? (
              <div className="h-12 w-12 flex items-center justify-center">
                <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded" loading="lazy" />
              </div>
            ) : (
              <div className="h-12 w-12 flex items-center justify-center">
                <span className="text-white font-black text-2xl drop-shadow-lg tracking-tight">YRP</span>
              </div>
            )}
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl pointer-events-none"></div>
          </motion.div>
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1"
      >
        {loginTitle}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        className="text-primary-700 dark:text-primary-400 font-semibold text-base mb-1"
      >
        {loginSlogan}
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="text-gray-600 dark:text-gray-400 text-sm"
      >
        Devam etmek icin giris yapin
      </motion.p>
    </div>
  );
};

export default LoginHeader;
