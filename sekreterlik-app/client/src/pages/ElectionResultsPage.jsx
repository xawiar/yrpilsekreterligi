import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ComposedChart } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { calculateDHondt, calculateDHondtDetailed, calculateMunicipalCouncilSeats, calculateProvincialAssemblySeats } from '../utils/dhondt';

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

const ElectionResultsPage = () => {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [results, setResults] = useState([]);
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [observers, setObservers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTown, setSelectedTown] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedBallotNumber, setSelectedBallotNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // Arama sorgusu
  const [filterByObjection, setFilterByObjection] = useState(''); // 'all', 'with', 'without'
  const [filterByProtocolOnly, setFilterByProtocolOnly] = useState(false); // Sadece tutanak olanlar
  const [filterByNoProtocol, setFilterByNoProtocol] = useState(false); // Hiç tutanak yüklenmemiş
  const [showFilters, setShowFilters] = useState(false); // Filtreler accordion açık/kapalı
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Modal state for viewing photos
  const [modalPhoto, setModalPhoto] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  
  // Chart detail modal state
  const [selectedChartData, setSelectedChartData] = useState(null);
  const [showChartDetailModal, setShowChartDetailModal] = useState(false);
  const [activeChartType, setActiveChartType] = useState('pie'); // 'pie' or 'bar'
  
  // Refs for export
  const chartContainerRef = useRef(null);

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
  }, [selectedDistrict, selectedTown, selectedNeighborhood, selectedVillage, selectedBallotNumber, searchQuery, filterByObjection, filterByProtocolOnly, filterByNoProtocol, results, ballotBoxes]);

  const fetchData = async () => {
    try {
      console.log('🔄 ElectionResultsPage: fetchData başladı, electionId:', electionId);
      setLoading(true);
      
      console.log('📡 API çağrıları başlatılıyor...');
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

      console.log('✅ API çağrıları tamamlandı:', {
        electionsCount: electionsData?.length || 0,
        resultsCount: resultsData?.length || 0,
        ballotBoxesCount: ballotBoxesData?.length || 0,
        districtsCount: districtsData?.length || 0,
        townsCount: townsData?.length || 0,
        neighborhoodsCount: neighborhoodsData?.length || 0,
        villagesCount: villagesData?.length || 0,
        observersCount: observersData?.length || 0
      });

      const selectedElection = electionsData.find(e => String(e.id) === String(electionId));
      console.log('🔍 Seçim bulundu:', selectedElection ? { id: selectedElection.id, name: selectedElection.name } : 'BULUNAMADI');
      
      setElection(selectedElection);
      setResults(resultsData || []);
      setBallotBoxes(ballotBoxesData || []);
      setDistricts(districtsData || []);
      setTowns(townsData || []);
      setNeighborhoods(neighborhoodsData || []);
      setVillages(villagesData || []);
      setObservers(observersData || []);
      
      console.log('✅ State güncellendi');
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    } finally {
      setLoading(false);
      console.log('🏁 Loading false yapıldı');
    }
  };

  const filterResults = () => {
    // Results are already filtered by electionId from API
    // We just need to apply location filters
  };

  // Get filtered results based on location filters and search query
  const getFilteredResults = () => {
    let filtered = results;

    // Arama sorgusu ile filtrele
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchingBallotBoxIds = new Set();
      
      // İlçe, belde, mahalle, köy isimlerine göre arama
      ballotBoxes.forEach(bb => {
        let matches = false;
        
        // İlçe kontrolü
        if (bb.district_id) {
          const district = districts.find(d => String(d.id) === String(bb.district_id));
          if (district && district.name.toLowerCase().includes(query)) {
            matches = true;
          }
        }
        
        // Belde kontrolü
        if (bb.town_id) {
          const town = towns.find(t => String(t.id) === String(bb.town_id));
          if (town && town.name.toLowerCase().includes(query)) {
            matches = true;
          }
        }
        
        // Mahalle kontrolü
        if (bb.neighborhood_id) {
          const neighborhood = neighborhoods.find(n => String(n.id) === String(bb.neighborhood_id));
          if (neighborhood && neighborhood.name.toLowerCase().includes(query)) {
            matches = true;
          }
        }
        
        // Köy kontrolü
        if (bb.village_id) {
          const village = villages.find(v => String(v.id) === String(bb.village_id));
          if (village && village.name.toLowerCase().includes(query)) {
            matches = true;
          }
        }
        
        // Sandık numarası kontrolü
        if (bb.ballot_box_number && bb.ballot_box_number.toString().toLowerCase().includes(query)) {
          matches = true;
        }
        
        if (matches) {
          matchingBallotBoxIds.add(String(bb.id));
        }
      });
      
      // Sonuçlarda da sandık numarasına göre arama
      filtered = filtered.filter(r => {
        const ballotBoxId = String(r.ballot_box_id || r.ballotBoxId);
        const ballotNumber = (r.ballot_number || r.ballotNumber || '').toString().toLowerCase();
        
        // Sandık numarası eşleşiyorsa
        if (ballotNumber.includes(query)) {
          return true;
        }
        
        // Konum eşleşiyorsa
        if (matchingBallotBoxIds.has(ballotBoxId)) {
          return true;
        }
        
        return false;
      });
    }

    // Dropdown filtreleri
    if (selectedBallotNumber) {
      filtered = filtered.filter(r => 
        r.ballot_number && r.ballot_number.toString().includes(selectedBallotNumber)
      );
    }

    // İtiraz filtresi
    if (filterByObjection === 'with') {
      filtered = filtered.filter(r => r.has_objection === true || r.has_objection === 1);
    } else if (filterByObjection === 'without') {
      filtered = filtered.filter(r => !r.has_objection || r.has_objection === false || r.has_objection === 0);
    }

    // Sadece tutanak olanlar filtresi (protocol photo var ama veri yok)
    if (filterByProtocolOnly) {
      filtered = filtered.filter(r => {
        const hasProtocol = !!(r.signed_protocol_photo || r.signedProtocolPhoto || r.objection_protocol_photo || r.objectionProtocolPhoto);
        const hasData = !!(r.used_votes || r.valid_votes || r.invalid_votes || 
          (r.cb_votes && Object.keys(r.cb_votes).length > 0) ||
          (r.mv_votes && Object.keys(r.mv_votes).length > 0) ||
          (r.mayor_votes && Object.keys(r.mayor_votes).length > 0) ||
          (r.provincial_assembly_votes && Object.keys(r.provincial_assembly_votes).length > 0) ||
          (r.municipal_council_votes && Object.keys(r.municipal_council_votes).length > 0) ||
          (r.referendum_votes && Object.keys(r.referendum_votes).length > 0) ||
          (r.candidate_votes && Object.keys(r.candidate_votes).length > 0) ||
          (r.party_votes && Object.keys(r.party_votes).length > 0));
        return hasProtocol && !hasData;
      });
    }

    // Hiç tutanak yüklenmemiş filtresi
    if (filterByNoProtocol) {
      filtered = filtered.filter(r => {
        const hasProtocol = !!(r.signed_protocol_photo || r.signedProtocolPhoto || r.objection_protocol_photo || r.objectionProtocolPhoto);
        return !hasProtocol;
      });
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
    const filtered = getFilteredResults();
    if (filtered.length === 0) return '0.00';
    
    // Toplam seçmen sayısını ballot box'lardan hesapla
    const totalVoters = filtered.reduce((sum, result) => {
      // Önce result'tan total_voters'a bak
      if (result.total_voters) {
        return sum + (parseInt(result.total_voters) || 0);
      }
      // Sonra ballot box'tan voter_count'a bak
      const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
      if (ballotBox && ballotBox.voter_count) {
        return sum + (parseInt(ballotBox.voter_count) || 0);
      }
      return sum;
    }, 0);
    
    if (totalVoters === 0) return '0.00';
    
    const totalUsedVotes = filtered.reduce((sum, result) => sum + (parseInt(result.used_votes) || 0), 0);
    return ((totalUsedVotes / totalVoters) * 100).toFixed(2);
  };

  // Calculate opened ballot box percentage
  const calculateOpenedBallotBoxPercentage = () => {
    const total = getTotalBallotBoxes();
    if (total === 0) return '0.00';
    const opened = hasResults ? filteredResults.length : 0;
    return ((opened / total) * 100).toFixed(2);
  };

  // Calculate aggregated results for new election system - returns separate results for each category
  const calculateAggregatedResults = () => {
    const filtered = getFilteredResults();
    
    if (election?.type === 'genel') {
      // Genel Seçim: CB ve MV oyları ayrı ayrı
      // CB Oyları
      const cbTotals = {};
      if (election.cb_candidates) {
        election.cb_candidates.forEach(candidate => {
          cbTotals[candidate] = 0;
        });
      }
      if (election.independent_cb_candidates) {
        election.independent_cb_candidates.forEach(candidate => {
          cbTotals[candidate] = 0;
        });
      }

      filtered.forEach(result => {
        if (result.cb_votes) {
          Object.keys(result.cb_votes).forEach(candidate => {
            if (cbTotals.hasOwnProperty(candidate)) {
              cbTotals[candidate] += parseInt(result.cb_votes[candidate]) || 0;
            }
          });
        }
      });

      const cbTotal = Object.values(cbTotals).reduce((sum, val) => sum + val, 0);

      // MV Oyları (Parti bazlı)
      const mvTotals = {};
      if (election.parties) {
        election.parties.forEach(party => {
          const partyName = typeof party === 'string' ? party : (party.name || party);
          mvTotals[partyName] = 0;
        });
      }
      if (election.independent_mv_candidates) {
        election.independent_mv_candidates.forEach(candidate => {
          mvTotals[candidate] = 0;
        });
      }

      filtered.forEach(result => {
        if (result.mv_votes) {
          Object.keys(result.mv_votes).forEach(party => {
            if (mvTotals.hasOwnProperty(party)) {
              mvTotals[party] += parseInt(result.mv_votes[party]) || 0;
            }
          });
        }
      });

      const mvTotal = Object.values(mvTotals).reduce((sum, val) => sum + val, 0);

      return {
        type: 'genel',
        categories: [
          {
            name: 'Cumhurbaşkanı Seçimi',
            data: Object.keys(cbTotals).map(candidate => ({
              name: candidate,
              value: cbTotals[candidate],
              percentage: cbTotal > 0 ? ((cbTotals[candidate] / cbTotal) * 100) : 0
            })),
            total: cbTotal
          },
          {
            name: 'Milletvekili Seçimi',
            data: Object.keys(mvTotals).map(party => ({
              name: party,
              value: mvTotals[party],
              percentage: mvTotal > 0 ? ((mvTotals[party] / mvTotal) * 100) : 0
            })),
            total: mvTotal
          }
        ],
        total: cbTotal + mvTotal
      };
    } else if (election?.type === 'yerel') {
      // Yerel Seçim: Belediye Başkanı, İl Genel Meclisi, Belediye Meclisi
      const mayorTotals = {};
      if (election.mayor_parties) {
        election.mayor_parties.forEach(party => {
          const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
          mayorTotals[partyName] = 0;
        });
      }
      if (election.mayor_candidates) {
        election.mayor_candidates.forEach(candidate => {
          mayorTotals[candidate] = 0;
        });
      }

      const provincialTotals = {};
      if (election.provincial_assembly_parties) {
        election.provincial_assembly_parties.forEach(party => {
          const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
          provincialTotals[partyName] = 0;
        });
      }

      const municipalTotals = {};
      if (election.municipal_council_parties) {
        election.municipal_council_parties.forEach(party => {
          const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
          municipalTotals[partyName] = 0;
        });
      }

      filtered.forEach(result => {
        if (result.mayor_votes) {
          Object.keys(result.mayor_votes).forEach(key => {
            if (mayorTotals.hasOwnProperty(key)) {
              mayorTotals[key] += parseInt(result.mayor_votes[key]) || 0;
            }
          });
        }
        if (result.provincial_assembly_votes) {
          Object.keys(result.provincial_assembly_votes).forEach(party => {
            if (provincialTotals.hasOwnProperty(party)) {
              provincialTotals[party] += parseInt(result.provincial_assembly_votes[party]) || 0;
            }
          });
        }
        if (result.municipal_council_votes) {
          Object.keys(result.municipal_council_votes).forEach(party => {
            if (municipalTotals.hasOwnProperty(party)) {
              municipalTotals[party] += parseInt(result.municipal_council_votes[party]) || 0;
            }
          });
        }
      });

      const mayorTotal = Object.values(mayorTotals).reduce((sum, val) => sum + val, 0);
      const provincialTotal = Object.values(provincialTotals).reduce((sum, val) => sum + val, 0);
      const municipalTotal = Object.values(municipalTotals).reduce((sum, val) => sum + val, 0);

      const categories = [];
      
      if (mayorTotal > 0 || Object.keys(mayorTotals).length > 0) {
        categories.push({
          name: 'Belediye Başkanı Seçimi',
          data: Object.keys(mayorTotals).map(key => ({
            name: key,
            value: mayorTotals[key],
            percentage: mayorTotal > 0 ? ((mayorTotals[key] / mayorTotal) * 100) : 0
          })),
          total: mayorTotal
        });
      }

      if (provincialTotal > 0 || Object.keys(provincialTotals).length > 0) {
        categories.push({
          name: 'İl Genel Meclisi Seçimi',
          data: Object.keys(provincialTotals).map(party => ({
            name: party,
            value: provincialTotals[party],
            percentage: provincialTotal > 0 ? ((provincialTotals[party] / provincialTotal) * 100) : 0
          })),
          total: provincialTotal
        });
      }

      if (municipalTotal > 0 || Object.keys(municipalTotals).length > 0) {
        categories.push({
          name: 'Belediye Meclisi Seçimi',
          data: Object.keys(municipalTotals).map(party => ({
            name: party,
            value: municipalTotals[party],
            percentage: municipalTotal > 0 ? ((municipalTotals[party] / municipalTotal) * 100) : 0
          })),
          total: municipalTotal
        });
      }

      return {
        type: 'yerel',
        categories: categories,
        total: mayorTotal + provincialTotal + municipalTotal
      };
    } else if (election?.type === 'referandum') {
      // Referandum: Evet/Hayır
      const evetTotal = filtered.reduce((sum, result) => {
        return sum + (parseInt(result.referendum_votes?.['Evet']) || 0);
      }, 0);
      const hayirTotal = filtered.reduce((sum, result) => {
        return sum + (parseInt(result.referendum_votes?.['Hayır']) || 0);
      }, 0);
      const total = evetTotal + hayirTotal;

      return {
        type: 'referandum',
        categories: [
          {
            name: 'Referandum',
            data: [
              {
                name: 'Evet',
                value: evetTotal,
                percentage: total > 0 ? ((evetTotal / total) * 100) : 0
              },
              {
                name: 'Hayır',
                value: hayirTotal,
                percentage: total > 0 ? ((hayirTotal / total) * 100) : 0
              }
            ],
            total: total
          }
        ],
        total: total
      };
    }

    // Legacy support for old election types
    if (election?.type === 'cb' && election?.candidates) {
      const candidateTotals = {};
      election.candidates.forEach(candidate => {
        candidateTotals[candidate] = 0;
      });

      filtered.forEach(result => {
        if (result.candidate_votes) {
          Object.keys(result.candidate_votes).forEach(candidate => {
            if (candidateTotals.hasOwnProperty(candidate)) {
              candidateTotals[candidate] += parseInt(result.candidate_votes[candidate]) || 0;
            }
          });
        }
      });

      const total = Object.values(candidateTotals).reduce((sum, val) => sum + val, 0);
      
      return {
        type: 'candidates',
        categories: [
          {
            name: 'Cumhurbaşkanı Seçimi',
            data: Object.keys(candidateTotals).map(candidate => ({
              name: candidate,
              value: candidateTotals[candidate],
              percentage: total > 0 ? ((candidateTotals[candidate] / total) * 100) : 0
            })),
            total: total
          }
        ],
        total: total
      };
    }

    return { type: 'unknown', categories: [], total: 0 };
  };

  const aggregatedResults = calculateAggregatedResults();

  // Calculate total used votes (oy kullanan seçmen)
  const calculateTotalUsedVotes = () => {
    const filtered = getFilteredResults();
    return filtered.reduce((sum, result) => sum + (parseInt(result.used_votes) || 0), 0);
  };

  // Calculate total invalid votes
  const calculateTotalInvalidVotes = () => {
    const filtered = getFilteredResults();
    return filtered.reduce((sum, result) => sum + (parseInt(result.invalid_votes) || 0), 0);
  };

  // Get winning candidate/party for each category
  const getWinningCandidateForCategory = (category) => {
    if (!category || !category.data || category.data.length === 0) return null;
    const sorted = [...category.data].sort((a, b) => b.value - a.value);
    return sorted[0];
  };


  // Calculate location-based analysis (mahalle/ilçe)
  const calculateLocationBasedAnalysis = () => {
    const filtered = getFilteredResults();
    const locationMap = {};

    filtered.forEach(result => {
      const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(result.ballot_box_id));
      if (!ballotBox) return;

      // Get location key
      let locationKey = '';
      let locationName = '';
      
      if (ballotBox.neighborhood_id) {
        const neighborhood = neighborhoods.find(n => String(n.id) === String(ballotBox.neighborhood_id));
        if (neighborhood) {
          locationKey = `neighborhood_${neighborhood.id}`;
          locationName = neighborhood.name;
        }
      } else if (ballotBox.village_id) {
        const village = villages.find(v => String(v.id) === String(ballotBox.village_id));
        if (village) {
          locationKey = `village_${village.id}`;
          locationName = village.name;
        }
      } else if (ballotBox.district_id) {
        const district = districts.find(d => String(d.id) === String(ballotBox.district_id));
        if (district) {
          locationKey = `district_${district.id}`;
          locationName = district.name;
        }
      }

      if (!locationKey) return;

      if (!locationMap[locationKey]) {
        locationMap[locationKey] = {
          name: locationName,
          type: ballotBox.neighborhood_id ? 'Mahalle' : ballotBox.village_id ? 'Köy' : 'İlçe',
          ballotBoxCount: 0,
          totalVotes: 0,
          usedVotes: 0,
          validVotes: 0,
          invalidVotes: 0,
          categoryVotes: {}
        };
      }

      locationMap[locationKey].ballotBoxCount++;
      locationMap[locationKey].usedVotes += parseInt(result.used_votes) || 0;
      locationMap[locationKey].validVotes += parseInt(result.valid_votes) || 0;
      locationMap[locationKey].invalidVotes += parseInt(result.invalid_votes) || 0;

      // Aggregate votes by category
      if (election?.type === 'genel') {
        Object.entries(result.cb_votes || {}).forEach(([candidate, votes]) => {
          if (!locationMap[locationKey].categoryVotes['CB']) {
            locationMap[locationKey].categoryVotes['CB'] = {};
          }
          locationMap[locationKey].categoryVotes['CB'][candidate] = 
            (locationMap[locationKey].categoryVotes['CB'][candidate] || 0) + (parseInt(votes) || 0);
        });
        Object.entries(result.mv_votes || {}).forEach(([party, votes]) => {
          if (!locationMap[locationKey].categoryVotes['MV']) {
            locationMap[locationKey].categoryVotes['MV'] = {};
          }
          locationMap[locationKey].categoryVotes['MV'][party] = 
            (locationMap[locationKey].categoryVotes['MV'][party] || 0) + (parseInt(votes) || 0);
        });
      } else if (election?.type === 'yerel') {
        Object.entries(result.mayor_votes || {}).forEach(([candidate, votes]) => {
          if (!locationMap[locationKey].categoryVotes['Belediye Başkanı']) {
            locationMap[locationKey].categoryVotes['Belediye Başkanı'] = {};
          }
          locationMap[locationKey].categoryVotes['Belediye Başkanı'][candidate] = 
            (locationMap[locationKey].categoryVotes['Belediye Başkanı'][candidate] || 0) + (parseInt(votes) || 0);
        });
      }
    });

    return Object.values(locationMap).sort((a, b) => b.totalVotes - a.totalVotes);
  };

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

  // Count-up animation hook
  const useCountUp = (end, duration = 2000) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
      let startTime = null;
      const startValue = 0;
      
      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(startValue + (end - startValue) * easeOutQuart));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(end);
        }
      };
      
      requestAnimationFrame(animate);
    }, [end, duration]);
    
    return count;
  };

  // Handle photo click
  const handlePhotoClick = (photoUrl, title) => {
    setModalPhoto(photoUrl);
    setModalTitle(title);
  };

  // Handle download
  const handleDownload = (photoUrl, filename) => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = filename || 'tutanak.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle chart segment click
  const handleChartClick = (data) => {
    setSelectedChartData(data);
    setShowChartDetailModal(true);
  };

  // Export as PNG
  const handleExportPNG = async () => {
    if (!chartContainerRef.current) return;
    
    try {
      const canvas = await html2canvas(chartContainerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `${election?.name || 'seçim-sonuclari'}_grafik.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('PNG export error:', error);
      alert('PNG oluşturulurken bir hata oluştu');
    }
  };

  // Export as PDF
  const handleExportPDF = async () => {
    if (!chartContainerRef.current) return;
    
    try {
      const canvas = await html2canvas(chartContainerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`${election?.name || 'seçim-sonuclari'}_grafik.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF oluşturulurken bir hata oluştu');
    }
  };

  // Export as Excel
  const handleExportExcel = useCallback(() => {
    try {
      const filtered = getFilteredResults();
      if (!filtered || filtered.length === 0) {
        alert('Dışa aktarılacak veri bulunamadı');
        return;
      }
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['Seçim Adı', election?.name || ''],
        ['Seçim Tarihi', election?.date ? new Date(election.date).toLocaleDateString('tr-TR') : ''],
        ['Toplam Sandık', getTotalBallotBoxes()],
        ['Açılan Sandık', filtered.length],
        ['Oy Kullanan Seçmen', calculateTotalUsedVotes()],
        ['Geçerli Oy', aggregatedResults.total],
        ['Geçersiz Oy', calculateTotalInvalidVotes()],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Özet');
      
      // Results sheet
      const resultsData = filtered.map(result => ({
        'Sandık No': result.ballot_number || '',
        'İl': result.region_name || '',
        'İlçe': result.district_name || '',
        'Belde': result.town_name || '',
        'Mahalle/Köy': result.neighborhood_name || result.village_name || '',
        'Toplam Seçmen': result.total_voters || 0,
        'Oy Kullanan': result.used_votes || 0,
        'Geçerli Oy': result.valid_votes || 0,
        'Geçersiz Oy': result.invalid_votes || 0,
        'İtiraz': result.has_objection ? 'Evet' : 'Hayır',
      }));
      const resultsSheet = XLSX.utils.json_to_sheet(resultsData);
      XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Sonuçlar');
      
      XLSX.writeFile(workbook, `${election?.name || 'seçim-sonuclari'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Excel export error:', error);
      alert('Excel oluşturulurken bir hata oluştu');
    }
  }, [election, getFilteredResults, getTotalBallotBoxes, calculateTotalUsedVotes, aggregatedResults, calculateTotalInvalidVotes]);

  // D'Hondt calculation for MV election
  const dhondtResults = useMemo(() => {
    if (election?.type !== 'genel' || !aggregatedResults.categories) return null;
    
    const mvCategory = aggregatedResults.categories.find(c => c.name === 'Milletvekili Seçimi');
    if (!mvCategory || mvCategory.data.length === 0) return null;
    
    // Get total seats from election data
    const totalSeats = parseInt(election.mv_total_seats) || 10; // Default to 10 if not set
    
    const partyVotes = {};
    mvCategory.data.forEach(item => {
      partyVotes[item.name] = item.value;
    });
    
    return calculateDHondtDetailed(partyVotes, totalSeats);
  }, [election, aggregatedResults]);

  // Belediye Meclisi Üyesi Seçimi - Kontenjan + D'Hondt
  const municipalCouncilResults = useMemo(() => {
    if (election?.type !== 'yerel' || !aggregatedResults.categories) return null;
    
    const municipalCategory = aggregatedResults.categories.find(c => c.name === 'Belediye Meclisi Seçimi');
    if (!municipalCategory || municipalCategory.data.length === 0) return null;
    
    // Get total seats from election data
    const totalSeats = parseInt(election.municipal_council_total_seats) || 25; // Default to 25 if not set
    
    // Get population from election data
    const population = parseInt(election.population) || 0; // Default to 0 if not set
    
    const partyVotes = {};
    municipalCategory.data.forEach(item => {
      partyVotes[item.name] = item.value;
    });
    
    return calculateMunicipalCouncilSeats(partyVotes, totalSeats, population);
  }, [election, aggregatedResults]);


  console.log('🎨 ElectionResultsPage render:', {
    loading,
    election: election ? { id: election.id, name: election.name } : null,
    resultsCount: results.length,
    electionId
  });

  if (loading) {
    console.log('⏳ Loading state: true, spinner gösteriliyor');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!election) {
    console.log('⚠️ Election bulunamadı, hata mesajı gösteriliyor');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Seçim bulunamadı</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Election ID: {electionId}</p>
        </div>
      </div>
    );
  }

  const filteredResults = getFilteredResults();
  
  // Pagination
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResults = filteredResults.slice(startIndex, endIndex);
  
  // Sonuç yoksa bile sayfa görünsün - sıfır değerlerle
  const hasResults = filteredResults.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {election.name} - Seçim Sonuçları
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {election.date ? new Date(election.date).toLocaleDateString('tr-TR') : '-'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF İndir
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel İndir
              </button>
            </div>
          </div>
          {!hasResults && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Henüz seçim sonucu girilmemiş. Sonuçlar girildikçe bu sayfada görünecektir.
              </p>
            </div>
          )}
        </div>

        {/* Filters - Accordion */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm mb-6 overflow-hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filtreler</h2>
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showFilters && (
            <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
              {/* Hızlı Arama Kutusu */}
              <div className="mb-6 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Hızlı Arama (İlçe, Belde, Mahalle, Köy, Sandık No)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Örn: Merkez, Sandık 5, Mahalle adı..."
                className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              />
              <svg 
                className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                "{searchQuery}" için {getFilteredResults().length} sonuç bulundu
              </p>
            )}
          </div>
          
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                İtiraz Durumu
              </label>
              <select
                value={filterByObjection}
                onChange={(e) => setFilterByObjection(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Tümü</option>
                <option value="with">İtiraz Edilenler</option>
                <option value="without">İtiraz Edilmeyenler</option>
              </select>
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterByProtocolOnly}
                  onChange={(e) => setFilterByProtocolOnly(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sadece Tutanak Olanlar (Veri Yok)
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                Sadece tutanak fotoğrafı yüklenmiş ama veri girilmemiş sandıkları göster
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterByNoProtocol}
                  onChange={(e) => setFilterByNoProtocol(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tutanak Yüklenmemiş
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                Hiç tutanak fotoğrafı yüklenmemiş sandıkları göster
              </p>
            </div>
          </div>
            </div>
          )}
        </div>

        {/* Sandık ve Seçmen İstatistikleri - Kompakt */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Sandık İstatistikleri */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Sandık İstatistikleri
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Toplam Sandık:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{getTotalBallotBoxes()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Açılan Sandık:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{hasResults ? filteredResults.length : 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Açılma Oranı:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">%{calculateOpenedBallotBoxPercentage()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Kapanan Sandık:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{getTotalBallotBoxes() - (hasResults ? filteredResults.length : 0)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">İtiraz Olan Sandık:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{filteredResults.filter(r => r.has_objection === true || r.has_objection === 1).length}</span>
              </div>
            </div>
          </div>

          {/* Seçmen ve Oy İstatistikleri */}
          {hasResults && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Seçmen ve Oy İstatistikleri
              </h3>
              <div className="space-y-2 text-xs">
                {election?.voter_count && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Toplam Seçmen:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{election.voter_count.toLocaleString('tr-TR')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Oy Kullanan:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{calculateTotalUsedVotes().toLocaleString('tr-TR')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Katılım Oranı:</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">%{calculateParticipationPercentage()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Geçerli Oy:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{aggregatedResults.total.toLocaleString('tr-TR')}</span>
                </div>
                {calculateTotalUsedVotes() > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Geçerli Oy Oranı:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">%{((aggregatedResults.total / calculateTotalUsedVotes()) * 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Geçersiz Oy:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{calculateTotalInvalidVotes().toLocaleString('tr-TR')}</span>
                </div>
                {calculateTotalUsedVotes() > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Geçersiz Oy Oranı:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">%{((calculateTotalInvalidVotes() / calculateTotalUsedVotes()) * 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Charts - Her kategori için ayrı grafik */}
        {election && aggregatedResults.categories && aggregatedResults.categories.length > 0 && (
          <div className="space-y-4 mb-4">
            {aggregatedResults.categories.map((category, categoryIndex) => 
              category.data.length > 0 ? (
                <div key={categoryIndex} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 transform transition-all duration-300 hover:shadow-lg">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {category.name}
                    <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
                      Toplam: {category.total.toLocaleString('tr-TR')} oy
                    </span>
                  </h2>
                  
                  {/* Kazanan Parti/Aday Bilgisi */}
                    {(() => {
                      const winner = getWinningCandidateForCategory(category);
                      if (!winner) return null;
                      const winnerName = typeof winner.name === 'string' ? winner.name : (winner.name?.name || String(winner.name) || 'Bilinmeyen');
                      const winnerPercentage = typeof winner.percentage === 'number' ? winner.percentage : parseFloat(winner.percentage || 0);
                      
                      // Kazanan adayları bul (oy sırasına göre)
                      const winningCandidates = [];
                      
                      if (election?.type === 'genel') {
                        if (category.name === 'Cumhurbaşkanı Seçimi') {
                          // CB adayları zaten category.data'da
                          winningCandidates.push(...category.data.slice(0, 3).map(item => ({
                            name: typeof item.name === 'string' ? item.name : (item.name?.name || String(item.name) || 'Bilinmeyen'),
                            votes: item.value,
                            percentage: typeof item.percentage === 'number' ? item.percentage : parseFloat(item.percentage || 0)
                          })));
                        } else if (category.name === 'Milletvekili Seçimi') {
                          // MV için partiler ve adayları
                          category.data.slice(0, 5).forEach(partyItem => {
                            const partyName = typeof partyItem.name === 'string' ? partyItem.name : (partyItem.name?.name || String(partyItem.name) || 'Bilinmeyen');
                            // Bu parti için adayları bul
                            const party = election.parties?.find(p => (typeof p === 'string' ? p : p.name) === partyName);
                            if (party && typeof party === 'object' && party.mv_candidates) {
                              party.mv_candidates.forEach((candidate, idx) => {
                                winningCandidates.push({
                                  name: `${candidate} (${partyName})`,
                                  votes: partyItem.value,
                                  percentage: typeof partyItem.percentage === 'number' ? partyItem.percentage : parseFloat(partyItem.percentage || 0),
                                  isParty: false,
                                  partyName: partyName
                                });
                              });
                            } else {
                              winningCandidates.push({
                                name: partyName,
                                votes: partyItem.value,
                                percentage: typeof partyItem.percentage === 'number' ? partyItem.percentage : parseFloat(partyItem.percentage || 0),
                                isParty: true
                              });
                            }
                          });
                        }
                      } else if (election?.type === 'yerel') {
                        if (category.name === 'Belediye Başkanı Seçimi') {
                          // Belediye başkanı adayları (parti ve bağımsız)
                          winningCandidates.push(...category.data.slice(0, 5).map(item => ({
                            name: typeof item.name === 'string' ? item.name : (item.name?.name || String(item.name) || 'Bilinmeyen'),
                            votes: item.value,
                            percentage: typeof item.percentage === 'number' ? item.percentage : parseFloat(item.percentage || 0)
                          })));
                        } else if (category.name === 'İl Genel Meclisi Seçimi') {
                          // İl Genel Meclisi partileri ve adayları
                          category.data.slice(0, 5).forEach(partyItem => {
                            const partyName = typeof partyItem.name === 'string' ? partyItem.name : (partyItem.name?.name || String(partyItem.name) || 'Bilinmeyen');
                            const party = election.provincial_assembly_parties?.find(p => {
                              const pName = typeof p === 'string' ? p : (p?.name || String(p));
                              return pName === partyName;
                            });
                            if (party && typeof party === 'object' && party.candidates) {
                              party.candidates.forEach((candidate) => {
                                winningCandidates.push({
                                  name: `${candidate} (${partyName})`,
                                  votes: partyItem.value,
                                  percentage: typeof partyItem.percentage === 'number' ? partyItem.percentage : parseFloat(partyItem.percentage || 0),
                                  isParty: false,
                                  partyName: partyName
                                });
                              });
                            } else {
                              winningCandidates.push({
                                name: partyName,
                                votes: partyItem.value,
                                percentage: typeof partyItem.percentage === 'number' ? partyItem.percentage : parseFloat(partyItem.percentage || 0),
                                isParty: true
                              });
                            }
                          });
                        } else if (category.name === 'Belediye Meclisi Seçimi') {
                          // Belediye Meclisi partileri ve adayları
                          category.data.slice(0, 5).forEach(partyItem => {
                            const partyName = typeof partyItem.name === 'string' ? partyItem.name : (partyItem.name?.name || String(partyItem.name) || 'Bilinmeyen');
                            const party = election.municipal_council_parties?.find(p => {
                              const pName = typeof p === 'string' ? p : (p?.name || String(p));
                              return pName === partyName;
                            });
                            if (party && typeof party === 'object' && party.candidates) {
                              party.candidates.forEach((candidate) => {
                                winningCandidates.push({
                                  name: `${candidate} (${partyName})`,
                                  votes: partyItem.value,
                                  percentage: typeof partyItem.percentage === 'number' ? partyItem.percentage : parseFloat(partyItem.percentage || 0),
                                  isParty: false,
                                  partyName: partyName
                                });
                              });
                            } else {
                              winningCandidates.push({
                                name: partyName,
                                votes: partyItem.value,
                                percentage: typeof partyItem.percentage === 'number' ? partyItem.percentage : parseFloat(partyItem.percentage || 0),
                                isParty: true
                              });
                            }
                          });
                        }
                      }
                      
                      return (
                        <div className="mb-4 space-y-3">
                          {/* Kazanan Parti/Aday */}
                          <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">🏆 Kazanan</div>
                                <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{winnerName}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {winner.value.toLocaleString('tr-TR')} oy (%{winnerPercentage.toFixed(2)})
                                </div>
                              </div>
                              <div className="text-2xl">🏆</div>
                            </div>
                          </div>
                          
                          {/* Kazanan Adaylar Listesi (En Çok Oy Alandan En Aza) */}
                          {winningCandidates.length > 0 && (() => {
                            // En çok oy alandan en aza doğru sırala
                            const sortedCandidates = [...winningCandidates].sort((a, b) => b.votes - a.votes);
                            
                            // Parti bazında kazanan sayısını hesapla
                            const partyWinners = {};
                            sortedCandidates.forEach(candidate => {
                              if (candidate.partyName) {
                                partyWinners[candidate.partyName] = (partyWinners[candidate.partyName] || 0) + 1;
                              }
                            });
                            
                            return (
                              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">📋 Kazanan Adaylar (En Çok Oy Alandan En Aza)</div>
                                
                                {/* Parti Bazında Kazanan Sayısı */}
                                {Object.keys(partyWinners).length > 0 && (
                                  <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800">
                                    <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">🏛️ Parti Bazında Kazanan Sayısı</div>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(partyWinners)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([party, count]) => (
                                          <span key={party} className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                                            {party}: {count} kazanan
                                          </span>
                                        ))}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="space-y-1.5">
                                  {sortedCandidates.slice(0, 10).map((candidate, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                                        <span className="text-gray-900 dark:text-gray-100">{candidate.name}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{candidate.votes.toLocaleString('tr-TR')}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">(%{candidate.percentage.toFixed(2)})</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Horizontal Bar Chart */}
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Oy Dağılımı</h3>
                      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
                        <ResponsiveContainer width="100%" height={Math.max(200, category.data.length * 40)}>
                          <BarChart
                            data={category.data
                              .sort((a, b) => b.value - a.value)
                              .map(item => ({
                                ...item,
                                name: typeof item.name === 'string' ? item.name : (item.name?.name || String(item.name) || 'Bilinmeyen')
                              }))}
                            layout="vertical"
                            margin={{ top: 10, right: 20, left: 100, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              type="number" 
                              stroke="#6b7280"
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={90}
                              stroke="#6b7280"
                              tick={{ fill: '#6b7280', fontSize: 11 }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                                padding: '12px'
                              }}
                              formatter={(value, name, props) => {
                                const percentage = typeof props.payload.percentage === 'number' 
                                  ? props.payload.percentage 
                                  : parseFloat(props.payload.percentage || 0);
                                const displayName = typeof props.payload.name === 'string' 
                                  ? props.payload.name 
                                  : (props.payload.name?.name || String(props.payload.name) || 'Bilinmeyen');
                                return [
                                  `${value.toLocaleString('tr-TR')} oy (%${percentage.toFixed(1)})`,
                                  displayName
                                ];
                              }}
                            />
                            <Bar 
                              dataKey="value" 
                              radius={[0, 8, 8, 0]}
                              fill="#6366f1"
                              label={{
                                position: 'right',
                                formatter: (value, entry) => {
                                  const displayName = typeof entry.name === 'string' 
                                    ? entry.name 
                                    : (entry.name?.name || String(entry.name) || 'Bilinmeyen');
                                  return displayName;
                                },
                                style: { fill: '#374151', fontSize: '11px', fontWeight: '500' }
                              }}
                            >
                              {category.data.map((entry, index) => (
                                <Cell 
                                  key={`bar-cell-${categoryIndex}-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* İnteraktif Liste */}
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Detaylı Sonuçlar</h3>
                      {category.data
                        .sort((a, b) => b.value - a.value)
                        .map((item, index) => {
                          const itemName = typeof item.name === 'string' ? item.name : (item.name?.name || String(item.name) || 'Bilinmeyen');
                          const percentage = typeof item.percentage === 'number' 
                            ? item.percentage 
                            : parseFloat(item.percentage || 0);
                          const maxPercentage = Math.max(...category.data.map(d => 
                            typeof d.percentage === 'number' ? d.percentage : parseFloat(d.percentage || 0)
                          ));
                          const barWidth = maxPercentage > 0 ? (percentage / maxPercentage) * 100 : 0;
                          
                          return (
                            <div 
                              key={itemName} 
                              className="group relative bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 transition-all duration-300 hover:shadow-md hover:scale-[1.01] hover:border-indigo-300 dark:hover:border-indigo-600"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded-full shadow-sm transition-transform duration-300 group-hover:scale-110" 
                                    style={{ 
                                      backgroundColor: COLORS[index % COLORS.length],
                                      boxShadow: `0 0 8px ${COLORS[index % COLORS.length]}40`
                                    }}
                                  ></div>
                                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{itemName}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-base text-gray-900 dark:text-gray-100">
                                    {item.value.toLocaleString('tr-TR')}
                                  </div>
                                  <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                    %{percentage.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              {/* Animasyonlu Progress Bar */}
                              <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out shadow-inner"
                                  style={{
                                    width: `${barWidth}%`,
                                    background: `linear-gradient(90deg, ${COLORS[index % COLORS.length]}, ${COLORS[index % COLORS.length]}dd)`,
                                    boxShadow: `0 0 10px ${COLORS[index % COLORS.length]}60`
                                  }}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* D'Hondt Calculation Visualization - Milletvekili Dağılımı */}
        {dhondtResults && election?.type === 'genel' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              D'Hondt Sistemi - Milletvekili Dağılımı
              <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
                Toplam: {dhondtResults.totalSeats} Milletvekili
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Distribution Chart */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Milletvekili Dağılımı</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dhondtResults.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="party" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="seats" fill="#6366f1" radius={[8, 8, 0, 0]}>
                      {dhondtResults.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Distribution List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Parti Bazında Dağılım</h3>
                <div className="space-y-2">
                  {dhondtResults.chartData
                    .sort((a, b) => b.seats - a.seats)
                    .map((item, index) => (
                      <div 
                        key={item.party}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.party}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-base text-indigo-600 dark:text-indigo-400">
                            {item.seats} MV
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.votes.toLocaleString('tr-TR')} oy
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Belediye Meclisi Üyesi Seçimi - Kontenjan + D'Hondt */}
        {municipalCouncilResults && election?.type === 'yerel' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Belediye Meclisi Üyesi Seçimi - Kontenjan + D'Hondt Sistemi
              <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
                Toplam: {municipalCouncilResults.totalSeats} Üye
              </span>
            </h2>
            
            {/* Kontenjan Bilgisi */}
            {municipalCouncilResults.quotaSeats > 0 && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-amber-800 dark:text-amber-300">Kontenjan Üyeleri</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>{municipalCouncilResults.quotaParty}</strong> partisi en çok oy aldığı için <strong>{municipalCouncilResults.quotaSeats}</strong> kontenjan üyesi kazandı.
                  <br />
                  <span className="text-xs">({municipalCouncilResults.quotaPartyVotes.toLocaleString('tr-TR')} oy ile)</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Distribution Chart */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Meclis Üyesi Dağılımı</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={municipalCouncilResults.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="party" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value, name, props) => {
                        if (name === 'Kontenjan') {
                          return [`${value} üye (Kontenjan)`, 'Kontenjan'];
                        } else if (name === 'D\'Hondt') {
                          return [`${value} üye (D'Hondt)`, 'D\'Hondt'];
                        }
                        return [`${value} üye`, 'Toplam'];
                      }}
                    />
                    <Bar dataKey="seats" fill="#6366f1" radius={[8, 8, 0, 0]}>
                      {municipalCouncilResults.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Distribution List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Parti Bazında Dağılım</h3>
                <div className="space-y-2">
                  {municipalCouncilResults.chartData
                    .sort((a, b) => b.seats - a.seats)
                    .map((item, index) => (
                      <div 
                        key={item.party}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.party}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-base text-indigo-600 dark:text-indigo-400">
                              {item.seats} Üye
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.votes.toLocaleString('tr-TR')} oy
                            </div>
                          </div>
                        </div>
                        {/* Kontenjan ve D'Hondt Detayı */}
                        <div className="flex gap-2 text-xs">
                          {item.quotaSeats > 0 && (
                            <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded">
                              {item.quotaSeats} Kontenjan
                            </span>
                          )}
                          {item.dhondtSeats > 0 && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                              {item.dhondtSeats} D'Hondt
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
                {/* Özet Bilgi */}
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                  <p className="mb-1"><strong>Toplam:</strong> {municipalCouncilResults.totalSeats} üye</p>
                  <p className="mb-1"><strong>Kontenjan:</strong> {municipalCouncilResults.quotaSeats} üye</p>
                  <p><strong>D'Hondt:</strong> {municipalCouncilResults.dhondtSeats} üye</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* İl Genel Meclisi Üyesi Seçimi - İlçe Bazlı D'Hondt */}
        {provincialAssemblyResults && election?.type === 'yerel' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              İl Genel Meclisi Üyesi Seçimi - İlçe Bazlı D'Hondt Sistemi
              <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
                Toplam: {provincialAssemblyResults.totalSeats} Üye
              </span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* İlçe Bazlı Sonuçlar */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">İlçe Bazlı Dağılım</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(provincialAssemblyResults.districtResults).map(([districtName, districtData]) => (
                    <div key={districtName} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">
                        {districtName} ({districtData.seats} üye)
                      </div>
                      <div className="space-y-1 text-xs">
                        {Object.entries(districtData.distribution)
                          .sort((a, b) => b[1] - a[1])
                          .map(([party, seats]) => (
                            <div key={party} className="flex justify-between items-center">
                              <span className="text-gray-700 dark:text-gray-300">{party}</span>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">{seats} üye</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Toplam Dağılım */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Toplam Meclis Dağılımı</h3>
                <div className="space-y-2">
                  {provincialAssemblyResults.chartData.map((item, index) => (
                    <div 
                      key={item.party}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.party}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-base text-blue-600 dark:text-blue-400">
                            {item.seats} Üye
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Özet Bilgi */}
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                  <p><strong>Toplam Üye:</strong> {provincialAssemblyResults.totalSeats} üye</p>
                  <p><strong>İlçe Sayısı:</strong> {Object.keys(provincialAssemblyResults.districtResults).length} ilçe</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Location-Based Analysis */}
        {hasResults && (() => {
          const locationAnalysis = calculateLocationBasedAnalysis();
          if (locationAnalysis.length === 0) return null;
          
          return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mahalle / İlçe Bazlı Analiz
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Konum</th>
                      <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Tür</th>
                      <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Sandık Sayısı</th>
                      <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Oy Kullanan</th>
                      <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Geçerli Oy</th>
                      <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Geçersiz Oy</th>
                      {election?.type === 'genel' && (
                        <>
                          <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">CB Kazanan</th>
                          <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">MV Kazanan</th>
                        </>
                      )}
                      {election?.type === 'yerel' && (
                        <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Başkan Kazanan</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {locationAnalysis.map((location, index) => {
                      let cbWinner = null;
                      let mvWinner = null;
                      let mayorWinner = null;
                      
                      if (election?.type === 'genel') {
                        const cbVotes = location.categoryVotes['CB'] || {};
                        const cbEntries = Object.entries(cbVotes).sort((a, b) => b[1] - a[1]);
                        cbWinner = cbEntries.length > 0 ? cbEntries[0][0] : null;
                        
                        const mvVotes = location.categoryVotes['MV'] || {};
                        const mvEntries = Object.entries(mvVotes).sort((a, b) => b[1] - a[1]);
                        mvWinner = mvEntries.length > 0 ? mvEntries[0][0] : null;
                      } else if (election?.type === 'yerel') {
                        const mayorVotes = location.categoryVotes['Belediye Başkanı'] || {};
                        const mayorEntries = Object.entries(mayorVotes).sort((a, b) => b[1] - a[1]);
                        mayorWinner = mayorEntries.length > 0 ? mayorEntries[0][0] : null;
                      }
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{location.name}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{location.type}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{location.ballotBoxCount}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{location.usedVotes.toLocaleString('tr-TR')}</td>
                          <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">{location.validVotes.toLocaleString('tr-TR')}</td>
                          <td className="px-4 py-3 text-red-600 dark:text-red-400">{location.invalidVotes.toLocaleString('tr-TR')}</td>
                          {election?.type === 'genel' && (
                            <>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{cbWinner || '-'}</td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{mvWinner || '-'}</td>
                            </>
                          )}
                          {election?.type === 'yerel' && (
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{mayorWinner || '-'}</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Results Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Sandık Bazında Detaylı Sonuçlar
          </h2>
          {filteredResults.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Henüz seçim sonucu girilmemiş
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Başmüşahitler seçim sonuçlarını girdikçe burada görünecektir.
              </p>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedResults.map((result) => {
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

                // Calculate total valid votes based on election type
                let totalValidVotes = 0;
                if (election.type === 'genel') {
                  const cbTotal = Object.values(result.cb_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                  const mvTotal = Object.values(result.mv_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                  totalValidVotes = cbTotal + mvTotal;
                } else if (election.type === 'yerel') {
                  const mayorTotal = Object.values(result.mayor_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                  const provincialTotal = Object.values(result.provincial_assembly_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                  const municipalTotal = Object.values(result.municipal_council_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                  totalValidVotes = mayorTotal + provincialTotal + municipalTotal;
                } else if (election.type === 'referandum') {
                  totalValidVotes = (parseInt(result.referendum_votes?.['Evet']) || 0) + (parseInt(result.referendum_votes?.['Hayır']) || 0);
                } else {
                  // Legacy support
                  totalValidVotes = election.type === 'cb' 
                    ? Object.values(result.candidate_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0)
                    : Object.values(result.party_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                }

                const hasObjection = result.has_objection === true || result.has_objection === 1;
                
                // En fazla oy alan parti/aday
                const winningParty = getWinningParty(result, election);
                const partyColor = winningParty ? getPartyColor(winningParty) : null;
                
                // İtiraz varsa kırmızı, yoksa kazanan partinin rengi
                const cardStyle = hasObjection 
                  ? { 
                      borderColor: '#EF4444', 
                      backgroundColor: '#FEF2F2',
                      color: '#991B1B'
                    }
                  : partyColor 
                    ? {
                        borderColor: partyColor.border,
                        backgroundColor: partyColor.bg,
                        color: partyColor.text
                      }
                    : {
                        borderColor: '#E5E7EB',
                        backgroundColor: '#F9FAFB',
                        color: '#6B7280'
                      };

                return (
                  <div 
                    key={result.id} 
                    onClick={() => navigate(`/election-results/${electionId}/edit/${result.id}`)}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    style={{
                      borderColor: cardStyle.borderColor,
                      backgroundColor: cardStyle.backgroundColor,
                      borderWidth: '2px'
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold" style={{ color: cardStyle.color }}>
                          Sandık No: {result.ballot_number}
                        </h3>
                        {winningParty && !hasObjection && (
                          <div className="text-xs mt-1" style={{ color: cardStyle.color, opacity: 0.8 }}>
                            En Çok Oy: {winningParty}
                          </div>
                        )}
                      </div>
                      {hasObjection && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/40 rounded-full">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">İtiraz Edildi</span>
                        </div>
                      )}
                    </div>
                    {hasObjection && result.objection_reason && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">İtiraz Sebebi:</div>
                        <div className="text-sm text-red-600 dark:text-red-400">{result.objection_reason}</div>
                      </div>
                    )}
                    
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

                    {/* Parti/Aday Oyları - Yeni Seçim Sistemine Göre */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mb-3">
                      {election.type === 'genel' && (
                        <div className="space-y-3">
                          {/* CB Oyları */}
                          {election.cb_candidates && election.cb_candidates.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Cumhurbaşkanı:</div>
                              <div className="space-y-1">
                                {election.cb_candidates.map(candidate => {
                                  const votes = parseInt(result.cb_votes?.[candidate]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={candidate} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{candidate}</span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {election.independent_cb_candidates && election.independent_cb_candidates.map(candidate => {
                                  const votes = parseInt(result.cb_votes?.[candidate]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={`ind_cb_${candidate}`} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{candidate} <span className="text-gray-500">(Bağımsız)</span></span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* MV Oyları */}
                          {election.parties && election.parties.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Milletvekili:</div>
                              <div className="space-y-1">
                                {election.parties.map(party => {
                                  const partyName = typeof party === 'string' ? party : (party.name || party);
                                  const votes = parseInt(result.mv_votes?.[partyName]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={partyName} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{partyName}</span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {election.independent_mv_candidates && election.independent_mv_candidates.map(candidate => {
                                  const votes = parseInt(result.mv_votes?.[candidate]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={`ind_mv_${candidate}`} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{candidate} <span className="text-gray-500">(Bağımsız)</span></span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {election.type === 'yerel' && (
                        <div className="space-y-3">
                          {/* Belediye Başkanı */}
                          {(election.mayor_parties && election.mayor_parties.length > 0) || (election.mayor_candidates && election.mayor_candidates.length > 0) ? (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Belediye Başkanı:</div>
                              <div className="space-y-1">
                                {election.mayor_parties && election.mayor_parties.map(party => {
                                  const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                                  const votes = parseInt(result.mayor_votes?.[partyName]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={partyName} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{partyName}</span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {election.mayor_candidates && election.mayor_candidates.map(candidate => {
                                  const votes = parseInt(result.mayor_votes?.[candidate]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={candidate} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{candidate} <span className="text-gray-500">(Bağımsız)</span></span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {/* İl Genel Meclisi */}
                          {election.provincial_assembly_parties && election.provincial_assembly_parties.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">İl Genel Meclisi:</div>
                              <div className="space-y-1">
                                {election.provincial_assembly_parties.map(party => {
                                  const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                                  const votes = parseInt(result.provincial_assembly_votes?.[partyName]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={partyName} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{partyName}</span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Belediye Meclisi */}
                          {election.municipal_council_parties && election.municipal_council_parties.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Belediye Meclisi:</div>
                              <div className="space-y-1">
                                {election.municipal_council_parties.map(party => {
                                  const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                                  const votes = parseInt(result.municipal_council_votes?.[partyName]) || 0;
                                  const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                                  return (
                                    <div key={partyName} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{partyName}</span>
                                      <div className="text-right">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{votes}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">%{percentage}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {election.type === 'referandum' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Evet</span>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                {parseInt(result.referendum_votes?.['Evet']) || 0}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                %{totalValidVotes > 0 ? (((parseInt(result.referendum_votes?.['Evet']) || 0) / totalValidVotes) * 100).toFixed(2) : '0.00'}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Hayır</span>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                {parseInt(result.referendum_votes?.['Hayır']) || 0}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                %{totalValidVotes > 0 ? (((parseInt(result.referendum_votes?.['Hayır']) || 0) / totalValidVotes) * 100).toFixed(2) : '0.00'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Legacy support */}
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
                    </div>

                    {/* Seçim Tutanak Fotoğrafları */}
                    {(result.signed_protocol_photo || result.signedProtocolPhoto || result.objection_protocol_photo || result.objectionProtocolPhoto) && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tutanaklar:</span>
                          <div className="flex items-center space-x-2">
                            {(result.signed_protocol_photo || result.signedProtocolPhoto) && (
                              <button
                                onClick={() => handlePhotoClick(
                                  result.signed_protocol_photo || result.signedProtocolPhoto,
                                  `Seçim Tutanağı - Sandık ${result.ballot_number}`
                                )}
                                className="flex items-center space-x-1 hover:opacity-80 transition-opacity cursor-pointer"
                                title="Seçim Tutanağını Görüntüle"
                              >
                                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs text-gray-600 dark:text-gray-400">Seçim</span>
                              </button>
                            )}
                            {(result.objection_protocol_photo || result.objectionProtocolPhoto) && (
                              <button
                                onClick={() => handlePhotoClick(
                                  result.objection_protocol_photo || result.objectionProtocolPhoto,
                                  `İtiraz Tutanağı - Sandık ${result.ballot_number}`
                                )}
                                className="flex items-center space-x-1 hover:opacity-80 transition-opacity cursor-pointer"
                                title="İtiraz Tutanağını Görüntüle"
                              >
                                <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-xs text-gray-600 dark:text-gray-400">İtiraz</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Sayfa başına:
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {startIndex + 1}-{Math.min(endIndex, filteredResults.length)} / {filteredResults.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Önceki
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Sonraki
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Photo Modal */}
      {modalPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setModalPhoto(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {modalTitle}
              </h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleDownload(modalPhoto, modalTitle.replace(/\s+/g, '_') + '.jpg')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>İndir</span>
                </button>
                <button
                  onClick={() => setModalPhoto(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <img 
                src={modalPhoto} 
                alt={modalTitle}
                className="w-full h-auto rounded-lg"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EResim yüklenemedi%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectionResultsPage;

