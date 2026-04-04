import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import Modal from '../components/Modal';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';

const LOCATION_CONFIG = {
  neighborhood: {
    apiGetAll: () => ApiService.getNeighborhoods(),
    apiGetReps: () => ApiService.getNeighborhoodRepresentatives(),
    apiGetSups: () => ApiService.getNeighborhoodSupervisors(),
    apiUpdate: (id, data) => ApiService.updateNeighborhood(id, data),
    idField: (item) => item.neighborhood_id || item.neighborhoodId,
    locationType: 'neighborhood',
    locationProp: 'neighborhood',
    title: 'Mahalleler',
    itemLabel: 'Mahalle',
    searchPlaceholder: 'Mahalle adı, ilçe veya belde ile ara...',
    emptyMessage: 'Henüz mahalle eklenmemiş',
    excelSheet: 'Mahalleler',
    excelPrefix: 'mahalleler',
    headerLabel: 'Mahalle Adı',
    totalLabel: 'Toplam Mahalle',
    visitErrorMsg: 'Bu mahalle için henüz ziyaret kaydı bulunmamaktadır.',
    errorMsg: 'Mahalleler yüklenirken hata oluştu'
  },
  village: {
    apiGetAll: () => ApiService.getVillages(),
    apiGetReps: () => ApiService.getVillageRepresentatives(),
    apiGetSups: () => ApiService.getVillageSupervisors(),
    apiUpdate: (id, data) => ApiService.updateVillage(id, data),
    idField: (item) => item.village_id || item.villageId,
    locationType: 'village',
    locationProp: 'village',
    title: 'Köyler',
    itemLabel: 'Köy',
    searchPlaceholder: 'Köy adı, ilçe veya belde ile ara...',
    emptyMessage: 'Henüz köy eklenmemiş',
    excelSheet: 'Köyler',
    excelPrefix: 'koyler',
    headerLabel: 'Köy Adı',
    totalLabel: 'Toplam Köy',
    visitErrorMsg: 'Bu köy için henüz ziyaret kaydı bulunmamaktadır.',
    errorMsg: 'Köyler yüklenirken hata oluştu'
  }
};

