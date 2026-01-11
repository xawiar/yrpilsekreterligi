import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiService from '../utils/ApiService';

const DistrictsPage = () => {
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [expandedDistricts, setExpandedDistricts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDistricts();
    fetchTowns();
  }, []);

  const fetchDistricts = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getDistricts();
      setDistricts(data);
    } catch (error) {
      console.error('Error fetching districts:', error);
      setError('İlçeler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchTowns = async () => {
    try {
      const data = await ApiService.getTowns();
      setTowns(data);
    } catch (error) {
      console.error('Error fetching towns:', error);
    }
  };

  const toggleDistrict = (districtId) => {
    setExpandedDistricts(prev => ({
      ...prev,
      [districtId]: !prev[districtId]
    }));
  };

  const getTownsByDistrict = (districtId) => {
    return towns.filter(town => String(town.district_id) === String(districtId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">İlçeler</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {districts.length} ilçe bulundu
          </p>
        </div>
        <Link
          to="/settings?tab=districts"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          İlçe Ekle
        </Link>
      </div>

      {districts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">İlçe bulunamadı</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Henüz hiç ilçe eklenmemiş.</p>
          <div className="mt-6">
            <Link
              to="/settings?tab=districts"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              İlk ilçeyi ekle
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {districts.map((district) => {
            const districtTowns = getTownsByDistrict(district.id);
            const isExpanded = expandedDistricts[district.id];

            return (
              <div 
                key={district.id} 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* İlçe Başlığı */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => toggleDistrict(district.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {district.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {districtTowns.length} belde
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Link
                        to={`/districts/${district.id}/details`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                      >
                        Detaylar
                      </Link>
                      <button
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDistrict(district.id);
                        }}
                      >
                        <svg 
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Beldeler Listesi */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {districtTowns.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                        <p>Bu ilçeye ait belde bulunmamaktadır.</p>
                        <Link
                          to="/settings?tab=towns"
                          className="mt-2 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          Belde ekle
                        </Link>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {districtTowns.map((town) => (
                            <div 
                              key={town.id} 
                              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                      </svg>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {town.name}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Belde
                                    </p>
                                  </div>
                                </div>
                                <Link
                                  to={`/towns/${town.id}/details`}
                                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DistrictsPage;
