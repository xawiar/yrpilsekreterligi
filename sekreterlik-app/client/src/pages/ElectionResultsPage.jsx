import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const ElectionResultsPage = () => {
  const { electionId } = useParams();
  const [election, setElection] = useState(null);
  const [results, setResults] = useState([]);
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTown, setSelectedTown] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedBallotNumber, setSelectedBallotNumber] = useState('');

  useEffect(() => {
    if (electionId) {
      fetchData();
    }
  }, [electionId]);

  useEffect(() => {
    if (results.length > 0 && ballotBoxes.length > 0) {
      // Filter results when filters change
      filterResults();
    }
  }, [selectedDistrict, selectedTown, selectedNeighborhood, selectedVillage, selectedBallotNumber, results, ballotBoxes]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        electionsData,
        resultsData,
        ballotBoxesData,
        districtsData,
        townsData,
        neighborhoodsData,
        villagesData,
        observersData
      ] = await Promise.all([
        ApiService.getElections(),
        ApiService.getElectionResults(electionId, null),
        ApiService.getBallotBoxes(),
        ApiService.getDistricts(),
        ApiService.getTowns(),
        ApiService.getNeighborhoods(),
        ApiService.getVillages(),
        ApiService.getBallotBoxObservers()
      ]);

      const selectedElection = electionsData.find(e => String(e.id) === String(electionId));
      setElection(selectedElection);
      setResults(resultsData || []);
      setBallotBoxes(ballotBoxesData || []);
      setDistricts(districtsData || []);
      setTowns(townsData || []);
      setNeighborhoods(neighborhoodsData || []);
      setVillages(villagesData || []);
      setObservers(observersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterResults = () => {
    // Results are already filtered by electionId from API
    // We just need to apply location filters
  };

  // Get filtered results based on location filters
  const getFilteredResults = () => {
    let filtered = results;

    if (selectedBallotNumber) {
      filtered = filtered.filter(r => 
        r.ballot_number && r.ballot_number.toString().includes(selectedBallotNumber)
      );
    }

    // Filter by location through ballot boxes
    if (selectedDistrict || selectedTown || selectedNeighborhood || selectedVillage) {
      const relevantBallotBoxIds = ballotBoxes
        .filter(bb => {
          if (selectedDistrict && String(bb.district_id) !== String(selectedDistrict)) return false;
          if (selectedTown && String(bb.town_id) !== String(selectedTown)) return false;
          if (selectedNeighborhood && String(bb.neighborhood_id) !== String(selectedNeighborhood)) return false;
          if (selectedVillage && String(bb.village_id) !== String(selectedVillage)) return false;
          return true;
        })
        .map(bb => String(bb.id));

      filtered = filtered.filter(r => 
        relevantBallotBoxIds.includes(String(r.ballot_box_id))
      );
    }

    return filtered;
  };

  // Get chief observer for a ballot box
  const getChiefObserver = (ballotBoxId) => {
    const chiefObserver = observers.find(obs => 
      String(obs.ballot_box_id) === String(ballotBoxId) && 
      (obs.is_chief_observer === true || obs.is_chief_observer === 1)
    );
    return chiefObserver || null;
  };

  // Calculate total ballot boxes for this election
  const getTotalBallotBoxes = () => {
    if (!selectedDistrict && !selectedTown && !selectedNeighborhood && !selectedVillage) {
      return ballotBoxes.length;
    }
    return ballotBoxes.filter(bb => {
      if (selectedDistrict && String(bb.district_id) !== String(selectedDistrict)) return false;
      if (selectedTown && String(bb.town_id) !== String(selectedTown)) return false;
      if (selectedNeighborhood && String(bb.neighborhood_id) !== String(selectedNeighborhood)) return false;
      if (selectedVillage && String(bb.village_id) !== String(selectedVillage)) return false;
      return true;
    }).length;
  };

  // Calculate participation percentage
  const calculateParticipationPercentage = () => {
    if (!election?.voter_count || election.voter_count === 0) return 0;
    const filtered = getFilteredResults();
    const totalUsedVotes = filtered.reduce((sum, result) => sum + (parseInt(result.used_votes) || 0), 0);
    return ((totalUsedVotes / election.voter_count) * 100).toFixed(2);
  };

  // Calculate aggregated results
  const calculateAggregatedResults = () => {
    const filtered = getFilteredResults();
    
    if (election?.type === 'cb' && election?.candidates) {
      // CB Seçimi - Aday oyları
      const candidateTotals = {};
      election.candidates.forEach(candidate => {
        candidateTotals[candidate] = 0;
      });

      filtered.forEach(result => {
        if (result.candidate_votes) {
          Object.keys(result.candidate_votes).forEach(candidate => {
            if (candidateTotals.hasOwnProperty(candidate)) {
              candidateTotals[candidate] += result.candidate_votes[candidate] || 0;
            }
          });
        }
      });

      const total = Object.values(candidateTotals).reduce((sum, val) => sum + val, 0);
      
      return {
        type: 'candidates',
        data: Object.keys(candidateTotals).map(candidate => ({
          name: candidate,
          value: candidateTotals[candidate],
          percentage: total > 0 ? ((candidateTotals[candidate] / total) * 100).toFixed(2) : 0
        })),
        total
      };
    } else if ((election?.type === 'yerel' || election?.type === 'genel') && election?.parties) {
      // Yerel/Genel Seçim - Parti oyları
      const partyTotals = {};
      election.parties.forEach(party => {
        partyTotals[party] = 0;
      });

      filtered.forEach(result => {
        if (result.party_votes) {
          Object.keys(result.party_votes).forEach(party => {
            if (partyTotals.hasOwnProperty(party)) {
              partyTotals[party] += result.party_votes[party] || 0;
            }
          });
        }
      });

      const total = Object.values(partyTotals).reduce((sum, val) => sum + val, 0);
      
      return {
        type: 'parties',
        data: Object.keys(partyTotals).map(party => ({
          name: party,
          value: partyTotals[party],
          percentage: total > 0 ? ((partyTotals[party] / total) * 100).toFixed(2) : 0
        })),
        total
      };
    }

    return { type: 'unknown', data: [], total: 0 };
  };

  const aggregatedResults = calculateAggregatedResults();

  // Get location name for a ballot box
  const getLocationName = (ballotBoxId) => {
    const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(ballotBoxId));
    if (!ballotBox) return 'Bilinmeyen';

    const parts = [];
    if (ballotBox.district_id) {
      const district = districts.find(d => String(d.id) === String(ballotBox.district_id));
      if (district) parts.push(district.name);
    }
    if (ballotBox.town_id) {
      const town = towns.find(t => String(t.id) === String(ballotBox.town_id));
      if (town) parts.push(town.name);
    }
    if (ballotBox.neighborhood_id) {
      const neighborhood = neighborhoods.find(n => String(n.id) === String(ballotBox.neighborhood_id));
      if (neighborhood) parts.push(neighborhood.name);
    }
    if (ballotBox.village_id) {
      const village = villages.find(v => String(v.id) === String(ballotBox.village_id));
      if (village) parts.push(village.name);
    }

    return parts.length > 0 ? parts.join(' - ') : 'Konum bilgisi yok';
  };

  // Filter options based on selections
  const filteredTowns = selectedDistrict 
    ? towns.filter(t => String(t.district_id) === String(selectedDistrict))
    : towns;

  const filteredNeighborhoods = () => {
    let base = neighborhoods;
    if (selectedDistrict) base = base.filter(n => String(n.district_id) === String(selectedDistrict));
    if (selectedTown) base = base.filter(n => String(n.town_id) === String(selectedTown));
    return base;
  };

  const filteredVillages = () => {
    let base = villages;
    if (selectedDistrict) base = base.filter(v => String(v.district_id) === String(selectedDistrict));
    if (selectedTown) base = base.filter(v => String(v.town_id) === String(selectedTown));
    return base;
  };

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Seçim bulunamadı</h2>
        </div>
      </div>
    );
  }

  const filteredResults = getFilteredResults();
  
  // Sonuç yoksa bile sayfa görünsün - sıfır değerlerle
  const hasResults = filteredResults.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {election.name} - Seçim Sonuçları
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {election.date ? new Date(election.date).toLocaleDateString('tr-TR') : '-'}
          </p>
          {!hasResults && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Henüz seçim sonucu girilmemiş. Sonuçlar girildikçe bu sayfada görünecektir.
              </p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Filtreler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                İlçe
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedTown('');
                  setSelectedNeighborhood('');
                  setSelectedVillage('');
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Tüm İlçeler</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Belde
              </label>
              <select
                value={selectedTown}
                onChange={(e) => {
                  setSelectedTown(e.target.value);
                  setSelectedNeighborhood('');
                  setSelectedVillage('');
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                disabled={!selectedDistrict}
              >
                <option value="">Tüm Beldeler</option>
                {filteredTowns.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mahalle
              </label>
              <select
                value={selectedNeighborhood}
                onChange={(e) => setSelectedNeighborhood(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Tüm Mahalleler</option>
                {filteredNeighborhoods().map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Köy
              </label>
              <select
                value={selectedVillage}
                onChange={(e) => setSelectedVillage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Tüm Köyler</option>
                {filteredVillages().map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sandık Numarası
              </label>
              <input
                type="text"
                value={selectedBallotNumber}
                onChange={(e) => setSelectedBallotNumber(e.target.value)}
                placeholder="Sandık no ara..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Toplam Sandık</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {getTotalBallotBoxes()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Açılan Sandık</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {filteredResults.length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Toplam Geçerli Oy</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {aggregatedResults.total.toLocaleString('tr-TR')}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Katılım Yüzdesi</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              %{calculateParticipationPercentage()}
            </div>
            {election?.voter_count && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Seçmen: {election.voter_count.toLocaleString('tr-TR')}
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        {election && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Genel Sonuçlar - Pasta Grafiği
            </h2>
            {aggregatedResults.data.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={aggregatedResults.data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name}: %${percentage}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {aggregatedResults.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {aggregatedResults.data.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{item.value.toLocaleString('tr-TR')}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">%{item.percentage}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Henüz sonuç girilmemiş
                </p>
                <div className="space-y-2">
                  {election.type === 'cb' && election.candidates && election.candidates.length > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p className="font-medium mb-2">Adaylar:</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {election.candidates.map((candidate, idx) => (
                          <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {candidate}: 0 oy (%0)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(election.type === 'yerel' || election.type === 'genel') && election.parties && election.parties.length > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p className="font-medium mb-2">Partiler:</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {election.parties.map((party, idx) => (
                          <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {party}: 0 oy (%0)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Sandık Bazında Detaylı Sonuçlar
          </h2>
          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Sonuç bulunamadı
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResults.map((result) => {
                const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
                const chiefObserver = getChiefObserver(result.ballot_box_id);
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
                    const neighborhood = neighborhoods.find(n => String(n.id) === String(ballotBox.neighborhood_id));
                    if (neighborhood) locationParts.push({ type: 'Mahalle', name: neighborhood.name });
                  }
                  if (ballotBox.village_id) {
                    const village = villages.find(v => String(v.id) === String(ballotBox.village_id));
                    if (village) locationParts.push({ type: 'Köy', name: village.name });
                  }
                }

                const totalValidVotes = election.type === 'cb' 
                  ? Object.values(result.candidate_votes || {}).reduce((sum, val) => sum + (val || 0), 0)
                  : Object.values(result.party_votes || {}).reduce((sum, val) => sum + (val || 0), 0);

                return (
                  <div key={result.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Sandık No: {result.ballot_number}
                      </h3>
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

                    {/* Parti/Aday Oyları */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      {election.type === 'cb' && election.candidates && (
                        <div className="space-y-2">
                          {election.candidates.map(candidate => {
                            const votes = result.candidate_votes?.[candidate] || 0;
                            const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                            return (
                              <div key={candidate} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700 dark:text-gray-300">{candidate}</span>
                                <div className="text-right">
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">{votes}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">%{percentage}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(election.type === 'yerel' || election.type === 'genel') && election.parties && (
                        <div className="space-y-2">
                          {election.parties.map(party => {
                            const votes = result.party_votes?.[party] || 0;
                            const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                            return (
                              <div key={party} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700 dark:text-gray-300">{party}</span>
                                <div className="text-right">
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">{votes}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">%{percentage}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ElectionResultsPage;

