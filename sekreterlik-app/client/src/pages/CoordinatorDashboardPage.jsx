import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import ElectionResultForm from '../components/ElectionResultForm';
import { isMobile } from '../utils/capacitorUtils';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import NativeCoordinatorDashboard from '../components/mobile/NativeCoordinatorDashboard';
import { formatBallotBoxShort } from '../utils/ballotBoxLabel';
import BallotBoxResultReview from '../components/BallotBoxResultReview';
import NotificationBell from '../components/NotificationBell';

import { PARTY_COLORS, getPartyColor } from '../utils/partyColors';

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

const COORDINATOR_ROLES = ['admin', 'provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'];

/**
 * Sorumlu Dashboard Sayfası - Modern, Animasyonlu, Mobile Uyumlu
 *
 * Coordinator'ların sorumlu olduğu sandıkları gösterir ve seçim sonuçlarını görüntüleyebilir/düzenleyebilir.
 */
const CoordinatorDashboardPage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, userRole, user, logout, loading: authLoading } = useAuth();
  
  // State management
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const [selectedBallotBox, setSelectedBallotBox] = useState(null);
  const [showResultForm, setShowResultForm] = useState(false);
  const [reviewBox, setReviewBox] = useState(null); // { id, ballot_number }
  const [regionInfo, setRegionInfo] = useState(null);
  const [myRegions, setMyRegions] = useState([]);
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
  // GÖREV A & B için state'ler
  const [activeElection, setActiveElection] = useState(null);
  const [allElectionResultsForActive, setAllElectionResultsForActive] = useState([]);
  const [loadingTotals, setLoadingTotals] = useState(false);

  // Authentication kontrolü - auth loading state'ini kontrol et
  useEffect(() => {
    // Auth loading tamamlanmadan yönlendirme yapma
    if (authLoading) return;

    if (!isLoggedIn || !COORDINATOR_ROLES.includes(userRole) || !user) {
      navigate('/login?type=coordinator', { replace: true });
    }
  }, [isLoggedIn, userRole, user, navigate, authLoading]);

  // Dashboard verilerini yükle - useCallback ile sarmalıyoruz pull-to-refresh için
  const loadData = useCallback(async () => {
    if (!isLoggedIn || !COORDINATOR_ROLES.includes(userRole) || !user || !user.coordinatorId) return;

    let isMounted = true;

    try {
      setLoading(true);
      setError(null);

      const dashboardData = await ApiService.getCoordinatorDashboard(user.coordinatorId);
      
      if (!isMounted) return;

      setCoordinator(dashboardData.coordinator);
      setBallotBoxes(dashboardData.ballotBoxes || []);
      setRegionInfo(dashboardData.regionInfo || null);
      setMyRegions(Array.isArray(dashboardData.regions) ? dashboardData.regions : []);
      setNeighborhoods(dashboardData.neighborhoods || []);
      setVillages(dashboardData.villages || []);
      setParentCoordinators(dashboardData.parentCoordinators || []);
      setElectionResults(dashboardData.electionResults || []);
      
      // Seçimleri de yükle
      const allElections = await ApiService.getElections();
      setElections(allElections || []);

      // Aktif seçimi belirle (status='active'; birden fazla varsa en yeni tarih)
      const activeOnes = (allElections || []).filter(e => e.status === 'active');
      const sortedActive = activeOnes.sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        return db - da;
      });
      const chosen = sortedActive[0] || null;
      setActiveElection(chosen);

      // Aktif seçim için TÜM sandıkların sonuçlarını çek (özet kart için)
      if (chosen) {
        try {
          setLoadingTotals(true);
          const allResults = await ApiService.getElectionResults(chosen.id, null);
          if (isMounted) {
            setAllElectionResultsForActive(Array.isArray(allResults) ? allResults : []);
          }
        } catch (err) {
          console.error('Error fetching all election results for active election:', err);
          if (isMounted) setAllElectionResultsForActive([]);
        } finally {
          if (isMounted) setLoadingTotals(false);
        }
      } else {
        setAllElectionResultsForActive([]);
      }
      
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
  }, [user, isLoggedIn, userRole]);

  useEffect(() => {
    if (!isLoggedIn || !COORDINATOR_ROLES.includes(userRole) || !user || !user.coordinatorId) return;
    loadData();
  }, [loadData, isLoggedIn, userRole, user]);

  const handleBallotBoxClick = useCallback((ballotBox) => {
    // Sandığa tıklayınca sonuç inceleme modal'ı aç (tutanak + rakamlar yan yana)
    setReviewBox(ballotBox);
  }, []);

  // GÖREV A: Sonuçları görüntüle/düzenle modalı için handler'lar
  const handleOpenResultForm = useCallback((ballotBox, e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    setSelectedBallotBox(ballotBox);
    setShowResultForm(true);
  }, []);

  const handleCloseResultForm = useCallback(() => {
    setShowResultForm(false);
    setSelectedBallotBox(null);
  }, []);

  const handleResultFormSuccess = useCallback(() => {
    setShowResultForm(false);
    setSelectedBallotBox(null);
    // Dashboard verilerini yenile (özet kart ve kartlar güncellensin)
    loadData();
  }, [loadData]);

  // Sorumlu olunan sandıkların ID seti (responsibilities + ballotBoxes fallback)
  const myBallotBoxIdSet = useMemo(() => {
    const ids = new Set();
    (ballotBoxes || []).forEach(bb => {
      const id = bb?.id ?? bb?.ballot_box_id ?? bb?.ballotBoxId;
      if (id !== undefined && id !== null) ids.add(String(id));
    });
    return ids;
  }, [ballotBoxes]);

  // GÖREV B: Sorumlu olunan sandıklara ait sonuçların TOPLAM hesabı
  const responsibilityTotals = useMemo(() => {
    const empty = {
      totalUsed: 0,
      totalValid: 0,
      totalInvalid: 0,
      cb: {}, // { candidate: votes }
      mv: {}, // { party: votes }
      mayor: {},
      provincialAssembly: {},
      municipalCouncil: {},
      referendum: {},
      ballotBoxCount: 0,
      hasAnyData: false,
    };
    if (!activeElection || !Array.isArray(allElectionResultsForActive) || allElectionResultsForActive.length === 0) {
      return empty;
    }

    // Sadece sorumlu olunan sandıklara ait sonuçları al
    const filtered = allElectionResultsForActive.filter(r => {
      if (!r || !r.ballot_box_id) return false;
      return myBallotBoxIdSet.has(String(r.ballot_box_id));
    });

    if (filtered.length === 0) return empty;

    // Aynı sandığa birden fazla sonuç varsa en güncel olanı kullan
    const latestPerBox = {};
    filtered.forEach(r => {
      const key = String(r.ballot_box_id);
      const existing = latestPerBox[key];
      if (!existing) {
        latestPerBox[key] = r;
      } else {
        const newer = (r.created_at && existing.created_at && new Date(r.created_at) > new Date(existing.created_at)) ||
          (r.id && existing.id && r.id > existing.id);
        if (newer) latestPerBox[key] = r;
      }
    });

    const totals = { ...empty, cb: {}, mv: {}, mayor: {}, provincialAssembly: {}, municipalCouncil: {}, referendum: {} };
    let hasAny = false;

    const sumOf = (obj) =>
      obj && typeof obj === 'object'
        ? Object.values(obj).reduce((s, v) => s + (parseInt(v) || 0), 0)
        : 0;

    Object.values(latestPerBox).forEach(r => {
      // Capabilities Model fallback: paylaşılan alan boşsa kategori-bazlı (cb_*/mv_*),
      // o da yoksa parti oyu toplamından hesapla. Eski format kayıtlar için kritik.
      const cbVotesTotal = sumOf(r.cb_votes);
      const mvVotesTotal = sumOf(r.mv_votes);
      const used = parseInt(r.used_votes) ||
        parseInt(r.cb_used_votes) || parseInt(r.mv_used_votes) || 0;
      const valid = parseInt(r.valid_votes) ||
        parseInt(r.cb_valid_votes) || parseInt(r.mv_valid_votes) ||
        cbVotesTotal || mvVotesTotal || 0;
      const invalid = parseInt(r.invalid_votes) ||
        parseInt(r.cb_invalid_votes) || parseInt(r.mv_invalid_votes) || 0;
      totals.totalUsed += used;
      totals.totalValid += valid;
      totals.totalInvalid += invalid;
      if (used || valid || invalid) hasAny = true;

      const accumulate = (target, votesObj) => {
        if (!votesObj || typeof votesObj !== 'object') return;
        Object.entries(votesObj).forEach(([key, val]) => {
          const v = parseInt(val) || 0;
          if (v > 0) hasAny = true;
          target[key] = (target[key] || 0) + v;
        });
      };

      accumulate(totals.cb, r.cb_votes);
      accumulate(totals.mv, r.mv_votes);
      accumulate(totals.mayor, r.mayor_votes);
      accumulate(totals.provincialAssembly, r.provincial_assembly_votes);
      accumulate(totals.municipalCouncil, r.municipal_council_votes);
      accumulate(totals.referendum, r.referendum_votes);
    });

    totals.ballotBoxCount = Object.keys(latestPerBox).length;
    totals.hasAnyData = hasAny;
    return totals;
  }, [activeElection, allElectionResultsForActive, myBallotBoxIdSet]);

  // En çok oy alan adayı/partiyi bul
  const topEntry = useCallback((obj) => {
    if (!obj || typeof obj !== 'object') return null;
    let bestKey = null;
    let bestVal = -1;
    Object.entries(obj).forEach(([k, v]) => {
      const val = parseInt(v) || 0;
      if (val > bestVal) {
        bestVal = val;
        bestKey = k;
      }
    });
    return bestKey ? { key: bestKey, value: bestVal } : null;
  }, []);

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
      'provincial_coordinator': 'from-red-700 via-red-600 to-rose-600',
      'district_supervisor': 'from-red-800 via-red-700 to-rose-700',
      'region_supervisor': 'from-rose-700 via-red-600 to-amber-600',
      'institution_supervisor': 'from-red-600 via-rose-600 to-pink-600'
    };
    return colors[role] || 'from-gray-500 to-gray-600';
  }, []);

  // Get chief observer for a ballot box — defansif:
  // 1) is_chief_observer=true olanı tercih et
  // 2) Yoksa o sandığa atanmış HERHANGİ bir observer'ı göster (eski kayıtlarda flag yoksa)
  const getChiefObserver = useCallback((ballotBoxId) => {
    const allForBox = observers.filter(obs =>
      String(obs.ballot_box_id) === String(ballotBoxId)
    );
    if (allForBox.length === 0) return null;
    const chief = allForBox.find(obs =>
      obs.is_chief_observer === true || obs.is_chief_observer === 1
    );
    return chief || allForBox[0];
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

  if (!user || !COORDINATOR_ROLES.includes(userRole)) {
    return null;
  }

  const mobileView = isMobile();

  // Pull-to-refresh for mobile
  const { isRefreshing, pullProgress } = usePullToRefresh(
    loadData,
    { disabled: !mobileView || !isLoggedIn || !COORDINATOR_ROLES.includes(userRole) || !user || !user.coordinatorId }
  );

  // Loading state
  if (loading && ballotBoxes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 sm:py-8 px-4">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          {/* Shimmer loading cards */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 animate-pulse">
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
      <>
        {/* Pull-to-refresh indicator */}
        {isRefreshing && (
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-center items-center bg-indigo-600 text-white py-2">
            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Yenileniyor...</span>
          </div>
        )}
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
          hasData={hasData}
          hasProtocol={hasProtocol}
          loading={loading}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 sm:py-8 px-4">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Modern Header with Gradient */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${getRoleColor(userRole)} rounded-xl shadow-2xl p-6 sm:p-8 text-white`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl animate-blob"></div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-red-300 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-rose-300 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
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
                    <h1 className="text-2xl sm:text-3xl font-bold">
                      {coordinator?.name || user?.name || 'Sorumlu'}
                    </h1>
                    <p className="text-white/80 text-sm sm:text-base mt-1">
                      {getRoleLabel(userRole)}
                      {coordinator?.institutionName ? ` · ${coordinator.institutionName}` : ''}
                    </p>
                  </div>
                </div>

                {coordinator && (
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {coordinator.phone && (
                      <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="font-medium">{coordinator.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">{ballotBoxes.length} Sandık</span>
                    </div>
                    {myRegions.length > 0 && (
                      <div className="flex items-start gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                        <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-medium">
                          {myRegions.length === 1 ? 'Bölge' : `${myRegions.length} Bölge`}: {myRegions.map(r => r.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <NotificationBell />
                <button
                  onClick={() => navigate('/uploaded-documents')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Yüklenen Evraklar
                </button>
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
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
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

        {/* GÖREV B: Sorumlu Olduğum Sandıkların Toplam Sonucu */}
        {activeElection && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                📊 Sorumlu Olduğum Sandıkların Toplam Sonucu
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium">
                  {activeElection.name || 'Aktif Seçim'}
                </span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-medium">
                  {responsibilityTotals.ballotBoxCount}/{ballotBoxes.length} sandık veri girildi
                </span>
              </div>
            </div>

            {loadingTotals ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sonuçlar hesaplanıyor...</p>
              </div>
            ) : !responsibilityTotals.hasAnyData ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" />
                  </svg>
                </div>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">Henüz veri girilmemiş</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Sorumlu olduğunuz sandıkların sonuçları girildikçe burada özetlenir.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* 1. Kolon: Toplam Oy Sayıları */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/40 dark:to-gray-800/40 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" />
                    </svg>
                    Oy Sayıları (Toplam)
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Kullanılan Oy</span>
                      <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                        {responsibilityTotals.totalUsed.toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Geçerli Oy</span>
                      <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
                        {responsibilityTotals.totalValid.toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Geçersiz Oy</span>
                      <span className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400">
                        {responsibilityTotals.totalInvalid.toLocaleString('tr-TR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2 + 3. Kolonlar: Seçim tipine göre değişir */}
                {activeElection.type === 'genel' ? (
                  <>
                    {/* CB Toplam */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 border-2 border-blue-200 dark:border-blue-800">
                      <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                        🗳️ Cumhurbaşkanı Toplam Oyları
                      </h3>
                      {Object.keys(responsibilityTotals.cb).length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Henüz CB verisi yok</p>
                      ) : (
                        <>
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {Object.entries(responsibilityTotals.cb)
                              .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))
                              .map(([cand, votes]) => (
                                <div key={cand} className="flex justify-between items-center text-xs py-1.5 px-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                                  <span className="text-gray-700 dark:text-gray-300 font-medium truncate mr-2">{cand}</span>
                                  <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
                                    {(parseInt(votes) || 0).toLocaleString('tr-TR')}
                                  </span>
                                </div>
                              ))}
                          </div>
                          {topEntry(responsibilityTotals.cb) && (
                            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 text-xs">
                              <span className="text-gray-600 dark:text-gray-400">En çok oy: </span>
                              <span className="font-bold text-blue-700 dark:text-blue-300">
                                {topEntry(responsibilityTotals.cb).key}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* MV Toplam */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border-2 border-purple-200 dark:border-purple-800">
                      <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-4 flex items-center gap-2">
                        🏛️ Milletvekili Toplam Oyları
                      </h3>
                      {Object.keys(responsibilityTotals.mv).length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Henüz MV verisi yok</p>
                      ) : (
                        <>
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {Object.entries(responsibilityTotals.mv)
                              .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))
                              .map(([party, votes]) => {
                                const pc = getPartyColor(party);
                                return (
                                  <div
                                    key={party}
                                    className="flex justify-between items-center text-xs py-1.5 px-2 rounded border-2"
                                    style={{ backgroundColor: pc.bg, borderColor: pc.border }}
                                  >
                                    <span className="font-medium truncate mr-2" style={{ color: pc.text }}>{party}</span>
                                    <span className="font-bold whitespace-nowrap" style={{ color: pc.text }}>
                                      {(parseInt(votes) || 0).toLocaleString('tr-TR')}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                          {topEntry(responsibilityTotals.mv) && (
                            <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700 text-xs">
                              <span className="text-gray-600 dark:text-gray-400">En çok oy: </span>
                              <span className="font-bold text-purple-700 dark:text-purple-300">
                                {topEntry(responsibilityTotals.mv).key}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                ) : activeElection.type === 'yerel' ? (
                  <>
                    {/* Belediye Başkanı */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 border-2 border-blue-200 dark:border-blue-800">
                      <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                        👤 Belediye Başkanı (Toplam)
                      </h3>
                      {Object.keys(responsibilityTotals.mayor).length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Veri yok</p>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {Object.entries(responsibilityTotals.mayor)
                            .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))
                            .map(([k, v]) => (
                              <div key={k} className="flex justify-between items-center text-xs py-1.5 px-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                                <span className="text-gray-700 dark:text-gray-300 font-medium truncate mr-2">{k}</span>
                                <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
                                  {(parseInt(v) || 0).toLocaleString('tr-TR')}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Belediye Meclisi */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border-2 border-purple-200 dark:border-purple-800">
                      <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-4 flex items-center gap-2">
                        🏛️ Belediye Meclisi (Toplam)
                      </h3>
                      {Object.keys(responsibilityTotals.municipalCouncil).length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Veri yok</p>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {Object.entries(responsibilityTotals.municipalCouncil)
                            .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))
                            .map(([k, v]) => {
                              const pc = getPartyColor(k);
                              return (
                                <div
                                  key={k}
                                  className="flex justify-between items-center text-xs py-1.5 px-2 rounded border-2"
                                  style={{ backgroundColor: pc.bg, borderColor: pc.border }}
                                >
                                  <span className="font-medium truncate mr-2" style={{ color: pc.text }}>{k}</span>
                                  <span className="font-bold whitespace-nowrap" style={{ color: pc.text }}>
                                    {(parseInt(v) || 0).toLocaleString('tr-TR')}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </>
                ) : activeElection.type === 'referandum' ? (
                  <div className="lg:col-span-2 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-5 border-2 border-emerald-200 dark:border-emerald-800">
                    <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-4">📜 Referandum Toplam</h3>
                    {Object.keys(responsibilityTotals.referendum).length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Veri yok</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(responsibilityTotals.referendum).map(([k, v]) => (
                          <div key={k} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm text-center">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{k}</p>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                              {(parseInt(v) || 0).toLocaleString('tr-TR')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Tek tutanaklı / bilinmeyen tip — CB veya MV hangisi varsa göster
                  <div className="lg:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/40 dark:to-gray-800/40 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Toplam Oylar</h3>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {Object.entries({
                        ...responsibilityTotals.cb,
                        ...responsibilityTotals.mv,
                      })
                        .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))
                        .map(([k, v]) => {
                          const pc = getPartyColor(k);
                          return (
                            <div
                              key={k}
                              className="flex justify-between items-center text-xs py-1.5 px-2 rounded border-2"
                              style={{ backgroundColor: pc.bg, borderColor: pc.border }}
                            >
                              <span className="font-medium truncate mr-2" style={{ color: pc.text }}>{k}</span>
                              <span className="font-bold whitespace-nowrap" style={{ color: pc.text }}>
                                {(parseInt(v) || 0).toLocaleString('tr-TR')}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bölge, Mahalle, Köy Bilgileri */}
        {(regionInfo || neighborhoods.length > 0 || villages.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
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
                    {parent.phone && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        📞 {parent.phone}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seçim Sonuçları - Gruplandırılmış */}
        {(() => {
          // Tüm sandıkları ve sonuçlarını gruplandır.
          // Bucket key = ballot_box.id (doc id). ballot_number unique DEĞİL —
          // aynı no farklı ilçelerde olabilir (örn. MERKEZ 1001 ve AĞIN 1001).
          const allBallotBoxesWithResults = {};

          // Önce tüm sandıkları ekle
          ballotBoxes.forEach((ballotBox) => {
            const key = String(ballotBox.id);
            if (!allBallotBoxesWithResults[key]) {
              allBallotBoxesWithResults[key] = {
                ballotBox,
                result: null,
                hasData: false,
                hasProtocol: false,
                hasObjection: false
              };
            }
          });

          // Sonuçları ekle
          electionResults.forEach((result) => {
            if (!result) return; // Null check

            const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
            const key = String(result.ballot_box_id);

            const hasDataResult = hasData(result);
            const hasProtocolResult = hasProtocol(result);
            const hasObjectionResult = result.has_objection === true || result.has_objection === 1;

            if (!allBallotBoxesWithResults[key]) {
              allBallotBoxesWithResults[key] = {
                ballotBox: ballotBox || { id: result.ballot_box_id, ballot_number: result.ballot_number },
                result: null,
                hasData: false,
                hasProtocol: false,
                hasObjection: false
              };
            }

            // Daha yeni sonuç varsa güncelle
            if (!allBallotBoxesWithResults[key].result ||
                (result.created_at && allBallotBoxesWithResults[key].result?.created_at &&
                 new Date(result.created_at) > new Date(allBallotBoxesWithResults[key].result.created_at)) ||
                (result.id > allBallotBoxesWithResults[key].result?.id)) {
              allBallotBoxesWithResults[key].result = result;
              allBallotBoxesWithResults[key].hasData = hasDataResult;
              allBallotBoxesWithResults[key].hasProtocol = hasProtocolResult;
              allBallotBoxesWithResults[key].hasObjection = hasObjectionResult;
            }
          });
          
          // Sonuç olmayan sandıklar için hasData ve hasProtocol'i false olarak işaretle
          Object.values(allBallotBoxesWithResults).forEach((item) => {
            if (!item.result) {
              item.hasData = false;
              item.hasProtocol = false;
              item.hasObjection = false;
            }
          });
          
          // Gruplandır
          const completed = []; // hasData && hasProtocol && !hasObjection
          const missingProtocol = []; // hasData && !hasProtocol
          const onlyProtocol = []; // !hasData && hasProtocol
          const noData = []; // !hasData && !hasProtocol
          const objected = []; // hasObjection
          
          Object.values(allBallotBoxesWithResults).forEach((item) => {
            if (item.hasObjection) {
              objected.push(item);
            } else if (item.hasData && item.hasProtocol) {
              completed.push(item);
            } else if (item.hasData && !item.hasProtocol) {
              missingProtocol.push(item);
            } else if (!item.hasData && item.hasProtocol) {
              onlyProtocol.push(item);
            } else {
              noData.push(item);
            }
          });
          
          const renderBallotBoxCard = (item, index) => {
            const { ballotBox, result } = item;
            const election = result ? elections.find(e => String(e.id) === String(result.election_id)) : null;
            const chiefObserver = getChiefObserver(ballotBox.id);
            
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
            
            const winningParty = result ? getWinningParty(result, election) : null;
            const partyColor = winningParty ? getPartyColor(winningParty) : null;
            
            // Kart stili
            let cardStyle = {};
            if (item.hasObjection) {
              cardStyle = { borderColor: '#EF4444', backgroundColor: '#FEF2F2', color: '#991B1B' };
            } else if (item.hasData && item.hasProtocol) {
              cardStyle = partyColor ? { borderColor: partyColor.border, backgroundColor: partyColor.bg, color: partyColor.text } : { borderColor: '#10B981', backgroundColor: '#D1FAE5', color: '#065F46' };
            } else if (item.hasData && !item.hasProtocol) {
              cardStyle = { borderColor: '#F59E0B', backgroundColor: '#FFFBEB', color: '#92400E' };
            } else if (!item.hasData && item.hasProtocol) {
              cardStyle = { borderColor: '#EF4444', backgroundColor: '#FEF2F2', color: '#991B1B' };
            } else {
              cardStyle = { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', color: '#6B7280' };
            }
            
            return (
              <div 
                key={ballotBox.id || index} 
                onClick={() => result ? navigate(`/election-results/${result.election_id}/edit/${result.id}`) : null}
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
                      {formatBallotBoxShort(ballotBox, districts)}
                      {ballotBox.institution_name && (
                        <span className="block text-xs font-normal mt-0.5 opacity-80">{ballotBox.institution_name}</span>
                      )}
                    </h3>
                    {winningParty && !item.hasObjection && item.hasData && (
                      <div className="text-xs mt-1" style={{ color: cardStyle.color, opacity: 0.8 }}>
                        En Çok Oy: {winningParty}
                      </div>
                    )}
                    {item.hasProtocol && !item.hasData && (
                      <div className="text-xs mt-1 text-red-600 dark:text-red-400 font-semibold">
                        ⚠️ Sadece Tutanak (Veri Yok)
                      </div>
                    )}
                    {item.hasData && !item.hasProtocol && (
                      <div className="text-xs mt-1 text-amber-600 dark:text-amber-400 font-semibold">
                        ⚠️ Tutanak Eksik
                      </div>
                    )}
                    {!item.hasData && !item.hasProtocol && (
                      <div className="text-xs mt-1 text-gray-500 dark:text-gray-400 font-semibold">
                        ⏳ Hiç Veri Girilmemiş
                      </div>
                    )}
                  </div>
                  {item.hasObjection && (
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
                
                {/* Başmüşahit Bilgileri — Sorumlu sandık başmüşahitiyle iletişim için */}
                {chiefObserver ? (
                  <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">Başmüşahit</div>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {chiefObserver.name || 'İsim yok'}
                    </div>
                    {chiefObserver.tc && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
                        TC: {chiefObserver.tc}
                      </div>
                    )}
                    {chiefObserver.phone && (
                      <a
                        href={`tel:${chiefObserver.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {chiefObserver.phone}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/40 rounded text-xs text-gray-500 dark:text-gray-400 italic">
                    ⚠️ Bu sandığa başmüşahit atanmamış (sonucu siz girebilirsiniz)
                  </div>
                )}
                
                {/* Oy Sayıları + Tutanak Önizleme — Capabilities Model fallback */}
                {item.hasData && result && (() => {
                  const sumO = (obj) => obj && typeof obj === 'object'
                    ? Object.values(obj).reduce((s, v) => s + (parseInt(v) || 0), 0) : 0;
                  const cbVT = sumO(result.cb_votes);
                  const mvVT = sumO(result.mv_votes);
                  const used = parseInt(result.used_votes) || parseInt(result.cb_used_votes) || parseInt(result.mv_used_votes) || 0;
                  const invalid = parseInt(result.invalid_votes) || parseInt(result.cb_invalid_votes) || parseInt(result.mv_invalid_votes) || 0;
                  const valid = parseInt(result.valid_votes) || parseInt(result.cb_valid_votes) || parseInt(result.mv_valid_votes) || cbVT || mvVT || 0;
                  const cbPhoto = result.signed_protocol_photo || result.signedProtocolPhoto;
                  const mvPhoto = result.signed_mv_protocol_photo || result.signedMvProtocolPhoto;
                  const objPhoto = result.objection_protocol_photo || result.objectionProtocolPhoto;
                  return (
                    <div className="mb-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Kullanılan</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{used}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Geçersiz</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{invalid}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Geçerli</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{valid}</div>
                        </div>
                      </div>
                      {(cbPhoto || mvPhoto || objPhoto) && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tutanaklar:</span>
                          {cbPhoto && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); window.open(cbPhoto, '_blank'); }}
                              className="group relative"
                              title="CB Tutanağını büyüt"
                            >
                              <img src={cbPhoto} alt="CB Tutanağı" className="w-12 h-12 object-cover rounded border-2 border-blue-300 dark:border-blue-700 hover:border-blue-500 transition" loading="lazy" />
                              <span className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[10px] font-bold text-center rounded-b">CB</span>
                            </button>
                          )}
                          {mvPhoto && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); window.open(mvPhoto, '_blank'); }}
                              className="group relative"
                              title="MV Tutanağını büyüt"
                            >
                              <img src={mvPhoto} alt="MV Tutanağı" className="w-12 h-12 object-cover rounded border-2 border-purple-300 dark:border-purple-700 hover:border-purple-500 transition" loading="lazy" />
                              <span className="absolute bottom-0 left-0 right-0 bg-purple-600 text-white text-[10px] font-bold text-center rounded-b">MV</span>
                            </button>
                          )}
                          {objPhoto && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); window.open(objPhoto, '_blank'); }}
                              className="group relative"
                              title="İtiraz Tutanağını büyüt"
                            >
                              <img src={objPhoto} alt="İtiraz Tutanağı" className="w-12 h-12 object-cover rounded border-2 border-red-300 dark:border-red-700 hover:border-red-500 transition" loading="lazy" />
                              <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[10px] font-bold text-center rounded-b">İTR</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                {/* Seçim Bilgisi */}
                {election && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>{election.name}</span>
                    {election.date && ` - ${new Date(election.date).toLocaleDateString('tr-TR')}`}
                    {election.type === 'cb' && election.round && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                        {election.round === 1 ? '1. Tur' : '2. Tur'}
                      </span>
                    )}
                  </div>
                )}

                {/* GÖREV A: Sonuçları Görüntüle/Düzenle butonu */}
                {activeElection && (
                  <button
                    type="button"
                    onClick={(e) => handleOpenResultForm(ballotBox, e)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium shadow-sm transition-colors dark:bg-green-600 dark:hover:bg-green-700"
                    title="Bu sandık için seçim sonucunu girin/düzenleyin"
                  >
                    📋 Sonuçları Görüntüle/Düzenle
                  </button>
                )}
              </div>
            );
          };
          
          return (
            <>
              {/* İtiraz Edilen Sandıklar */}
              {objected.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                    İtiraz Edilen Sandıklar ({objected.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {objected.map((item, index) => renderBallotBoxCard(item, index))}
                  </div>
                </div>
              )}
              
              {/* Seçimi Tamamlananlar */}
              {completed.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
                    Seçimi Tamamlananlar ({completed.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completed.map((item, index) => renderBallotBoxCard(item, index))}
                  </div>
                </div>
              )}
              
              {/* Tutanak Eksik Olanlar */}
              {missingProtocol.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full"></div>
                    Tutanak Eksik Olanlar ({missingProtocol.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {missingProtocol.map((item, index) => renderBallotBoxCard(item, index))}
                  </div>
                </div>
              )}
              
              {/* Sadece Tutanak Yüklenenler */}
              {onlyProtocol.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                    Sadece Tutanak Yüklenenler ({onlyProtocol.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {onlyProtocol.map((item, index) => renderBallotBoxCard(item, index))}
                  </div>
                </div>
              )}
              
              {/* Hiç Veri Girilmeyenler */}
              {noData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-600 dark:text-gray-400 flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full"></div>
                    Hiç Veri Girilmeyenler ({noData.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {noData.map((item, index) => renderBallotBoxCard(item, index))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

      </div>

      {/* GÖREV A: Election Result Form Modal */}
      {showResultForm && selectedBallotBox && activeElection && (
        <ElectionResultForm
          election={activeElection}
          ballotBoxId={selectedBallotBox.id ?? selectedBallotBox.ballot_box_id ?? selectedBallotBox.ballotBoxId}
          ballotNumber={selectedBallotBox.ballot_number ?? selectedBallotBox.ballotNumber ?? selectedBallotBox.id}
          onClose={handleCloseResultForm}
          onSuccess={handleResultFormSuccess}
        />
      )}

      {/* Sandık Sonuç İnceleme Modal — tutanak + rakamlar yan yana */}
      {reviewBox && (
        <BallotBoxResultReview
          ballotBoxId={reviewBox.id ?? reviewBox.ballot_box_id ?? reviewBox.ballotBoxId}
          ballotNumber={reviewBox.ballot_number ?? reviewBox.ballotNumber ?? ''}
          onClose={() => setReviewBox(null)}
          onEdit={(result, election) => {
            // "Düzenle" butonuna basınca: result form modal'ını aç
            setReviewBox(null);
            setSelectedBallotBox(reviewBox);
            // activeElection state'i mevcut; eğer farklı seçimse onu activeElection olarak kullanmıyoruz —
            // ResultForm aktif seçim üzerinden çalışıyor.
            setShowResultForm(true);
          }}
        />
      )}

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
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                const fallback = e.target.nextSibling;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div
              className="items-center justify-center h-96 bg-gray-100 dark:bg-gray-700 rounded-lg"
              style={{ display: 'none' }}
            >
              <p className="text-gray-500 dark:text-gray-400">Resim yüklenemedi</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CoordinatorDashboardPage;

