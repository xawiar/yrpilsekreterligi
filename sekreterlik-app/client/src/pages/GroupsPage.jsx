import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import * as XLSX from 'xlsx';

const GroupsPage = () => {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [neighborhoodRepresentatives, setNeighborhoodRepresentatives] = useState([]);
  const [villageRepresentatives, setVillageRepresentatives] = useState([]);
  const [neighborhoodSupervisors, setNeighborhoodSupervisors] = useState([]);
  const [villageSupervisors, setVillageSupervisors] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [ballotBoxObservers, setBallotBoxObservers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupLeaderIds, setGroupLeaderIds] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [neighborhoodsData, villagesData, groupsData, membersData, neighborhoodRepsData, villageRepsData, neighborhoodSupsData, villageSupsData, districtsData, townsData, ballotBoxesData, ballotBoxObserversData] = await Promise.all([
        ApiService.getNeighborhoods(),
        ApiService.getVillages(),
        ApiService.getGroups(),
        ApiService.getMembers(),
        ApiService.getNeighborhoodRepresentatives(),
        ApiService.getVillageRepresentatives(),
        ApiService.getNeighborhoodSupervisors(),
        ApiService.getVillageSupervisors(),
        ApiService.getDistricts(),
        ApiService.getTowns(),
        ApiService.getBallotBoxes(),
        ApiService.getBallotBoxObservers()
      ]);

      setNeighborhoods(neighborhoodsData);
      setVillages(villagesData);
      setMembers(membersData);
      setNeighborhoodRepresentatives(neighborhoodRepsData);
      setVillageRepresentatives(villageRepsData);
      setNeighborhoodSupervisors(neighborhoodSupsData);
      setVillageSupervisors(villageSupsData);
      setDistricts(districtsData);
      setTowns(townsData);
      setBallotBoxes(ballotBoxesData || []);
      setBallotBoxObservers(ballotBoxObserversData || []);

      // Groups data - eğer yoksa boş array
      if (groupsData && Array.isArray(groupsData)) {
        setGroups(groupsData);
        // Initialize group leader IDs
        const leaderIds = {};
        groupsData.forEach(group => {
          if (group.group_no) {
            leaderIds[group.group_no] = group.group_leader_id || '';
          }
        });
        setGroupLeaderIds(leaderIds);
      } else {
        setGroups([]);
        setGroupLeaderIds({});
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group neighborhoods and villages by group_no
  const groupedData = {};
  
  neighborhoods.forEach(neighborhood => {
    if (neighborhood.group_no) {
      const groupNo = String(neighborhood.group_no);
      if (!groupedData[groupNo]) {
        groupedData[groupNo] = {
          group_no: groupNo,
          neighborhoods: [],
          villages: []
        };
      }
      groupedData[groupNo].neighborhoods.push(neighborhood);
    }
  });

  villages.forEach(village => {
    if (village.group_no) {
      const groupNo = String(village.group_no);
      if (!groupedData[groupNo]) {
        groupedData[groupNo] = {
          group_no: groupNo,
          neighborhoods: [],
          villages: []
        };
      }
      groupedData[groupNo].villages.push(village);
    }
  });

  const sortedGroupNos = Object.keys(groupedData).sort((a, b) => {
    const numA = parseInt(a) || 0;
    const numB = parseInt(b) || 0;
    return numA - numB;
  });

  const handleGroupLeaderChange = async (groupNo, memberId) => {
    try {
      setGroupLeaderIds(prev => ({
        ...prev,
        [groupNo]: memberId
      }));

      // Save to Firebase
      await ApiService.createOrUpdateGroup(groupNo, memberId || null);
      
      // Refresh groups data
      const groupsData = await ApiService.getGroups();
      setGroups(groupsData);
    } catch (error) {
      console.error('Error updating group leader:', error);
      // Revert on error
      fetchData();
    }
  };

  const getGroupLeader = (groupNo) => {
    const group = groups.find(g => String(g.group_no) === String(groupNo));
    if (group && group.group_leader_id) {
      return members.find(m => String(m.id) === String(group.group_leader_id));
    }
    return null;
  };

  // Grup sandık ve müşahit helper fonksiyonları
  const getGroupBallotBoxes = (groupNo) => {
    const group = groupedData[groupNo];
    if (!group) return [];
    const neighborhoodIds = group.neighborhoods.map(n => String(n.id));
    const villageIds = group.villages.map(v => String(v.id));
    return ballotBoxes.filter(bb =>
      (bb.neighborhood_id && neighborhoodIds.includes(String(bb.neighborhood_id))) ||
      (bb.village_id && villageIds.includes(String(bb.village_id)))
    );
  };

  const getGroupBallotBoxCount = (groupNo) => {
    return getGroupBallotBoxes(groupNo).length;
  };

  const getGroupObserverCount = (groupNo) => {
    const groupBBIds = getGroupBallotBoxes(groupNo).map(bb => String(bb.id));
    return ballotBoxObservers.filter(obs =>
      obs.ballot_box_id && groupBBIds.includes(String(obs.ballot_box_id))
    ).length;
  };

  const getGroupChiefCount = (groupNo) => {
    const groupBBIds = getGroupBallotBoxes(groupNo).map(bb => String(bb.id));
    return ballotBoxObservers.filter(obs =>
      obs.ballot_box_id && groupBBIds.includes(String(obs.ballot_box_id)) &&
      (obs.is_chief_observer === true || obs.is_chief_observer === 1)
    ).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/election-preparation"
            className="text-indigo-600 hover:text-indigo-800 mb-2 inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Seçime Hazırlık
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gruplar</h1>
        </div>
        <button
          onClick={() => {
            const excelData = [
              ['Grup No', 'Grup Lideri', 'Mahalle/Köy', 'İlçe', 'Belde', 'Temsilci', 'Temsilci Telefon', 'Müfettiş', 'Müfettiş Telefon']
            ];
            
            sortedGroupNos.forEach(groupNo => {
              const groupData = groupedData[groupNo];
              const groupLeader = getGroupLeader(groupNo);
              
              // Mahalleler
              groupData.neighborhoods.forEach(neighborhood => {
                const rep = neighborhoodRepresentatives.find(r => String(r.neighborhood_id) === String(neighborhood.id));
                const sup = neighborhoodSupervisors.find(s => String(s.neighborhood_id) === String(neighborhood.id));
                const district = districts.find(d => String(d.id) === String(neighborhood.district_id));
                const town = neighborhood.town_id ? towns.find(t => String(t.id) === String(neighborhood.town_id)) : null;
                
                excelData.push([
                  groupNo,
                  groupLeader ? groupLeader.name : '',
                  neighborhood.name || '',
                  district?.name || '',
                  town?.name || '',
                  rep?.name || '',
                  rep?.phone || '',
                  sup?.name || '',
                  sup?.phone || ''
                ]);
              });
              
              // Köyler
              groupData.villages.forEach(village => {
                const rep = villageRepresentatives.find(r => String(r.village_id) === String(village.id));
                const sup = villageSupervisors.find(s => String(s.village_id) === String(village.id));
                const district = districts.find(d => String(d.id) === String(village.district_id));
                const town = village.town_id ? towns.find(t => String(t.id) === String(village.town_id)) : null;
                
                excelData.push([
                  groupNo,
                  groupLeader ? groupLeader.name : '',
                  village.name || '',
                  district?.name || '',
                  town?.name || '',
                  rep?.name || '',
                  rep?.phone || '',
                  sup?.name || '',
                  sup?.phone || ''
                ]);
              });
            });
            
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            ws['!cols'] = [
              { wch: 10 }, // Grup No
              { wch: 25 }, // Grup Lideri
              { wch: 20 }, // Mahalle/Köy
              { wch: 15 }, // İlçe
              { wch: 15 }, // Belde
              { wch: 25 }, // Temsilci
              { wch: 15 }, // Temsilci Telefon
              { wch: 25 }, // Müfettiş
              { wch: 15 }  // Müfettiş Telefon
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Gruplar');

            const fileName = `gruplar_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Excel'e Aktar
        </button>
      </div>

      {sortedGroupNos.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Henüz grup oluşturulmamış. Grup numarası atanmış mahalle ve köyler burada görünecektir.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGroupNos.map(groupNo => {
            const groupData = groupedData[groupNo];
            const groupLeader = getGroupLeader(groupNo);
            const currentLeaderId = groupLeaderIds[groupNo] || (groupLeader ? groupLeader.id : '');

            return (
              <div key={groupNo} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                {/* Group Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Grup {groupNo}</h2>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                      {groupData.neighborhoods.length + groupData.villages.length} Toplam
                    </span>
                  </div>
                  
                  {/* Group Leader Selection */}
                  <div className="flex items-center space-x-4">
                    <label htmlFor={`group-leader-${groupNo}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Grup Lideri:
                    </label>
                    <select
                      id={`group-leader-${groupNo}`}
                      value={currentLeaderId}
                      onChange={(e) => handleGroupLeaderChange(groupNo, e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Grup lideri seçin</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                    {groupLeader && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Seçili: <span className="font-medium">{groupLeader.name}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Grup Sandık Özeti */}
                <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    {getGroupBallotBoxCount(groupNo)} sandık
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    {getGroupObserverCount(groupNo)} müşahit
                  </span>
                  <span className={`inline-flex items-center gap-1 ${getGroupChiefCount(groupNo) < getGroupBallotBoxCount(groupNo) ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    {getGroupChiefCount(groupNo)}/{getGroupBallotBoxCount(groupNo)} başmüşahit
                  </span>
                </div>

                {/* Neighborhoods Table */}
                {groupData.neighborhoods.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Mahalleler ({groupData.neighborhoods.length})
                    </h3>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {groupData.neighborhoods.map(neighborhood => {
                        const representative = neighborhoodRepresentatives.find(rep => String(rep.neighborhood_id) === String(neighborhood.id));
                        const supervisor = neighborhoodSupervisors.find(sup => String(sup.neighborhood_id) === String(neighborhood.id));
                        const district = districts.find(d => String(d.id) === String(neighborhood.district_id));
                        const town = neighborhood.town_id ? towns.find(t => String(t.id) === String(neighborhood.town_id)) : null;
                        
                        return (
                          <div key={neighborhood.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                            <div className="space-y-3">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{neighborhood.name}</h4>
                              <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">İlçe:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{district?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Belde:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{town?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Temsilci:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{representative?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Temsilci Telefon:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{representative?.phone || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Müfettiş:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{supervisor?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Müfettiş Telefon:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{supervisor?.phone || '-'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mahalle Adı</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">İlçe</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Belde</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temsilci</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temsilci Telefon</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Müfettiş</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Müfettiş Telefon</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {groupData.neighborhoods.map(neighborhood => {
                            const representative = neighborhoodRepresentatives.find(rep => String(rep.neighborhood_id) === String(neighborhood.id));
                            const supervisor = neighborhoodSupervisors.find(sup => String(sup.neighborhood_id) === String(neighborhood.id));
                            const district = districts.find(d => String(d.id) === String(neighborhood.district_id));
                            const town = neighborhood.town_id ? towns.find(t => String(t.id) === String(neighborhood.town_id)) : null;
                            
                            return (
                              <tr key={neighborhood.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{neighborhood.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{district?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{town?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{representative?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{representative?.phone || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{supervisor?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{supervisor?.phone || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Villages Table */}
                {groupData.villages.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Köyler ({groupData.villages.length})
                    </h3>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {groupData.villages.map(village => {
                        const representative = villageRepresentatives.find(rep => String(rep.village_id) === String(village.id));
                        const supervisor = villageSupervisors.find(sup => String(sup.village_id) === String(village.id));
                        const district = districts.find(d => String(d.id) === String(village.district_id));
                        const town = village.town_id ? towns.find(t => String(t.id) === String(village.town_id)) : null;
                        
                        return (
                          <div key={village.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                            <div className="space-y-3">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{village.name}</h4>
                              <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">İlçe:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{district?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Belde:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{town?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Temsilci:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{representative?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Temsilci Telefon:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{representative?.phone || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Müfettiş:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{supervisor?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Müfettiş Telefon:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{supervisor?.phone || '-'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Köy Adı</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">İlçe</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Belde</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temsilci</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temsilci Telefon</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Müfettiş</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Müfettiş Telefon</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {groupData.villages.map(village => {
                            const representative = villageRepresentatives.find(rep => String(rep.village_id) === String(village.id));
                            const supervisor = villageSupervisors.find(sup => String(sup.village_id) === String(village.id));
                            const district = districts.find(d => String(d.id) === String(village.district_id));
                            const town = village.town_id ? towns.find(t => String(t.id) === String(village.town_id)) : null;
                            
                            return (
                              <tr key={village.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{village.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{district?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{town?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{representative?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{representative?.phone || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{supervisor?.name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{supervisor?.phone || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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

export default GroupsPage;