const LocationsPage = ({ type = 'neighborhood' }) => {
  const cfg = LOCATION_CONFIG[type];
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [visitCounts, setVisitCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroupNo, setFilterGroupNo] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupNoInput, setGroupNoInput] = useState('');
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [visitDetails, setVisitDetails] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, representativesData, supervisorsData] = await Promise.all([
        cfg.apiGetAll(),
        cfg.apiGetReps(),
        cfg.apiGetSups()
      ]);
      setItems(itemsData);
      setRepresentatives(representativesData);
      setSupervisors(supervisorsData);
    } catch (error) {
      console.error(`Error fetching ${cfg.locationType}s:`, error);
      setError(cfg.errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Items yüklendikten sonra ziyaret sayılarını hesapla
  useEffect(() => {
    if (items.length > 0) {
      fetchVisitCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const fetchVisitCounts = async () => {
    try {
      // Etkinliklerden gerçek ziyaret sayılarını hesapla
      const events = await ApiService.getEvents(false); // Sadece aktif etkinlikler

      const counts = {};

      // Tüm items için başlangıç değeri 0
      items.forEach(item => {
        counts[item.id] = 0;
      });

      // Her etkinlik için ziyaret sayılarını hesapla
      events.forEach(event => {
        if (event.selectedLocationTypes && event.selectedLocations) {
          const locationTypes = event.selectedLocationTypes;
          const locations = event.selectedLocations;

          if (locationTypes.includes(cfg.locationType) && locations[cfg.locationProp]) {
            const locationIds = locations[cfg.locationProp];
            locationIds.forEach(locationId => {
              const id = String(locationId);
              if (counts[id] !== undefined) {
                counts[id] = (counts[id] || 0) + 1;
              } else {
                counts[id] = 1;
              }
            });
          }
        }
      });

      setVisitCounts(counts);
    } catch (error) {
      console.error('Error fetching visit counts:', error);
    }
  };

  const handleVisitCountClick = async (item) => {
    setSelectedItem(item);
    setShowVisitModal(true);

    try {
      // Tüm etkinlikleri al
      const events = await ApiService.getEvents(false); // Sadece aktif etkinlikler

      // Bu item için ziyaret detaylarını bul
      const details = [];
      events.forEach(event => {
        if (event.selectedLocationTypes && event.selectedLocations) {
          const locationTypes = event.selectedLocationTypes;
          const locations = event.selectedLocations;

          if (locationTypes.includes(cfg.locationType) && locations[cfg.locationProp]) {
            const locationIds = locations[cfg.locationProp];
            if (locationIds.includes(item.id) || locationIds.includes(String(item.id))) {
              details.push({
                eventName: event.name || 'Etkinlik',
                eventDate: event.date || '',
                eventDescription: event.description || ''
              });
            }
          }
        }
      });

      // Tarihe göre sırala (en yeni önce)
      details.sort((a, b) => {
        const dateA = new Date(a.eventDate);
        const dateB = new Date(b.eventDate);
        return dateB - dateA;
      });

      setVisitDetails(details);
    } catch (error) {
      console.error('Error fetching visit details:', error);
      setVisitDetails([]);
    }
  };

  const handleGroupNoChange = async (itemId, groupNo) => {
    try {
      await cfg.apiUpdate(itemId, { group_no: groupNo || null });
      await fetchData();
      setEditingGroup(null);
      setGroupNoInput('');
    } catch (error) {
      console.error('Error updating group no:', error);
      toast.error('Grup numarası güncellenirken hata oluştu');
    }
  };

  // Calculate items without representatives
  // Handle both string and number ID types
  const itemsWithReps = new Set(
    representatives.map(rep => {
      const id = cfg.idField(rep);
      return id ? String(id) : null;
    }).filter(Boolean)
  );
  const itemsWithoutReps = items.filter(
    item => {
      const itemId = String(item.id);
      return !itemsWithReps.has(itemId);
    }
  ).length;

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.district_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.town_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGroup = filterGroupNo
      ? String(item.group_no || '') === String(filterGroupNo)
      : true;

    return matchesSearch && matchesGroup;
  }).sort((a, b) => {
    // Sort by group_no first (nulls last)
    const groupA = a.group_no ? parseInt(a.group_no) : 999999;
    const groupB = b.group_no ? parseInt(b.group_no) : 999999;
    if (groupA !== groupB) {
      return groupA - groupB;
    }
    // Then sort by name
    return (a.name || '').localeCompare(b.name || '');
  });

  // Helper: find representative for an item
  const findRepresentative = (item) => {
    const itemIdStr = String(item.id);
    const itemIdNum = Number(item.id);
    return representatives.find(rep => {
      const repId = cfg.idField(rep);
      const repIdStr = String(repId);
      const repIdNum = Number(repId);
      return repIdStr === itemIdStr || repIdNum === itemIdNum ||
             repIdStr === itemIdNum || repIdNum === itemIdStr;
    });
  };

  // Helper: find supervisor for an item
  const findSupervisor = (item) => {
    const itemIdStr = String(item.id);
    const itemIdNum = Number(item.id);
    return supervisors.find(sup => {
      const supId = cfg.idField(sup);
      const supIdStr = String(supId);
      const supIdNum = Number(supId);
      return supIdStr === itemIdStr || supIdNum === itemIdNum ||
             supIdStr === itemIdNum || supIdNum === itemIdStr;
    });
  };

  const exportToExcel = () => {
    const excelData = [
      [cfg.headerLabel, 'İlçe', 'Belde', 'Grup No', 'Temsilci', 'Temsilci Telefon', 'Müfettiş', 'Müfettiş Telefon']
    ];

    filteredItems.forEach(item => {
      const representative = findRepresentative(item);
      const supervisor = findSupervisor(item);

      excelData.push([
        item.name || '',
        item.district_name || '',
        item.town_name || '',
        item.group_no || '',
        representative?.name || '',
        representative?.phone || '',
        supervisor?.name || '',
        supervisor?.phone || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 20 }, // Mahalle/Köy Adı
      { wch: 15 }, // İlçe
      { wch: 15 }, // Belde
      { wch: 10 }, // Grup No
      { wch: 25 }, // Temsilci
      { wch: 15 }, // Temsilci Telefon
      { wch: 25 }, // Müfettiş
      { wch: 15 }  // Müfettiş Telefon
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.excelSheet);

    const fileName = `${cfg.excelPrefix}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
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
          <h1 className="text-2xl font-bold text-gray-900">{cfg.title}</h1>
        </div>
        <button
          onClick={exportToExcel}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Excel'e Aktar
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-blue-800">
            <span className="font-semibold">{cfg.totalLabel}:</span> {items.length} |
            <span className="font-semibold ml-2">Temsilci Atanmamış:</span> {itemsWithoutReps}
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
        <input
          type="text"
          placeholder={cfg.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div className="flex items-center space-x-2">
          <label htmlFor="filterGroupNo" className="text-sm text-gray-700 whitespace-nowrap">Grup No Filtrele:</label>
          <input
            type="number"
            id="filterGroupNo"
            value={filterGroupNo}
            onChange={(e) => setFilterGroupNo(e.target.value)}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Tümü"
            min="1"
          />
          {filterGroupNo && (
            <button
              onClick={() => setFilterGroupNo('')}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500">
              {searchTerm ? 'Arama sonucu bulunamadı' : cfg.emptyMessage}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const representative = findRepresentative(item);
            const supervisor = findSupervisor(item);
            const hasRepresentative = !!representative;
            const isEditing = editingGroup === item.id;

            return (
              <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.district_name || '-'} / {item.town_name || '-'}</p>
                    </div>
                    {hasRepresentative ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Temsilci Atanmış
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Temsilci Atanmamış
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Grup:</span>
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={groupNoInput}
                            onChange={(e) => setGroupNoInput(e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Grup"
                            min="1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleGroupNoChange(item.id, groupNoInput)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditingGroup(null);
                              setGroupNoInput('');
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          {item.group_no ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              Grup {item.group_no}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                          <button
                            onClick={() => {
                              setEditingGroup(item.id);
                              setGroupNoInput(item.group_no || '');
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-xs"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Temsilci:</span>
                      <span className="text-gray-900 font-medium">{representative?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Müfettiş:</span>
                      <span className="text-gray-900 font-medium">{supervisor?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Ziyaret Sayısı:</span>
                      <button
                        onClick={() => handleVisitCountClick(item)}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors cursor-pointer"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {visitCounts[item.id] || 0} ziyaret
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? 'Arama sonucu bulunamadı' : cfg.emptyMessage}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {cfg.headerLabel}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İlçe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Belde
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grup
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temsilci
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Müfettiş
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ziyaret Sayısı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temsilci Durumu
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => {
                  const representative = findRepresentative(item);
                  const supervisor = findSupervisor(item);
                  const hasRepresentative = !!representative;
                  const isEditing = editingGroup === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.district_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.town_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={groupNoInput}
                              onChange={(e) => setGroupNoInput(e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Grup"
                              min="1"
                              autoFocus
                            />
                            <button
                              onClick={() => handleGroupNoChange(item.id, groupNoInput)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setEditingGroup(null);
                                setGroupNoInput('');
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            {item.group_no ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                Grup {item.group_no}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                            <button
                              onClick={() => {
                                setEditingGroup(item.id);
                                setGroupNoInput(item.group_no || '');
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-xs"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {representative?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supervisor?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleVisitCountClick(item)}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors cursor-pointer"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {visitCounts[item.id] || 0} ziyaret
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {hasRepresentative ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Temsilci Atanmış
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Temsilci Atanmamış
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visit Details Modal */}
      <Modal
        isOpen={showVisitModal}
        onClose={() => {
          setShowVisitModal(false);
          setSelectedItem(null);
          setVisitDetails([]);
        }}
        title={`${selectedItem?.name || cfg.itemLabel} - Ziyaret Detayları`}
        size="lg"
      >
        <div className="space-y-4">
          {visitDetails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{cfg.visitErrorMsg}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visitDetails.map((detail, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {detail.eventName}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-medium">Tarih:</span> {detail.eventDate ? new Date(detail.eventDate).toLocaleDateString('tr-TR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </p>
                      {detail.eventDescription && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {detail.eventDescription}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default LocationsPage;
