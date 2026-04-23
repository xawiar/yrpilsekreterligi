import React from 'react';
import { Link } from 'react-router-dom';
import VoterListSettings from '../components/VoterListSettings';

const VoterSearchPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seçmen Sorgulama</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              TC, ad, soyad, sandık no veya ilçe ile seçmen arama
            </p>
          </div>
          <Link
            to="/member-dashboard"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ← Dashboard
          </Link>
        </div>
        <VoterListSettings mode="search-only" />
      </div>
    </div>
  );
};

export default VoterSearchPage;
