import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { isMobile } from '../utils/capacitorUtils';
import NativeCoordinatorDashboard from '../components/mobile/NativeCoordinatorDashboard';

// Parti renkleri - Türkiye'deki yaygın partiler
const PARTY_COLORS = {
  'AK Parti': { border: '#FF6B35', bg: '#FFF4F0', text: '#CC4A1F' },
  'Adalet ve Kalkınma Partisi': { border: '#FF6B35', bg: '#FFF4F0', text: '#CC4A1F' },
  'CHP': { border: '#DC143C', bg: '#FFF0F0', text: '#B01030' },
  'Cumhuriyet Halk Partisi': { border: '#DC143C', bg: '#FFF0F0', text: '#B01030' },
  'MHP': { border: '#FF8C00', bg: '#FFF8F0', text: '#CC7000' },
  'Milliyetçi Hareket Partisi': { border: '#FF8C00', bg: '#FFF8F0', text: '#CC7000' },
  'İYİ Parti': { border: '#1E90FF', bg: '#F0F8FF', text: '#0066CC' },
  'HDP': { border: '#9370DB', bg: '#F5F0FF', text: '#6A4C93' },
  'Halkların Demokratik Partisi': { border: '#9370DB', bg: '#F5F0FF', text: '#6A4C93' },
  'Saadet Partisi': { border: '#228B22', bg: '#F0FFF0', text: '#006400' },
  'Yeniden Refah Partisi': { border: '#FFD700', bg: '#FFFEF0', text: '#CCAA00' },
  'YRP': { border: '#FFD700', bg: '#FFFEF0', text: '#CCAA00' },
  'DEVA Partisi': { border: '#00CED1', bg: '#F0FFFF', text: '#008B8B' },
  'Gelecek Partisi': { border: '#FF1493', bg: '#FFF0F5', text: '#CC1166' },
  'Zafer Partisi': { border: '#000080', bg: '#F0F0FF', text: '#000066' },
};

// Parti ismine göre renk al (yoksa dinamik renk oluştur)
const getPartyColor = (partyName) => {
  if (!partyName) return { border: '#E5E7EB', bg: '#F9FAFB', text: '#6B7280' };
  
  // Tam eşleşme kontrolü
  if (PARTY_COLORS[partyName]) {
    return PARTY_COLORS[partyName];
  }
  
  // Kısmi eşleşme kontrolü (büyük/küçük harf duyarsız)
  const normalizedName = partyName.toLowerCase();
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return color;
    }
  }
  
  // Eşleşme yoksa, parti ismine göre dinamik renk oluştur
  let hash = 0;
  for (let i = 0; i < partyName.length; i++) {
    hash = partyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Parlak renkler için HSL kullan
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 50 + (Math.abs(hash) % 10); // 50-60%
  
  // HSL'yi RGB'ye çevir (basit versiyon)
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  
  let r, g, b;
  if (h < 1/6) { r = c; g = x; b = 0; }
  else if (h < 2/6) { r = x; g = c; b = 0; }
  else if (h < 3/6) { r = 0; g = c; b = x; }
  else if (h < 4/6) { r = 0; g = x; b = c; }
  else if (h < 5/6) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  const borderColor = `rgb(${r}, ${g}, ${b})`;
  const bgColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
  const textColor = `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)})`;
  
  return { border: borderColor, bg: bgColor, text: textColor };
};

