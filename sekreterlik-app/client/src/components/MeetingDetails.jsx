import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import ApiService from '../utils/ApiService';
import NotificationService, { NOTIFICATION_TYPES, TARGET_TYPES } from '../services/NotificationService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { isMobile } from '../utils/capacitorUtils';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';

var RSVP_STYLES = {
  attending: { border: 'border-green-200', bg: 'bg-green-50', title: 'text-green-700', badge: 'bg-green-100 text-green-800', label: 'Katilacak' },
  not_attending: { border: 'border-red-200', bg: 'bg-red-50', title: 'text-red-700', badge: 'bg-red-100 text-red-800', label: 'Katilamayacak' },
  maybe: { border: 'border-amber-200', bg: 'bg-amber-50', title: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', label: 'Belirsiz' }
};

function RsvpPersonList({ rsvpData, members }) {
  var groups = ['attending', 'not_attending', 'maybe'];
  return (
    <div className="mt-4 space-y-3">
      {groups.map(function(status) {
        var style = RSVP_STYLES[status];
        var items = rsvpData.filter(function(r) { return r.status === status; });
        if (items.length === 0) return null;
        return (
          <div key={status} className={'border rounded-lg p-3 ' + style.border + ' ' + style.bg}>
            <div className={'text-sm font-semibold mb-2 ' + style.title}>{style.label} ({items.length})</div>
            <div className="flex flex-wrap gap-2">
              {items.map(function(rsvp) {
                var name = rsvp.userName || rsvp.memberName;
                if (!name && members) {
                  var m = members.find(function(mem) { return String(mem.id) === String(rsvp.userId); });
                  name = m ? m.name : 'Uye';
                }
                return (
                  <span key={rsvp.id} className={'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ' + style.badge}>
                    {name || 'Uye'}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MeetingDetails = ({ meeting }) => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [rsvpData, setRsvpData] = useState([]);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    fetchMembers();
    if (meeting?.id) fetchRsvpData();
  }, [meeting]);

  const fetchRsvpData = async () => {
    if (!meeting?.id) return;
    setRsvpLoading(true);
    try {
      const rsvpQuery = query(
        collection(db, 'meeting_rsvp'),
        where('meetingId', '==', meeting.id)
      );
      const rsvpSnapshot = await getDocs(rsvpQuery);
      setRsvpData(rsvpSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('RSVP data fetch error:', error);
    } finally {
      setRsvpLoading(false);
    }
  };

  // Cevap vermeyenlere hatirlatma bildirimi gonder
  const sendRsvpReminder = async () => {
    if (!meeting?.id) return;
    setSendingReminder(true);
    try {
      // RSVP yapanlarin userId'lerini topla
      const respondedUserIds = new Set(rsvpData.map(r => r.userId));
      // Toplantiya davetli olup cevap vermeyenleri bul
      const allMembers = await ApiService.getMembers();
      const regionMembers = meeting.regions
        ? allMembers.filter(m => m.region && meeting.regions.includes(m.region))
        : allMembers;
      const noResponseMembers = regionMembers.filter(m => !respondedUserIds.has(String(m.id)));

      if (noResponseMembers.length === 0) {
        toast.success('Tum uyeler zaten cevap vermis');
        setSendingReminder(false);
        return;
      }

      // Her cevapsiz uye icin bildirim gonder
      let sentCount = 0;
      for (const member of noResponseMembers) {
        try {
          await NotificationService.createNotification({
            title: `Hatirlatma: ${meeting.name}`,
            body: `${meeting.date} tarihli toplantiya henuz cevap vermediniz. Lutfen katilim durumunuzu bildiriniz.`,
            type: NOTIFICATION_TYPES.MEETING_REMINDER,
            target: { type: TARGET_TYPES.SINGLE, value: String(member.id) },
            url: '/member-dashboard/meetings',
          });
          sentCount++;
        } catch (err) {
          console.error(`Reminder send error for member ${member.id}:`, err);
        }
      }

      toast.success(`${sentCount} kisiye hatirlatma gonderildi`);
    } catch (error) {
      console.error('Send reminder error:', error);
      toast.error('Hatirlatma gonderilirken hata olustu');
    } finally {
      setSendingReminder(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      // In a real implementation, you would fetch members by their IDs from the meeting
      const allMembers = await ApiService.getMembers();
      setMembers(allMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMemberName = (memberId) => {
    if (!memberId) return 'Bilinmeyen Üye';
    // Handle both string and number memberId values
    const memberIdStr = String(memberId);
    const memberIdNum = Number(memberId);
    const member = members.find(m => {
      const mIdStr = String(m.id);
      const mIdNum = Number(m.id);
      return mIdStr === memberIdStr || mIdNum === memberIdNum || mIdStr === memberIdNum || mIdNum === memberIdStr;
    });
    return member ? member.name : 'Bilinmeyen Üye';
  };
  
  const getMember = (memberId) => {
    if (!memberId) return null;
    // Handle both string and number memberId values
    const memberIdStr = String(memberId);
    const memberIdNum = Number(memberId);
    return members.find(m => {
      const mIdStr = String(m.id);
      const mIdNum = Number(m.id);
      return mIdStr === memberIdStr || mIdNum === memberIdNum || mIdStr === memberIdNum || mIdNum === memberIdStr;
    });
  };

  const getAttendanceRate = () => {
    if (!meeting.attendees || meeting.attendees.length === 0) return 0;
    const attendedCount = meeting.attendees.filter(a => a.attended).length;
    return Math.round((attendedCount / meeting.attendees.length) * 100);
  };

  const getExcusedCount = () => {
    if (!meeting.attendees || meeting.attendees.length === 0) return 0;
    return meeting.attendees.filter(a => a.excuse && a.excuse.hasExcuse).length;
  };

  const getNonAttendedCount = () => {
    if (!meeting.attendees || meeting.attendees.length === 0) return 0;
    // Non-attended includes both those who didn't attend and those with excuses
    return meeting.attendees.filter(a => !a.attended).length;
  };
  
  // Function to export meeting details as CSV
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

      // Meeting info
      csvContent += 'Toplantı Bilgileri\n';
      csvContent += 'Alan,Değer\n';
      csvContent += `Toplantı Adı,${meeting.name}\n`;
      csvContent += `Tarih,${meeting.date}\n`;
      csvContent += `Bölgeler,"${meeting.regions ? meeting.regions.join(', ') : 'Belirtilmemiş'}"\n`;
      csvContent += `Toplam Katılımcı,${meeting.attendees ? meeting.attendees.length : 0} kişi\n`;
      csvContent += `Katılan,${meeting.attendees ? meeting.attendees.filter(a => a.attended).length : 0} kişi\n`;
      csvContent += `Katılmayan,${meeting.attendees ? meeting.attendees.filter(a => !a.attended).length : 0} kişi\n`;
      csvContent += `Mazeretli,${getExcusedCount()} kişi\n`;
      csvContent += `Katılım Oranı,${getAttendanceRate()}%\n`;
      csvContent += `Toplantı Notları,"${meeting.notes || 'Not eklenmemiş'}"\n`;
      csvContent += `Oluşturulma Tarihi,${new Date(meeting.created_at).toLocaleDateString('tr-TR')}\n`;
      csvContent += '\n';

      // Participants - detailed information
      csvContent += 'Katılımcı Detayları\n';
      csvContent += 'Üye Adı,TC Kimlik,Görev,Bölge,İlçe,Telefon,E-posta,Katılım Durumu,Mazeret Durumu,Mazeret Sebebi\n';

      if (meeting.attendees && meeting.attendees.length > 0) {
        meeting.attendees.forEach(attendance => {
          // Handle both string and number memberId values
          const attendeeMemberId = attendance.memberId || attendance.member_id;
          const member = getMember(attendeeMemberId);
          const memberName = member ? member.name : 'Bilinmeyen Üye';
          const memberTc = member ? (member.tc || '-') : '-';
          const memberPosition = member ? member.position : '-';
          const memberRegion = member ? member.region : '-';
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
        csvContent += 'Bu toplantıya katılımcı eklenmemiş\n';
      }

      // Create blob and download
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const csvDateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${meeting.name.replace(/\s+/g, '_')}_detaylar_${csvDateStr}.csv`);
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

  // Function to export meeting details as PDF
  const exportToPDF = async () => {
    const confirmed = await confirm({
      message: 'Bu dosya TC kimlik ve telefon numarası gibi hassas kişisel veriler içermektedir. KVKK kapsamında bu verilerin paylaşımından siz sorumlusunuz. Devam etmek istiyor musunuz?',
      title: 'Hassas Veri Uyarısı'
    });
    if (!confirmed) return;

    try {
      const element = document.getElementById('meeting-details-container');
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
        pdf.text('Toplanti Detaylari', margin, margin + 5);
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
      pdf.save(`${meeting.name.replace(/\s+/g, '_')}_detaylar_${dateStr}.pdf`);
      
      toast.success('PDF başarıyla oluşturuldu ve indirildi!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF oluşturulurken bir hata oluştu: ' + error.message);
    }
  };

  return (
    <div id="meeting-details-container" className="space-y-6">
      {/* Export buttons */}
      <div className="flex justify-end space-x-3">
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
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Toplantı Bilgileri</h3>
          <dl className="space-y-3">
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500">Toplantı Adı</dt>
              <dd className="text-sm text-gray-900 font-medium">{meeting.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500">Tarih</dt>
              <dd className="text-sm text-gray-900 font-medium">{meeting.date}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500">Bölgeler</dt>
              <dd className="text-sm text-gray-900 font-medium">
                <div className="flex flex-wrap gap-1">
                  {meeting.regions.map((region, index) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {region}
                    </span>
                  ))}
                </div>
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500">Katılım Oranı</dt>
              <dd className="text-sm text-gray-900 font-medium">
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className={`h-2 rounded-full ${getAttendanceRate() > 70 ? 'bg-green-500' : getAttendanceRate() > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                      style={{ width: `${getAttendanceRate()}%` }}
                    ></div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    %{getAttendanceRate()}
                  </span>
                </div>
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500">Mazeretli</dt>
              <dd className="text-sm text-gray-900 font-medium">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  {getExcusedCount()} kişi
                </span>
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm font-medium text-gray-500">Katılmadı</dt>
              <dd className="text-sm text-gray-900 font-medium">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {getNonAttendedCount()} kişi
                </span>
              </dd>
            </div>
          </dl>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Toplantı Notları</h3>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {meeting.notes || 'Not eklenmemiş.'}
            </p>
          </div>
        </div>
      </div>

      {/* RSVP Ozet Bolumu */}
      {rsvpData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">RSVP Ozeti</h3>
            <button
              onClick={sendRsvpReminder}
              disabled={sendingReminder}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sendingReminder ? (
                <>
                  <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1.5"></span>
                  Gonderiliyor...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Hatirlatma Gonder
                </>
              )}
            </button>
          </div>
          <div className="p-5">
            {rsvpLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
              </div>
            ) : (() => {
              const attending = rsvpData.filter(r => r.status === 'attending').length;
              const notAttending = rsvpData.filter(r => r.status === 'not_attending').length;
              const maybe = rsvpData.filter(r => r.status === 'maybe').length;
              const totalExpected = meeting.attendees ? meeting.attendees.length : 0;
              const noResponse = totalExpected > 0 ? Math.max(0, totalExpected - attending - notAttending - maybe) : 0;
              return (
                <>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-green-600 font-bold text-lg">{attending}</span>
                    <span className="text-green-700 text-sm">Katilacak</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg border border-red-200">
                    <span className="text-red-600 font-bold text-lg">{notAttending}</span>
                    <span className="text-red-700 text-sm">Katilamayacak</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-amber-600 font-bold text-lg">{maybe}</span>
                    <span className="text-amber-700 text-sm">Belirsiz</span>
                  </div>
                  {totalExpected > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-gray-600 font-bold text-lg">{noResponse}</span>
                      <span className="text-gray-700 text-sm">Cevapsiz</span>
                    </div>
                  )}
                </div>
                <RsvpPersonList rsvpData={rsvpData} members={members} />
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">Katılımcılar</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          (() => {
            const mobileView = isMobile();
            const sortedAttendees = meeting.attendees && [...meeting.attendees]
              .sort((a, b) => {
                const attendeeMemberIdA = a.memberId || a.member_id;
                const attendeeMemberIdB = b.memberId || b.member_id;
                const memberA = getMember(attendeeMemberIdA);
                const memberB = getMember(attendeeMemberIdB);
                const nameA = memberA ? memberA.name : 'Bilinmeyen Üye';
                const nameB = memberB ? memberB.name : 'Bilinmeyen Üye';
                return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
              }) || [];

            if (mobileView) {
              // Mobile Card Layout
              return (
                <div className="space-y-2 p-4">
                  {sortedAttendees.map((attendance) => {
                    const attendeeMemberId = attendance.memberId || attendance.member_id;
                    const member = getMember(attendeeMemberId);
                    return (
                      <div key={attendance.memberId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <span className="text-indigo-800 dark:text-indigo-200 text-sm font-medium">
                              {member ? member.name.charAt(0) : '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {member ? member.name : 'Bilinmeyen Üye'}
                            </div>
                            {member && member.position && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                {member.position}
                              </div>
                            )}
                            {member && member.region && (
                              <div className="mb-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                                  {member.region}
                                </span>
                              </div>
                            )}
                            <div className="mb-1">
                              <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${
                                attendance.attended 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                  : (attendance.excuse && attendance.excuse.hasExcuse)
                                    ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              }`}>
                                {attendance.attended 
                                  ? 'Katıldı' 
                                  : (attendance.excuse && attendance.excuse.hasExcuse)
                                    ? 'Mazeretli'
                                    : 'Katılmadı'}
                              </span>
                            </div>
                            {attendance.excuse && attendance.excuse.hasExcuse && (
                              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Mazeret:</span> {attendance.excuse.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Desktop Table Layout
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Üye
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Görev
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Bölge
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Katılım Durumu
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Mazeret
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {sortedAttendees.map((attendance) => {
                      const attendeeMemberId = attendance.memberId || attendance.member_id;
                      const member = getMember(attendeeMemberId);
                      return (
                        <tr key={attendance.memberId} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <span className="text-indigo-800 text-xs font-medium">
                                  {member ? member.name.charAt(0) : '?'}
                                </span>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {member ? member.name : 'Bilinmeyen Üye'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member ? member.position : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {member.region}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              attendance.attended 
                                ? 'bg-green-100 text-green-800' 
                                : (attendance.excuse && attendance.excuse.hasExcuse)
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {attendance.attended 
                                ? 'Katıldı' 
                                : (attendance.excuse && attendance.excuse.hasExcuse)
                                  ? 'Mazeretli'
                                  : 'Katılmadı'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {attendance.excuse && attendance.excuse.hasExcuse ? (
                              <div className="max-w-xs">
                                <span className="text-xs text-gray-600">{attendance.excuse.reason}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Yok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default MeetingDetails;