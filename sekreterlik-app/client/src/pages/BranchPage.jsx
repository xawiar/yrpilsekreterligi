import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import Modal from '../components/Modal';
import MemberDetails from '../components/MemberDetails';
import BranchManagementSection from '../components/BranchManagementSection';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/UI/ConfirmDialog';

/**
 * BranchPage - Kadin Kollari ve Genclik Kollari icin birlesik sayfa
 * @param {Object} props
 * @param {'women'|'youth'} props.type - Kol tipi
 */
const BranchPage = ({ type = 'women' }) => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();

  const isWomen = type === 'women';
  const branchLabel = isWomen ? 'Kadin Kollari' : 'Genclik Kollari';
  const storageKey = isWomen ? 'womenBranchSelectedRegion' : 'youthBranchSelectedRegion';

  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(() => {
    return localStorage.getItem(storageKey) || '';
  });
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [presidents, setPresidents] = useState({});
  const [management, setManagement] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchRegions();
    fetchMembers();
    fetchPresidents();
  }, [type]);

  useEffect(() => {
    if (selectedRegion) {
      localStorage.setItem(storageKey, selectedRegion);
    }

    if (selectedRegion && members.length > 0) {
      const filtered = members.filter(m => m.region === selectedRegion);
      setFilteredMembers(filtered);

      const presidentId = presidents[selectedRegion];
      if (presidentId) {
        fetchManagement(presidentId);
      } else {
        setManagement([]);
      }
    } else {
      setFilteredMembers([]);
      setManagement([]);
    }
  }, [selectedRegion, members, presidents]);

  const fetchRegions = async () => {
    try {
      const data = await ApiService.getRegions();
      setRegions(data);
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresidents = async () => {
    try {
      const data = isWomen
        ? await ApiService.getWomenBranchPresidents()
        : await ApiService.getYouthBranchPresidents();
      const presidentsMap = {};
      data.forEach(p => {
        presidentsMap[p.region] = p.member_id;
      });
      setPresidents(presidentsMap);
    } catch (error) {
      console.error('Error fetching presidents:', error);
    }
  };

  const fetchManagement = async (presidentMemberId) => {
    try {
      const data = isWomen
        ? await ApiService.getWomenBranchManagement(presidentMemberId)
        : await ApiService.getYouthBranchManagement(presidentMemberId);
      setManagement(data || []);
    } catch (error) {
      console.error('Error fetching management:', error);
      setManagement([]);
    }
  };

  const handleSetPresident = async (memberId) => {
    if (!selectedRegion) {
      toast.warning('Lutfen once bir bolge secin');
      return;
    }

    try {
      if (isWomen) {
        await ApiService.setWomenBranchPresident(selectedRegion, memberId);
      } else {
        await ApiService.setYouthBranchPresident(selectedRegion, memberId);
      }
      setPresidents(prev => ({
        ...prev,
        [selectedRegion]: memberId
      }));
      toast.success(`${branchLabel} baskani basariyla atandi`);
    } catch (error) {
      console.error('Error setting president:', error);
      toast.error('Baskan atanirken hata olustu: ' + error.message);
    }
  };

  const handleRemovePresident = async () => {
    if (!selectedRegion) return;

    const confirmed = await confirm({
      title: 'Baskanligi Kaldir',
      message: 'Bu kisinin baskanligini kaldirmak istediginize emin misiniz?',
      confirmText: 'Kaldir',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      if (isWomen) {
        await ApiService.removeWomenBranchPresident(selectedRegion);
      } else {
        await ApiService.removeYouthBranchPresident(selectedRegion);
      }
      setPresidents(prev => {
        const newPresidents = { ...prev };
        delete newPresidents[selectedRegion];
        return newPresidents;
      });
      toast.success(`${branchLabel} baskanligi kaldirildi`);
    } catch (error) {
      console.error('Error removing president:', error);
      toast.error('Baskanlik kaldirilirken hata olustu: ' + error.message);
    }
  };

  const currentPresidentId = selectedRegion ? presidents[selectedRegion] : null;
  const currentPresident = currentPresidentId
    ? filteredMembers.find(m => String(m.id) === String(currentPresidentId))
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{branchLabel}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Bolge bazinda {branchLabel.toLowerCase()} baskanligi yonetimi
        </p>
      </div>

      {/* Bolge Secimi */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Bolge Secin
        </label>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">Bolge secin...</option>
          {regions.map((region) => (
            <option key={region.id} value={region.name}>
              {region.name}
            </option>
          ))}
        </select>
      </div>

      {/* Mevcut Baskan */}
      {selectedRegion && currentPresident && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Mevcut {branchLabel} Baskani
              </h3>
              <p className="mt-1 text-green-700 dark:text-green-300">
                {currentPresident.name}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Bolge: {selectedRegion}
              </p>
            </div>
            <button
              onClick={handleRemovePresident}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Baskanligi Kaldir
            </button>
          </div>
        </div>
      )}

      {/* Yonetim Listesi */}
      {selectedRegion && currentPresidentId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {branchLabel} Yonetimi
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedRegion} bolgesi {branchLabel.toLowerCase()} baskaninin olusturdugu yonetim listesi
            </p>
          </div>
          <BranchManagementSection
            branchType={isWomen ? 'women' : 'youth'}
            memberRegion={selectedRegion}
            memberId={currentPresidentId}
            management={management}
            setManagement={setManagement}
          />
        </div>
      )}

      {/* Uye Listesi */}
      {selectedRegion && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {selectedRegion} Bolgesi Uyeleri ({filteredMembers.length})
            </h2>
          </div>
          {filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Bu bolgede uye bulunmamaktadir.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ad Soyad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Telefon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Gorev
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Islemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredMembers.map((member) => {
                    const isPresident = String(member.id) === String(currentPresidentId);
                    return (
                      <tr key={member.id} className={isPresident ? 'bg-green-50 dark:bg-green-900/20' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {member.name}
                            </div>
                            {isPresident && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Baskan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {member.phone || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {member.position || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setSelectedMember(member);
                                setIsDetailModalOpen(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                            >
                              Detay
                            </button>
                            {!isPresident && (
                              <button
                                onClick={() => handleSetPresident(member.id)}
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                              >
                                Baskan Yap
                              </button>
                            )}
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
      )}

      {/* Uye Detay Modal */}
      {selectedMember && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedMember(null);
          }}
          title={`${selectedMember.name} Detaylari`}
        >
          <MemberDetails member={selectedMember} meetings={[]} />
        </Modal>
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default BranchPage;
