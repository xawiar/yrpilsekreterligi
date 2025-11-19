import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';

const CoordinatorsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Aktif alt tab'ı URL'den belirle
  const getActiveSubTab = () => {
    const path = location.pathname;
    if (path.includes('/coordinators/coordinators')) return 'coordinators';
    if (path.includes('/coordinators/regions')) return 'regions';
    return 'coordinators'; // Default
  };

  const [activeSubTab, setActiveSubTab] = useState(getActiveSubTab());

  // URL değiştiğinde aktif alt tab'ı güncelle
  useEffect(() => {
    setActiveSubTab(getActiveSubTab());
  }, [location.pathname]);

  const subTabs = [
    {
      id: 'coordinators',
      name: 'Sorumlular',
      path: '/election-preparation/coordinators/coordinators'
    },
    {
      id: 'regions',
      name: 'Bölgeler',
      path: '/election-preparation/coordinators/regions'
    }
  ];

  const handleSubTabClick = (tab) => {
    setActiveSubTab(tab.id);
    navigate(tab.path);
  };

  return (
    <div className="space-y-6">
      {/* Alt Tab Navigasyonu */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {subTabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSubTabClick(tab)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Alt Sayfa İçeriği */}
      <div>
        <Routes>
          <Route index element={<Navigate to="/election-preparation/coordinators/coordinators" replace />} />
          <Route path="coordinators" element={<CoordinatorsListPage />} />
          <Route path="regions" element={<RegionsListPage />} />
        </Routes>
      </div>
    </div>
  );
};

