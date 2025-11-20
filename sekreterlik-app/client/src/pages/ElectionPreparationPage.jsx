import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import BallotBoxesPage from './BallotBoxesPage';
import ObserversPage from './ObserversPage';
import RepresentativesPage from './RepresentativesPage';
import NeighborhoodsPage from './NeighborhoodsPage';
import VillagesPage from './VillagesPage';
import GroupsPage from './GroupsPage';
import CoordinatorsPage from './CoordinatorsPage';

const ElectionPreparationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Aktif tab'ı URL'den belirle
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/ballot-boxes')) return 'ballot-boxes';
    if (path.includes('/observers')) return 'observers';
    if (path.includes('/representatives')) return 'representatives';
    if (path.includes('/neighborhoods')) return 'neighborhoods';
    if (path.includes('/villages')) return 'villages';
    if (path.includes('/groups')) return 'groups';
    if (path.includes('/coordinators')) return 'coordinators';
    return 'ballot-boxes'; // Default
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  // URL değiştiğinde aktif tab'ı güncelle
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);

  const tabs = [
    {
      id: 'ballot-boxes',
      name: 'Sandıklar',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'indigo',
      path: '/election-preparation/ballot-boxes'
    },
    {
      id: 'observers',
      name: 'Müşahitler',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'green',
      path: '/election-preparation/observers'
    },
    {
      id: 'representatives',
      name: 'Temsilciler',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'purple',
      path: '/election-preparation/representatives'
    },
    {
      id: 'neighborhoods',
      name: 'Mahalleler',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'orange',
      path: '/election-preparation/neighborhoods'
    },
    {
      id: 'villages',
      name: 'Köyler',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      color: 'teal',
      path: '/election-preparation/villages'
    },
    {
      id: 'groups',
      name: 'Gruplar',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'pink',
      path: '/election-preparation/groups'
    },
    {
      id: 'coordinators',
      name: 'Sorumlular',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: 'blue',
      path: '/election-preparation/coordinators'
    }
  ];

  const handleTabClick = (tab) => {
    setActiveTab(tab.id);
    // Eğer route-based navigation mümkünse navigate et, değilse sadece state'i güncelle
    try {
      navigate(tab.path);
    } catch (e) {
      // Route-based navigation çalışmıyorsa sadece state'i güncelle
      console.log('Route navigation not available, using state-based navigation');
    }
  };

  const getColorClasses = (color, isActive) => {
    const colors = {
      indigo: {
        bg: isActive ? 'bg-indigo-600' : 'bg-indigo-100 hover:bg-indigo-200',
        text: isActive ? 'text-white' : 'text-indigo-700',
        border: isActive ? 'border-indigo-600' : 'border-indigo-200'
      },
      green: {
        bg: isActive ? 'bg-green-600' : 'bg-green-100 hover:bg-green-200',
        text: isActive ? 'text-white' : 'text-green-700',
        border: isActive ? 'border-green-600' : 'border-green-200'
      },
      purple: {
        bg: isActive ? 'bg-purple-600' : 'bg-purple-100 hover:bg-purple-200',
        text: isActive ? 'text-white' : 'text-purple-700',
        border: isActive ? 'border-purple-600' : 'border-purple-200'
      },
      orange: {
        bg: isActive ? 'bg-orange-600' : 'bg-orange-100 hover:bg-orange-200',
        text: isActive ? 'text-white' : 'text-orange-700',
        border: isActive ? 'border-orange-600' : 'border-orange-200'
      },
      teal: {
        bg: isActive ? 'bg-teal-600' : 'bg-teal-100 hover:bg-teal-200',
        text: isActive ? 'text-white' : 'text-teal-700',
        border: isActive ? 'border-teal-600' : 'border-teal-200'
      },
      pink: {
        bg: isActive ? 'bg-pink-600' : 'bg-pink-100 hover:bg-pink-200',
        text: isActive ? 'text-white' : 'text-pink-700',
        border: isActive ? 'border-pink-600' : 'border-pink-200'
      },
      blue: {
        bg: isActive ? 'bg-blue-600' : 'bg-blue-100 hover:bg-blue-200',
        text: isActive ? 'text-white' : 'text-blue-700',
        border: isActive ? 'border-blue-600' : 'border-blue-200'
      }
    };
    return colors[color] || colors.indigo;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Seçime Hazırlık</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Sandık ve müşahit yönetimi</p>
            </div>
          </div>
        </div>

        {/* Tabs - Alt sayfa navigasyonu */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex flex-wrap gap-2 p-4 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const colorClasses = getColorClasses(tab.color, isActive);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200
                    ${colorClasses.bg} ${colorClasses.text} ${colorClasses.border} border-2
                    ${isActive ? 'shadow-md scale-105' : 'shadow-sm'}
                    hover:scale-105 active:scale-95
                  `}
                >
                  {tab.icon}
                  <span className="whitespace-nowrap">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area - Alt sayfalar burada render edilecek */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[500px]">
          {/* State-based navigation - MemberDashboardPage içinde render edildiğinde çalışır */}
          {activeTab === 'ballot-boxes' && <BallotBoxesPage />}
          {activeTab === 'observers' && <ObserversPage />}
          {activeTab === 'representatives' && <RepresentativesPage />}
          {activeTab === 'neighborhoods' && <NeighborhoodsPage />}
          {activeTab === 'villages' && <VillagesPage />}
          {activeTab === 'groups' && <GroupsPage />}
          {activeTab === 'coordinators' && <CoordinatorsPage />}
          
          {/* Route-based navigation - Standalone route olarak kullanıldığında çalışır */}
          {location.pathname.startsWith('/election-preparation') && (
            <Routes>
              <Route index element={<Navigate to="/election-preparation/ballot-boxes" replace />} />
              <Route path="ballot-boxes/*" element={<BallotBoxesPage />} />
              <Route path="observers" element={<ObserversPage />} />
              <Route path="representatives" element={<RepresentativesPage />} />
              <Route path="neighborhoods" element={<NeighborhoodsPage />} />
              <Route path="villages" element={<VillagesPage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="coordinators/*" element={<CoordinatorsPage />} />
            </Routes>
          )}
        </div>
      </div>
    </div>
  );
};

export default ElectionPreparationPage;