// Sandıkta en fazla oy alan partiyi/adayı bul (yeni seçim sistemine göre)
const getWinningParty = (result, election) => {
  if (!result || !election) return null;
  
  if (election.type === 'genel') {
    // Genel Seçim: CB ve MV ayrı ayrı, en yüksek toplamı bul
    let maxVotes = 0;
    let winner = null;

    // CB oyları
    if (result.cb_votes) {
      Object.entries(result.cb_votes).forEach(([candidate, votes]) => {
        const voteCount = parseInt(votes) || 0;
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winner = candidate;
        }
      });
    }

    // MV oyları
    if (result.mv_votes) {
      Object.entries(result.mv_votes).forEach(([party, votes]) => {
        const voteCount = parseInt(votes) || 0;
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winner = party;
        }
      });
    }

    return winner;
  } else if (election.type === 'yerel') {
    // Yerel Seçim: Belediye Başkanı, İl Genel Meclisi, Belediye Meclisi
    let maxVotes = 0;
    let winner = null;

    if (result.mayor_votes) {
      Object.entries(result.mayor_votes).forEach(([key, votes]) => {
        const voteCount = parseInt(votes) || 0;
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winner = key;
        }
      });
    }

    if (result.provincial_assembly_votes) {
      Object.entries(result.provincial_assembly_votes).forEach(([party, votes]) => {
        const voteCount = parseInt(votes) || 0;
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winner = party;
        }
      });
    }

    if (result.municipal_council_votes) {
      Object.entries(result.municipal_council_votes).forEach(([party, votes]) => {
        const voteCount = parseInt(votes) || 0;
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winner = party;
        }
      });
    }

    return winner;
  } else if (election.type === 'referandum') {
    // Referandum: Evet/Hayır
    const evet = parseInt(result.referendum_votes?.['Evet']) || 0;
    const hayir = parseInt(result.referendum_votes?.['Hayır']) || 0;
    return evet > hayir ? 'Evet' : (hayir > evet ? 'Hayır' : null);
  }

  // Legacy support
  if (election.type === 'cb' && result.candidate_votes) {
    let maxVotes = 0;
    let winningCandidate = null;
    
    Object.entries(result.candidate_votes).forEach(([candidate, votes]) => {
      const voteCount = parseInt(votes) || 0;
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningCandidate = candidate;
      }
    });
    
    return winningCandidate;
  } else if ((election.type === 'yerel' || election.type === 'genel') && result.party_votes) {
    let maxVotes = 0;
    let winningParty = null;
    
    Object.entries(result.party_votes).forEach(([party, votes]) => {
      const voteCount = parseInt(votes) || 0;
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningParty = party;
      }
    });
    
    return winningParty;
  }
  
  return null;
};

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
  const [neighborhoodsList, setNeighborhoodsList] = useState([]);
  const [villagesList, setVillagesList] = useState([]);
  const [parentCoordinators, setParentCoordinators] = useState([]);
  const [electionResults, setElectionResults] = useState([]);
  const [elections, setElections] = useState([]);
  const [observers, setObservers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [modalTitle, setModalTitle] = useState('');

  // Coordinator rolleri
  const coordinatorRoles = ['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'];

  // Authentication kontrolü - loading state'ini kontrol et
  useEffect(() => {
    // Loading tamamlanmadan yönlendirme yapma
    if (loading) return;
    
    if (!isLoggedIn || !coordinatorRoles.includes(userRole) || !user) {
      navigate('/login?type=coordinator', { replace: true });
    }
  }, [isLoggedIn, userRole, user, navigate, loading]);

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
        
        // Observers, districts, towns, neighborhoods, villages yükle (seçim sonuçları kartları için)
        try {
          const [observersData, districtsData, townsData, neighborhoodsData, villagesData] = await Promise.all([
            ApiService.getBallotBoxObservers(),
            ApiService.getDistricts(),
            ApiService.getTowns(),
            ApiService.getNeighborhoods(),
            ApiService.getVillages()
          ]);
          setObservers(observersData || []);
          setDistricts(districtsData || []);
          setTowns(townsData || []);
          setNeighborhoodsList(neighborhoodsData || []);
          setVillagesList(villagesData || []);
        } catch (err) {
          console.error('Error fetching location data:', err);
        }
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

  // Get chief observer for a ballot box
  const getChiefObserver = useCallback((ballotBoxId) => {
    const chiefObserver = observers.find(obs => 
      String(obs.ballot_box_id) === String(ballotBoxId) && 
      (obs.is_chief_observer === true || obs.is_chief_observer === 1)
    );
    return chiefObserver || null;
  }, [observers]);

  // Handle photo click
  const handlePhotoClick = useCallback((photoUrl, title) => {
    setModalPhoto(photoUrl);
    setModalTitle(title);
  }, []);

  // Check if result has data (votes)
  const hasData = useCallback((result) => {
    return !!(result.used_votes || result.valid_votes || result.invalid_votes || 
      (result.cb_votes && Object.keys(result.cb_votes).length > 0) ||
      (result.mv_votes && Object.keys(result.mv_votes).length > 0) ||
      (result.mayor_votes && Object.keys(result.mayor_votes).length > 0) ||
      (result.provincial_assembly_votes && Object.keys(result.provincial_assembly_votes).length > 0) ||
      (result.municipal_council_votes && Object.keys(result.municipal_council_votes).length > 0) ||
      (result.referendum_votes && Object.keys(result.referendum_votes).length > 0) ||
      (result.candidate_votes && Object.keys(result.candidate_votes).length > 0) ||
      (result.party_votes && Object.keys(result.party_votes).length > 0));
  }, []);

  // Check if result has protocol photo
  const hasProtocol = useCallback((result) => {
    return !!(result.signed_protocol_photo || result.signedProtocolPhoto || 
      result.objection_protocol_photo || result.objectionProtocolPhoto);
  }, []);

  if (!user || !coordinatorRoles.includes(userRole)) {
    return null;
  }

  const mobileView = isMobile();

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

  // Native mobile görünümü
  if (mobileView) {
    return (
      <NativeCoordinatorDashboard
        coordinator={coordinator}
        ballotBoxes={ballotBoxes}
        electionResults={electionResults}
        regionInfo={regionInfo}
        neighborhoods={neighborhoods}
        villages={villages}
        parentCoordinators={parentCoordinators}
        elections={elections}
        observers={observers}
        districts={districts}
        towns={towns}
        neighborhoodsList={neighborhoodsList}
        villagesList={villagesList}
        onLogout={handleLogout}
        getRoleLabel={getRoleLabel}
        getWinningParty={getWinningParty}
        getPartyColor={getPartyColor}
        loading={loading}
      />
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

        {/* Seçim Sonuçları - ElectionResultsPage kart formatında */}
        {electionResults.length > 0 && (() => {
          // Sandık numarasına göre unique hale getir - her sandık numarası için en son seçim sonucunu al
          const uniqueResultsByBallotNumber = {};
          electionResults.forEach((result) => {
            const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
            const ballotNumber = ballotBox?.ballot_number || result.ballot_box_id;
            
            // Eğer bu sandık numarası için daha önce bir sonuç yoksa veya bu sonuç daha yeni ise
            if (!uniqueResultsByBallotNumber[ballotNumber] || 
                (result.created_at && uniqueResultsByBallotNumber[ballotNumber].created_at && 
                 new Date(result.created_at) > new Date(uniqueResultsByBallotNumber[ballotNumber].created_at)) ||
                (result.id > uniqueResultsByBallotNumber[ballotNumber].id)) {
              uniqueResultsByBallotNumber[ballotNumber] = result;
            }
          });
          
          const uniqueResults = Object.values(uniqueResultsByBallotNumber);
          
          return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
                Seçim Sonuçları ({uniqueResults.length} Sandık)
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueResults.map((result) => {
                const election = elections.find(e => String(e.id) === String(result.election_id));
                const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
                const chiefObserver = getChiefObserver(result.ballot_box_id);
                
                // Konum bilgileri
                const locationParts = [];
                if (ballotBox) {
                  if (ballotBox.district_id) {
                    const district = districts.find(d => String(d.id) === String(ballotBox.district_id));
                    if (district) locationParts.push({ type: 'İlçe', name: district.name });
                  }
                  if (ballotBox.town_id) {
                    const town = towns.find(t => String(t.id) === String(ballotBox.town_id));
                    if (town) locationParts.push({ type: 'Belde', name: town.name });
                  }
                  if (ballotBox.neighborhood_id) {
                    const neighborhood = neighborhoodsList.find(n => String(n.id) === String(ballotBox.neighborhood_id));
                    if (neighborhood) locationParts.push({ type: 'Mahalle', name: neighborhood.name });
                  }
                  if (ballotBox.village_id) {
                    const village = villagesList.find(v => String(v.id) === String(ballotBox.village_id));
                    if (village) locationParts.push({ type: 'Köy', name: village.name });
                  }
                }
                
                // Veri kontrolü: sadece tutanak var mı, sadece veri var mı?
                const hasProtocol = result.protocol_photo || result.protocol_photos?.length > 0 || 
                  result.signed_protocol_photo || result.signedProtocolPhoto || 
                  result.objection_protocol_photo || result.objectionProtocolPhoto;
                const hasData = result.used_votes > 0 || result.valid_votes > 0 || 
                  (result.cb_votes && Object.keys(result.cb_votes).length > 0) ||
                  (result.mv_votes && Object.keys(result.mv_votes).length > 0) ||
                  (result.mayor_votes && Object.keys(result.mayor_votes).length > 0);
                
                // En fazla oy alan parti/aday
                const winningParty = getWinningParty(result, election);
                const partyColor = winningParty ? getPartyColor(winningParty) : null;
                
                // İtiraz varsa kırmızı, sadece tutanak varsa kırmızı border, sadece veri varsa sarı border
                const hasObjection = result.has_objection === true || result.has_objection === 1;
                let cardStyle = {};
                if (hasObjection) {
                  cardStyle = { borderColor: '#EF4444', backgroundColor: '#FEF2F2', color: '#991B1B' };
                } else if (hasProtocol && !hasData) {
                  cardStyle = { borderColor: '#EF4444', backgroundColor: '#FEF2F2', color: '#991B1B' };
                } else if (hasData && !hasProtocol) {
                  cardStyle = { borderColor: '#F59E0B', backgroundColor: '#FFFBEB', color: '#92400E' };
                } else if (partyColor) {
                  cardStyle = { borderColor: partyColor.border, backgroundColor: partyColor.bg, color: partyColor.text };
                } else {
                  cardStyle = { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', color: '#6B7280' };
                }
                
                return (
                  <div 
                    key={result.id} 
                    onClick={() => navigate(`/election-results/${result.election_id}/edit/${result.id}`)}
                    className="border rounded-lg p-4 transition-shadow hover:shadow-md cursor-pointer"
                    style={{
                      borderColor: cardStyle.borderColor,
                      backgroundColor: cardStyle.backgroundColor,
                      borderWidth: '2px'
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold" style={{ color: cardStyle.color }}>
                          Sandık No: {ballotBox?.ballot_number || result.ballot_box_id}
                        </h3>
                        {winningParty && !hasObjection && hasData && (
                          <div className="text-xs mt-1" style={{ color: cardStyle.color, opacity: 0.8 }}>
                            En Çok Oy: {winningParty}
                          </div>
                        )}
                        {hasProtocol && !hasData && (
                          <div className="text-xs mt-1 text-red-600 dark:text-red-400 font-semibold">
                            ⚠️ Sadece Tutanak (Veri Yok)
                          </div>
                        )}
                        {hasData && !hasProtocol && (
                          <div className="text-xs mt-1 text-yellow-600 dark:text-yellow-400 font-semibold">
                            ⚠️ Sadece Veri (Tutanak Yok)
                          </div>
                        )}
                      </div>
                      {hasObjection && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/40 rounded-full">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">İtiraz</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Konum Bilgileri */}
                    {locationParts.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {locationParts.map((part, idx) => (
                          <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{part.type}:</span> {part.name}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Başmüşahit Bilgileri */}
                    {chiefObserver && (
                      <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          Başmüşahit
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {chiefObserver.name}
                        </div>
                        {chiefObserver.phone && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {chiefObserver.phone}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Oy Sayıları */}
                    {hasData && (
                      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Kullanılan</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {result.used_votes || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Geçersiz</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {result.invalid_votes || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Geçerli</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {result.valid_votes || 0}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Seçim Bilgisi */}
                    {election && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        {election.name}
                        {election.date && ` - ${new Date(election.date).toLocaleDateString('tr-TR')}`}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          );
        })()}

        {/* Ballot Boxes List - Sadece seçim sonucu olmayan sandıklar */}
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

          {!loading && ballotBoxes.length > 0 && (() => {
            // Seçim sonucu olan sandık numaralarını topla
            const ballotNumbersWithResults = new Set();
            electionResults.forEach((result) => {
              const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
              if (ballotBox) {
                ballotNumbersWithResults.add(ballotBox.ballot_number || result.ballot_box_id);
              }
            });
            
            // Seçim sonucu olmayan sandıkları filtrele ve unique hale getir
            const uniqueBallotBoxes = {};
            ballotBoxes.forEach((ballotBox) => {
              const ballotNumber = ballotBox.ballot_number || ballotBox.id;
              // Seçim sonucu olmayan ve daha önce eklenmemiş sandıkları ekle
              if (!ballotNumbersWithResults.has(ballotNumber) && !uniqueBallotBoxes[ballotNumber]) {
                uniqueBallotBoxes[ballotNumber] = ballotBox;
              }
            });
            
            const uniqueBallotBoxesList = Object.values(uniqueBallotBoxes);
            
            if (uniqueBallotBoxesList.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Tüm sandıklar için seçim sonucu girilmiş.
                  </p>
                </div>
              );
            }
            
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {uniqueBallotBoxesList.map((ballotBox) => {
                  return (
                  <div
                    key={ballotBox.id}
                    onClick={() => handleBallotBoxClick(ballotBox)}
                    className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-md hover:shadow-xl p-6 cursor-pointer transform transition-all duration-300 hover:scale-105 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            Sandık {ballotBox.ballot_number || ballotBox.id}
                          </h3>
                        </div>
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
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Photo Modal */}
      {modalPhoto && (
        <Modal
          isOpen={!!modalPhoto}
          onClose={() => {
            setModalPhoto(null);
            setModalTitle('');
          }}
          title={modalTitle}
        >
          <div className="max-w-4xl mx-auto">
            <img 
              src={modalPhoto} 
              alt={modalTitle}
              className="w-full h-auto rounded-lg"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/800x600?text=Resim+Yüklenemedi';
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CoordinatorDashboardPage;

