import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getBrandingSettings } from '../utils/brandingLoader';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    const loadBranding = () => {
      const settings = getBrandingSettings();
      setBranding(settings);
    };
    loadBranding();
    window.addEventListener('storage', loadBranding);
    window.addEventListener('brandingUpdated', loadBranding);
    return () => {
      window.removeEventListener('storage', loadBranding);
      window.removeEventListener('brandingUpdated', loadBranding);
    };
  }, []);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 lg:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center space-x-2">
              {branding?.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto object-contain" loading="lazy" decoding="async" />
              )}
              <h1 className="text-lg sm:text-xl font-bold text-indigo-700 dark:text-indigo-400">
                {branding?.appName || 'Parti Sekreterliği'}
              </h1>
            </div>
          </div>
          {branding?.headerInfoText && (
            <div className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 px-2">
              {branding.headerInfoText}
            </div>
          )}
          <div className="flex items-center">
            <div className="ml-3 relative">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
                  {user ? `Hoş geldin, ${user.name}` : 'Kullanıcı'}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Çıkış Yap
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;