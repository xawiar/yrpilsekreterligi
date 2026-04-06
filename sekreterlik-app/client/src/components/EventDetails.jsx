import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';
import { getMemberId } from '../utils/normalizeId';

const NonAttendeesSection = ({ nonAttendees, getMemberInfo }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Katılmayanlar ({nonAttendees.length})
        </h3>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Katılmayan Kişiler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {nonAttendees.map((attendance) => {
                const attendeeMemberId = getMemberId(attendance);
                const memberInfo = getMemberInfo(attendeeMemberId);
                return (
                  <tr key={attendeeMemberId} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                          <span className="text-red-800 dark:text-red-200 text-xs font-medium">
                            {memberInfo.name.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {memberInfo.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {memberInfo.position} - {memberInfo.region}
                            {attendance.excuse && attendance.excuse.hasExcuse && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                (Mazeret: {attendance.excuse.reason || 'Belirtilmemiş'})
                              </span>
                            )}
                          </div>
                        </div>
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
  );
};

const EventDetails = ({ event, members, onEditEvent, onUpdateAttendance }) => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [neighborhoodRepresentatives, setNeighborhoodRepresentatives] = useState([]);
  const [neighborhoodSupervisors, setNeighborhoodSupervisors] = useState([]);
  const [villageRepresentatives, setVillageRepresentatives] = useState([]);
  const [villageSupervisors, setVillageSupervisors] = useState([]);

  useEffect(() => {
    const fetchAdditionalData = async () => {
      setLoading(true);
      try {
        const [neighborhoodReps, neighborhoodSups, villageReps, villageSups] = await Promise.all([
          ApiService.getNeighborhoodRepresentatives(),
          ApiService.getNeighborhoodSupervisors(),
          ApiService.getVillageRepresentatives(),
          ApiService.getVillageSupervisors()
        ]);
        setNeighborhoodRepresentatives(neighborhoodReps || []);
        setNeighborhoodSupervisors(neighborhoodSups || []);
        setVillageRepresentatives(villageReps || []);
        setVillageSupervisors(villageSups || []);
      } catch (error) {
        console.error('Error fetching additional data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdditionalData();
  }, [event]);

  const getMemberName = (memberId) => {
    // ID'leri string'e çevirerek karşılaştır (tip uyumsuzluğu sorununu çözer)
    const member = members.find(m => String(m.id) === String(memberId));
    if (member) return member.name;
    
    // Members listesinde yoksa, neighborhood representatives'te ara
    const neighborhoodRep = neighborhoodRepresentatives.find(rep => String(rep.member_id) === String(memberId));
    if (neighborhoodRep) return neighborhoodRep.name;
    
    // Neighborhood supervisors'te ara
    const neighborhoodSup = neighborhoodSupervisors.find(sup => String(sup.member_id) === String(memberId));
    if (neighborhoodSup) return neighborhoodSup.name;
    
    // Village representatives'te ara
    const villageRep = villageRepresentatives.find(rep => String(rep.member_id) === String(memberId));
    if (villageRep) return villageRep.name;
    
    // Village supervisors'te ara
    const villageSup = villageSupervisors.find(sup => String(sup.member_id) === String(memberId));
    if (villageSup) return villageSup.name;
    
    return 'Bilinmeyen Üye';
  };

  const getMemberInfo = (memberId) => {
    if (!memberId) {
      return {
        name: 'Bilinmeyen Üye',
        position: '-',
        region: '-'
      };
    }
    
    // Handle both string and number memberId values
    const memberIdStr = String(memberId);
    const memberIdNum = Number(memberId);
    
    const member = members.find(m => {
      const mIdStr = String(m.id);
      const mIdNum = Number(m.id);
      return mIdStr === memberIdStr || mIdNum === memberIdNum || mIdStr === memberIdNum || mIdNum === memberIdStr;
    });
    if (member) {
      return {
        name: member.name,
        position: member.position || '-',
        region: member.region || '-'
      };
    }
    
    // Members listesinde yoksa, neighborhood representatives'te ara
    const neighborhoodRep = neighborhoodRepresentatives.find(rep => {
      const repIdStr = String(rep.member_id);
      const repIdNum = Number(rep.member_id);
      return repIdStr === memberIdStr || repIdNum === memberIdNum || repIdStr === memberIdNum || repIdNum === memberIdStr;
    });
    if (neighborhoodRep) {
      return {
        name: neighborhoodRep.name,
        position: 'Mahalle Temsilcisi',
        region: neighborhoodRep.neighborhood_name || '-'
      };
    }
    
    // Neighborhood supervisors'te ara
    const neighborhoodSup = neighborhoodSupervisors.find(sup => {
      const supIdStr = String(sup.member_id);
      const supIdNum = Number(sup.member_id);
      return supIdStr === memberIdStr || supIdNum === memberIdNum || supIdStr === memberIdNum || supIdNum === memberIdStr;
    });
    if (neighborhoodSup) {
      return {
        name: neighborhoodSup.name,
        position: 'Mahalle Sorumlusu',
        region: neighborhoodSup.neighborhood_name || '-'
      };
    }
    
    // Village representatives'te ara
    const villageRep = villageRepresentatives.find(rep => {
      const repIdStr = String(rep.member_id);
      const repIdNum = Number(rep.member_id);
      return repIdStr === memberIdStr || repIdNum === memberIdNum || repIdStr === memberIdNum || repIdNum === memberIdStr;
    });
    if (villageRep) {
      return {
        name: villageRep.name,
        position: 'Köy Temsilcisi',
        region: villageRep.village_name || '-'
      };
    }
    
    // Village supervisors'te ara
    const villageSup = villageSupervisors.find(sup => {
      const supIdStr = String(sup.member_id);
      const supIdNum = Number(sup.member_id);
      return supIdStr === memberIdStr || supIdNum === memberIdNum || supIdStr === memberIdNum || supIdNum === memberIdStr;
    });
    if (villageSup) {
      return {
        name: villageSup.name,
        position: 'Köy Sorumlusu',
        region: villageSup.village_name || '-'
      };
    }
    
    return {
      name: 'Bilinmeyen Üye',
      position: '-',
      region: '-'
    };
  };

  const getAttendanceRate = () => {
    if (!event.attendees || event.attendees.length === 0) return 0;
    const attendedCount = event.attendees.filter(a => a.attended).length;
    return Math.round((attendedCount / event.attendees.length) * 100);
  };

  const getExcusedCount = () => {
    if (!event.attendees || event.attendees.length === 0) return 0;
    return event.attendees.filter(a => a.excuse && a.excuse.hasExcuse).length;
  };

  const getNonAttendedCount = () => {
    if (!event.attendees || event.attendees.length === 0) return 0;
    return event.attendees.filter(a => !a.attended).length;
  };
  
  // Function to export event details as CSV
  const exportToCSV = async () => {
    const confirmed = await confirm({
      message: 'Bu dosya TC kimlik ve telefon numarası gibi hassas kişisel veriler içermektedir. KVKK kapsamında bu verilerin paylaşımından siz sorumlusunuz. Devam etmek istiyor musunuz?',
      title: 'Hassas Veri Uyarısı'
    });
    if (!confirmed) return;

    setIsExporting(true);
    try {
      // Create CSV content
      let csvContent = '';

      // Event info
      csvContent += 'Etkinlik Bilgileri\n';
      csvContent += 'Alan,Değer\n';
      csvContent += `Etkinlik Adı,${event.name}\n`;
      csvContent += `Tarih,${event.date}\n`;
      csvContent += `Yer,${event.location}\n`;
      csvContent += `Toplam Katılımcı,${event.attendees ? event.attendees.length : 0} kişi\n`;
      csvContent += `Katılan,${event.attendees ? event.attendees.filter(a => a.attended).length : 0} kişi\n`;
      csvContent += `Katılmayan,${event.attendees ? event.attendees.filter(a => !a.attended).length : 0} kişi\n`;
      csvContent += `Mazeretli,${getExcusedCount()} kişi\n`;
      csvContent += `Katılım Oranı,${getAttendanceRate()}%\n`;
      csvContent += `Açıklama,"${event.description || 'Açıklama eklenmemiş'}"\n`;
      csvContent += `Oluşturulma Tarihi,${new Date(event.created_at).toLocaleDateString('tr-TR')}\n`;
      csvContent += '\n';

      // Participants - detailed information
      csvContent += 'Katılımcı Detayları\n';
      csvContent += 'Üye Adı,TC Kimlik,Görev,Bölge,İlçe,Telefon,E-posta,Katılım Durumu,Mazeret Durumu,Mazeret Sebebi\n';

      if (event.attendees && event.attendees.length > 0) {
        event.attendees.forEach(attendance => {
          // Handle both string and number memberId values
          const attendeeMemberId = getMemberId(attendance);
          const memberInfo = getMemberInfo(attendeeMemberId);
          const memberIdStr = String(attendeeMemberId);
          const memberIdNum = Number(attendeeMemberId);
          const member = members.find(m => {
            const mIdStr = String(m.id);
            const mIdNum = Number(m.id);
            return mIdStr === memberIdStr || mIdNum === memberIdNum || mIdStr === memberIdNum || mIdNum === memberIdStr;
          });
          const memberName = memberInfo.name;
          const memberTc = member ? (member.tc || '-') : '-';
          const memberPosition = memberInfo.position;
          const memberRegion = memberInfo.region;
          const memberDistrict = member ? member.district : '-';
          const memberPhone = member ? (member.phone || '-') : '-';
          const memberEmail = member ? member.email : '-';

          let attendanceStatus = 'Katılmadı';
          if (attendance.attended) {
            attendanceStatus = 'Katıldı';
          }

          let excuseStatus = 'Yok';
          let excuseReason = '';
          if (attendance.excuse && attendance.excuse.hasExcuse) {
            excuseStatus = 'Var';
            excuseReason = attendance.excuse.reason || 'Belirtilmemiş';
          }

          // Escape commas and quotes in fields
          const escapeField = (field) => {
            if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field || '';
          };

          csvContent += `${escapeField(memberName)},${escapeField(memberTc)},${escapeField(memberPosition)},${escapeField(memberRegion)},${escapeField(memberDistrict)},${escapeField(memberPhone)},${escapeField(memberEmail)},${escapeField(attendanceStatus)},${escapeField(excuseStatus)},${escapeField(excuseReason)}\n`;
        });
      } else {
        csvContent += 'Bu etkinliğe katılımcı eklenmemiş\n';
      }

      // Create blob and download
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const csvDateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${event.name.replace(/\s+/g, '_')}_detaylar_${csvDateStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV dosyası başarıyla indirildi!');
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error('CSV dosyası oluşturulurken bir hata oluştu: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Function to export event details as PDF
  const exportToPDF = async () => {
    try {
      const element = document.getElementById('event-details-container');
      if (!element) {
        toast.error('PDF oluşturulamadı: Sayfa içeriği bulunamadı');
        return;
      }

      // Create canvas from HTML element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 10;
      const headerHeight = 12;
      const footerHeight = 10;
      const imgWidth = 210 - margin * 2;
      const pageHeight = 297 - margin * 2 - headerHeight - footerHeight;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let pageNumber = 1;
      const today = new Date().toLocaleDateString('tr-TR');
      const dateStr = new Date().toISOString().split('T')[0];
      const totalPages = Math.ceil(imgHeight / pageHeight);

      // Helper: draw header and footer on current page
      const addHeaderFooter = (pageNum) => {
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text('Etkinlik Detaylari', margin, margin + 5);
        pdf.text(today, 210 - margin, margin + 5, { align: 'right' });
        pdf.setFontSize(9);
        pdf.text(`Sayfa ${pageNum} / ${totalPages}`, 105, 297 - margin + 2, { align: 'center' });
      };

      // First page
      addHeaderFooter(pageNumber);
      pdf.addImage(imgData, 'PNG', margin, margin + headerHeight, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        pageNumber++;
        pdf.addPage();
        addHeaderFooter(pageNumber);
        const position = margin + headerHeight - (imgHeight - heightLeft);
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save PDF
      pdf.save(`${event.name.replace(/\s+/g, '_')}_detaylar_${dateStr}.pdf`);
      
      toast.success('PDF başarıyla oluşturuldu ve indirildi!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF oluşturulurken bir hata oluştu: ' + error.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Yükleniyor...</div>;
  }

  return (
    <div id="event-details-container" className="space-y-6">
      {/* Action buttons */}
      <div className="flex flex-wrap justify-end gap-2">
        {onEditEvent && (
          <button
            onClick={() => onEditEvent(event)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Düzenle
          </button>
        )}
        {onUpdateAttendance && (
          <button
            onClick={() => onUpdateAttendance(event)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Yoklama Güncelle
          </button>
        )}
        <button
          onClick={exportToCSV}
          disabled={isExporting}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isExporting ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isExporting ? 'Oluşturuluyor...' : 'CSV İndir'}
        </button>
        <button
          onClick={exportToPDF}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          PDF İndir
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Etkinlik Bilgileri</h3>
          <dl className="space-y-3">
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400">Etkinlik Adı</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 font-medium">{event.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400">Tarih</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 font-medium">{event.date}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400">Yer</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 font-medium">{event.location}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400">Açıklama</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 font-medium">{event.description || 'Açıklama eklenmemiş'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">İstatistikler</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-500 dark:text-gray-400">Toplam Katılımcı</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{event.attendees ? event.attendees.length : 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-500 dark:text-gray-400">Katılan</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{event.attendees ? event.attendees.filter(a => a.attended).length : 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-500 dark:text-gray-400">Katılmayan</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{getNonAttendedCount()}</div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-500 dark:text-gray-400">Mazeretli</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{getExcusedCount()}</div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-500 dark:text-gray-400">Katılım Oranı</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{getAttendanceRate()}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Katılımcı Listesi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Katılan Kişiler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {event.attendees && event.attendees.length > 0 ? (
                event.attendees
                  .filter(attendance => {
                    // Sadece katılan kişileri filtrele
                    if (!attendance.attended) return false;
                    
                    // Eğer etkinlikte seçilen konumlar varsa, sadece o konumlardaki temsilcileri göster
                    if (event.selectedLocationTypes && event.selectedLocations) {
                      const attendeeMemberId = getMemberId(attendance);
                      const memberId = String(attendeeMemberId);
                      const memberIdNum = Number(attendeeMemberId);
                      
                      // Önce normal üye mi kontrol et
                      const member = members.find(m => {
                        const mIdStr = String(m.id);
                        const mIdNum = Number(m.id);
                        return mIdStr === memberId || mIdNum === memberIdNum || mIdStr === memberIdNum || mIdNum === memberId;
                      });
                      if (member) return true; // Normal üyeler her zaman gösterilir
                      
                      // Mahalle temsilcisi mi kontrol et
                      const neighborhoodRep = neighborhoodRepresentatives.find(rep => {
                        const repIdStr = String(rep.member_id);
                        const repIdNum = Number(rep.member_id);
                        return repIdStr === memberId || repIdNum === memberIdNum || repIdStr === memberIdNum || repIdNum === memberId;
                      });
                      if (neighborhoodRep) {
                        // Etkinlikte bu mahalle seçilmiş mi kontrol et
                        const selectedNeighborhoodIds = event.selectedLocations.neighborhood || [];
                        return selectedNeighborhoodIds.includes(neighborhoodRep.neighborhood_id) || 
                               selectedNeighborhoodIds.includes(String(neighborhoodRep.neighborhood_id));
                      }
                      
                      // Köy temsilcisi mi kontrol et
                      const villageRep = villageRepresentatives.find(rep => {
                        const repIdStr = String(rep.member_id);
                        const repIdNum = Number(rep.member_id);
                        return repIdStr === memberId || repIdNum === memberIdNum || repIdStr === memberIdNum || repIdNum === memberId;
                      });
                      if (villageRep) {
                        // Etkinlikte bu köy seçilmiş mi kontrol et
                        const selectedVillageIds = event.selectedLocations.village || [];
                        return selectedVillageIds.includes(villageRep.village_id) || 
                               selectedVillageIds.includes(String(villageRep.village_id));
                      }
                      
                      // Mahalle sorumlusu mu kontrol et
                      const neighborhoodSup = neighborhoodSupervisors.find(sup => {
                        const supIdStr = String(sup.member_id);
                        const supIdNum = Number(sup.member_id);
                        return supIdStr === memberId || supIdNum === memberIdNum || supIdStr === memberIdNum || supIdNum === memberId;
                      });
                      if (neighborhoodSup) {
                        // Etkinlikte bu mahalle seçilmiş mi kontrol et
                        const selectedNeighborhoodIds = event.selectedLocations.neighborhood || [];
                        return selectedNeighborhoodIds.includes(neighborhoodSup.neighborhood_id) || 
                               selectedNeighborhoodIds.includes(String(neighborhoodSup.neighborhood_id));
                      }
                      
                      // Köy sorumlusu mu kontrol et
                      const villageSup = villageSupervisors.find(sup => {
                        const supIdStr = String(sup.member_id);
                        const supIdNum = Number(sup.member_id);
                        return supIdStr === memberId || supIdNum === memberIdNum || supIdStr === memberIdNum || supIdNum === memberId;
                      });
                      if (villageSup) {
                        // Etkinlikte bu köy seçilmiş mi kontrol et
                        const selectedVillageIds = event.selectedLocations.village || [];
                        return selectedVillageIds.includes(villageSup.village_id) || 
                               selectedVillageIds.includes(String(villageSup.village_id));
                      }
                      
                      // Temsilci/sorumlu değilse göster (normal üye olabilir)
                      return true;
                    }
                    
                    // Seçilen konumlar yoksa, tüm katılanları göster
                    return true;
                  })
                  .sort((a, b) => {
                    // Handle both string and number memberId values
                    const attendeeMemberIdA = getMemberId(a);
                    const attendeeMemberIdB = getMemberId(b);
                    const memberInfoA = getMemberInfo(attendeeMemberIdA);
                    const memberInfoB = getMemberInfo(attendeeMemberIdB);
                    return memberInfoA.name.localeCompare(memberInfoB.name, 'tr', { sensitivity: 'base' });
                  })
                  .map((attendance) => {
                  // Handle both string and number memberId values
                  const attendeeMemberId = getMemberId(attendance);
                  const memberInfo = getMemberInfo(attendeeMemberId);
                  return (
                    <tr key={attendeeMemberId} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                            <span className="text-green-800 dark:text-green-200 text-xs font-medium">
                              {memberInfo.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {memberInfo.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {memberInfo.position} - {memberInfo.region}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Bu etkinliğe katılımcı eklenmemiş
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-attendees section (#4) */}
      {event.attendees && event.attendees.length > 0 && (() => {
        const nonAttendees = event.attendees
          .filter(a => !a.attended)
          .sort((a, b) => {
            const memberInfoA = getMemberInfo(getMemberId(a));
            const memberInfoB = getMemberInfo(getMemberId(b));
            return memberInfoA.name.localeCompare(memberInfoB.name, 'tr', { sensitivity: 'base' });
          });
        if (nonAttendees.length === 0) return null;
        return (
          <NonAttendeesSection
            nonAttendees={nonAttendees}
            getMemberInfo={getMemberInfo}
          />
        );
      })()}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default EventDetails;
