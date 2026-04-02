// Members page actions handler
export const membersActions = {
  handleAddMember: (setFormMode, setSelectedMember, setIsFormModalOpen) => {
    return () => {
      setFormMode('create');
      setSelectedMember(null);
      setIsFormModalOpen(true);
    };
  },

  handleEditMember: (members, setFormMode, setSelectedMember, setIsFormModalOpen) => {
    return (id) => {
      const member = members.find(m => m.id === id);
      if (member) {
        setFormMode('edit');
        setSelectedMember(member);
        setIsFormModalOpen(true);
      }
    };
  },

  handleArchiveMember: (ApiService, fetchMembers, toast, confirmFn) => {
    return async (id) => {
      const confirmed = confirmFn
        ? await confirmFn({ title: 'Üyeyi Arşivle', message: 'Bu üyeyi arşivlemek istediğinize emin misiniz?' })
        : window.confirm('Bu üyeyi arşivlemek istediğinize emin misiniz?');
      if (confirmed) {
        try {
          await ApiService.archiveMember(id);
          fetchMembers(); // Refresh the list
          if (toast) toast.success('Üye başarıyla arşivlendi');
          else alert('Üye başarıyla arşivlendi');
        } catch (error) {
          console.error('Error archiving member:', error);
          if (toast) toast.error('Üye arşivlenirken hata oluştu: ' + error.message);
          else alert('Üye arşivlenirken hata oluştu: ' + error.message);
        }
      }
    };
  },

  handleShowMember: (ApiService, setSelectedMember, setIsDetailModalOpen) => {
    return async (id) => {
      try {
        const member = await ApiService.getMemberById(id);
        setSelectedMember(member);
        setIsDetailModalOpen(true);
      } catch (error) {
        console.error('Error fetching member details:', error);
      }
    };
  },

  handleImportExcel: (ApiService, fetchMembers, toast) => {
    return async (file) => {
      try {
        // Send the file to the server
        const result = await ApiService.importMembersFromExcel(file);
        fetchMembers(); // Refresh the list
        console.log('Members imported from Excel:', result);
        if (toast) toast.success(`${result.count} üye başarıyla içe aktarıldı.`);
        else alert(`${result.count} üye başarıyla içe aktarıldı.`);
        if (result.errors && result.errors.length > 0) {
          if (toast) toast.warning('Hatalar oluştu:\n' + result.errors.join('\n'));
          else alert('Hatalar oluştu:\n' + result.errors.join('\n'));
        }
      } catch (error) {
        console.error('Error importing members from Excel:', error);
        if (toast) toast.error('Excel içe aktarımı sırasında bir hata oluştu: ' + error.message);
        else alert('Excel içe aktarımı sırasında bir hata oluştu: ' + error.message);
      }
    };
  },

  handleExportExcel: (members, meetings, calculateMeetingStats, toast) => {
    return async () => {
      try {
        // XLSX kütüphanesini dinamik olarak yükle
        const XLSX = await import('xlsx');
        
        // Excel verilerini hazırla
        const worksheetData = [
          // Başlık satırı
          ['TC', 'İsim Soyisim', 'Telefon', 'Görev', 'Bölge', 'Toplantı Sayısı', 'Katıldığı', 'Katılım %']
        ];
        
        // Üye verilerini ekle
        members.forEach(member => {
          const stats = calculateMeetingStats(member, meetings);
          worksheetData.push([
            member.tc || '',
            member.name || '',
            member.phone || '',
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
        if (toast) toast.error('Excel dışa aktarımı sırasında bir hata oluştu: ' + error.message);
        else alert('Excel dışa aktarımı sırasında bir hata oluştu: ' + error.message);
      }
    };
  },

  closeDetailModal: (setIsDetailModalOpen, setSelectedMember) => {
    return () => {
      setIsDetailModalOpen(false);
      setSelectedMember(null);
    };
  },

  closeFormModal: (setIsFormModalOpen, setSelectedMember) => {
    return () => {
      setIsFormModalOpen(false);
      setSelectedMember(null);
    };
  },

  handleMemberSaved: (fetchMembers, closeFormModal) => {
    return () => {
      fetchMembers(); // Refresh the members list
      closeFormModal();
    };
  },

  handleSort: (sortConfig, setSortConfig) => {
    return (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    };
  }
};