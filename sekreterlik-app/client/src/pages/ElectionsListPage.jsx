import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';

const ElectionsListPage = () => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getElections();
      // Tarihe göre sırala (en yeni en üstte)
      const sorted = (data || []).sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });
      setElections(sorted);
    } catch (error) {
      console.error('Error fetching elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'yerel': return 'Yerel Seçim';
      case 'genel': return 'Genel Seçim';
      case 'cb': return 'Cumhurbaşkanlığı Seçimi';
      default: return type;
    }
  };

  const handleElectionClick = (electionId) => {
    navigate(`/election-results/${electionId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Seçim Sonuçları
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tüm seçimlerin sonuçlarını görüntüleyebilirsiniz
          </p>
        </div>

        {/* Elections List */}
        {elections.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Henüz seçim eklenmemiş</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Seçim eklemek için Ayarlar &gt; Seçim Ekle sayfasını kullanın
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {elections.map((election) => (
              <div
                key={election.id}
                onClick={() => handleElectionClick(election.id)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1">
                    {election.name}
                  </h3>
                  <span className="ml-2 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded text-xs font-medium whitespace-nowrap">
                    {getTypeLabel(election.type)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {election.date ? new Date(election.date).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : '-'}
                  </div>

                  {election.voter_count && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Seçmen: {election.voter_count.toLocaleString('tr-TR')}
                    </div>
                  )}

                  {election.type === 'cb' && election.candidates && election.candidates.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Adaylar:</div>
                      <div className="flex flex-wrap gap-1">
                        {election.candidates.slice(0, 3).map((candidate, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                            {candidate}
                          </span>
                        ))}
                        {election.candidates.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                            +{election.candidates.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {(election.type === 'yerel' || election.type === 'genel') && election.parties && election.parties.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Partiler:</div>
                      <div className="flex flex-wrap gap-1">
                        {election.parties.slice(0, 3).map((party, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                            {party}
                          </span>
                        ))}
                        {election.parties.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                            +{election.parties.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      Sonuçları Görüntüle
                    </span>
                    <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ElectionsListPage;