// Sorumlular Listesi Sayfası
const CoordinatorsListPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoordinator, setEditingCoordinator] = useState(null);
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tc: '',
    phone: '',
    role: 'provincial_coordinator', // provincial_coordinator, district_supervisor, region_supervisor
    parent_coordinator_id: null,
    district_id: null
  });
  const [districts, setDistricts] = useState([]);
  const [parentCoordinators, setParentCoordinators] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Verileri yükle
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.role === 'district_supervisor') {
      // İlçe sorumlusu için parent olarak il genel sorumlularını getir
      const provincialCoordinators = coordinators.filter(c => c.role === 'provincial_coordinator');
      setParentCoordinators(provincialCoordinators);
    } else if (formData.role === 'region_supervisor') {
      // Bölge sorumlusu için parent olarak ilçe sorumlularını getir
      const districtSupervisors = coordinators.filter(c => c.role === 'district_supervisor');
      setParentCoordinators(districtSupervisors);
    } else {
      setParentCoordinators([]);
    }
  }, [formData.role, coordinators]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [districtsData, coordinatorsData] = await Promise.all([
        ApiService.getDistricts(),
        ApiService.getElectionCoordinators()
      ]);
      setDistricts(districtsData || []);
      setCoordinators(coordinatorsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Veriler yüklenirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoordinator = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Ad soyad zorunludur');
      setMessageType('error');
      return;
    }

    if (!formData.tc || formData.tc.length !== 11) {
      setMessage('TC kimlik numarası 11 haneli olmalıdır');
      setMessageType('error');
      return;
    }

    if (!formData.phone.trim()) {
      setMessage('Telefon numarası zorunludur');
      setMessageType('error');
      return;
    }

    if (formData.role === 'district_supervisor' && !formData.parent_coordinator_id) {
      setMessage('İl genel sorumlusu seçmelisiniz');
      setMessageType('error');
      return;
    }

    if (formData.role === 'region_supervisor' && !formData.parent_coordinator_id) {
      setMessage('İlçe sorumlusu seçmelisiniz');
      setMessageType('error');
      return;
    }

    try {
      setLoading(true);
      const coordinatorData = {
        name: formData.name,
        tc: formData.tc,
        phone: formData.phone,
        role: formData.role,
        parent_coordinator_id: formData.parent_coordinator_id || null,
        district_id: formData.district_id || null
      };

      let response;
      if (editingCoordinator) {
        response = await ApiService.updateElectionCoordinator(editingCoordinator.id, coordinatorData);
      } else {
        response = await ApiService.createElectionCoordinator(coordinatorData);
      }
      
      if (response.success) {
        setMessage(editingCoordinator ? 'Sorumlu başarıyla güncellendi' : 'Sorumlu başarıyla oluşturuldu');
        setMessageType('success');
        setShowCreateModal(false);
        setEditingCoordinator(null);
        setFormData({
          name: '',
          tc: '',
          phone: '',
          role: 'provincial_coordinator',
          parent_coordinator_id: null,
          district_id: null
        });
        loadData(); // Listeyi yenile
      } else {
        setMessage(response.message || 'Sorumlu işlemi sırasında hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving coordinator:', error);
      setMessage('Sorumlu işlemi sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCoordinator = (coordinator) => {
    setEditingCoordinator(coordinator);
    setFormData({
      name: coordinator.name || '',
      tc: coordinator.tc || '',
      phone: coordinator.phone || '',
      role: coordinator.role || 'provincial_coordinator',
      parent_coordinator_id: coordinator.parent_coordinator_id || null,
      district_id: coordinator.district_id || null
    });
    setShowCreateModal(true);
  };

  const handleDeleteCoordinator = async (id) => {
    if (!window.confirm('Bu sorumluyu silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await ApiService.deleteElectionCoordinator(id);
      if (response.success) {
        setMessage('Sorumlu başarıyla silindi');
        setMessageType('success');
        loadData();
      } else {
        setMessage(response.message || 'Sorumlu silinirken hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error deleting coordinator:', error);
      setMessage('Sorumlu silinirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sorumlular</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Sorumlu Ekle
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          messageType === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
          messageType === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
          'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
        }`}>
          {message}
        </div>
      )}

      {/* Sorumlu Listesi */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
        ) : coordinators.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">Henüz sorumlu eklenmemiş.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ad Soyad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    TC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Telefon
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Üst Sorumlu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {coordinators.map((coordinator) => {
                  const roleNames = {
                    provincial_coordinator: 'İl Genel Sorumlusu',
                    district_supervisor: 'İlçe Sorumlusu',
                    region_supervisor: 'Bölge Sorumlusu'
                  };
                  const parentCoordinator = coordinator.parent_coordinator_id 
                    ? coordinators.find(c => String(c.id) === String(coordinator.parent_coordinator_id))
                    : null;
                  
                  return (
                    <tr key={coordinator.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {coordinator.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {coordinator.tc}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {coordinator.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          coordinator.role === 'provincial_coordinator' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                          coordinator.role === 'district_supervisor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {roleNames[coordinator.role] || coordinator.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {parentCoordinator ? parentCoordinator.name : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditCoordinator(coordinator)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            title="Düzenle"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteCoordinator(coordinator.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Sil"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sorumlu Ekle Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingCoordinator ? 'Sorumlu Düzenle' : 'Yeni Sorumlu Ekle'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingCoordinator(null);
                    setFormData({
                      name: '',
                      tc: '',
                      phone: '',
                      role: 'provincial_coordinator',
                      parent_coordinator_id: null,
                      district_id: null
                    });
                    setMessage('');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateCoordinator} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sorumluluk Türü *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value, parent_coordinator_id: null })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="provincial_coordinator">İl Genel Sorumlusu</option>
                    <option value="district_supervisor">İlçe Sorumlusu</option>
                    <option value="region_supervisor">Bölge Sorumlusu</option>
                  </select>
                </div>

                {formData.role === 'district_supervisor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      İl Genel Sorumlusu *
                    </label>
                    <select
                      value={formData.parent_coordinator_id ? String(formData.parent_coordinator_id) : ''}
                      onChange={(e) => setFormData({ ...formData, parent_coordinator_id: e.target.value ? (Number(e.target.value) || null) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Seçiniz...</option>
                      {parentCoordinators.map((coordinator) => (
                        <option key={coordinator.id} value={String(coordinator.id)}>
                          {coordinator.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.role === 'region_supervisor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      İlçe Sorumlusu *
                    </label>
                    <select
                      value={formData.parent_coordinator_id ? String(formData.parent_coordinator_id) : ''}
                      onChange={(e) => setFormData({ ...formData, parent_coordinator_id: e.target.value ? (Number(e.target.value) || null) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Seçiniz...</option>
                      {parentCoordinators.map((coordinator) => (
                        <option key={coordinator.id} value={String(coordinator.id)}>
                          {coordinator.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ad Soyad *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ad Soyad"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    TC Kimlik No *
                  </label>
                  <input
                    type="text"
                    value={formData.tc}
                    onChange={(e) => setFormData({ ...formData, tc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="11 haneli TC kimlik numarası"
                    maxLength={11}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefon *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Telefon numarası"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingCoordinator(null);
                    setFormData({
                      name: '',
                      tc: '',
                      phone: '',
                      role: 'provincial_coordinator',
                      parent_coordinator_id: null,
                      district_id: null
                    });
                    setMessage('');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Bölgeler Listesi Sayfası
const RegionsListPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [ballotBoxes, setBallotBoxes] = useState([]);
  const [regionSupervisors, setRegionSupervisors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState([]);
  const [selectedVillages, setSelectedVillages] = useState([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [regionName, setRegionName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Sandık sayılarını hesapla
  const getBallotBoxCount = (locationId, type) => {
    if (type === 'neighborhood') {
      return ballotBoxes.filter(bb => bb.neighborhood_id === locationId || String(bb.neighborhood_id) === String(locationId)).length;
    } else if (type === 'village') {
      return ballotBoxes.filter(bb => bb.village_id === locationId || String(bb.village_id) === String(locationId)).length;
    }
    return 0;
  };

  const [regions, setRegions] = useState([]);

  // Verileri yükle
  useEffect(() => {
    loadRegions();
    if (showCreateModal) {
      loadData();
    }
  }, [showCreateModal]);

  const loadRegions = async () => {
    try {
      setLoading(true);
      const regionsData = await ApiService.getElectionRegions();
      setRegions(regionsData || []);
    } catch (error) {
      console.error('Error loading regions:', error);
      setMessage('Bölgeler yüklenirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [neighborhoodsData, villagesData, ballotBoxesData, coordinatorsData] = await Promise.all([
        ApiService.getNeighborhoods(),
        ApiService.getVillages(),
        ApiService.getBallotBoxes(),
        ApiService.getElectionCoordinators()
      ]);
      setNeighborhoods(neighborhoodsData || []);
      setVillages(villagesData || []);
      setBallotBoxes(ballotBoxesData || []);
      // Bölge sorumlularını filtrele (region_supervisor role'üne sahip olanlar)
      const supervisors = coordinatorsData.filter(c => c.role === 'region_supervisor') || [];
      setRegionSupervisors(supervisors);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Veriler yüklenirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegion = async (e) => {
    e.preventDefault();
    
    if (!regionName.trim()) {
      setMessage('Bölge adı zorunludur');
      setMessageType('error');
      return;
    }

    if (selectedNeighborhoods.length === 0 && selectedVillages.length === 0) {
      setMessage('En az bir mahalle veya köy seçmelisiniz');
      setMessageType('error');
      return;
    }

    if (!selectedSupervisorId) {
      setMessage('Bölge sorumlusu seçmelisiniz');
      setMessageType('error');
      return;
    }

    try {
      setLoading(true);
      const regionData = {
        name: regionName,
        neighborhood_ids: selectedNeighborhoods,
        village_ids: selectedVillages,
        supervisor_id: selectedSupervisorId ? parseInt(selectedSupervisorId) : null,
        district_id: neighborhoods.find(n => selectedNeighborhoods.includes(n.id))?.district_id || 
                     villages.find(v => selectedVillages.includes(v.id))?.district_id || null
      };

      let response;
      if (editingRegion) {
        response = await ApiService.updateElectionRegion(editingRegion.id, regionData);
      } else {
        response = await ApiService.createElectionRegion(regionData);
      }
      
      if (response.success || response.id) {
        setMessage(editingRegion ? 'Bölge başarıyla güncellendi' : 'Bölge başarıyla oluşturuldu');
        setMessageType('success');
        setShowCreateModal(false);
        setEditingRegion(null);
        setRegionName('');
        setSelectedNeighborhoods([]);
        setSelectedVillages([]);
        setSelectedSupervisorId('');
        loadRegions(); // Listeyi yenile
      } else {
        setMessage(response.message || 'Bölge işlemi sırasında hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving region:', error);
      setMessage('Bölge işlemi sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRegion = async (region) => {
    setEditingRegion(region);
    setRegionName(region.name || '');
    setSelectedNeighborhoods(region.neighborhood_ids || []);
    setSelectedVillages(region.village_ids || []);
    setSelectedSupervisorId(region.supervisor_id ? String(region.supervisor_id) : '');
    await loadData(); // Verileri yükle
    setShowCreateModal(true);
  };

  const handleDeleteRegion = async (id) => {
    if (!window.confirm('Bu bölgeyi silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await ApiService.deleteElectionRegion(id);
      if (response.success) {
        setMessage('Bölge başarıyla silindi');
        setMessageType('success');
        loadRegions();
      } else {
        setMessage(response.message || 'Bölge silinirken hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error deleting region:', error);
      setMessage('Bölge silinirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const toggleNeighborhood = (id) => {
    setSelectedNeighborhoods(prev => 
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  };

  const toggleVillage = (id) => {
    setSelectedVillages(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bölgeler</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Bölge Oluştur
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          messageType === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
          messageType === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
          'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
        }`}>
          {message}
        </div>
      )}

      {/* Bölge Listesi */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
        ) : regions.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">Henüz bölge eklenmemiş.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Bölge Adı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sorumlu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Mahalleler
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Köyler
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {regions.map((region) => {
                  const supervisor = regionSupervisors.find(s => String(s.id) === String(region.supervisor_id));
                  const regionNeighborhoods = neighborhoods.filter(n => 
                    (region.neighborhood_ids || []).includes(n.id)
                  );
                  const regionVillages = villages.filter(v => 
                    (region.village_ids || []).includes(v.id)
                  );
                  
                  return (
                    <tr key={region.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {region.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {supervisor ? supervisor.name : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {regionNeighborhoods.length > 0 
                          ? regionNeighborhoods.map(n => n.name).join(', ')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {regionVillages.length > 0 
                          ? regionVillages.map(v => v.name).join(', ')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditRegion(region)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            title="Düzenle"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteRegion(region.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Sil"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bölge Oluştur Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingRegion ? 'Bölge Düzenle' : 'Yeni Bölge Oluştur'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRegion(null);
                    setRegionName('');
                    setSelectedNeighborhoods([]);
                    setSelectedVillages([]);
                    setSelectedSupervisorId('');
                    setMessage('');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateRegion} className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bölge Adı *
                </label>
                <input
                  type="text"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Örn: 1. Bölge"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bölge Sorumlusu *
                </label>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Seçiniz...</option>
                  {regionSupervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} {supervisor.tc ? `(${supervisor.tc})` : ''}
                    </option>
                  ))}
                </select>
                {regionSupervisors.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Henüz bölge sorumlusu eklenmemiş. Önce "Sorumlular" sayfasından bölge sorumlusu ekleyin.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mahalleler */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Mahalleler</h4>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {neighborhoods.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Mahalle bulunamadı</p>
                      ) : (
                        <div className="space-y-2">
                          {neighborhoods.map((neighborhood) => {
                            const ballotCount = getBallotBoxCount(neighborhood.id, 'neighborhood');
                            const isSelected = selectedNeighborhoods.includes(neighborhood.id);
                            return (
                              <label
                                key={neighborhood.id}
                                className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                                    : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleNeighborhood(neighborhood.id)}
                                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                                <span className="ml-3 flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {neighborhood.name}
                                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                                    ({ballotCount} sandık)
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Köyler */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Köyler</h4>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {villages.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Köy bulunamadı</p>
                      ) : (
                        <div className="space-y-2">
                          {villages.map((village) => {
                            const ballotCount = getBallotBoxCount(village.id, 'village');
                            const isSelected = selectedVillages.includes(village.id);
                            return (
                              <label
                                key={village.id}
                                className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                                    : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleVillage(village.id)}
                                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                                <span className="ml-3 flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {village.name}
                                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                                    ({ballotCount} sandık)
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRegion(null);
                    setRegionName('');
                    setSelectedNeighborhoods([]);
                    setSelectedVillages([]);
                    setSelectedSupervisorId('');
                    setMessage('');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorsPage;

