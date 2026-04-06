import React, { useState, useEffect, useRef } from 'react';
import ApiService from '../utils/ApiService';
import Modal from '../components/Modal';
import MemberDetails from '../components/MemberDetails';
import MeetingDetails from '../components/MeetingDetails';
import {
  ArchiveHeader,
  SummaryStatistics,
  ArchiveTabs,
  DocumentsTable,
  ArchivedMembersTable,
  ArchivedMeetingsTable,
  ArchivedEventsTable
} from '../components/Archive';
import MemberDocumentsTable from '../components/Archive/MemberDocumentsTable';
import DocumentUploadForm from '../components/Archive/DocumentUploadForm';
import { LoadingSpinner } from '../components/UI';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/UI/ConfirmDialog';

const ArchivePage = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [documents, setDocuments] = useState([]);
  const [memberDocuments, setMemberDocuments] = useState([]);
  const [archivedMembers, setArchivedMembers] = useState([]);
  const [archivedMeetings, setArchivedMeetings] = useState([]);
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemType, setItemType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', description: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('documents'); // 'documents', 'members', 'meetings', 'events'
  const [documentType, setDocumentType] = useState('admin'); // 'admin' or 'member'
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchArchivedData();
    fetchMeetings();
    fetchDocuments();
    fetchMemberDocuments();
  }, []);

  const fetchArchivedData = async () => {
    try {
      setLoading(true);
      const membersData = await ApiService.getMembers(true); // Get archived members
      const meetingsData = await ApiService.getMeetings(true); // Get archived meetings
      const eventsData = await ApiService.getEvents(true); // Get archived events
      
      setArchivedMembers(membersData.filter(member => member.archived));
      setArchivedMeetings(meetingsData.filter(meeting => meeting.archived));
      setArchivedEvents(eventsData.filter(ev => ev.archived));
    } catch (error) {
      console.error('Error fetching archived data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const meetingsData = await ApiService.getMeetings();
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const documentsData = await ApiService.getDocuments();
      setDocuments(documentsData);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchMemberDocuments = async () => {
    try {
      // Tüm üyeleri al
      const members = await ApiService.getMembers();
      
      // Her üye için personal documents'ları al
      const allMemberDocuments = [];
      for (const member of members) {
        try {
          const memberDocs = await ApiService.getPersonalDocuments(member.id);
          // Her belgeye üye bilgisi ekle
          const docsWithMemberInfo = memberDocs.map(doc => ({
            ...doc,
            member_name: member.name,
            member_id: member.id,
            is_member_document: true
          }));
          allMemberDocuments.push(...docsWithMemberInfo);
        } catch (error) {
          console.error(`Error fetching documents for member ${member.id}:`, error);
        }
      }
      
      setMemberDocuments(allMemberDocuments);
    } catch (error) {
      console.error('Error fetching member documents:', error);
    }
  };

  const handleShowMember = async (id) => {
    try {
      const member = await ApiService.getMemberById(id);
      setSelectedItem(member);
      setItemType('member');
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching member details:', error);
    }
  };

  const handleShowMeeting = async (id) => {
    try {
      const meeting = await ApiService.getMeetingById(id);
      setSelectedItem(meeting);
      setItemType('meeting');
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching meeting details:', error);
    }
  };

  const closeDetailModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setItemType(null);
  };

  const openUploadModal = () => {
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadForm({ name: '', description: '' });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill name field if empty
      if (!uploadForm.name) {
        setUploadForm({ ...uploadForm, name: file.name });
      }
    }
  };

  const handleUploadFormChange = (e) => {
    const { name, value } = e.target;
    setUploadForm({ ...uploadForm, [name]: value });
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.warning('Lütfen bir dosya seçin');
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('name', uploadForm.name);
      formData.append('description', uploadForm.description);
      
      await ApiService.uploadDocument(formData);
      
      // Refresh documents list
      await fetchDocuments();
      
      // Close modal and reset form
      closeUploadModal();

      toast.success('Belge başarıyla yüklendi');
    } catch (error) {
      console.error('Error uploading document:', error);
      // More detailed error handling
      let errorMessage = 'Belge yüklenirken hata oluştu';
      if (error.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (id, filename, isMemberDocument = false) => {
    try {
      let blob;
      if (isMemberDocument) {
        blob = await ApiService.downloadPersonalDocument(id);
      } else {
        blob = await ApiService.downloadDocument(id);
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Belge indirilirken hata oluştu: ' + error.message);
    }
  };

  const handleDeleteDocument = async (id, isMemberDocument = false) => {
    const confirmed = await confirm({ title: 'Belgeyi Sil', message: 'Bu belgeyi silmek istediğinize emin misiniz?' });
    if (!confirmed) return;
    try {
      if (isMemberDocument) {
        await ApiService.deletePersonalDocument(id);
        // Refresh member documents list
        await fetchMemberDocuments();
      } else {
        await ApiService.deleteDocument(id);
        // Refresh documents list
        await fetchDocuments();
      }
      toast.success('Belge başarıyla silindi');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Belge silinirken hata oluştu: ' + error.message);
    }
  };

  const handleDeleteArchivedMember = async (id) => {
    const confirmed = await confirm({ title: 'Üyeyi Kalıcı Sil', message: 'Bu arşivlenmiş üyeyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' });
    if (!confirmed) return;
    try {
      await ApiService.deleteArchivedMember(id);
      // Refresh archived members list
      await fetchArchivedData();
      toast.success('Arşivlenmiş üye başarıyla silindi');
    } catch (error) {
      console.error('Error deleting archived member:', error);
      toast.error('Arşivlenmiş üye silinirken hata oluştu: ' + error.message);
    }
  };

  const handleRestoreMember = async (id) => {
    const confirmed = await confirm({ title: 'Üyeyi Geri Yükle', message: 'Bu üyeyi geri yüklemek istediğinize emin misiniz?' });
    if (!confirmed) return;
    try {
      await ApiService.restoreMember(id);
      // Refresh archived members list
      await fetchArchivedData();
      toast.success('Üye başarıyla geri yüklendi');
    } catch (error) {
      console.error('Error restoring member:', error);
      toast.error('Üye geri yüklenirken hata oluştu: ' + error.message);
    }
  };

  const handleDeleteArchivedMeeting = async (id) => {
    const confirmed = await confirm({ title: 'Toplantıyı Kalıcı Sil', message: 'Bu arşivlenmiş toplantıyı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' });
    if (!confirmed) return;
    try {
      await ApiService.deleteArchivedMeeting(id);
      // Refresh archived meetings list
      await fetchArchivedData();
      // Also refresh regular meetings list to update statistics
      await fetchMeetings();
      toast.success('Arşivlenmiş toplantı başarıyla silindi');
    } catch (error) {
      console.error('Error deleting archived meeting:', error);
      toast.error('Arşivlenmiş toplantı silinirken hata oluştu: ' + error.message);
    }
  };

  const handleRestoreEvent = async (id) => {
    const confirmed = await confirm({ title: 'Etkinliği Geri Al', message: 'Bu etkinliği arşivden geri almak istediğinize emin misiniz?' });
    if (!confirmed) return;
    try {
      await ApiService.unarchiveEvent(id);
      await fetchArchivedData();
      toast.success('Etkinlik başarıyla geri alındı');
    } catch (error) {
      console.error('Error restoring event:', error);
      toast.error('Etkinlik geri alınırken hata oluştu: ' + error.message);
    }
  };

  const handleDeleteArchivedEvent = async (id) => {
    const confirmed = await confirm({ title: 'Etkinliği Kalıcı Sil', message: 'Bu arşivlenmiş etkinliği kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' });
    if (!confirmed) return;
    try {
      await ApiService.deleteEvent(id);
      // Refresh archived events list
      await fetchArchivedData();
      // Note: EventsPage will automatically refresh when navigated to due to cache-busting
      toast.success('Arşivlenmiş etkinlik başarıyla silindi');
    } catch (error) {
      console.error('Error deleting archived event:', error);
      toast.error('Arşivlenmiş etkinlik silinirken hata oluştu: ' + error.message);
    }
  };

  // Clear archived members
  const handleClearArchivedMembers = async () => {
    const confirmed = await confirm({ title: 'Tüm Arşivlenen Üyeleri Sil', message: 'Arşivlenmiş tüm üyeleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' });
    if (!confirmed) return;
    try {
      await ApiService.clearArchivedMembers();
      // Refresh archived members list
      await fetchArchivedData();
      toast.success('Arşivlenmiş üyeler başarıyla temizlendi');
    } catch (error) {
      console.error('Error clearing archived members:', error);
      toast.error('Arşivlenmiş üyeler temizlenirken hata oluştu: ' + error.message);
    }
  };

  // Clear archived meetings
  const handleClearArchivedMeetings = async () => {
    const confirmed = await confirm({ title: 'Tüm Arşivlenen Toplantıları Sil', message: 'Arşivlenmiş tüm toplantıları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' });
    if (!confirmed) return;
    try {
      await ApiService.clearArchivedMeetings();
      // Refresh archived meetings list
      await fetchArchivedData();
      toast.success('Arşivlenmiş toplantılar başarıyla temizlendi');
    } catch (error) {
      console.error('Error clearing archived meetings:', error);
      toast.error('Arşivlenmiş toplantılar temizlenirken hata oluştu: ' + error.message);
    }
  };

  // Clear documents
  const handleClearDocuments = async () => {
    const confirmed = await confirm({ title: 'Tüm Belgeleri Sil', message: 'Tüm belgeleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' });
    if (!confirmed) return;
    try {
      await ApiService.clearDocuments();
      // Refresh documents list
      await fetchDocuments();
      toast.success('Tüm belgeler başarıyla temizlendi');
    } catch (error) {
      console.error('Error clearing documents:', error);
      toast.error('Belgeler temizlenirken hata oluştu: ' + error.message);
    }
  };

  // Clear archived events
  const handleClearArchivedEvents = async () => {
    const confirmed = await confirm({ title: 'Tüm Arşivlenen Etkinlikleri Sil', message: 'Arşivlenmiş tüm etkinlikleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' });
    if (!confirmed) return;
    try {
      await ApiService.clearArchivedEvents();
      await fetchArchivedData();
      toast.success('Arşivlenmiş etkinlikler başarıyla temizlendi');
    } catch (error) {
      console.error('Error clearing archived events:', error);
      toast.error('Arşivlenmiş etkinlikler temizlenirken hata oluştu: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden pb-24 lg:pb-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden pb-24 lg:pb-6">
      {/* Header Section */}
      <ArchiveHeader onUploadDocument={openUploadModal} />

      {/* Summary Statistics Cards */}
      <SummaryStatistics 
        documents={documents} 
        archivedMembers={archivedMembers} 
        archivedMeetings={archivedMeetings} 
      />

      {/* Navigation Tabs */}
      <ArchiveTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Actions per tab */}
      <div className="flex justify-end mb-2">
        {activeTab === 'documents' && (
          <button onClick={handleClearDocuments} className="px-3 py-1.5 text-sm rounded-md bg-red-50 text-red-700 hover:bg-red-100">Tümünü Sil</button>
        )}
        {activeTab === 'members' && (
          <button onClick={handleClearArchivedMembers} className="px-3 py-1.5 text-sm rounded-md bg-red-50 text-red-700 hover:bg-red-100">Tümünü Sil</button>
        )}
        {activeTab === 'meetings' && (
          <button onClick={handleClearArchivedMeetings} className="px-3 py-1.5 text-sm rounded-md bg-red-50 text-red-700 hover:bg-red-100">Tümünü Sil</button>
        )}
        {activeTab === 'events' && (
          <button onClick={handleClearArchivedEvents} className="px-3 py-1.5 text-sm rounded-md bg-red-50 text-red-700 hover:bg-red-100">Tümünü Sil</button>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            {/* Admin Belgeleri */}
            <div className="mb-6">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Admin Belgeleri</h2>
              </div>
              <DocumentsTable 
                documents={documents} 
                onDownloadDocument={(id, filename) => handleDownloadDocument(id, filename, false)} 
                onDeleteDocument={(id) => handleDeleteDocument(id, false)} 
              />
            </div>
            
            {/* Üye Belgeleri */}
            <div className="mt-8">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Üye Belgeleri</h2>
              </div>
              <MemberDocumentsTable 
                documents={memberDocuments} 
                onDownloadDocument={(id, filename) => handleDownloadDocument(id, filename, true)} 
                onDeleteDocument={(id) => handleDeleteDocument(id, true)} 
              />
            </div>
          </div>
        )}

        {/* Archived Members Tab */}
        {activeTab === 'members' && (
          <div>
            <ArchivedMembersTable 
              archivedMembers={archivedMembers} 
              onShowMember={handleShowMember} 
              onDeleteMember={handleDeleteArchivedMember}
              onRestoreMember={handleRestoreMember}
            />
          </div>
        )}

        {/* Archived Meetings Tab */}
        {activeTab === 'meetings' && (
          <div>
            <ArchivedMeetingsTable 
              archivedMeetings={archivedMeetings} 
              onShowMeeting={handleShowMeeting} 
              onDeleteMeeting={handleDeleteArchivedMeeting}
            />
          </div>
        )}

        {/* Archived Events Tab */}
        {activeTab === 'events' && (
          <div>
            <ArchivedEventsTable
              archivedEvents={archivedEvents}
              onDeleteEvent={handleDeleteArchivedEvent}
              onRestoreEvent={handleRestoreEvent}
            />
          </div>
        )}
      </div>

      {/* Document Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={closeUploadModal}
        title="Belge Yükle"
      >
        <DocumentUploadForm 
          uploadForm={uploadForm}
          handleUploadFormChange={handleUploadFormChange}
          handleFileChange={handleFileChange}
          handleUploadDocument={handleUploadDocument}
          closeUploadModal={closeUploadModal}
          uploading={uploading}
          fileInputRef={fileInputRef}
        />
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        title={itemType === 'member' ? `${selectedItem?.name} Detayları` : selectedItem?.name}
      >
        {itemType === 'member' && selectedItem && (
          <MemberDetails member={selectedItem} meetings={meetings} />
        )}
        {itemType === 'meeting' && selectedItem && (
          <MeetingDetails meeting={selectedItem} />
        )}
      </Modal>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default ArchivePage;