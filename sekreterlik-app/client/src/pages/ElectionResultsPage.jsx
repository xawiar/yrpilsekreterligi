import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

// Sandıkta en fazla oy alan partiyi bul
const getWinningParty = (result, election) => {
  if (!result || !election) return null;
  
  if (election.type === 'cb' && result.candidate_votes) {
    // CB seçimi için aday oyları
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
    // Yerel/Genel seçim için parti oyları
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
  }, [selectedDistrict, selectedTown, selectedNeighborhood, selectedVillage, selectedBallotNumber, searchQuery, results, ballotBoxes]);

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

  // Calculate opened ballot box percentage
  const calculateOpenedBallotBoxPercentage = () => {
    const total = getTotalBallotBoxes();
    if (total === 0) return '0.00';
    const opened = hasResults ? filteredResults.length : 0;
    return ((opened / total) * 100).toFixed(2);
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
          percentage: total > 0 ? ((candidateTotals[candidate] / total) * 100) : 0
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
          percentage: total > 0 ? ((partyTotals[party] / total) * 100) : 0
        })),
        total
      };
    }

    return { type: 'unknown', data: [], total: 0 };
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

  // Calculate filtered results and aggregated results
  const filteredResults = getFilteredResults();
  const hasResults = filteredResults.length > 0;

  // Count-up animation states
  const [totalBallotBoxesCount, setTotalBallotBoxesCount] = useState(0);
  const [openedBallotBoxesCount, setOpenedBallotBoxesCount] = useState(0);
  const [totalValidVotesCount, setTotalValidVotesCount] = useState(0);
  const [objectionCount, setObjectionCount] = useState(0);

  // Animate counts - moved after filteredResults and aggregatedResults are calculated
  useEffect(() => {
    if (!election) return;
    
    const totalBallotBoxes = getTotalBallotBoxes();
    const openedCount = hasResults ? filteredResults.length : 0;
    const validVotes = hasResults ? aggregatedResults.total : 0;
    const objectionCountValue = filteredResults.filter(r => r.has_objection === true || r.has_objection === 1).length;

    const animateValue = (start, end, setter, duration = 1000) => {
      let startTime = null;
      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setter(Math.floor(start + (end - start) * easeOutQuart));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setter(end);
        }
      };
      requestAnimationFrame(animate);
    };

    animateValue(0, totalBallotBoxes, setTotalBallotBoxesCount);
    animateValue(0, openedCount, setOpenedBallotBoxesCount);
    animateValue(0, validVotes, setTotalValidVotesCount);
    animateValue(0, objectionCountValue, setObjectionCount);
  }, [election, hasResults, filteredResults, aggregatedResults]);

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

        {/* Filters - Modern Design */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Filtreler ve Arama</h2>
          </div>
          
          {/* Hızlı Arama Kutusu - Modern */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Hızlı Arama (İlçe, Belde, Mahalle, Köy, Sandık No)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Örn: Merkez, Sandık 5, Mahalle adı..."
                className="w-full px-5 py-4 pl-12 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 text-lg"
              />
              <svg 
                className="absolute left-4 top-4.5 h-6 w-6 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-4.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <div className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium">
                  "{searchQuery}" için {getFilteredResults().length} sonuç bulundu
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
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
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium"
              >
                <option value="">Tüm İlçeler</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Belde
              </label>
              <select
                value={selectedTown}
                onChange={(e) => {
                  setSelectedTown(e.target.value);
                  setSelectedNeighborhood('');
                  setSelectedVillage('');
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium disabled:opacity-50"
                disabled={!selectedDistrict}
              >
                <option value="">Tüm Beldeler</option>
                {filteredTowns.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Mahalle
              </label>
              <select
                value={selectedNeighborhood}
                onChange={(e) => setSelectedNeighborhood(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium"
              >
                <option value="">Tüm Mahalleler</option>
                {filteredNeighborhoods().map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Köy
              </label>
              <select
                value={selectedVillage}
                onChange={(e) => setSelectedVillage(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium"
              >
                <option value="">Tüm Köyler</option>
                {filteredVillages().map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                Sandık Numarası
              </label>
              <input
                type="text"
                value={selectedBallotNumber}
                onChange={(e) => setSelectedBallotNumber(e.target.value)}
                placeholder="Sandık no ara..."
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium"
              />
            </div>

            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-red-200 dark:border-red-900/50">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                İtiraz Durumu
              </label>
              <select
                value={filterByObjection}
                onChange={(e) => setFilterByObjection(e.target.value)}
                className="w-full px-4 py-3 border-2 border-red-300 dark:border-red-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium"
              >
                <option value="">Tümü</option>
                <option value="with">İtiraz Edilenler</option>
                <option value="without">İtiraz Edilmeyenler</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Statistics - Modern Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Sandık</div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {totalBallotBoxesCount}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Açılan Sandık</div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {openedBallotBoxesCount}
            </div>
            <div className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              %{calculateOpenedBallotBoxPercentage()}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Geçerli Oy</div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {totalValidVotesCount.toLocaleString('tr-TR')}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Katılım Yüzdesi</div>
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              %{hasResults ? calculateParticipationPercentage() : '0.00'}
            </div>
            {election?.voter_count && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Seçmen: {election.voter_count.toLocaleString('tr-TR')}
              </div>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-red-200 dark:border-red-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">İtiraz Edilen</div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {objectionCount}
            </div>
          </div>
        </div>

        {/* Chart - Modern 3D Animasyonlu */}
        {election && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 transform transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Genel Sonuçlar - İnteraktif Grafik
            </h2>
            {aggregatedResults.data.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 3D Animasyonlu Pasta Grafiği */}
                <div className="relative transform transition-transform duration-300 hover:scale-105">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 to-purple-100/50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl blur-xl"></div>
                  <div className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700">
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <defs>
                          {aggregatedResults.data.map((entry, index) => (
                            <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={1} />
                              <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.7} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={aggregatedResults.data}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}\n%${typeof percentage === 'number' ? percentage.toFixed(1) : parseFloat(percentage || 0).toFixed(1)}`}
                          outerRadius={120}
                          innerRadius={40}
                          fill="#8884d8"
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={1000}
                          animationEasing="ease-out"
                          paddingAngle={2}
                        >
                          {aggregatedResults.data.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={`url(#gradient-${index})`}
                              style={{
                                filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.filter = 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.2)) brightness(1.1)';
                                e.target.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.filter = 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))';
                                e.target.style.transform = 'scale(1)';
                              }}
                            />
                          ))}
                        </Pie>
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
                            return [
                              `${value.toLocaleString('tr-TR')} oy (%${percentage.toFixed(1)})`,
                              name
                            ];
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="circle"
                          formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* İnteraktif Liste */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Detaylı Sonuçlar</h3>
                  {aggregatedResults.data
                    .sort((a, b) => b.value - a.value)
                    .map((item, index) => {
                      const percentage = typeof item.percentage === 'number' 
                        ? item.percentage 
                        : parseFloat(item.percentage || 0);
                      const maxPercentage = Math.max(...aggregatedResults.data.map(d => 
                        typeof d.percentage === 'number' ? d.percentage : parseFloat(d.percentage || 0)
                      ));
                      const barWidth = maxPercentage > 0 ? (percentage / maxPercentage) * 100 : 0;
                      
                      return (
                        <div 
                          key={item.name} 
                          className="group relative bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-indigo-300 dark:hover:border-indigo-600"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-5 h-5 rounded-full shadow-md transition-transform duration-300 group-hover:scale-125" 
                                style={{ 
                                  backgroundColor: COLORS[index % COLORS.length],
                                  boxShadow: `0 0 10px ${COLORS[index % COLORS.length]}40`
                                }}
                              ></div>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                                {item.value.toLocaleString('tr-TR')}
                              </div>
                              <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                %{percentage.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          {/* Animasyonlu Progress Bar */}
                          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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

        {/* Results Cards - Modern Design */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Sandık Bazında Detaylı Sonuçlar
              </h2>
            </div>
            {filteredResults.length > 0 && (
              <div className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold text-sm">
                {filteredResults.length} Sandık
              </div>
            )}
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredResults.map((result, index) => {
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
                    className="border-2 rounded-2xl p-5 sm:p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                    style={{
                      borderColor: cardStyle.borderColor,
                      backgroundColor: cardStyle.backgroundColor,
                      animation: `fadeInUp 0.5s ease-out ${index * 0.05}s both`
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
                      <div className="mb-4 space-y-2">
                        {locationParts.map((part, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{part.type}:</span>
                            <span className="text-gray-600 dark:text-gray-400">{part.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Başmüşahit Bilgileri */}
                    {chiefObserver && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Başmüşahit
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {chiefObserver.name}
                        </div>
                        {chiefObserver.phone && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            📞 {chiefObserver.phone}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Oy Sayıları - Modern Cards */}
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      <div className="bg-white/60 dark:bg-gray-700/60 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-600">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kullanılan</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {result.used_votes || 0}
                        </div>
                      </div>
                      <div className="bg-white/60 dark:bg-gray-700/60 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-600">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Geçersiz</div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {result.invalid_votes || 0}
                        </div>
                      </div>
                      <div className="bg-white/60 dark:bg-gray-700/60 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-600">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Geçerli</div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {result.valid_votes || 0}
                        </div>
                      </div>
                    </div>

                    {/* Parti/Aday Oyları - Modern Design */}
                    <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4 mb-4">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                        {election.type === 'cb' ? 'Aday Oyları' : 'Parti Oyları'}
                      </div>
                      {election.type === 'cb' && election.candidates && (
                        <div className="space-y-2">
                          {election.candidates.map((candidate, idx) => {
                            const votes = result.candidate_votes?.[candidate] || 0;
                            const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                            const isWinning = winningParty === candidate && !hasObjection;
                            return (
                              <div 
                                key={candidate} 
                                className={`flex justify-between items-center p-2 rounded-lg transition-all duration-200 ${
                                  isWinning ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/50'
                                }`}
                              >
                                <span className={`text-sm font-medium ${isWinning ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {candidate}
                                </span>
                                <div className="text-right">
                                  <div className={`font-bold ${isWinning ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {votes}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">%{percentage}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(election.type === 'yerel' || election.type === 'genel') && election.parties && (
                        <div className="space-y-2">
                          {election.parties.map((party, idx) => {
                            const votes = result.party_votes?.[party] || 0;
                            const percentage = totalValidVotes > 0 ? ((votes / totalValidVotes) * 100).toFixed(2) : 0;
                            const isWinning = winningParty === party && !hasObjection;
                            return (
                              <div 
                                key={party} 
                                className={`flex justify-between items-center p-2 rounded-lg transition-all duration-200 ${
                                  isWinning ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/50'
                                }`}
                              >
                                <span className={`text-sm font-medium ${isWinning ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {party}
                                </span>
                                <div className="text-right">
                                  <div className={`font-bold ${isWinning ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {votes}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">%{percentage}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Seçim Tutanak Fotoğrafları - Modern Buttons */}
                    {(result.signed_protocol_photo || result.signedProtocolPhoto || result.objection_protocol_photo || result.objectionProtocolPhoto) && (
                      <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                          Tutanaklar
                        </div>
                        <div className="flex items-center gap-2">
                          {(result.signed_protocol_photo || result.signedProtocolPhoto) && (
                            <button
                              onClick={() => handlePhotoClick(
                                result.signed_protocol_photo || result.signedProtocolPhoto,
                                `Seçim Tutanağı - Sandık ${result.ballot_number}`
                              )}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                              title="Seçim Tutanağını Görüntüle"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Seçim Tutanağı</span>
                            </button>
                          )}
                          {(result.objection_protocol_photo || result.objectionProtocolPhoto) && (
                            <button
                              onClick={() => handlePhotoClick(
                                result.objection_protocol_photo || result.objectionProtocolPhoto,
                                `İtiraz Tutanağı - Sandık ${result.ballot_number}`
                              )}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                              title="İtiraz Tutanağını Görüntüle"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>İtiraz Tutanağı</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Photo Modal - Modern Design */}
      {modalPhoto && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setModalPhoto(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-3xl max-w-5xl w-full max-h-[95vh] overflow-hidden shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-5 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {modalTitle}
              </h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleDownload(modalPhoto, modalTitle.replace(/\s+/g, '_') + '.jpg')}
                  className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl text-sm font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>İndir</span>
                </button>
                <button
                  onClick={() => setModalPhoto(null)}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl transition-all duration-200 flex items-center justify-center hover:scale-110"
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

