import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Sorumlu Dashboard Sayfası - Modern, Animasyonlu, Mobile Uyumlu
 * 
 * Coordinator'ların sorumlu olduğu sandıkları gösterir ve seçim sonuçlarını görüntüleyebilir/düzenleyebilir.
 */
const CoordinatorDashboardPage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, userRole, user, logout } = useAuth();
  
  // State management
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const [selectedBallotBox, setSelectedBallotBox] = useState(null);
  const [showResultForm, setShowResultForm] = useState(false);
  const [regionInfo, setRegionInfo] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [parentCoordinators, setParentCoordinators] = useState([]);
  const [electionResults, setElectionResults] = useState([]);
  const [elections, setElections] = useState([]);

  // Coordinator rolleri
  const coordinatorRoles = ['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'];

  // Authentication kontrolü
  useEffect(() => {
    if (!isLoggedIn || !coordinatorRoles.includes(userRole) || !user) {
      navigate('/coordinator-login', { replace: true });
    }
  }, [isLoggedIn, userRole, user, navigate]);

  // Dashboard verilerini yükle
  useEffect(() => {
    if (!isLoggedIn || !coordinatorRoles.includes(userRole) || !user || !user.coordinatorId) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const dashboardData = await ApiService.getCoordinatorDashboard(user.coordinatorId);
        
        if (!isMounted) return;

        setCoordinator(dashboardData.coordinator);
        setBallotBoxes(dashboardData.ballotBoxes || []);
        setRegionInfo(dashboardData.regionInfo || null);
        setNeighborhoods(dashboardData.neighborhoods || []);
        setVillages(dashboardData.villages || []);
        setParentCoordinators(dashboardData.parentCoordinators || []);
        setElectionResults(dashboardData.electionResults || []);
        
        // Seçimleri de yükle
        const allElections = await ApiService.getElections();
        setElections(allElections || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        if (isMounted) {
          setError('Veriler yüklenirken hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
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
  }, [user, isLoggedIn, userRole]);

  const handleBallotBoxClick = useCallback((ballotBox) => {
    setSelectedBallotBox(ballotBox);
    // Sandık detay sayfasına yönlendir veya modal aç
    navigate(`/ballot-boxes/${ballotBox.id}`);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/coordinator-login', { replace: true });
  }, [navigate, logout]);

  const getRoleLabel = useCallback((role) => {
    const labels = {
      'provincial_coordinator': 'İl Genel Sorumlusu',
      'district_supervisor': 'İlçe Sorumlusu',
      'region_supervisor': 'Bölge Sorumlusu',
      'institution_supervisor': 'Kurum Sorumlusu'
    };
    return labels[role] || role;
  }, []);

  const getRoleColor = useCallback((role) => {
    const colors = {
      'provincial_coordinator': 'from-blue-500 to-blue-600',
      'district_supervisor': 'from-purple-500 to-purple-600',
      'region_supervisor': 'from-indigo-500 to-indigo-600',
      'institution_supervisor': 'from-green-500 to-green-600'
    };
    return colors[role] || 'from-gray-500 to-gray-600';
  }, []);

  if (!user || !coordinatorRoles.includes(userRole)) {
    return null;
  }

  // Loading state
  if (loading && ballotBoxes.length === 0) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 sm:py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Modern Header with Gradient */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${getRoleColor(userRole)} rounded-3xl shadow-2xl p-6 sm:p-8 text-white`}>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Sorumlu Dashboard</h1>
                    <p className="text-white/80 text-sm sm:text-base mt-1">
                      {getRoleLabel(userRole)} - Sorumlu olduğunuz sandıklar
                    </p>
                  </div>
                </div>
                
                {coordinator && (
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">{coordinator.name || user.name || 'Bilinmiyor'}</span>
                    </div>
                    {coordinator.institutionName && (
                      <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="font-medium">{coordinator.institutionName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">{ballotBoxes.length} Sandık</span>
                    </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sorumlu Olduğunuz Sandıklar</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{ballotBoxes.length}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          {regionInfo && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Bölge</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{regionInfo.name}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h1.5M21 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0H21m-1.5 0H18" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          
          {electionResults.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Girilen Seçim Sonuçları</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{electionResults.length}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bölge, Mahalle, Köy Bilgileri */}
        {(regionInfo || neighborhoods.length > 0 || villages.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
              Sorumluluk Bilgileri
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {regionInfo && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Bölge</h3>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{regionInfo.name}</p>
                </div>
              )}
              
              {neighborhoods.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Mahalleler ({neighborhoods.length})</h3>
                  <div className="space-y-1">
                    {neighborhoods.slice(0, 3).map((neighborhood) => (
                      <p key={neighborhood.id} className="text-sm text-gray-900 dark:text-gray-100">
                        • {neighborhood.name}
                      </p>
                    ))}
                    {neighborhoods.length > 3 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        +{neighborhoods.length - 3} mahalle daha
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {villages.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Köyler ({villages.length})</h3>
                  <div className="space-y-1">
                    {villages.slice(0, 3).map((village) => (
                      <p key={village.id} className="text-sm text-gray-900 dark:text-gray-100">
                        • {village.name}
                      </p>
                    ))}
                    {villages.length > 3 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        +{villages.length - 3} köy daha
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Üst Sorumlular */}
        {parentCoordinators.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              Üst Sorumlular
            </h2>
            
            <div className="space-y-3">
              {parentCoordinators.map((parent, index) => (
                <div key={parent.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{parent.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {getRoleLabel(parent.role)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seçim Sonuçları */}
        {electionResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
              Seçim Sonuçları
            </h2>
            
            <div className="space-y-4">
              {electionResults.map((result) => {
                const election = elections.find(e => String(e.id) === String(result.election_id));
                const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
                
                return (
                  <div key={result.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {election?.name || `Seçim #${result.election_id}`}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sandık: {ballotBox?.ballot_number || result.ballot_box_id}
                          {ballotBox?.institution_name && ` - ${ballotBox.institution_name}`}
                        </p>
                        {election?.date && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {new Date(election.date).toLocaleDateString('tr-TR')}
                          </p>
                        )}
                      </div>
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-xs font-semibold">
                        Sonuç Girildi
                      </span>
                    </div>
                    
                    <button
                      onClick={() => navigate(`/ballot-boxes/${result.ballot_box_id}?election=${result.election_id}`)}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center gap-2"
                    >
                      Sonuçları Görüntüle
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ballot Boxes List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              Sandıklar
            </h2>
            {loading && (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600"></div>
            )}
          </div>

          {error && ballotBoxes.length === 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 mb-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {!loading && ballotBoxes.length === 0 && (
            <div className="text-center py-16 animate-fade-in">
              <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Henüz sandık atanmamış</h3>
              <p className="text-gray-600 dark:text-gray-400">Sorumlu olduğunuz sandıklar burada görünecektir.</p>
            </div>
          )}

          {!loading && ballotBoxes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {ballotBoxes.map((ballotBox) => (
                <div
                  key={ballotBox.id}
                  onClick={() => handleBallotBoxClick(ballotBox)}
                  className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-md hover:shadow-xl p-6 cursor-pointer transform transition-all duration-300 hover:scale-105 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                        Sandık {ballotBox.ballot_number || ballotBox.id}
                      </h3>
                      {ballotBox.institution_name && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {ballotBox.institution_name}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Detayları görüntüle</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboardPage;

