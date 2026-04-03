import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { isMobile } from '../utils/capacitorUtils';
import Modal from '../components/Modal';
import MemberDetails from '../components/MemberDetails';
import MemberForm from '../components/MemberForm';
import MemberRegistrationForm from '../components/MemberRegistrationForm';
import MembersHeader from '../components/Members/MembersHeader';
import SummaryStatistics from '../components/Members/SummaryStatistics';
import MembersOperationsMenu from '../components/Members/MembersOperationsMenu';
import MembersTable from '../components/Members/MembersTable';
import ExcelImportPreview from '../components/Members/ExcelImportPreview';
import { calculateMeetingStats, getAttendanceColor, calculateSummaryStats, calculateMemberRegistrations } from '../components/Members/membersUtils';
import LoadingState from '../components/Members/LoadingState';
import NativeMembersList from '../components/mobile/NativeMembersList';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { Pagination } from '../components/UI';

const MembersPage = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [members, setMembers] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  
  const [allMembers, setAllMembers] = useState([]); // Store all members for filtering
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isRegistrationHistoryOpen, setIsRegistrationHistoryOpen] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [events, setEvents] = useState([]);
  const [memberRegistrations, setMemberRegistrations] = useState([]);
  const [regions, setRegions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [formMode, setFormMode] = useState('create'); // 'create' or 'edit'
  const [searchTerm, setSearchTerm] = useState(''); // For member search
  const [selectedRegion, setSelectedRegion] = useState(''); // For region filtering
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' }); // For sorting - default to name A-Z
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [filteredMembers, setFilteredMembers] = useState([]); // For filtered and sorted members
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;
  const [excelImportPreview, setExcelImportPreview] = useState(null); // Excel import preview data
  const [excelImportFile, setExcelImportFile] = useState(null); // Excel file for import
  const [excelImportLoading, setExcelImportLoading] = useState(false); // Excel import loading state

  useEffect(() => {
    fetchMembers();
    fetchMeetings();
    fetchEvents();
    fetchMemberRegistrations();
    fetchRegionsAndPositions();
  }, []);

  // Listen for region and position updates
  useEffect(() => {
    const handleRegionUpdate = () => {
      console.log('Region updated, refreshing members...');
      fetchMembers();
    };

    const handlePositionUpdate = () => {
      console.log('Position updated, refreshing members...');
      fetchMembers();
    };

    window.addEventListener('regionUpdated', handleRegionUpdate);
    window.addEventListener('positionUpdated', handlePositionUpdate);

    return () => {
      window.removeEventListener('regionUpdated', handleRegionUpdate);
      window.removeEventListener('positionUpdated', handlePositionUpdate);
    };
  }, []);

  useEffect(() => {
    // Apply filtering first
    let result = allMembers.filter(member => 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedRegion === '' || member.region === selectedRegion)
    );
    
    // Then apply sorting (always sort by name A-Z by default)
    const sortKey = sortConfig.key || 'name'; // Fallback to 'name' if no key is set
    const sortDirection = sortConfig.direction || 'asc'; // Fallback to 'asc' if no direction is set
    
    result = [...result].sort((a, b) => {
      let aValue, bValue;
      
      if (sortKey === 'attendancePercentage') {
        // Calculate attendance percentage for sorting
        const aStats = calculateMeetingStats(a, meetings);
        const bStats = calculateMeetingStats(b, meetings);
        aValue = aStats.attendancePercentage;
        bValue = bStats.attendancePercentage;
      } else if (sortKey === 'totalMeetings') {
        // Calculate total meetings for sorting
        const aStats = calculateMeetingStats(a, meetings);
        const bStats = calculateMeetingStats(b, meetings);
        aValue = aStats.totalMeetings;
        bValue = bStats.totalMeetings;
      } else if (sortKey === 'attendedMeetings') {
        // Calculate attended meetings for sorting
        const aStats = calculateMeetingStats(a, meetings);
        const bStats = calculateMeetingStats(b, meetings);
        aValue = aStats.attendedMeetings;
        bValue = bStats.attendedMeetings;
      } else if (sortKey === 'excusedMeetings') {
        // Calculate excused meetings for sorting
        const aStats = calculateMeetingStats(a, meetings);
        const bStats = calculateMeetingStats(b, meetings);
        aValue = aStats.excusedMeetings;
        bValue = bStats.excusedMeetings;
      } else if (sortKey === 'registrations') {
        // Calculate registrations for sorting
        aValue = calculateMemberRegistrations(a.id, memberRegistrations);
        bValue = calculateMemberRegistrations(b.id, memberRegistrations);
      } else {
        aValue = a[sortKey];
        bValue = b[sortKey];
      }
      
      // Handle null or undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
      
      // For string values, use localeCompare for proper sorting (especially for Turkish characters)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'tr-TR', { 
          sensitivity: 'base',
          numeric: true,
          caseFirst: 'lower'
        });
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      // For numeric values
      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    setFilteredMembers(result);
  }, [allMembers, searchTerm, selectedRegion, sortConfig, meetings, memberRegistrations]);

  // Reset to page 1 when search term or region filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRegion]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const resp = await ApiService.getMembers(false);
      const data = Array.isArray(resp) ? resp : (resp.data || []);
      setMembers(data);
      setAllMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const data = await ApiService.getMeetings();
      setMeetings(data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const data = await ApiService.getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchMemberRegistrations = async () => {
    try {
      const data = await ApiService.getMemberRegistrations();
      setMemberRegistrations(data);
    } catch (error) {
      console.error('Error fetching member registrations:', error);
    }
  };

  const fetchRegionsAndPositions = async () => {
    try {
      const [regionsData, positionsData] = await Promise.all([
        ApiService.getRegions().catch(err => {
          console.warn('Error fetching regions:', err);
          return [];
        }),
        ApiService.getPositions().catch(err => {
          console.warn('Error fetching positions:', err);
          return [];
        })
      ]);
      setRegions(Array.isArray(regionsData) ? regionsData : []);
      setPositions(Array.isArray(positionsData) ? positionsData : []);
    } catch (error) {
      console.warn('Error fetching regions and positions:', error);
      setRegions([]);
      setPositions([]);
    }
  };

  // Function to calculate summary statistics
  const summaryStats = calculateSummaryStats(allMembers || [], meetings || []);

  const handleAddMember = () => {
    setFormMode('create');
    setSelectedMember(null);
    setIsFormModalOpen(true);
  };

  const handleEditMember = (idOrMember) => {
    try {
      // Handle both ID (string/number) and member object
      let memberId = null;
      let member = null;
      
      if (typeof idOrMember === 'object' && idOrMember !== null) {
        // If it's a member object, use it directly
        member = idOrMember;
        memberId = idOrMember.id;
      } else {
        // If it's an ID, find the member in allMembers
        memberId = idOrMember;
        // Convert ID to string for comparison
        const stringId = String(memberId);
        // Try to find member by ID (handle both string and number IDs)
        member = allMembers.find(m => String(m.id) === stringId || Number(m.id) === Number(memberId));
      }
      
      if (!member) {
        console.error('Member not found for ID:', memberId);
        toast.error('Üye bulunamadı');
        return;
      }

      setFormMode('edit');
      setSelectedMember(member);
      setIsFormModalOpen(true);
    } catch (error) {
      console.error('Error in handleEditMember:', error);
      toast.error('Üye düzenleme penceresi açılırken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  const handleArchiveMember = async (id) => {
    const confirmed = await confirm({ title: 'Üyeyi Arşivle', message: 'Bu üyeyi arşivlemek istediğinize emin misiniz?' });
    if (!confirmed) return;

    try {
      await ApiService.archiveMember(id);
      fetchMembers(); // Refresh the list
      toast.success('Üye başarıyla arşivlendi');
    } catch (error) {
      console.error('Error archiving member:', error);
      toast.error('Üye arşivlenirken hata oluştu: ' + error.message);
    }
  };

  const handleAddMemberRegistration = (id) => {
    const member = allMembers.find(m => m.id === id);
    if (member) {
      setSelectedMember(member);
      setIsRegistrationModalOpen(true);
    }
  };

  const handleShowRegistrations = (id) => {
    const member = allMembers.find(m => m.id === id);
    if (member) {
      setSelectedMember(member);
      setIsRegistrationHistoryOpen(true);
    }
  };

  const handleEditRegistration = (reg) => {
    setEditingRegistration(reg);
  };

  const handleDeleteRegistration = async (id) => {
    if (!id) return;
    const confirmed = await confirm({ title: 'Kaydı Sil', message: 'Bu kayıt silinsin mi?' });
    if (!confirmed) return;
    try {
      await ApiService.deleteMemberRegistration(id);
      await fetchMemberRegistrations();
    } catch (e) {
      toast.error('Silinirken hata: ' + e.message);
    }
  };

  const handleShowMember = async (idOrMember) => {
    try {
      // Handle both ID (string/number) and member object
      let memberId = null;
      let member = null;
      
      if (typeof idOrMember === 'object' && idOrMember !== null) {
        // If it's a member object, use it directly
        member = idOrMember;
        memberId = idOrMember.id;
      } else {
        // If it's an ID, fetch the member
        memberId = idOrMember;
      }
      
      if (!memberId) {
        console.error('Member ID is required');
        return;
      }
      
      // Convert ID to string for Firebase
      const stringId = String(memberId);
      
      // If we already have the member object, use it; otherwise fetch
      if (!member) {
        member = await ApiService.getMemberById(stringId);
        if (!member) {
          console.error('Member not found for ID:', stringId);
          toast.error('Üye bulunamadı');
          return;
        }
      }

      setSelectedMember(member);
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error('Error fetching member details:', error);
      toast.error('Üye detayları yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  const handleImportExcel = async (file) => {
    try {
      setExcelImportLoading(true);
      // Preview the import first
      const previewData = await ApiService.previewImportMembersFromExcel(file);
      setExcelImportPreview(previewData);
      setExcelImportFile(file);
    } catch (error) {
      console.error('Error previewing Excel import:', error);
      toast.error('Excel dosyası analiz edilirken hata oluştu: ' + error.message);
    } finally {
      setExcelImportLoading(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelImportFile || !excelImportPreview) return;
    
    try {
      setExcelImportLoading(true);
      // Import with preview data
      const result = await ApiService.importMembersFromExcel(excelImportFile, excelImportPreview);
      fetchMembers(); // Refresh the list
      console.log('Members imported from Excel:', result);
      
      // Close preview modal
      setExcelImportPreview(null);
      setExcelImportFile(null);
      
      // Show success message
      toast.success(`${result.count} üye başarıyla içe aktarıldı.`);
      if (result.errors && result.errors.length > 0) {
        toast.warning('Hatalar oluştu:\n' + result.errors.join('\n'));
      }
    } catch (error) {
      console.error('Error importing members from Excel:', error);
      toast.error('Excel içe aktarımı sırasında bir hata oluştu: ' + error.message);
    } finally {
      setExcelImportLoading(false);
    }
  };

  const handleCancelExcelImport = () => {
    setExcelImportPreview(null);
    setExcelImportFile(null);
  };

  const handleExportExcel = async () => {
    const confirmed = await confirm({
      message: 'Bu dosya TC kimlik ve telefon numarası gibi hassas kişisel veriler içermektedir. KVKK kapsamında bu verilerin paylaşımından siz sorumlusunuz. Devam etmek istiyor musunuz?',
      title: 'Hassas Veri Uyarısı'
    });
    if (!confirmed) return;

    const maskTC = (tc) => tc ? `${String(tc).slice(0,3)}****${String(tc).slice(-3)}` : '';
    const maskPhone = (phone) => phone ? `${String(phone).slice(0,3)}****${String(phone).slice(-3)}` : '';

    setIsExporting(true);
    try {
      // XLSX kütüphanesini dinamik olarak yükle
      const XLSX = await import('xlsx');
      
      // Excel verilerini hazırla
      const worksheetData = [
        // Başlık satırı
        ['TC', 'İsim Soyisim', 'Telefon', 'Görev', 'Bölge', 'Toplantı Sayısı', 'Katıldığı', 'Katılım %']
      ];
      
      // Üye verilerini ekle
      filteredMembers.forEach(member => {
        const stats = calculateMeetingStats(member, meetings);
        worksheetData.push([
          maskTC(member.tc),
          member.name || '',
          maskPhone(member.phone),
          member.position || '',
          member.region || '',
          stats.totalMeetings || 0,
          stats.attendedMeetings || 0,
          `${stats.attendancePercentage || 0}%`
        ]);
      });
      
      // Worksheet oluştur
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Sütun genişliklerini ayarla
      worksheet['!cols'] = [
        { wch: 12 }, // TC
        { wch: 25 }, // İsim Soyisim
        { wch: 15 }, // Telefon
        { wch: 20 }, // Görev
        { wch: 20 }, // Bölge
        { wch: 15 }, // Toplantı Sayısı
        { wch: 12 }, // Katıldığı
        { wch: 12 }  // Katılım %
      ];
      
      // Workbook oluştur
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Üyeler');
      
      // Excel dosyasını oluştur
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      // Blob oluştur ve indir
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'uyeler.xlsx');
      link.style.visibility = 'hidden';
      
      // Append to the document, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // URL'i temizle
      URL.revokeObjectURL(url);
      
      console.log('Members exported to Excel');
    } catch (error) {
      console.error('Error exporting members to Excel:', error);
      toast.error('Excel dışa aktarımı sırasında bir hata oluştu: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedMember(null);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setSelectedMember(null);
  };

  const handleMemberSaved = () => {
    fetchMembers(); // Refresh the members list
    closeFormModal();
  };

  // Function to handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Function to get sort indicator
  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? '↑' : '↓';
    }
    return null;
  };

  if (loading) {
    return <LoadingState />;
  }

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const mobileView = isMobile();

  // Native mobile görünümü
  if (mobileView) {
    return (
      <>
        <NativeMembersList
          members={filteredMembers}
          onMemberClick={handleShowMember}
          onAddMember={handleAddMember}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
          regions={regions}
          loading={loading}
        />

        {/* Modals - Mobilde de çalışır */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={closeDetailModal}
          title={selectedMember ? selectedMember.name : "Üye Detayları"}
        >
          {selectedMember && (
            <MemberDetails 
              member={selectedMember} 
              meetings={meetings} 
              events={events}
              memberRegistrations={memberRegistrations}
              calculateMeetingStats={calculateMeetingStats}
            />
          )}
        </Modal>

        <Modal
          isOpen={isFormModalOpen}
          onClose={closeFormModal}
          title={formMode === 'edit' ? "Üyeyi Düzenle" : "Yeni Üye Ekle"}
        >
          <MemberForm
            member={selectedMember}
            regions={regions}
            positions={positions}
            onClose={closeFormModal}
            onMemberSaved={handleMemberSaved}
          />
        </Modal>

        <Modal
          isOpen={isRegistrationModalOpen}
          onClose={() => { setIsRegistrationModalOpen(false); setSelectedMember(null); }}
          title={selectedMember ? `${selectedMember.name} - Üye Kaydı Ekle` : 'Üye Kaydı Ekle'}
        >
          {selectedMember && (
            <MemberRegistrationForm
              member={selectedMember}
              onClose={() => { setIsRegistrationModalOpen(false); setSelectedMember(null); }}
              onRegistrationSaved={async () => {
                await fetchMemberRegistrations();
                setIsRegistrationModalOpen(false);
                setSelectedMember(null);
              }}
            />
          )}
        </Modal>

        <Modal
          isOpen={isRegistrationHistoryOpen}
          onClose={() => { setIsRegistrationHistoryOpen(false); setSelectedMember(null); setEditingRegistration(null); }}
          title={selectedMember ? `${selectedMember.name} - Kayıt Geçmişi` : 'Kayıt Geçmişi'}
        >
          {selectedMember && (
            <div className="space-y-4">
              {editingRegistration ? (
                <MemberRegistrationForm
                  member={selectedMember}
                  initialData={editingRegistration}
                  onClose={() => setEditingRegistration(null)}
                  onRegistrationSaved={async () => {
                    await fetchMemberRegistrations();
                    setEditingRegistration(null);
                  }}
                />
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Adet</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {memberRegistrations
                      .filter(r => r.memberId === selectedMember.id)
                      .sort((a,b) => (a.date < b.date ? 1 : -1))
                      .map(reg => (
                        <tr key={reg.id || `${reg.memberId}-${reg.date}`}>
                          <td className="px-4 py-2 text-sm text-gray-700">{reg.date}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{reg.count}</td>
                          <td className="px-4 py-2 text-sm font-medium space-x-2">
                            <button
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => handleEditRegistration(reg)}
                            >
                              Düzenle
                            </button>
                            {reg.id && (
                              <button
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs rounded-md text-white bg-red-600 hover:bg-red-700"
                                onClick={() => handleDeleteRegistration(reg.id)}
                              >
                                Sil
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    {memberRegistrations.filter(r => r.memberId === selectedMember.id).length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-4 py-6 text-center text-sm text-gray-500">Kayıt bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>

        {/* Excel Import Preview Modal */}
        {excelImportPreview && (
          <ExcelImportPreview
            previewData={excelImportPreview}
            onConfirm={handleConfirmExcelImport}
            onCancel={handleCancelExcelImport}
            loading={excelImportLoading}
          />
        )}
        <ConfirmDialog {...confirmDialogProps} />
      </>
    );
  }

  // Desktop görünümü (mevcut)
  return (
    <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden pb-24 lg:pb-6">
      <MembersHeader onAddMember={handleAddMember} />
      <SummaryStatistics summaryStats={summaryStats} />
      <MembersOperationsMenu 
        onViewModeChange={setViewMode}
        viewMode={viewMode}
        onImportExcel={handleImportExcel}
        onExportExcel={handleExportExcel}
        isExporting={isExporting}
        onAddMember={handleAddMember}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedRegion={selectedRegion}
        regions={regions}
        onRegionChange={setSelectedRegion}
      />
      <MembersTable
        members={paginatedMembers}
        meetings={meetings}
        memberRegistrations={memberRegistrations}
        calculateMeetingStats={calculateMeetingStats}
        getAttendanceColor={getAttendanceColor}
        onShowMember={handleShowMember}
        onEditMember={handleEditMember}
        onArchiveMember={handleArchiveMember}
        onAddRegistration={handleAddMemberRegistration}
        onShowRegistrations={handleShowRegistrations}
        onSort={handleSort}
        sortConfig={sortConfig}
        getSortIndicator={getSortIndicator}
        searchTerm={searchTerm}
        selectedRegion={selectedRegion}
        viewMode={viewMode}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredMembers.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
      />
      
      <Modal
        isOpen={isDetailModalOpen}
        onClose={closeDetailModal}
        title={selectedMember ? selectedMember.name : "Üye Detayları"}
      >
        {selectedMember && (
          <MemberDetails 
            member={selectedMember} 
            meetings={meetings} 
            events={events}
            memberRegistrations={memberRegistrations}
            calculateMeetingStats={calculateMeetingStats}
          />
        )}
      </Modal>

      <Modal
        isOpen={isFormModalOpen}
        onClose={closeFormModal}
        title={formMode === 'edit' ? "Üyeyi Düzenle" : "Yeni Üye Ekle"}
      >
        <MemberForm
          member={selectedMember}
          regions={regions}
          positions={positions}
          onClose={closeFormModal}
          onMemberSaved={handleMemberSaved}
        />
      </Modal>

      <Modal
        isOpen={isRegistrationModalOpen}
        onClose={() => { setIsRegistrationModalOpen(false); setSelectedMember(null); }}
        title={selectedMember ? `${selectedMember.name} - Üye Kaydı Ekle` : 'Üye Kaydı Ekle'}
      >
        {selectedMember && (
          <MemberRegistrationForm
            member={selectedMember}
            onClose={() => { setIsRegistrationModalOpen(false); setSelectedMember(null); }}
            onRegistrationSaved={async () => {
              await fetchMemberRegistrations();
              setIsRegistrationModalOpen(false);
              setSelectedMember(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isRegistrationHistoryOpen}
        onClose={() => { setIsRegistrationHistoryOpen(false); setSelectedMember(null); setEditingRegistration(null); }}
        title={selectedMember ? `${selectedMember.name} - Kayıt Geçmişi` : 'Kayıt Geçmişi'}
      >
        {selectedMember && (
          <div className="space-y-4">
            {editingRegistration ? (
              <MemberRegistrationForm
                member={selectedMember}
                initialData={editingRegistration}
                onClose={() => setEditingRegistration(null)}
                onRegistrationSaved={async () => {
                  await fetchMemberRegistrations();
                  setEditingRegistration(null);
                }}
              />
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Adet</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {memberRegistrations
                    .filter(r => r.memberId === selectedMember.id)
                    .sort((a,b) => (a.date < b.date ? 1 : -1))
                    .map(reg => (
                      <tr key={reg.id || `${reg.memberId}-${reg.date}`}>
                        <td className="px-4 py-2 text-sm text-gray-700">{reg.date}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{reg.count}</td>
                        <td className="px-4 py-2 text-sm font-medium space-x-2">
                          <button
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => handleEditRegistration(reg)}
                          >
                            Düzenle
                          </button>
                          {reg.id && (
                            <button
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs rounded-md text-white bg-red-600 hover:bg-red-700"
                              onClick={() => handleDeleteRegistration(reg.id)}
                            >
                              Sil
                            </button>
                          )}
                        </td>
                      </tr>
                  ))}
                  {memberRegistrations.filter(r => r.memberId === selectedMember.id).length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-4 py-6 text-center text-sm text-gray-500">Kayıt bulunamadı.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Excel Import Preview Modal */}
      {excelImportPreview && (
        <ExcelImportPreview
          previewData={excelImportPreview}
          onConfirm={handleConfirmExcelImport}
          onCancel={handleCancelExcelImport}
          loading={excelImportLoading}
        />
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default MembersPage;