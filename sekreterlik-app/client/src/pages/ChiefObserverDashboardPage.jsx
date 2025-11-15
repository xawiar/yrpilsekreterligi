import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import ElectionResultForm from '../components/ElectionResultForm';

/**
 * Başmüşahit Dashboard Sayfası - Modern, Animasyonlu, Mobile Uyumlu
 * 
 * NOT: Authentication kontrolü bu sayfada yapılıyor - route guard kullanılmıyor.
 * Sonsuz döngü önlemek için useRef ile bir kez kontrol ediliyor.
 */
const ChiefObserverDashboardPage = () => {
  const navigate = useNavigate();
  
  // State management
  const [user, setUser] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedElection, setSelectedElection] = useState(null);
  const [showResultForm, setShowResultForm] = useState(false);
  const [electionResults, setElectionResults] = useState({}); // electionId -> result
  
  // Authentication kontrolü - sadece bir kez yap (useRef ile)
  const hasCheckedAuth = React.useRef(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Authentication kontrolü - sadece mount'ta bir kez
  useEffect(() => {
    if (hasCheckedAuth.current) return;
    
    hasCheckedAuth.current = true;
    
    const checkAuth = () => {
      try {
        const savedUser = localStorage.getItem('user');
        const userRole = localStorage.getItem('userRole');
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const currentPath = window.location.pathname;

        if (!savedUser || userRole !== 'chief_observer' || !isLoggedIn) {
          setAuthChecked(true);
          if (currentPath !== '/login' && currentPath !== '/chief-observer-login') {
            navigate('/login?type=chief-observer', { replace: true });
          }
          return;
        }

        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setAuthChecked(true);
        } catch (e) {
          setAuthChecked(true);
          if (currentPath !== '/login' && currentPath !== '/chief-observer-login') {
            navigate('/login?type=chief-observer', { replace: true });
          }
        }
      } catch (err) {
        console.error('Error checking auth:', err);
        setAuthChecked(true);
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/chief-observer-login') {
          navigate('/login?type=chief-observer', { replace: true });
        }
      }
    };

    checkAuth();
  }, [navigate]);

  // Seçimleri ve sonuçları yükle
  useEffect(() => {
    if (!authChecked || !user) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const allElections = await ApiService.getElections();

        if (!isMounted) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeElections = allElections
          .filter(election => {
            if (!election.date) return false;
            const electionDate = new Date(election.date);
            electionDate.setHours(0, 0, 0, 0);
            return electionDate >= today;
          })
          .sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateA - dateB;
          });

        setElections(activeElections);

        // Her seçim için sonuç kontrolü yap
        const resultsMap = {};
        for (const election of activeElections) {
          try {
            const results = await ApiService.getElectionResults(election.id, user.ballotBoxId || user.ballot_box_id);
            if (results && results.length > 0) {
              resultsMap[election.id] = results[0];
            }
          } catch (e) {
            // Sonuç yoksa devam et
          }
        }
        setElectionResults(resultsMap);
      } catch (err) {
        console.error('Error fetching data:', err);
        if (isMounted) {
          setError('Veriler yüklenirken hata oluştu');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user, authChecked]);

  // Event handlers
  const handleElectionClick = useCallback((election) => {
    setSelectedElection(election);
    setShowResultForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowResultForm(false);
    setSelectedElection(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    // Sonuçları yeniden yükle
    if (selectedElection && user) {
      ApiService.getElectionResults(selectedElection.id, user.ballotBoxId || user.ballot_box_id)
        .then(results => {
          if (results && results.length > 0) {
            setElectionResults(prev => ({
              ...prev,
              [selectedElection.id]: results[0]
            }));
          }
        })
        .catch(console.error);
    }
    setShowResultForm(false);
    setSelectedElection(null);
  }, [selectedElection, user]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    navigate('/login?type=chief-observer', { replace: true });
  }, [navigate]);

  const getTypeLabel = useCallback((type) => {
    const labels = {
      'yerel': 'Yerel Seçim',
      'genel': 'Genel Seçim',
      'cb': 'Cumhurbaşkanlığı Seçimi'
    };
    return labels[type] || type;
  }, []);

  const getTypeColor = useCallback((type) => {
    const colors = {
      'yerel': 'from-blue-500 to-blue-600',
      'genel': 'from-purple-500 to-purple-600',
      'cb': 'from-indigo-500 to-indigo-600'
    };
    return colors[type] || 'from-gray-500 to-gray-600';
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '-';
    }
  }, []);

  const getDaysUntil = useCallback((dateString) => {
    if (!dateString) return null;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const electionDate = new Date(dateString);
      electionDate.setHours(0, 0, 0, 0);
      const diffTime = electionDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return null;
    }
  }, []);

  // Auth kontrolü tamamlanmamışsa loading göster
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400 animate-spin" style={{ animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Loading state
  if (loading && elections.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 sm:py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Shimmer loading cards */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasResult = (electionId) => {
    return electionResults[electionId] !== undefined;
  };

  const completedCount = elections.filter(e => hasResult(e.id)).length;
  const pendingCount = elections.length - completedCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 sm:py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Modern Header with Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-6 sm:p-8 text-white">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl animate-blob"></div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-purple-300 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-pink-300 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Başmüşahit Dashboard</h1>
                    <p className="text-indigo-100 text-sm sm:text-base mt-1">Seçim sonuçlarınızı girin ve yönetin</p>
                  </div>
                </div>
                
                {user && (
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">{user.name || 'Bilinmiyor'}</span>
                    </div>
                    {user.ballot_number && (
                      <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium">Sandık: {user.ballot_number}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toplam Seçim</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{elections.length}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tamamlanan</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{completedCount}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Bekleyen</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{pendingCount}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Elections List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              Güncel Seçimler
            </h2>
            {loading && (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600"></div>
            )}
          </div>

          {error && elections.length === 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 mb-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {!loading && elections.length === 0 && (
            <div className="text-center py-16 animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Henüz aktif seçim bulunmuyor</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Yeni seçimler eklendiğinde burada görünecek</p>
            </div>
          )}

          {!loading && elections.length > 0 && (
            <div className="grid gap-4 sm:gap-6">
              {elections.map((election, index) => {
                const daysUntil = getDaysUntil(election.date);
                const isCompleted = hasResult(election.id);
                const isToday = daysUntil === 0;
                const isPast = daysUntil !== null && daysUntil < 0;

                return (
                  <div
                    key={election.id}
                    className={`group relative overflow-hidden bg-gradient-to-r ${getTypeColor(election.type)} rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer ${
                      isCompleted ? 'ring-2 ring-green-400 ring-offset-2' : ''
                    }`}
                    style={{
                      animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                    }}
                    onClick={() => handleElectionClick(election)}
                  >
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-xl"></div>
                    </div>

                    <div className="relative p-6 sm:p-8 text-white">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-xl sm:text-2xl font-bold mb-1">
                                {election.name || 'İsimsiz Seçim'}
                              </h3>
                              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium">
                                {getTypeLabel(election.type)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-medium">{formatDate(election.date)}</span>
                            </div>

                            {daysUntil !== null && !isPast && (
                              <div className={`flex items-center gap-2 backdrop-blur-sm px-3 py-1.5 rounded-lg font-medium ${
                                isToday 
                                  ? 'bg-yellow-500/30 text-yellow-100' 
                                  : daysUntil <= 7 
                                    ? 'bg-orange-500/30 text-orange-100'
                                    : 'bg-white/20 text-white'
                              }`}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {isToday ? 'Bugün' : `${daysUntil} gün kaldı`}
                              </div>
                            )}

                            {isCompleted && (
                              <div className="flex items-center gap-2 bg-green-500/30 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium">Tamamlandı</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                            <svg className="w-7 h-7 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Election Result Form Modal */}
      {showResultForm && selectedElection && user && user.ballotBoxId && (
        <ElectionResultForm
          election={selectedElection}
          ballotBoxId={user.ballotBoxId || user.ballot_box_id}
          ballotNumber={user.ballotNumber || user.ballot_number}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ChiefObserverDashboardPage;
