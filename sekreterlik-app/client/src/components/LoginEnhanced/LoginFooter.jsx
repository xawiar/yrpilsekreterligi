import React from 'react';
import { Link } from 'react-router-dom';

const LoginFooter = () => {
  return (
    <div className="mt-8">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            Yeniden Refah Partisi İl Sekreterlik Sistemi
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <Link
          to="/public/apply"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Yonetime Basvur
        </Link>
        <Link
          to="/privacy-policy"
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors"
        >
          Kisisel Verilerin Korunmasi Hakkinda Aydinlatma Metni
        </Link>
      </div>

      <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>© 2026 <a href="https://www.datdijital.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors font-medium">DAT Dijital</a>. Tüm hakları saklıdır.</p>
      </div>
    </div>
  );
};

export default LoginFooter;