import React, { createContext, useContext, useState, useEffect } from 'react';
import { applyThemeColors } from '../utils/themeUtils';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // localStorage'dan tema tercihini yukle
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Sistem tercihini kontrol et
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }
    return false;
  });

  const [primaryColor, setPrimaryColor] = useState(() => {
    try {
      const cached = localStorage.getItem('themeSettings');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.primaryColor || '#4f46e5';
      }
    } catch (_) {}
    return '#4f46e5';
  });

  useEffect(() => {
    // Tema degistiginde localStorage'a kaydet ve html class'ini guncelle
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Renk temasini dinle
  useEffect(() => {
    const handleThemeUpdate = () => {
      try {
        const cached = localStorage.getItem('themeSettings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.colors) {
            applyThemeColors(parsed.colors);
          }
          if (parsed.primaryColor) {
            setPrimaryColor(parsed.primaryColor);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('themeUpdated', handleThemeUpdate);
    window.addEventListener('storage', handleThemeUpdate);

    // Baslangicta renk temasini uygula
    handleThemeUpdate();

    return () => {
      window.removeEventListener('themeUpdated', handleThemeUpdate);
      window.removeEventListener('storage', handleThemeUpdate);
    };
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const value = {
    isDarkMode,
    toggleTheme,
    primaryColor,
    setPrimaryColor
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
