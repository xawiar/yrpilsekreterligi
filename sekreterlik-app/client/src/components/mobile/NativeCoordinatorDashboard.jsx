/**
 * Native Mobile Coordinator Dashboard Component
 * Sorumlu dashboard'u için native mobil görünümü
 */
import React from 'react';
import NativeCard from './NativeCard';
import { useNavigate } from 'react-router-dom';

const NativeCoordinatorDashboard = ({
  coordinator = null,
  ballotBoxes = [],
  electionResults = [],
  regionInfo = null,
  neighborhoods = [],
  villages = [],
  parentCoordinators = [],
  elections = [],
  observers = [],
  districts = [],
  towns = [],
  neighborhoodsList = [],
  villagesList = [],
  onLogout,
  getRoleLabel = (r) => r,
  getWinningParty = () => null,
  getPartyColor = () => ({ border: '#E5E7EB', bg: '#F9FAFB', text: '#6B7280' }),
  hasData = () => false,
  hasProtocol = () => false,
  loading = false
}) => {
  const navigate = useNavigate();

  // Tüm sandıkları ve sonuçlarını gruplandır
  const allBallotBoxesWithResults = {};
  
  // Önce tüm sandıkları ekle
  ballotBoxes.forEach((ballotBox) => {
    const ballotNumber = ballotBox.ballot_number || ballotBox.id;
    if (!allBallotBoxesWithResults[ballotNumber]) {
      allBallotBoxesWithResults[ballotNumber] = {
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
    const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
    const ballotNumber = ballotBox?.ballot_number || result.ballot_box_id;
    
    const hasDataResult = hasData(result);
    const hasProtocolResult = hasProtocol(result);
    const hasObjectionResult = result.has_objection === true || result.has_objection === 1;
    
    if (!allBallotBoxesWithResults[ballotNumber]) {
      allBallotBoxesWithResults[ballotNumber] = {
        ballotBox: ballotBox || { id: result.ballot_box_id, ballot_number: ballotNumber },
        result: null,
        hasData: false,
        hasProtocol: false,
        hasObjection: false
      };
    }
    
    // Daha yeni sonuç varsa güncelle
    if (!allBallotBoxesWithResults[ballotNumber].result || 
        (result.created_at && allBallotBoxesWithResults[ballotNumber].result?.created_at && 
         new Date(result.created_at) > new Date(allBallotBoxesWithResults[ballotNumber].result.created_at)) ||
        (result.id > allBallotBoxesWithResults[ballotNumber].result?.id)) {
      allBallotBoxesWithResults[ballotNumber].result = result;
      allBallotBoxesWithResults[ballotNumber].hasData = hasDataResult;
      allBallotBoxesWithResults[ballotNumber].hasProtocol = hasProtocolResult;
      allBallotBoxesWithResults[ballotNumber].hasObjection = hasObjectionResult;
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

  const getLocationInfo = (ballotBox) => {
    const district = districts.find(d => String(d.id) === String(ballotBox.district_id));
    const town = towns.find(t => String(t.id) === String(ballotBox.town_id));
    const neighborhood = neighborhoodsList.find(n => String(n.id) === String(ballotBox.neighborhood_id));
    const village = villagesList.find(v => String(v.id) === String(ballotBox.village_id));
    const observer = observers.find(o => String(o.ballot_box_id) === String(ballotBox.id));
    
    return {
      district: district?.name,
      town: town?.name,
      neighborhood: neighborhood?.name,
      village: village?.name,
      observer: observer?.name || observer?.observer_name
    };
  };

  return (
    <div className="px-4 py-6 space-y-4 pb-24 overflow-y-auto" style={{ height: '100vh', WebkitOverflowScrolling: 'touch' }}>
      {/* Header with Logout */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Sorumlu Dashboard
          </h1>
          {coordinator && (
            <p className="text-gray-600 dark:text-gray-400 text-base">
              {coordinator.name || 'Bilinmiyor'} - {getRoleLabel(coordinator.role)}
            </p>
          )}
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        )}
      </div>

      {/* Coordinator Info Card */}
      {coordinator && (
        <NativeCard className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                  {coordinator.name || 'Bilinmiyor'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {getRoleLabel(coordinator.role)}
                </div>
              </div>
            </div>
            {(coordinator.tc || coordinator.phone) && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                {coordinator.tc && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">TC Kimlik No</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {coordinator.tc}
                    </div>
                  </div>
                )}
                {coordinator.phone && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Telefon</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {coordinator.phone}
                    </div>
                  </div>
                )}
              </div>
            )}
            {coordinator.institutionName && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kurum</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {coordinator.institutionName}
                </div>
              </div>
            )}
          </div>
        </NativeCard>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
            {ballotBoxes.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Toplam Sandık
          </div>
        </NativeCard>

        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
            {completed.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Tamamlanan
          </div>
        </NativeCard>
      </div>

      {/* Bölge Bilgisi */}
      {regionInfo && (
        <NativeCard>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h1.5M21 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0H21m-1.5 0H18" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                {regionInfo.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Sorumlu Olduğunuz Bölge
              </div>
            </div>
          </div>
        </NativeCard>
      )}

      {/* Üst Sorumlular */}
      {parentCoordinators.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
            Üst Sorumlular
          </h2>
          {parentCoordinators.map((parent, index) => (
            <NativeCard key={parent.id}>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {parent.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {getRoleLabel(parent.role)}
                  </div>
                  {parent.phone && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      📞 {parent.phone}
                    </div>
                  )}
                </div>
              </div>
            </NativeCard>
          ))}
        </div>
      )}

      {/* İtiraz Edilen Sandıklar */}
      {objected.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 px-1">
            İtiraz Edilen Sandıklar ({objected.length})
          </h2>
          {objected.map((item, index) => {
            const { ballotBox, result } = item;
            const election = result ? elections.find(e => String(e.id) === String(result.election_id)) : null;
            const location = getLocationInfo(ballotBox);
            const winningParty = result ? getWinningParty(result, election) : null;
            const partyColor = winningParty ? getPartyColor(winningParty) : null;
            
            return (
              <NativeCard
                key={ballotBox.id || index}
                onClick={() => result ? navigate(`/election-results/${result.election_id}/edit/${result.id}`) : null}
                className={result ? 'cursor-pointer active:scale-[0.98]' : ''}
                style={{ borderColor: '#EF4444', borderWidth: '2px' }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center flex-shrink-0">
                    <div className="text-white font-bold text-lg">
                      {ballotBox.ballot_number || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                      {election?.name || 'Seçim'}
                    </div>
                    {location.district && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        📍 {[location.district, location.town, location.neighborhood, location.village].filter(Boolean).join(', ')}
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
                        ⚠️ İtiraz Edildi
                      </span>
                    </div>
                  </div>
                </div>
              </NativeCard>
            );
          })}
        </div>
      )}

      {/* Seçimi Tamamlananlar */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 px-1">
            Seçimi Tamamlananlar ({completed.length})
          </h2>
          {completed.map((item, index) => {
            const { ballotBox, result } = item;
            const election = result ? elections.find(e => String(e.id) === String(result.election_id)) : null;
            const location = getLocationInfo(ballotBox);
            const winningParty = result ? getWinningParty(result, election) : null;
            const partyColor = winningParty ? getPartyColor(winningParty) : null;
            
            return (
              <NativeCard
                key={ballotBox.id || index}
                onClick={() => navigate(`/election-results/${result.election_id}/edit/${result.id}`)}
                className="cursor-pointer active:scale-[0.98]"
                style={{ borderColor: '#10B981', borderWidth: '2px' }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                    <div className="text-white font-bold text-lg">
                      {ballotBox.ballot_number || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                      {election?.name || 'Seçim'}
                    </div>
                    {location.district && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        📍 {[location.district, location.town, location.neighborhood, location.village].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {winningParty && (
                      <div className="mt-2">
                        <span 
                          className="px-2 py-1 text-xs font-semibold rounded-lg"
                          style={{ 
                            backgroundColor: partyColor.bg, 
                            color: partyColor.text,
                            border: `1px solid ${partyColor.border}`
                          }}
                        >
                          🏆 {winningParty}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </NativeCard>
            );
          })}
        </div>
      )}

      {/* Tutanak Eksik Olanlar */}
      {missingProtocol.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 px-1">
            Tutanak Eksik Olanlar ({missingProtocol.length})
          </h2>
          {missingProtocol.map((item, index) => {
            const { ballotBox, result } = item;
            const election = result ? elections.find(e => String(e.id) === String(result.election_id)) : null;
            const location = getLocationInfo(ballotBox);
            
            return (
              <NativeCard
                key={ballotBox.id || index}
                onClick={() => navigate(`/election-results/${result.election_id}/edit/${result.id}`)}
                className="cursor-pointer active:scale-[0.98]"
                style={{ borderColor: '#F59E0B', borderWidth: '2px' }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <div className="text-white font-bold text-lg">
                      {ballotBox.ballot_number || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                      {election?.name || 'Seçim'}
                    </div>
                    {location.district && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        📍 {[location.district, location.town, location.neighborhood, location.village].filter(Boolean).join(', ')}
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-lg">
                        ⚠️ Tutanak Eksik
                      </span>
                    </div>
                  </div>
                </div>
              </NativeCard>
            );
          })}
        </div>
      )}

      {/* Sadece Tutanak Yüklenenler */}
      {onlyProtocol.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 px-1">
            Sadece Tutanak Yüklenenler ({onlyProtocol.length})
          </h2>
          {onlyProtocol.map((item, index) => {
            const { ballotBox, result } = item;
            const election = result ? elections.find(e => String(e.id) === String(result.election_id)) : null;
            const location = getLocationInfo(ballotBox);
            
            return (
              <NativeCard
                key={ballotBox.id || index}
                onClick={() => navigate(`/election-results/${result.election_id}/edit/${result.id}`)}
                className="cursor-pointer active:scale-[0.98]"
                style={{ borderColor: '#EF4444', borderWidth: '2px' }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <div className="text-white font-bold text-lg">
                      {ballotBox.ballot_number || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                      {election?.name || 'Seçim'}
                    </div>
                    {location.district && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        📍 {[location.district, location.town, location.neighborhood, location.village].filter(Boolean).join(', ')}
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
                        ⚠️ Sadece Tutanak (Veri Yok)
                      </span>
                    </div>
                  </div>
                </div>
              </NativeCard>
            );
          })}
        </div>
      )}

      {/* Hiç Veri Girilmeyenler */}
      {noData.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-400 px-1">
            Hiç Veri Girilmeyenler ({noData.length})
          </h2>
          {noData.map((item, index) => {
            const { ballotBox } = item;
            const location = getLocationInfo(ballotBox);
            
            return (
              <NativeCard key={ballotBox.id || index} style={{ borderColor: '#E5E7EB', borderWidth: '2px' }}>
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-gray-400 to-gray-500 flex items-center justify-center flex-shrink-0">
                    <div className="text-white font-bold text-lg">
                      {ballotBox.ballot_number || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                      Sandık #{ballotBox.ballot_number}
                    </div>
                    {location.district && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        📍 {[location.district, location.town, location.neighborhood, location.village].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {location.observer && (
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        👤 {location.observer}
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg">
                        ⏳ Hiç Veri Girilmemiş
                      </span>
                    </div>
                  </div>
                </div>
              </NativeCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NativeCoordinatorDashboard;

