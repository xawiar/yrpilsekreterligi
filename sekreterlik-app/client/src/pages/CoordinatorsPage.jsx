import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';

const CoordinatorsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Aktif alt tab'ı URL'den belirle
  const getActiveSubTab = () => {
    const path = location.pathname;
    if (path.includes('/coordinators/coordinators')) return 'coordinators';
    if (path.includes('/coordinators/regions')) return 'regions';
    return 'coordinators'; // Default
  };

  const [activeSubTab, setActiveSubTab] = useState(getActiveSubTab());

  // URL değiştiğinde aktif alt tab'ı güncelle
  useEffect(() => {
    setActiveSubTab(getActiveSubTab());
  }, [location.pathname]);

  const subTabs = [
    {
      id: 'coordinators',
      name: 'Sorumlular',
      path: '/election-preparation/coordinators/coordinators'
    },
    {
      id: 'regions',
      name: 'Bölgeler',
      path: '/election-preparation/coordinators/regions'
    }
  ];

  const handleSubTabClick = (tab) => {
    setActiveSubTab(tab.id);
    navigate(tab.path);
  };

  return (
    <div className="space-y-6">
      {/* Alt Tab Navigasyonu */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {subTabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSubTabClick(tab)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Alt Sayfa İçeriği */}
      <div>
        <Routes>
          <Route index element={<Navigate to="/election-preparation/coordinators/coordinators" replace />} />
          <Route path="coordinators" element={<CoordinatorsListPage />} />
          <Route path="regions" element={<RegionsListPage />} />
        </Routes>
      </div>
    </div>
  );
};

// Sorumlular Listesi Sayfası
const CoordinatorsListPage = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Sorumlular</h2>
      <p className="text-gray-600 dark:text-gray-400">Sorumlular listesi burada görüntülenecek.</p>
    </div>
  );
};

// Bölgeler Listesi Sayfası
const RegionsListPage = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Bölgeler</h2>
      <p className="text-gray-600 dark:text-gray-400">Bölgeler listesi burada görüntülenecek.</p>
    </div>
  );
};

export default CoordinatorsPage;

