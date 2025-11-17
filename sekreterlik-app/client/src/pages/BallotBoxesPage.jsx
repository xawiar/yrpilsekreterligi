import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import * as XLSX from 'xlsx';

const BallotBoxesPage = () => {
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [observers, setObservers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [elections, setElections] = useState([]);
  const [electionResults, setElectionResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBallotBox, setEditingBallotBox] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBallotBox, setSelectedBallotBox] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formData, setFormData] = useState({
    ballot_number: '',
    institution_name: '',
    region_name: '',
    district_id: '',
    town_id: '',
    neighborhood_id: '',
    village_id: '',
    voter_count: ''
  });
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    district_id: '',
    neighborhood_id: '',
    village_id: '',
    has_observer: ''
  });

  useEffect(() => {
    fetchBallotBoxes();
  }, []);

  const fetchBallotBoxes = async () => {
    try {
      setLoading(true);
      const [ballotBoxesData, observersData, districtsData, townsData, neighborhoodsData, villagesData, electionsData] = await Promise.all([
        ApiService.getBallotBoxes(),
        ApiService.getBallotBoxObservers(),
        ApiService.getDistricts(),
        ApiService.getTowns(),
        ApiService.getNeighborhoods(),
        ApiService.getVillages(),
        ApiService.getElections()
      ]);
      setBallotBoxes(ballotBoxesData || []);
      setObservers(observersData || []);
      setDistricts(districtsData || []);
      setTowns(townsData || []);
      setNeighborhoods(neighborhoodsData || []);
      setVillages(villagesData || []);
      setElections(electionsData || []);
      
      // Tüm seçim sonuçlarını al
      if (electionsData && electionsData.length > 0) {
        try {
          const allResults = await Promise.all(
            electionsData.map(election => ApiService.getElectionResults(election.id, null))
          );
          const flattenedResults = allResults.flat();
          setElectionResults(flattenedResults || []);
        } catch (error) {
          console.error('Error fetching election results:', error);
          setElectionResults([]);
        }
      }
    } catch (error) {
      console.error('Error fetching ballot boxes:', error);
      setError('Sandıklar yüklenirken hata oluştu');
      setBallotBoxes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Cascade filtering helpers
  const filteredTowns = () => {
    if (!formData.district_id) return towns;
    return towns.filter(t => String(t.district_id) === String(formData.district_id));
  };
  const filteredNeighborhoods = () => {
    let base = neighborhoods;
    if (formData.district_id) base = base.filter(n => String(n.district_id) === String(formData.district_id));
    if (formData.town_id && 'town_id' in (base[0] || {})) base = base.filter(n => String(n.town_id) === String(formData.town_id));
    return base;
  };
  const filteredVillages = () => {
    let base = villages;
    if (formData.district_id) base = base.filter(v => String(v.district_id) === String(formData.district_id));
    if (formData.town_id && 'town_id' in (base[0] || {})) base = base.filter(v => String(v.town_id) === String(formData.town_id));
    return base;
  };

  // When higher level changes, clear lower ones
  useEffect(() => {
    setFormData(prev => ({ ...prev, town_id: '', neighborhood_id: '', village_id: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.district_id]);
  useEffect(() => {
    setFormData(prev => ({ ...prev, neighborhood_id: '', village_id: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.town_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.ballot_number || !formData.institution_name) {
      setError('Sandık numarası ve kurum adı zorunludur');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        ballot_number: formData.ballot_number,
        institution_name: formData.institution_name,
        region_name: formData.region_name || null,
        district_id: formData.district_id || null,
        town_id: formData.town_id || null,
        neighborhood_id: formData.neighborhood_id || null,
        village_id: formData.village_id || null,
        voter_count: formData.voter_count ? parseInt(formData.voter_count) : null,
      };
      if (editingBallotBox) {
        await ApiService.updateBallotBox(editingBallotBox.id, payload);
      } else {
        await ApiService.createBallotBox(payload);
      }

      // Reset form but keep region_name from localStorage
      const savedRegionName = localStorage.getItem('admin_region_name') || '';
      setFormData({
        ballot_number: '',
        institution_name: '',
        region_name: savedRegionName,
        district_id: '',
        town_id: '',
        neighborhood_id: '',
        village_id: '',
        voter_count: ''
      });
      setShowAddForm(false);
      setEditingBallotBox(null);
      await fetchBallotBoxes();
    } catch (error) {
      console.error('Error saving ballot box:', error);
      setError('Sandık kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ballotBox) => {
    setEditingBallotBox(ballotBox);
    // Get region_name from ballotBox or from localStorage
    const regionName = ballotBox.region_name || localStorage.getItem('admin_region_name') || '';
    setFormData({
      ballot_number: ballotBox.ballot_number,
      institution_name: ballotBox.institution_name,
      region_name: regionName,
      district_id: ballotBox.district_id ? String(ballotBox.district_id) : '',
      town_id: ballotBox.town_id ? String(ballotBox.town_id) : '',
      neighborhood_id: ballotBox.neighborhood_id ? String(ballotBox.neighborhood_id) : '',
      village_id: ballotBox.village_id ? String(ballotBox.village_id) : '',
      voter_count: ballotBox.voter_count ? String(ballotBox.voter_count) : ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (ballotBoxId) => {
    if (window.confirm('Bu sandığı silmek istediğinizden emin misiniz?')) {
      try {
        setLoading(true);
        await ApiService.deleteBallotBox(ballotBoxId);
        await fetchBallotBoxes();
      } catch (error) {
        console.error('Error deleting ballot box:', error);
        setError('Sandık silinirken hata oluştu');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    // Reset form but keep region_name from localStorage
    const savedRegionName = localStorage.getItem('admin_region_name') || '';
    setFormData({
      ballot_number: '',
      institution_name: '',
      region_name: savedRegionName,
      district_id: '',
      town_id: '',
      neighborhood_id: '',
      village_id: '',
      voter_count: ''
    });
    setShowAddForm(false);
    setEditingBallotBox(null);
    setError('');
  };

  // Excel Import Handler
  const handleExcelFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFile(file);
    setImportErrors([]);
  };

  const handleExcelImport = async () => {
    if (!excelFile) {
      setError('Lütfen bir Excel dosyası seçin');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setImportErrors([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // İlk satırı başlık olarak atla
          const dataRows = jsonData.slice(1);
          const errors = [];
          let importedCount = 0;

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNumber = i + 2; // Excel satır numarası (başlık dahil)

            if (row.length === 0 || row.every(cell => !cell)) continue; // Boş satırları atla

            try {
              // Excel formatı: İl, İlçe, Mahalle/Köy, Sandık Alanı/Okul Adı, Sandık Numarası, Sandık Seçmen Sayısı
              const regionName = row[0] ? String(row[0]).trim() : '';
              const districtName = row[1] ? String(row[1]).trim() : '';
              const locationName = row[2] ? String(row[2]).trim() : ''; // Mahalle veya Köy
              const institutionName = row[3] ? String(row[3]).trim() : '';
              const ballotNumber = row[4] ? String(row[4]).trim() : '';
              const voterCount = row[5] ? String(row[5]).trim() : '';

              // Validasyon
              if (!ballotNumber) {
                errors.push(`Satır ${rowNumber}: Sandık numarası zorunludur`);
                continue;
              }
              if (!institutionName) {
                errors.push(`Satır ${rowNumber}: Kurum adı zorunludur`);
                continue;
              }

              // İlçe kontrolü
              let districtId = null;
              if (districtName) {
                const district = districts.find(d => 
                  d.name.toLowerCase() === districtName.toLowerCase()
                );
                if (!district) {
                  errors.push(`Satır ${rowNumber}: "${districtName}" ilçesi bulunamadı`);
                  continue;
                }
                districtId = district.id;
              }

              // Mahalle/Köy kontrolü
              let neighborhoodId = null;
              let villageId = null;
              if (locationName && districtId) {
                const neighborhood = neighborhoods.find(n => 
                  n.name.toLowerCase() === locationName.toLowerCase() && 
                  String(n.district_id) === String(districtId)
                );
                const village = villages.find(v => 
                  v.name.toLowerCase() === locationName.toLowerCase() && 
                  String(v.district_id) === String(districtId)
                );
                
                if (neighborhood) {
                  neighborhoodId = neighborhood.id;
                } else if (village) {
                  villageId = village.id;
                } else {
                  errors.push(`Satır ${rowNumber}: "${locationName}" mahalle/köyü bulunamadı`);
                  // Devam et, sadece uyarı ver
                }
              }

              // Sandık oluştur
              const payload = {
                ballot_number: ballotNumber,
                institution_name: institutionName,
                region_name: regionName || null,
                district_id: districtId,
                town_id: null,
                neighborhood_id: neighborhoodId,
                village_id: villageId,
                voter_count: voterCount ? parseInt(voterCount) : null
              };

              await ApiService.createBallotBox(payload);
              importedCount++;
            } catch (rowError) {
              errors.push(`Satır ${rowNumber}: ${rowError.message || 'Bilinmeyen hata'}`);
            }
          }

          if (errors.length > 0) {
            setImportErrors(errors);
          }

          if (importedCount > 0) {
            setMessage(`${importedCount} sandık başarıyla içe aktarıldı${errors.length > 0 ? `, ${errors.length} hata oluştu` : ''}`);
            setMessageType(errors.length > 0 ? 'error' : 'success');
            await fetchBallotBoxes();
            setShowExcelImport(false);
            setExcelFile(null);
          } else {
            setError('Hiçbir sandık içe aktarılamadı');
          }
        } catch (error) {
          console.error('Excel import error:', error);
          setError('Excel dosyası işlenirken hata oluştu: ' + error.message);
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(excelFile);
    } catch (error) {
      console.error('Excel import error:', error);
      setError('Excel dosyası okunurken hata oluştu: ' + error.message);
      setLoading(false);
    }
  };

  // Excel Template Download
  const downloadExcelTemplate = () => {
    const templateData = [
      ['İl', 'İlçe', 'Mahalle / Köy', 'Sandık Alanı / Okul Adı', 'Sandık Numarası', 'Sandık Seçmen Sayısı (Toplam)'],
      ['Elazığ', 'Merkez', 'Ataşehir', 'İlkokul', '1001', '200'],
      ['Elazığ', 'Merkez', 'Yenimahalle', 'Ortaokul', '1002', '250']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sandıklar');
    
    XLSX.writeFile(wb, 'sandik_template.xlsx');
  };

  const getBallotBoxObservers = (ballotBoxId) => {
    // ID'leri string'e çevirerek karşılaştır (tip uyumsuzluğu sorununu çözer)
    return observers.filter(observer => String(observer.ballot_box_id) === String(ballotBoxId));
  };

  // Konum bilgilerini ayrı ayrı döndürür
  const getLocationInfo = (ballotBox) => {
    if (!ballotBox) {
      return {
        region: null,
        district: null,
        town: null,
        neighborhood: null,
        village: null,
        chiefObserver: null
      };
    }
    
    // Önce sandığın kendi bilgilerine bak
    let regionName = ballotBox.region_name;
    let districtName = ballotBox.district_name;
    let townName = ballotBox.town_name;
    let neighborhoodName = ballotBox.neighborhood_name;
    let villageName = ballotBox.village_name;
    
    // Başmüşahit bilgisini al
    const ballotBoxObservers = getBallotBoxObservers(ballotBox.id);
    const chiefObserver = ballotBoxObservers.find(observer => 
      observer.is_chief_observer === true || observer.is_chief_observer === 1
    );
    
    // Eğer sandıkta konum bilgisi yoksa, başmüşahit bilgilerine bak
    if (!districtName && !neighborhoodName && !villageName && chiefObserver) {
      if (!regionName) {
        regionName = chiefObserver.region_name || null;
      }
      if (!districtName) {
        districtName = chiefObserver.district_name || 
          (chiefObserver.observer_district_id ? districts.find(d => String(d.id) === String(chiefObserver.observer_district_id))?.name : null);
      }
      if (!townName) {
        townName = chiefObserver.town_name || 
          (chiefObserver.observer_town_id ? towns.find(t => String(t.id) === String(chiefObserver.observer_town_id))?.name : null);
      }
      if (!neighborhoodName && !villageName) {
        neighborhoodName = chiefObserver.neighborhood_name || 
          (chiefObserver.observer_neighborhood_id ? neighborhoods.find(n => String(n.id) === String(chiefObserver.observer_neighborhood_id))?.name : null);
        villageName = chiefObserver.village_name || 
          (chiefObserver.observer_village_id ? villages.find(v => String(v.id) === String(chiefObserver.observer_village_id))?.name : null);
      }
    }
    
    return {
      region: regionName,
      district: districtName,
      town: townName,
      neighborhood: neighborhoodName,
      village: villageName,
      chiefObserver: chiefObserver ? chiefObserver.name : null
    };
  };

  // Konum bilgilerini okunabilir formatta döndürür (eski fonksiyon - geriye dönük uyumluluk için)
  const getLocationDisplay = (ballotBox) => {
    if (!ballotBox) return null;
    
    const parts = [];
    
    // Önce sandığın kendi bilgilerine bak
    let regionName = ballotBox.region_name;
    let districtName = ballotBox.district_name;
    let townName = ballotBox.town_name;
    let neighborhoodName = ballotBox.neighborhood_name;
    let villageName = ballotBox.village_name;
    
    // Eğer sandıkta konum bilgisi yoksa, başmüşahit bilgilerine bak
    if (!districtName && !neighborhoodName && !villageName) {
      const ballotBoxObservers = getBallotBoxObservers(ballotBox.id);
      const chiefObserver = ballotBoxObservers.find(observer => 
        observer.is_chief_observer === true || observer.is_chief_observer === 1
      );
      
      if (chiefObserver) {
        // Başmüşahit bilgilerini kullan
        if (!regionName) {
          regionName = chiefObserver.region_name || null;
        }
        if (!districtName) {
          districtName = chiefObserver.district_name || 
            (chiefObserver.observer_district_id ? districts.find(d => String(d.id) === String(chiefObserver.observer_district_id))?.name : null);
        }
        if (!townName) {
          townName = chiefObserver.town_name || 
            (chiefObserver.observer_town_id ? towns.find(t => String(t.id) === String(chiefObserver.observer_town_id))?.name : null);
        }
        if (!neighborhoodName && !villageName) {
          neighborhoodName = chiefObserver.neighborhood_name || 
            (chiefObserver.observer_neighborhood_id ? neighborhoods.find(n => String(n.id) === String(chiefObserver.observer_neighborhood_id))?.name : null);
          villageName = chiefObserver.village_name || 
            (chiefObserver.observer_village_id ? villages.find(v => String(v.id) === String(chiefObserver.observer_village_id))?.name : null);
        }
      }
    }
    
    // İl bilgisi
    if (regionName) {
      parts.push(regionName);
    }
    
    // İlçe bilgisi
    if (districtName) {
      parts.push(districtName);
    }
    
    // Belde bilgisi varsa
    if (townName) {
      parts.push(townName + ' Beldesi');
    }
    
    // Mahalle veya Köy bilgisi (en alt seviye)
    if (neighborhoodName) {
      parts.push(neighborhoodName + ' Mahallesi');
    } else if (villageName) {
      parts.push(villageName + ' Köyü');
    }
    
    // Eğer hiçbir bilgi yoksa null döndür
    if (parts.length === 0) return null;
    
    // Hiyerarşik sırada birleştir (İl > İlçe > Belde > Mahalle/Köy)
    return parts.join(' > ');
  };

  const getBallotBoxStatus = (ballotBoxId) => {
    const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(ballotBoxId));
    const ballotBoxObservers = getBallotBoxObservers(ballotBoxId);
    const chiefObserver = ballotBoxObservers.find(observer => observer.is_chief_observer === true || observer.is_chief_observer === 1);
    const regularObservers = ballotBoxObservers.filter(observer => !observer.is_chief_observer);
    
    // Sandığın kendisinde mahalle/köy var mı kontrol et
    const hasBallotBoxNeighborhood = ballotBox && (ballotBox.neighborhood_id || ballotBox.village_id);
    
    // Observer'larda mahalle/köy var mı kontrol et - hem direkt alanlar hem de observer_ prefix'li alanlar
    const hasObserverNeighborhoodOrVillage = ballotBoxObservers.some(observer => 
      (observer.neighborhood_id && observer.neighborhood_id !== null && observer.neighborhood_id !== '') ||
      (observer.village_id && observer.village_id !== null && observer.village_id !== '') ||
      (observer.observer_neighborhood_id && observer.observer_neighborhood_id !== null && observer.observer_neighborhood_id !== '') ||
      (observer.observer_village_id && observer.observer_village_id !== null && observer.observer_village_id !== '')
    );
    
    // Sandığın kendisinde veya observer'larda ilçe var mı kontrol et - hem direkt alanlar hem de observer_ prefix'li alanlar
    const hasBallotBoxDistrict = ballotBox && ballotBox.district_id && ballotBox.district_id !== null && ballotBox.district_id !== '';
    const hasObserverDistrict = ballotBoxObservers.some(observer => 
      (observer.district_id && observer.district_id !== null && observer.district_id !== '') ||
      (observer.observer_district_id && observer.observer_district_id !== null && observer.observer_district_id !== '')
    );
    
    // Seçim sonuçlarını kontrol et - bu sandık için yüklenen fotoğraflar
    const ballotBoxResults = electionResults.filter(result => 
      String(result.ballot_box_id || result.ballotBoxId) === String(ballotBoxId)
    );
    
    // En az bir seçim sonucunda fotoğraf var mı kontrol et
    const hasSignedProtocolPhoto = ballotBoxResults.some(result => 
      result.signed_protocol_photo || result.signedProtocolPhoto
    );
    const hasObjectionProtocolPhoto = ballotBoxResults.some(result => 
      result.objection_protocol_photo || result.objectionProtocolPhoto
    );
    
    return {
      hasChiefObserver: !!chiefObserver,
      hasObservers: regularObservers.length > 0,
      hasDistrict: hasBallotBoxDistrict || hasObserverDistrict,
      hasNeighborhoodOrVillage: hasBallotBoxNeighborhood || hasObserverNeighborhoodOrVillage,
      chiefObserverName: chiefObserver ? chiefObserver.name : null,
      observersCount: regularObservers.length,
      hasSignedProtocolPhoto,
      hasObjectionProtocolPhoto
    };
  };

  // Filter ballot boxes based on search term and filters
  const getFilteredBallotBoxes = () => {
    return ballotBoxes.filter(ballotBox => {
      const matchesSearch = searchTerm === '' || 
        ballotBox.ballot_number.toString().includes(searchTerm) ||
        ballotBox.institution_name.toLowerCase().includes(searchTerm.toLowerCase());

      // Get observers for this ballot box
      const ballotBoxObservers = observers.filter(observer => observer.ballot_box_id === ballotBox.id);
      const hasObservers = ballotBoxObservers.length > 0;

      const matchesDistrict = filters.district_id === '' || 
        ballotBoxObservers.some(observer => observer.observer_district_id === parseInt(filters.district_id));
      const matchesNeighborhood = filters.neighborhood_id === '' || 
        ballotBoxObservers.some(observer => observer.observer_neighborhood_id === parseInt(filters.neighborhood_id));
      const matchesVillage = filters.village_id === '' || 
        ballotBoxObservers.some(observer => observer.observer_village_id === parseInt(filters.village_id));
      const matchesObserverStatus = filters.has_observer === '' || 
        (filters.has_observer === 'true' && hasObservers) ||
        (filters.has_observer === 'false' && !hasObservers);

      return matchesSearch && matchesDistrict && matchesNeighborhood && matchesVillage && matchesObserverStatus;
    });
  };

  const filteredBallotBoxes = getFilteredBallotBoxes();

  // Calculate statistics
  const getStatistics = () => {
    const totalBallotBoxes = filteredBallotBoxes.length;
    
    // Count ballot boxes with chief observers
    const ballotBoxesWithChiefObserver = filteredBallotBoxes.filter(ballotBox => {
      const status = getBallotBoxStatus(ballotBox.id);
      return status.hasChiefObserver;
    }).length;
    
    // Count ballot boxes with district assigned (sandığın kendisinde veya observer'larda)
    const ballotBoxesWithDistrict = filteredBallotBoxes.filter(ballotBox => {
      const status = getBallotBoxStatus(ballotBox.id);
      return status.hasDistrict;
    }).length;
    
    // Count ballot boxes with neighborhood/village assigned (sandığın kendisinde veya observer'larda)
    const ballotBoxesWithLocation = filteredBallotBoxes.filter(ballotBox => {
      const status = getBallotBoxStatus(ballotBox.id);
      return status.hasNeighborhoodOrVillage;
    }).length;
    
    // Count completed ballot boxes (has district, location, and chief observer)
    const completedBallotBoxes = filteredBallotBoxes.filter(ballotBox => {
      const status = getBallotBoxStatus(ballotBox.id);
      return status.hasChiefObserver && status.hasDistrict && status.hasNeighborhoodOrVillage;
    }).length;
    
    return {
      totalBallotBoxes,
      ballotBoxesWithChiefObserver,
      ballotBoxesWithDistrict,
      ballotBoxesWithLocation,
      completedBallotBoxes
    };
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value,
      // Reset dependent filters when parent changes
      ...(filterType === 'district_id' && {
        neighborhood_id: '',
        village_id: ''
      })
    }));
  };

  // Get filtered neighborhoods based on selected district
  const getFilteredNeighborhoods = () => {
    if (!filters.district_id) return neighborhoods;
    return neighborhoods.filter(neighborhood => neighborhood.district_id === parseInt(filters.district_id));
  };

  // Get filtered villages based on selected district
  const getFilteredVillages = () => {
    if (!filters.district_id) return villages;
    return villages.filter(village => village.district_id === parseInt(filters.district_id));
  };

  const statistics = getStatistics();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sandıklar</h1>
              <p className="mt-2 text-gray-600">Sandık ekleme ve yönetimi</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  const excelData = [
                    ['İl', 'İlçe', 'Mahalle / Köy', 'Sandık Alanı / Okul Adı', 'Sandık Numarası', 'Sandık Seçmen Sayısı (Toplam)']
                  ];
                  
                  filteredBallotBoxes.forEach(ballotBox => {
                    const locationInfo = getLocationInfo(ballotBox);
                    const neighborhoodOrVillage = locationInfo.neighborhood || locationInfo.village || '';
                    
                    excelData.push([
                      locationInfo.region || '',
                      locationInfo.district || '',
                      neighborhoodOrVillage,
                      ballotBox.institution_name || '',
                      ballotBox.ballot_number || '',
                      ballotBox.voter_count || ''
                    ]);
                  });
                  
                  const ws = XLSX.utils.aoa_to_sheet(excelData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Sandıklar');
                  
                  const fileName = `sandiklar_${new Date().toISOString().split('T')[0]}.xlsx`;
                  XLSX.writeFile(wb, fileName);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel'e Aktar
              </button>
              <button
                onClick={() => {
                  // Load region_name from localStorage when opening form
                  const savedRegionName = localStorage.getItem('admin_region_name') || '';
                  setFormData(prev => ({
                    ...prev,
                    region_name: savedRegionName
                  }));
                  setShowAddForm(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Yeni Sandık Ekle
              </button>
              <button
                onClick={() => setShowExcelImport(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Excel ile Yükle
              </button>
              <button
                onClick={downloadExcelTemplate}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel Şablonu İndir
              </button>
              <Link
                to="/election-preparation"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Geri Dön
              </Link>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Toplam Sandık</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.totalBallotBoxes}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Başmüşahit Atanmış</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.ballotBoxesWithChiefObserver}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">İlçe Atanmış</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.ballotBoxesWithDistrict}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Mahalle/Köy Atanmış</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.ballotBoxesWithLocation}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Tamamlanmış Sandık</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.completedBallotBoxes}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Hata</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900">
                Sandık Listesi
              </h2>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Sandık ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Filters */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Filtreler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İlçe</label>
                  <select
                    value={filters.district_id}
                    onChange={(e) => handleFilterChange('district_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Tüm İlçeler</option>
                    {districts.map(district => (
                      <option key={district.id} value={district.id}>{district.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mahalle</label>
                  <select
                    value={filters.neighborhood_id}
                    onChange={(e) => handleFilterChange('neighborhood_id', e.target.value)}
                    disabled={!filters.district_id}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">Tüm Mahalleler</option>
                    {getFilteredNeighborhoods().map(neighborhood => (
                      <option key={neighborhood.id} value={neighborhood.id}>{neighborhood.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Köy</label>
                  <select
                    value={filters.village_id}
                    onChange={(e) => handleFilterChange('village_id', e.target.value)}
                    disabled={!filters.district_id}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">Tüm Köyler</option>
                    {getFilteredVillages().map(village => (
                      <option key={village.id} value={village.id}>{village.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Müşahit Durumu</label>
                  <select
                    value={filters.has_observer}
                    onChange={(e) => handleFilterChange('has_observer', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Tümü</option>
                    <option value="true">Müşahit Atanmış</option>
                    <option value="false">Müşahit Atanmamış</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setFilters({
                    district_id: '',
                    neighborhood_id: '',
                    village_id: '',
                    has_observer: ''
                  })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Filtreleri Temizle
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingBallotBox ? 'Sandık Düzenle' : 'Yeni Sandık Ekle'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Sandık Numarası *
                      </label>
                      <input
                        type="text"
                        name="ballot_number"
                        value={formData.ballot_number}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Kurum Adı *
                      </label>
                      <input
                        type="text"
                        name="institution_name"
                        value={formData.institution_name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Seçmen Sayısı (Toplam)
                      </label>
                      <input
                        type="number"
                        name="voter_count"
                        value={formData.voter_count}
                        onChange={handleInputChange}
                        min="0"
                        placeholder="Örn: 200"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  {/* Optional location fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">İl (opsiyonel)</label>
                      <input
                        type="text"
                        name="region_name"
                        value={formData.region_name}
                        onChange={handleInputChange}
                        placeholder="Örn: Elazığ"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">İlçe (opsiyonel)</label>
                      <select
                        name="district_id"
                        value={formData.district_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">İlçe seçin</option>
                        {districts.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Belde (opsiyonel)</label>
                      <select
                        name="town_id"
                        value={formData.town_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Belde seçin</option>
                        {filteredTowns().map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mahalle (opsiyonel)</label>
                      <select
                        name="neighborhood_id"
                        value={formData.neighborhood_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Mahalle seçin</option>
                        {filteredNeighborhoods().map(n => (
                          <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Köy (opsiyonel)</label>
                      <select
                        name="village_id"
                        value={formData.village_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Köy seçin</option>
                        {filteredVillages().map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'Kaydediliyor...' : (editingBallotBox ? 'Güncelle' : 'Kaydet')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Excel Import Modal */}
            {showExcelImport && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Excel ile Sandık Yükle
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Excel Dosyası Seç
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelFile}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    {excelFile && (
                      <p className="mt-2 text-sm text-gray-600">
                        Seçilen dosya: {excelFile.name}
                      </p>
                    )}
                  </div>
                  
                  {importErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <h4 className="text-sm font-medium text-red-800 mb-2">
                        Hatalar ({importErrors.length}):
                      </h4>
                      <ul className="list-disc list-inside text-sm text-red-700 max-h-40 overflow-y-auto">
                        {importErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExcelImport(false);
                        setExcelFile(null);
                        setImportErrors([]);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={handleExcelImport}
                      disabled={!excelFile || loading}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Yükleniyor...' : 'Yükle'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && !showAddForm && !showExcelImport ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Sandıklar yükleniyor...</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredBallotBoxes.map((ballotBox) => {
                    const status = getBallotBoxStatus(ballotBox.id);
                    const locationInfo = getLocationInfo(ballotBox);
                    return (
                      <div key={ballotBox.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-base font-semibold text-gray-900 mb-1">Sandık {ballotBox.ballot_number}</h3>
                              <p className="text-sm text-gray-500">{ballotBox.institution_name || '-'}</p>
                            </div>
                          </div>
                          
                          {/* Konum Bilgileri */}
                          <div className="space-y-1.5 border-t border-gray-200 pt-3">
                            {locationInfo.region && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">İl:</span> {locationInfo.region}
                              </div>
                            )}
                            {locationInfo.district && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">İlçe:</span> {locationInfo.district}
                              </div>
                            )}
                            {locationInfo.town && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Belde:</span> {locationInfo.town}
                              </div>
                            )}
                            {(locationInfo.neighborhood || locationInfo.village) && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Mahalle/Köy:</span> {locationInfo.neighborhood || locationInfo.village}
                              </div>
                            )}
                            {locationInfo.chiefObserver && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Başmüşahit:</span> {locationInfo.chiefObserver}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                            <button
                              onClick={() => {
                                setSelectedBallotBox(ballotBox);
                                setShowDetailModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                            >
                              Detay
                            </button>
                            <button
                              onClick={() => handleEdit(ballotBox)}
                              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleDelete(ballotBox.id)}
                              className="text-red-600 hover:text-red-900 text-sm font-medium"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredBallotBoxes.length === 0 && (
                    <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-gray-200">
                      <p className="text-gray-500">
                        {searchTerm ? 'Arama kriterlerine uygun sandık bulunamadı' : 'Henüz sandık eklenmemiş'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sandık No
                      </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kurum Adı
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          İl
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          İlçe
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Belde
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mahalle/Köy
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Başmüşahit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          İşlemler
                        </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBallotBoxes.map((ballotBox) => {
                      const status = getBallotBoxStatus(ballotBox.id);
                      const locationInfo = getLocationInfo(ballotBox);
                      return (
                        <tr key={ballotBox.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ballotBox.ballot_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ballotBox.institution_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {locationInfo.region || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {locationInfo.district || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {locationInfo.town || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {locationInfo.neighborhood || locationInfo.village || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {locationInfo.chiefObserver || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium relative">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedBallotBox(ballotBox);
                                  setShowDetailModal(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Detay"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleEdit(ballotBox)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Düzenle"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(ballotBox.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Sil"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <div className="relative">
                                <button
                                  onClick={() => setOpenMenuId(openMenuId === ballotBox.id ? null : ballotBox.id)}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Durum"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                  </svg>
                                </button>
                                {openMenuId === ballotBox.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-10" 
                                      onClick={() => setOpenMenuId(null)}
                                    ></div>
                                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                                      <div className="py-2">
                                        <div className="px-4 py-2 border-b border-gray-200">
                                          <h4 className="text-xs font-semibold text-gray-700 uppercase">Durum Bilgileri</h4>
                                        </div>
                                        <div className="px-4 py-2 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <div className={`w-3 h-3 rounded-full ${status.hasDistrict ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                              <span className="text-xs text-gray-700">İlçe</span>
                                            </div>
                                            <span className="text-xs text-gray-500">{status.hasDistrict ? 'Atanmış' : 'Atanmamış'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <div className={`w-3 h-3 rounded-full ${status.hasNeighborhoodOrVillage ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                              <span className="text-xs text-gray-700">Mahalle/Köy</span>
                                            </div>
                                            <span className="text-xs text-gray-500">{status.hasNeighborhoodOrVillage ? 'Atanmış' : 'Atanmamış'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <div className={`w-3 h-3 rounded-full ${status.hasChiefObserver ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                              <span className="text-xs text-gray-700">Başmüşahit</span>
                                            </div>
                                            <span className="text-xs text-gray-500">{status.hasChiefObserver ? 'Atanmış' : 'Atanmamış'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <div className={`w-3 h-3 rounded-full ${status.hasObservers ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                              <span className="text-xs text-gray-700">Müşahit</span>
                                            </div>
                                            <span className="text-xs text-gray-500">{status.hasObservers ? `${status.observersCount} kişi` : 'Atanmamış'}</span>
                                          </div>
                                          {(status.hasSignedProtocolPhoto || status.hasObjectionProtocolPhoto) && (
                                            <div className="pt-2 border-t border-gray-200">
                                              <div className="text-xs font-medium text-gray-700 mb-1">Tutanaklar:</div>
                                              <div className="flex items-center space-x-3">
                                                {status.hasSignedProtocolPhoto && (
                                                  <div className="flex items-center space-x-1" title="Seçim Tutanağı Yüklendi">
                                                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-xs text-gray-600">Seçim</span>
                                                  </div>
                                                )}
                                                {status.hasObjectionProtocolPhoto && (
                                                  <div className="flex items-center space-x-1" title="İtiraz Tutanağı Yüklendi">
                                                    <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <span className="text-xs text-gray-600">İtiraz</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredBallotBoxes.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {searchTerm ? 'Arama kriterlerine uygun sandık bulunamadı' : 'Henüz sandık eklenmemiş'}
                    </p>
                  </div>
                )}
                  </div>
                </>
              )}
          </div>
        </div>
      </div>

      {/* Sandık Detay Modal */}
      {showDetailModal && selectedBallotBox && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowDetailModal(false);
                setSelectedBallotBox(null);
              }}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Sandık Detayları - {selectedBallotBox.ballot_number}
                  </h3>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedBallotBox(null);
                    }}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sandık Bilgileri */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Sandık Bilgileri</h4>
                    <dl className="grid grid-cols-1 gap-3">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Sandık Numarası</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedBallotBox.ballot_number}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Kurum Adı</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedBallotBox.institution_name}</dd>
                      </div>
                      {(() => {
                        const locationInfo = getLocationInfo(selectedBallotBox);
                        return (
                          <>
                            {locationInfo.region && (
                              <div>
                                <dt className="text-xs font-medium text-gray-500">İl</dt>
                                <dd className="mt-1 text-sm text-gray-900">{locationInfo.region}</dd>
                              </div>
                            )}
                            {locationInfo.district && (
                              <div>
                                <dt className="text-xs font-medium text-gray-500">İlçe</dt>
                                <dd className="mt-1 text-sm text-gray-900">{locationInfo.district}</dd>
                              </div>
                            )}
                            {locationInfo.town && (
                              <div>
                                <dt className="text-xs font-medium text-gray-500">Belde</dt>
                                <dd className="mt-1 text-sm text-gray-900">{locationInfo.town}</dd>
                              </div>
                            )}
                            {locationInfo.neighborhood && (
                              <div>
                                <dt className="text-xs font-medium text-gray-500">Mahalle</dt>
                                <dd className="mt-1 text-sm text-gray-900">{locationInfo.neighborhood}</dd>
                              </div>
                            )}
                            {locationInfo.village && (
                              <div>
                                <dt className="text-xs font-medium text-gray-500">Köy</dt>
                                <dd className="mt-1 text-sm text-gray-900">{locationInfo.village}</dd>
                              </div>
                            )}
                            {locationInfo.chiefObserver && (
                              <div>
                                <dt className="text-xs font-medium text-gray-500">Başmüşahit</dt>
                                <dd className="mt-1 text-sm text-gray-900">{locationInfo.chiefObserver}</dd>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </dl>
                  </div>

                  {/* Müşahit Bilgileri */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Müşahit Bilgileri</h4>
                    {(() => {
                      const ballotBoxObservers = getBallotBoxObservers(selectedBallotBox.id);
                      const chiefObserver = ballotBoxObservers.find(obs => obs.is_chief_observer === true || obs.is_chief_observer === 1);
                      const regularObservers = ballotBoxObservers.filter(obs => !obs.is_chief_observer);
                      
                      return (
                        <div className="space-y-4">
                          {chiefObserver ? (
                            <div>
                              <h5 className="text-xs font-medium text-gray-600 mb-2">Başmüşahit</h5>
                              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                <p className="text-sm font-medium text-gray-900">{chiefObserver.name}</p>
                                <p className="text-xs text-gray-600 mt-1">TC: {chiefObserver.tc}</p>
                                <p className="text-xs text-gray-600">Telefon: {chiefObserver.phone}</p>
                                {chiefObserver.region_name && (
                                  <p className="text-xs text-gray-600 mt-1">İl: {chiefObserver.region_name}</p>
                                )}
                                {chiefObserver.district_name && (
                                  <p className="text-xs text-gray-600">İlçe: {chiefObserver.district_name}</p>
                                )}
                                {(chiefObserver.neighborhood_name || chiefObserver.village_name) && (
                                  <p className="text-xs text-gray-600">
                                    {chiefObserver.neighborhood_name ? `Mahalle: ${chiefObserver.neighborhood_name}` : `Köy: ${chiefObserver.village_name}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                              <p className="text-xs text-red-600">Başmüşahit atanmamış</p>
                            </div>
                          )}

                          {regularObservers.length > 0 ? (
                            <div>
                              <h5 className="text-xs font-medium text-gray-600 mb-2">Müşahitler ({regularObservers.length})</h5>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {regularObservers.map((observer) => (
                                  <div key={observer.id} className="bg-blue-50 border border-blue-200 rounded-md p-2">
                                    <p className="text-xs font-medium text-gray-900">{observer.name}</p>
                                    <p className="text-xs text-gray-600">TC: {observer.tc}</p>
                                    <p className="text-xs text-gray-600">Telefon: {observer.phone}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                              <p className="text-xs text-red-600">Müşahit atanmamış</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedBallotBox(null);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BallotBoxesPage;
