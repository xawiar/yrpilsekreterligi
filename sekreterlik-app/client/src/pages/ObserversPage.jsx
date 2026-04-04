import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { decryptData } from '../utils/crypto';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/UI/ConfirmDialog';

const ObserversPage = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [observers, setObservers] = useState([]);
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success'); // 'success' or 'error'
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingObserver, setEditingObserver] = useState(null);
  const [formData, setFormData] = useState({
    tc: '',
    name: '',
    phone: '',
    ballot_box_id: '',
    region_name: '',
    district_id: '',
    town_id: '',
    neighborhood_id: '',
    village_id: '',
    is_chief_observer: true // Varsayılan olarak true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    district_id: '',
    town_id: '',
    neighborhood_id: '',
    village_id: '',
    is_chief_observer: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [observersData, ballotBoxesData, districtsData, townsData, neighborhoodsData, villagesData] = await Promise.all([
        ApiService.getBallotBoxObservers(),
        ApiService.getBallotBoxes(),
        ApiService.getDistricts(),
        ApiService.getTowns(),
        ApiService.getNeighborhoods(),
        ApiService.getVillages()
      ]);
      // Decrypt TC and phone fields before setting state
      const decryptedObservers = (observersData || []).map(obs => ({
        ...obs,
        tc: obs.tc && obs.tc.startsWith('U2FsdGVkX1') ? decryptData(obs.tc) : obs.tc,
        phone: obs.phone && obs.phone.startsWith('U2FsdGVkX1') ? decryptData(obs.phone) : obs.phone
      }));
      setObservers(decryptedObservers);
      setBallotBoxes(ballotBoxesData || []);
      setDistricts(districtsData || []);
      setTowns(townsData || []);
      setNeighborhoods(neighborhoodsData || []);
      setVillages(villagesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Veriler yüklenirken hata oluştu');
      setObservers([]);
      setBallotBoxes([]);
      setDistricts([]);
      setTowns([]);
      setNeighborhoods([]);
      setVillages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      
      // If a ballot box selected, auto-fill its location fields into form
      if (name === 'ballot_box_id') {
        const selected = ballotBoxes.find(bb => String(bb.id) === String(value));
        if (selected) {
          // Sandığın kaydedilirken seçilen mahalle/köy ve belde bilgilerini otomatik doldur
          // Önce district_id'yi set et, sonra diğer alanları set et
          if (selected.district_id) {
            newData.district_id = String(selected.district_id);
          }
          if (selected.town_id) {
            newData.town_id = String(selected.town_id);
          }
          if (selected.neighborhood_id) {
            newData.neighborhood_id = String(selected.neighborhood_id);
            // Mahalle seçildiyse köy alanını temizle
            newData.village_id = '';
          }
          if (selected.village_id) {
            newData.village_id = String(selected.village_id);
            // Köy seçildiyse mahalle alanını temizle
            newData.neighborhood_id = '';
          }
          
          // Sandık seçimi nedeniyle district_id değiştiyse, alt alanları resetleme
          // Bu yüzden return ediyoruz, aşağıdaki reset mantığına geçmesin
          return newData;
        } else {
          // Sandık seçimi temizlendiyse, sadece ballot_box_id'yi temizle, diğer alanları koru
          // (kullanıcı manuel değişiklik yapmış olabilir)
        }
      }

      // Reset dependent fields when parent changes (sadece manuel değişikliklerde)
      // Sandık seçimi değiştiğinde reset yapma, sandığın bilgilerini kullan
      // NOT: Bu kontrol sadece name === 'district_id' veya name === 'town_id' olduğunda çalışır
      // Sandık seçimi (name === 'ballot_box_id') yukarıda handle edildi ve return edildi
      if (name === 'district_id') {
        // Eğer district_id manuel olarak değiştirildiyse (sandık seçimi değilse), alt alanları temizle
        newData.town_id = '';
        newData.neighborhood_id = '';
        newData.village_id = '';
      } else if (name === 'town_id') {
        // Eğer town_id manuel olarak değiştirildiyse (sandık seçimi değilse), alt alanları temizle
        newData.neighborhood_id = '';
        newData.village_id = '';
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.tc || !formData.name || !formData.phone) {
      setError('TC, isim ve telefon zorunludur');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // USE_FIREBASE kontrolü - Firebase'de ID'ler string, backend'de integer
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      // ballot_box_id değerini doğru formata çevir
      const ballotBoxId = formData.ballot_box_id 
        ? (USE_FIREBASE ? String(formData.ballot_box_id) : parseInt(formData.ballot_box_id))
        : null;
      
      const observerData = {
        ...formData,
        tc: String(formData.tc || '').trim(),
        name: String(formData.name || '').trim(),
        phone: String(formData.phone || '').trim(),
        // Firebase'de ID'ler string, backend'de integer olarak saklanıyor
        ballot_box_id: ballotBoxId,
        region_name: formData.region_name || null,
        district_id: formData.district_id ? (USE_FIREBASE ? String(formData.district_id) : parseInt(formData.district_id)) : null,
        town_id: formData.town_id ? (USE_FIREBASE ? String(formData.town_id) : parseInt(formData.town_id)) : null,
        neighborhood_id: formData.neighborhood_id ? (USE_FIREBASE ? String(formData.neighborhood_id) : parseInt(formData.neighborhood_id)) : null,
        village_id: formData.village_id ? (USE_FIREBASE ? String(formData.village_id) : parseInt(formData.village_id)) : null,
        is_chief_observer: formData.is_chief_observer || false
      };
      
      try {
        if (editingObserver) {
          // Başmüşahit güncellenirken kullanıcı otomatik olarak FirebaseApiService.updateBallotBoxObserver içinde güncelleniyor
          await ApiService.updateBallotBoxObserver(editingObserver.id, observerData);
          setMessage('Müşahit başarıyla güncellendi');
          setMessageType('success');
        } else {
          // Başmüşahit eklenirken kullanıcı otomatik olarak FirebaseApiService.createBallotBoxObserver içinde oluşturuluyor
          await ApiService.createBallotBoxObserver(observerData);
          setMessage('Müşahit başarıyla eklendi');
          setMessageType('success');
        }
      } catch (apiError) {
        console.error('❌ API Error:', apiError);
        throw apiError; // Re-throw to be caught by outer catch block
      }

      // Reset form but keep region_name from localStorage and is_chief_observer as true
      const savedRegionName = localStorage.getItem('admin_region_name') || '';
      setFormData({
        tc: '',
        name: '',
        phone: '',
        ballot_box_id: '',
        region_name: savedRegionName,
        district_id: '',
        town_id: '',
        neighborhood_id: '',
        village_id: '',
        is_chief_observer: true
      });
      setShowAddForm(false);
      setEditingObserver(null);
      setError(''); // Clear error on success
      await fetchData();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving observer:', error);
      const errorMessage = error.message || 'Müşahit kaydedilirken hata oluştu';
      setError(errorMessage);
      setMessage(errorMessage);
      setMessageType('error');
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setError('');
        setMessage('');
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (observer) => {
    setEditingObserver(observer);
    
    // Get region_name from observer or from localStorage
    const regionName = observer.region_name || localStorage.getItem('admin_region_name') || '';
    
    setFormData({
      tc: observer.tc,
      name: observer.name,
      phone: observer.phone,
      // ID'leri string'e çevir (form select'ler string değer bekliyor)
      ballot_box_id: observer.ballot_box_id ? String(observer.ballot_box_id) : '',
      region_name: regionName,
      district_id: observer.district_id ? String(observer.district_id) : '',
      town_id: observer.town_id ? String(observer.town_id) : '',
      neighborhood_id: observer.neighborhood_id ? String(observer.neighborhood_id) : '',
      village_id: observer.village_id ? String(observer.village_id) : '',
      is_chief_observer: observer.is_chief_observer || false
    });
    setShowAddForm(true);
  };

  const handleDelete = async (observerId) => {
    const confirmed = await confirm({ title: 'Müşahidi Sil', message: 'Bu müşahidi silmek istediğinizden emin misiniz?' });
    if (!confirmed) return;
    try {
      setLoading(true);
      await ApiService.deleteBallotBoxObserver(observerId);
      await fetchData();
    } catch (error) {
      console.error('Error deleting observer:', error);
      setError('Müşahit silinirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form but keep region_name from localStorage and is_chief_observer as true
    const savedRegionName = localStorage.getItem('admin_region_name') || '';
    setFormData({
      tc: '',
      name: '',
      phone: '',
      ballot_box_id: '',
      region_name: savedRegionName,
      district_id: '',
      town_id: '',
      neighborhood_id: '',
      village_id: '',
      is_chief_observer: true
    });
    setShowAddForm(false);
    setEditingObserver(null);
    setError('');
  };

  const getBallotBoxName = (ballotBoxId) => {
    // ID'leri string'e çevirerek karşılaştır (tip uyumsuzluğu sorununu çözer)
    if (!ballotBoxId) return 'Sandık seçilmemiş';
    
    // Debug log
    if (ballotBoxes.length > 0 && !ballotBoxes.find(bb => String(bb.id) === String(ballotBoxId))) {
      console.warn('⚠️ Ballot box not found:', {
        ballotBoxId,
        ballotBoxIdType: typeof ballotBoxId,
        availableIds: ballotBoxes.map(bb => ({ id: bb.id, idType: typeof bb.id, ballot_number: bb.ballot_number })).slice(0, 5)
      });
    }
    
    const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(ballotBoxId));
    return ballotBox ? `${ballotBox.ballot_number} - ${ballotBox.institution_name}` : 'Sandık seçilmemiş';
  };

  const getDistrictName = (districtId) => {
    // ID'leri string'e çevirerek karşılaştır (tip uyumsuzluğu sorununu çözer)
    if (!districtId) return '';
    const district = districts.find(d => String(d.id) === String(districtId));
    return district ? district.name : '';
  };

  const getTownName = (townId) => {
    // ID'leri string'e çevirerek karşılaştır (tip uyumsuzluğu sorununu çözer)
    if (!townId) return '';
    const town = towns.find(t => String(t.id) === String(townId));
    return town ? town.name : '';
  };

  const getNeighborhoodName = (neighborhoodId) => {
    // ID'leri string'e çevirerek karşılaştır (tip uyumsuzluğu sorununu çözer)
    if (!neighborhoodId) return '';
    const neighborhood = neighborhoods.find(n => String(n.id) === String(neighborhoodId));
    return neighborhood ? neighborhood.name : '';
  };

  const getVillageName = (villageId) => {
    // ID'leri string'e çevirerek karşılaştır (tip uyumsuzluğu sorununu çözer)
    if (!villageId) return '';
    const village = villages.find(v => String(v.id) === String(villageId));
    return village ? village.name : '';
  };

  const getLocationInfo = (observer) => {
    const parts = [];
    // Hem direkt alanlar hem de observer_ prefix'li alanları kontrol et
    const districtId = observer.district_id || observer.observer_district_id;
    const townId = observer.town_id || observer.observer_town_id;
    const neighborhoodId = observer.neighborhood_id || observer.observer_neighborhood_id;
    const villageId = observer.village_id || observer.observer_village_id;
    
    if (districtId) parts.push(getDistrictName(districtId));
    if (townId) parts.push(getTownName(townId));
    if (neighborhoodId) parts.push(getNeighborhoodName(neighborhoodId));
    if (villageId) parts.push(getVillageName(villageId));
    return parts.length > 0 ? parts.join(' - ') : 'Konum seçilmemiş';
  };

  // Mask TC for display (first 3 + **** + last 3)
  const maskTC = (tc) => {
    if (!tc || tc.length < 7) return tc || '-';
    return tc.substring(0, 3) + '****' + tc.substring(tc.length - 3);
  };

  // Filter observers based on search term and filters
  const getFilteredObservers = () => {
    return observers.filter(observer => {
      const matchesSearch = searchTerm === '' || 
        observer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        observer.tc.includes(searchTerm) ||
        observer.phone.includes(searchTerm) ||
        getBallotBoxName(observer.ballot_box_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getLocationInfo(observer).toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDistrict = filters.district_id === '' || observer.observer_district_id === parseInt(filters.district_id);
      const matchesTown = filters.town_id === '' || observer.observer_town_id === parseInt(filters.town_id);
      const matchesNeighborhood = filters.neighborhood_id === '' || observer.observer_neighborhood_id === parseInt(filters.neighborhood_id);
      const matchesVillage = filters.village_id === '' || observer.observer_village_id === parseInt(filters.village_id);
      const matchesChiefObserver = filters.is_chief_observer === '' || 
        (filters.is_chief_observer === 'true' && observer.is_chief_observer) ||
        (filters.is_chief_observer === 'false' && !observer.is_chief_observer);

      return matchesSearch && matchesDistrict && matchesTown && matchesNeighborhood && matchesVillage && matchesChiefObserver;
    });
  };

  const filteredObservers = getFilteredObservers();
  const chiefObservers = filteredObservers.filter(observer => observer.is_chief_observer);
  const regularObservers = filteredObservers.filter(observer => !observer.is_chief_observer);

  // Calculate statistics
  const getStatistics = () => {
    const totalObservers = filteredObservers.length;
    const chiefObserversCount = chiefObservers.length;
    const regularObserversCount = regularObservers.length;
    
    // Get unique ballot boxes with observers
    const ballotBoxesWithObservers = new Set(filteredObservers.map(obs => obs.ballot_box_id).filter(id => id));
    const totalBallotBoxes = ballotBoxes.length;
    const ballotBoxesWithoutObservers = totalBallotBoxes - ballotBoxesWithObservers.size;
    
    return {
      totalObservers,
      chiefObserversCount,
      regularObserversCount,
      totalBallotBoxes,
      ballotBoxesWithObservers: ballotBoxesWithObservers.size,
      ballotBoxesWithoutObservers
    };
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value,
      // Reset dependent filters when parent changes
      ...(filterType === 'district_id' && {
        town_id: '',
        neighborhood_id: '',
        village_id: ''
      }),
      ...(filterType === 'town_id' && {
        neighborhood_id: '',
        village_id: ''
      })
    }));
  };

  // Get filtered towns based on selected district
  const getFilteredTowns = () => {
    if (!filters.district_id) return towns;
    return towns.filter(town => town.district_id === parseInt(filters.district_id));
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Müşahitler</h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">Başmüşahit ve müşahit yönetimi</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={isExporting}
                onClick={async () => {
                  const confirmed = await confirm({
                    message: 'Bu dosya TC kimlik ve telefon numarası gibi hassas kişisel veriler içermektedir. KVKK kapsamında bu verilerin paylaşımından siz sorumlusunuz. Devam etmek istiyor musunuz?',
                    title: 'Hassas Veri Uyarısı'
                  });
                  if (!confirmed) return;

                  setIsExporting(true);
                  try {
                    const excelData = [
                      ['TC', 'Ad Soyad', 'Telefon', 'Sandık', 'Konum', 'Başmüşahit']
                    ];

                    const filteredObservers = getFilteredObservers();
                    filteredObservers.forEach(observer => {
                      excelData.push([
                        observer.tc || '',
                        observer.name || '',
                        observer.phone || '',
                        getBallotBoxName(observer.ballot_box_id),
                        getLocationInfo(observer),
                        observer.is_chief_observer ? 'Evet' : 'Hayır'
                      ]);
                    });

                    const ws = XLSX.utils.aoa_to_sheet(excelData);
                    ws['!cols'] = [
                      { wch: 12 }, // TC
                      { wch: 25 }, // Ad Soyad
                      { wch: 15 }, // Telefon
                      { wch: 15 }, // Sandık
                      { wch: 25 }, // Konum
                      { wch: 12 }  // Başmüşahit
                    ];
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Müşahitler');

                    const fileName = `musahitler_${new Date().toISOString().split('T')[0]}.xlsx`;
                    XLSX.writeFile(wb, fileName);
                    toast.success('Excel dosyası başarıyla indirildi!');
                  } catch (error) {
                    console.error('Excel export error:', error);
                    toast.error('Excel dosyası oluşturulurken bir hata oluştu: ' + error.message);
                  } finally {
                    setIsExporting(false);
                  }
                }}
                className={`inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white ${isExporting ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Excel'e Aktar</span>
                <span className="sm:hidden">Excel</span>
              </button>
              <button
                onClick={() => {
                  // Load region_name from localStorage when opening form
                  const savedRegionName = localStorage.getItem('admin_region_name') || '';
                  setFormData(prev => ({
                    ...prev,
                    region_name: savedRegionName,
                    is_chief_observer: true
                  }));
                  setShowAddForm(true);
                }}
                className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Yeni Müşahit Ekle</span>
                <span className="sm:hidden">Ekle</span>
              </button>
              <Link
                to="/election-preparation"
                className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="hidden sm:inline">← Geri Dön</span>
                <span className="sm:hidden">←</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Müşahit</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{statistics.totalObservers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Başmüşahit</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{statistics.chiefObserversCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Müşahit</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{statistics.regularObserversCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Sandık</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{statistics.totalBallotBoxes}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Müşahit Atanmış Sandık</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{statistics.ballotBoxesWithObservers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Müşahit Atanmamış Sandık</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{statistics.ballotBoxesWithoutObservers}</p>
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

        {message && (
          <div className={`mb-6 border rounded-md p-4 ${
            messageType === 'success' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex">
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${
                  messageType === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {messageType === 'success' ? 'Başarılı' : 'Hata'}
                </h3>
                <div className={`mt-2 text-sm ${
                  messageType === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {message}
                </div>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setMessage('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Müşahit Listesi
              </h2>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Müşahit ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Filters */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Filtreler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">İlçe</label>
                  <select
                    value={filters.district_id}
                    onChange={(e) => handleFilterChange('district_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Tüm İlçeler</option>
                    {districts.map(district => (
                      <option key={district.id} value={district.id}>{district.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Belde</label>
                  <select
                    value={filters.town_id}
                    onChange={(e) => handleFilterChange('town_id', e.target.value)}
                    disabled={!filters.district_id}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">Tüm Beldeler</option>
                    {getFilteredTowns().map(town => (
                      <option key={town.id} value={town.id}>{town.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mahalle</label>
                  <select
                    value={filters.neighborhood_id}
                    onChange={(e) => handleFilterChange('neighborhood_id', e.target.value)}
                    disabled={!filters.district_id}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">Tüm Mahalleler</option>
                    {getFilteredNeighborhoods().map(neighborhood => (
                      <option key={neighborhood.id} value={neighborhood.id}>{neighborhood.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Köy</label>
                  <select
                    value={filters.village_id}
                    onChange={(e) => handleFilterChange('village_id', e.target.value)}
                    disabled={!filters.district_id}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">Tüm Köyler</option>
                    {getFilteredVillages().map(village => (
                      <option key={village.id} value={village.id}>{village.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tür</label>
                  <select
                    value={filters.is_chief_observer}
                    onChange={(e) => handleFilterChange('is_chief_observer', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Tümü</option>
                    <option value="true">Başmüşahit</option>
                    <option value="false">Müşahit</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setFilters({
                    district_id: '',
                    town_id: '',
                    neighborhood_id: '',
                    village_id: '',
                    is_chief_observer: ''
                  })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Filtreleri Temizle
                </button>
              </div>
            </div>

            {/* Müşahit Ekleme/Düzenleme Modal */}
            {showAddForm && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  {/* Background overlay */}
                  <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                    onClick={handleCancel}
                  ></div>

                  {/* Modal panel */}
                  <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                    <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {editingObserver ? 'Müşahit Düzenle' : 'Yeni Müşahit Ekle'}
                </h3>
                        <button
                          onClick={handleCancel}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        TC Kimlik No *
                      </label>
                      <input
                        type="text"
                        name="tc"
                        value={formData.tc}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Ad Soyad *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Telefon *
                      </label>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Sandık
                      </label>
                      <select
                        name="ballot_box_id"
                        value={formData.ballot_box_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Sandık seçin (opsiyonel)</option>
                        {ballotBoxes.map(ballotBox => (
                          <option key={ballotBox.id} value={ballotBox.id}>
                            {ballotBox.ballot_number} - {ballotBox.institution_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        İl
                      </label>
                      <input
                        type="text"
                        name="region_name"
                        value={formData.region_name}
                        onChange={handleInputChange}
                        placeholder="Örn: Elazığ"
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        İlçe
                      </label>
                      <select
                        name="district_id"
                        value={formData.district_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">İlçe seçin (opsiyonel)</option>
                        {districts.map(district => (
                          <option key={district.id} value={district.id}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Belde
                      </label>
                      <select
                        name="town_id"
                        value={formData.town_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={!formData.district_id}
                      >
                        <option value="">Belde seçin (opsiyonel)</option>
                        {towns.filter(town => String(town.district_id) === String(formData.district_id)).map(town => (
                          <option key={town.id} value={town.id}>
                            {town.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Mahalle
                      </label>
                      <select
                        name="neighborhood_id"
                        value={formData.neighborhood_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={!formData.district_id}
                      >
                        <option value="">Mahalle seçin (opsiyonel)</option>
                        {neighborhoods
                          .filter(neighborhood => {
                            // İlçe kontrolü
                            if (String(neighborhood.district_id) !== String(formData.district_id)) return false;
                            // Eğer belde seçilmişse, belde kontrolü de yap
                            if (formData.town_id) {
                              return String(neighborhood.town_id || '') === String(formData.town_id);
                            }
                            return true;
                          })
                          .map(neighborhood => (
                            <option key={neighborhood.id} value={neighborhood.id}>
                              {neighborhood.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Köy
                      </label>
                      <select
                        name="village_id"
                        value={formData.village_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={!formData.district_id}
                      >
                        <option value="">Köy seçin (opsiyonel)</option>
                        {villages
                          .filter(village => {
                            // İlçe kontrolü
                            if (String(village.district_id) !== String(formData.district_id)) return false;
                            // Eğer belde seçilmişse, belde kontrolü de yap
                            if (formData.town_id) {
                              return String(village.town_id || '') === String(formData.town_id);
                            }
                            return true;
                          })
                          .map(village => (
                            <option key={village.id} value={village.id}>
                              {village.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_chief_observer"
                        checked={formData.is_chief_observer}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                        Başmüşahit
                      </label>
                    </div>
                  </div>
                      </form>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                        {loading ? 'Kaydediliyor...' : (editingObserver ? 'Güncelle' : 'Kaydet')}
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        İptal
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            )}

            {loading && !showAddForm ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Müşahitler yükleniyor...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {chiefObservers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Başmüşahitler</h3>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {chiefObservers.map((observer) => (
                        <div key={observer.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{observer.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{maskTC(observer.tc)}</p>
                              </div>
                            </div>

                            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Telefon:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{observer.phone || '-'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Sandık:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{getBallotBoxName(observer.ballot_box_id)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Konum:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{getLocationInfo(observer)}</span>
                              </div>
                            </div>

                            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() => handleEdit(observer)}
                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleDelete(observer.id)}
                                className="text-red-600 hover:text-red-900 text-sm font-medium"
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              TC
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Ad Soyad
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Telefon
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Sandık
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Konum
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              İşlemler
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {chiefObservers.map((observer) => (
                            <tr key={observer.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {maskTC(observer.tc)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {observer.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {observer.phone}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {getBallotBoxName(observer.ballot_box_id)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {getLocationInfo(observer)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleEdit(observer)}
                                  className="text-indigo-600 hover:text-indigo-900 mr-3"
                                >
                                  Düzenle
                                </button>
                                <button
                                  onClick={() => handleDelete(observer.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Sil
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {regularObservers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Müşahitler</h3>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {regularObservers.map((observer) => (
                        <div key={observer.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{observer.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{maskTC(observer.tc)}</p>
                              </div>
                            </div>

                            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Telefon:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{observer.phone || '-'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Sandık:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{getBallotBoxName(observer.ballot_box_id)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Konum:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{getLocationInfo(observer)}</span>
                              </div>
                            </div>

                            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() => handleEdit(observer)}
                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleDelete(observer.id)}
                                className="text-red-600 hover:text-red-900 text-sm font-medium"
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              TC
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Ad Soyad
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Telefon
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Sandık
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Konum
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              İşlemler
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {regularObservers.map((observer) => (
                            <tr key={observer.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {maskTC(observer.tc)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {observer.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {observer.phone}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {getBallotBoxName(observer.ballot_box_id)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {getLocationInfo(observer)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleEdit(observer)}
                                  className="text-indigo-600 hover:text-indigo-900 mr-3"
                                >
                                  Düzenle
                                </button>
                                <button
                                  onClick={() => handleDelete(observer.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Sil
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {filteredObservers.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm ? 'Arama kriterlerine uygun müşahit bulunamadı' : 'Henüz müşahit eklenmemiş'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default ObserversPage;
