import React, { useState, useEffect, useMemo } from 'react';
import ApiService from '../utils/ApiService';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { TopRegistrarsTable, TopAttendeesTable } from '../components/Dashboard';
import { calculateAllMemberScores } from '../utils/performanceScore';
import { useAuth } from '../contexts/AuthContext';
import { isMobile } from '../utils/capacitorUtils';
import NativeCard from '../components/mobile/NativeCard';

const ReportsPage = () => {
  const { user } = useAuth();
  const isAdmin = user && user.role === 'admin';
  const isDistrictPresident = user && user.role === 'district_president';
  const canSetStars = isAdmin || isDistrictPresident;
  
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [savingStars, setSavingStars] = useState({});
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const mobileView = isMobile();
  const [stats, setStats] = useState({
    // Genel İstatistikler
    totalMembers: 0,
    totalMeetings: 0,
    avgMeetingAttendanceRate: 0,
    totalEvents: 0,
    
    // Etkinlik İstatistikleri
    eventCategoryStats: [],
    
    // Mahalle İstatistikleri
    totalNeighborhoods: 0,
    totalNeighborhoodVisits: 0,
    assignedNeighborhoodRepresentatives: 0,
    neighborhoodRepresentativeAttendanceRate: 0,
    
    // Köy İstatistikleri
    totalVillages: 0,
    totalVillageVisits: 0,
    assignedVillageRepresentatives: 0,
    villageRepresentativeAttendanceRate: 0,
    
    // STK İstatistikleri
    totalSTKs: 0,
    totalSTKVisits: 0,
    topSTKs: [],
    
    // Kamu Kurumu İstatistikleri
    totalPublicInstitutions: 0,
    totalPublicInstitutionVisits: 0,
    topPublicInstitutions: [],
    
    // Grafik Verileri
    monthlyEventsAndMeetings: [],
    monthlyVisits: [],
    
    // Dashboard Özellikleri
    topRegistrars: [],
    topAttendees: [],
    upcomingEvents: [],
    upcomingMeetings: [],
    
    // Performans Puanları
    performanceScores: [],
  });

  // Üye arama filtresi - useMemo ile optimize edildi (stats tanımından sonra)
  const filteredScores = useMemo(() => {
    if (!stats.performanceScores || !Array.isArray(stats.performanceScores)) {
      return [];
    }
    return stats.performanceScores.filter(item => {
      if (!memberSearchTerm) return true;
      const searchLower = memberSearchTerm.toLowerCase();
      return (
        item.member?.name?.toLowerCase().includes(searchLower) ||
        item.member?.position?.toLowerCase().includes(searchLower) ||
        item.member?.region?.toLowerCase().includes(searchLower)
      );
    });
  }, [stats.performanceScores, memberSearchTerm]);

  useEffect(() => {
    fetchReportsData();
  }, [dateRange.startDate, dateRange.endDate]);

  const handleSaveStars = async (memberId, stars) => {
    setSavingStars(prev => ({ ...prev, [memberId]: true }));
    try {
      await ApiService.setMemberStars(memberId, stars);
      // Refresh data to show updated stars
      await fetchReportsData();
      alert('Yıldız başarıyla güncellendi');
    } catch (error) {
      console.error('Error saving stars:', error);
      alert('Yıldız güncellenirken hata oluştu: ' + error.message);
    } finally {
      setSavingStars(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      
      // Tüm verileri paralel olarak çek
      const [
        members,
        meetings,
        events,
        eventCategories,
        neighborhoods,
        villages,
        neighborhoodVisitCounts,
        villageVisitCounts,
        neighborhoodRepresentatives,
        villageRepresentatives,
        stks,
        publicInstitutions,
        stkVisitCounts,
        publicInstitutionVisitCounts,
        memberRegistrations
      ] = await Promise.all([
        ApiService.getMembers(),
        ApiService.getMeetings(),
        ApiService.getEvents(),
        ApiService.getEventCategories(),
        ApiService.getNeighborhoods(),
        ApiService.getVillages(),
        ApiService.getAllVisitCounts('neighborhood'),
        ApiService.getAllVisitCounts('village'),
        ApiService.getNeighborhoodRepresentatives(),
        ApiService.getVillageRepresentatives(),
        ApiService.getSTKs(),
        ApiService.getPublicInstitutions(),
        ApiService.getAllVisitCounts('stk'),
        ApiService.getAllVisitCounts('public_institution'),
        ApiService.getMemberRegistrations()
      ]);

      // Tarih filtreleme
      let filteredEvents = events;
      let filteredMeetings = meetings;
      
      if (dateRange.startDate || dateRange.endDate) {
        const startDate = dateRange.startDate ? new Date(dateRange.startDate) : null;
        const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null;
        
        if (startDate || endDate) {
          filteredEvents = events.filter(event => {
            if (!event.date) return false;
            const eventDate = new Date(event.date);
            if (startDate && eventDate < startDate) return false;
            if (endDate && eventDate > endDate) return false;
            return true;
          });
          
          filteredMeetings = meetings.filter(meeting => {
            if (!meeting.date) return false;
            const meetingDate = new Date(meeting.date);
            if (startDate && meetingDate < startDate) return false;
            if (endDate && meetingDate > endDate) return false;
            return true;
          });
        }
      }

      // Genel İstatistikler
      const totalMembers = members.length;
      const totalMeetings = filteredMeetings.length;
      const totalEvents = filteredEvents.length;

      // Ortalama toplantı katılım oranı
      let totalAttendanceRate = 0;
      let validMeetings = 0;
      
      filteredMeetings.forEach(meeting => {
        if (meeting.attendees && meeting.attendees.length > 0) {
          const totalExpected = meeting.attendees.length;
          const attendedCount = meeting.attendees.filter(a => a.attended).length;
          const attendanceRate = (attendedCount / totalExpected) * 100;
          totalAttendanceRate += attendanceRate;
          validMeetings++;
        }
      });
      
      const avgMeetingAttendanceRate = validMeetings > 0 
        ? Math.round(totalAttendanceRate / validMeetings) 
        : 0;

      // Kategori bazında etkinlik istatistikleri
      const eventCategoryStats = eventCategories.map(category => {
        const categoryEvents = filteredEvents.filter(event => 
          event.category_id === category.id || event.categoryId === category.id
        );
        
        // Her etkinlik için katılım sayısı
        let totalAttendance = 0;
        categoryEvents.forEach(event => {
          if (event.attendees && Array.isArray(event.attendees)) {
            const attendedCount = event.attendees.filter(a => a.attended).length;
            totalAttendance += attendedCount;
          }
        });
        
        return {
          categoryId: category.id,
          categoryName: category.name,
          eventCount: categoryEvents.length,
          totalAttendance: totalAttendance
        };
      });

      // Mahalle İstatistikleri
      const totalNeighborhoods = neighborhoods.length;
      
      // Toplam mahalle ziyaret sayısı
      const totalNeighborhoodVisits = neighborhoodVisitCounts.reduce((sum, visit) => 
        sum + (visit.visit_count || 0), 0
      );
      
      // Atanmış mahalle temsilcisi sayısı
      const assignedNeighborhoodRepresentatives = neighborhoodRepresentatives.length;
      
      // Mahalle temsilcilerinin katılım oranı
      let neighborhoodRepTotalRequired = 0;
      let neighborhoodRepTotalAttended = 0;
      
      neighborhoodRepresentatives.forEach(rep => {
        const locationId = rep.neighborhood_id;
        const memberId = String(rep.member_id);
        
        // Katılması gereken ziyaret sayısı
        const visitCount = neighborhoodVisitCounts.find(v => 
          v.neighborhood_id === locationId
        );
        const requiredVisits = visitCount ? (visitCount.visit_count || 0) : 0;
        neighborhoodRepTotalRequired += requiredVisits;
        
        // Katıldığı ziyaret sayısı
        let attendedVisits = 0;
        filteredEvents.forEach(event => {
          if (event.selectedLocationTypes && event.selectedLocations) {
            if (event.selectedLocationTypes.includes('neighborhood')) {
              const locationIds = event.selectedLocations.neighborhood || [];
              if (locationIds.includes(locationId) || locationIds.includes(String(locationId))) {
                if (event.attendees && event.attendees.length > 0) {
                  const attended = event.attendees.find(a => 
                    String(a.memberId) === memberId && a.attended === true
                  );
                  if (attended) {
                    attendedVisits++;
                  }
                }
              }
            }
          }
        });
        neighborhoodRepTotalAttended += attendedVisits;
      });
      
      const neighborhoodRepresentativeAttendanceRate = neighborhoodRepTotalRequired > 0
        ? Math.round((neighborhoodRepTotalAttended / neighborhoodRepTotalRequired) * 100)
        : 0;

      // Köy İstatistikleri
      const totalVillages = villages.length;
      
      // Toplam köy ziyaret sayısı
      const totalVillageVisits = villageVisitCounts.reduce((sum, visit) => 
        sum + (visit.visit_count || 0), 0
      );
      
      // Atanmış köy temsilcisi sayısı
      const assignedVillageRepresentatives = villageRepresentatives.length;
      
      // Köy temsilcilerinin katılım oranı
      let villageRepTotalRequired = 0;
      let villageRepTotalAttended = 0;
      
      villageRepresentatives.forEach(rep => {
        const locationId = rep.village_id;
        const memberId = String(rep.member_id);
        
        // Katılması gereken ziyaret sayısı
        const visitCount = villageVisitCounts.find(v => 
          v.village_id === locationId
        );
        const requiredVisits = visitCount ? (visitCount.visit_count || 0) : 0;
        villageRepTotalRequired += requiredVisits;
        
        // Katıldığı ziyaret sayısı
        let attendedVisits = 0;
        filteredEvents.forEach(event => {
          if (event.selectedLocationTypes && event.selectedLocations) {
            if (event.selectedLocationTypes.includes('village')) {
              const locationIds = event.selectedLocations.village || [];
              if (locationIds.includes(locationId) || locationIds.includes(String(locationId))) {
                if (event.attendees && event.attendees.length > 0) {
                  const attended = event.attendees.find(a => 
                    String(a.memberId) === memberId && a.attended === true
                  );
                  if (attended) {
                    attendedVisits++;
                  }
                }
              }
            }
          }
        });
        villageRepTotalAttended += attendedVisits;
      });
      
      const villageRepresentativeAttendanceRate = villageRepTotalRequired > 0
        ? Math.round((villageRepTotalAttended / villageRepTotalRequired) * 100)
        : 0;

      // STK İstatistikleri
      const totalSTKs = stks.length;
      const totalSTKVisits = stkVisitCounts.reduce((sum, visit) => 
        sum + (visit.visit_count || 0), 0
      );
      
      // En çok ziyaret edilen STK'lar (Top 5)
      const stkVisitMap = {};
      stkVisitCounts.forEach(visit => {
        const stkId = String(visit.stk_id);
        stkVisitMap[stkId] = visit.visit_count || 0;
      });
      
      const topSTKs = stks
        .map(stk => ({
          id: stk.id,
          name: stk.name,
          visitCount: stkVisitMap[String(stk.id)] || stkVisitMap[Number(stk.id)] || 0
        }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 5);

      // Kamu Kurumu İstatistikleri
      const totalPublicInstitutions = publicInstitutions.length;
      const totalPublicInstitutionVisits = publicInstitutionVisitCounts.reduce((sum, visit) => 
        sum + (visit.visit_count || 0), 0
      );
      
      // En çok ziyaret edilen Kamu Kurumları (Top 5)
      const publicInstitutionVisitMap = {};
      publicInstitutionVisitCounts.forEach(visit => {
        const institutionId = String(visit.public_institution_id);
        publicInstitutionVisitMap[institutionId] = visit.visit_count || 0;
      });
      
      const topPublicInstitutions = publicInstitutions
        .map(institution => ({
          id: institution.id,
          name: institution.name,
          visitCount: publicInstitutionVisitMap[String(institution.id)] || publicInstitutionVisitMap[Number(institution.id)] || 0
        }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 5);

      // Grafik Verileri - Aylık Etkinlik ve Toplantı Grafiği (Birleştirilmiş)
      const monthlyEventsMap = {};
      filteredEvents.forEach(event => {
        if (event.date) {
          let date;
          try {
            // Farklı tarih formatlarını handle et
            if (typeof event.date === 'string') {
              if (event.date.includes('T')) {
                date = new Date(event.date);
              } else if (event.date.includes('.')) {
                // DD.MM.YYYY formatı
                const [day, month, year] = event.date.split('.');
                date = new Date(year, month - 1, day);
              } else {
                date = new Date(event.date);
              }
            } else {
              date = new Date(event.date);
            }
            
            // Geçerli tarih kontrolü
            if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              monthlyEventsMap[monthKey] = (monthlyEventsMap[monthKey] || 0) + 1;
            }
          } catch (e) {
            console.warn('Invalid event date:', event.date, e);
          }
        }
      });

      const monthlyMeetingsMap = {};
      filteredMeetings.forEach(meeting => {
        if (meeting.date) {
          let date;
          try {
            // Farklı tarih formatlarını handle et
            if (typeof meeting.date === 'string') {
              if (meeting.date.includes('T')) {
                date = new Date(meeting.date);
              } else if (meeting.date.includes('.')) {
                // DD.MM.YYYY formatı
                const [day, month, year] = meeting.date.split('.');
                date = new Date(year, month - 1, day);
              } else {
                date = new Date(meeting.date);
              }
            } else {
              date = new Date(meeting.date);
            }
            
            // Geçerli tarih kontrolü
            if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              monthlyMeetingsMap[monthKey] = (monthlyMeetingsMap[monthKey] || 0) + 1;
            }
          } catch (e) {
            console.warn('Invalid meeting date:', meeting.date, e);
          }
        }
      });

      // Tüm ayları birleştir ve geçersiz verileri filtrele
      const allMonths = new Set([...Object.keys(monthlyEventsMap), ...Object.keys(monthlyMeetingsMap)]);
      const monthlyEventsAndMeetings = Array.from(allMonths)
        .filter(key => key && !key.includes('NaN') && key.match(/^\d{4}-\d{2}$/)) // Geçerli format kontrolü
        .sort()
        .map(key => ({
          month: key,
          events: monthlyEventsMap[key] || 0,
          meetings: monthlyMeetingsMap[key] || 0
        }));

      // Aylık Ziyaret Grafiği - Etkinliklerden ziyaret tarihlerini çıkar
      const monthlyVisitsMap = {};
      
      // Her etkinlik için ziyaret edilen lokasyonları kontrol et
      filteredEvents.forEach(event => {
        if (event.date && event.selectedLocationTypes && event.selectedLocations) {
          let eventDate;
          try {
            // Tarih parse et
            if (typeof event.date === 'string') {
              if (event.date.includes('T')) {
                eventDate = new Date(event.date);
              } else if (event.date.includes('.')) {
                const [day, month, year] = event.date.split('.');
                eventDate = new Date(year, month - 1, day);
              } else {
                eventDate = new Date(event.date);
              }
            } else {
              eventDate = new Date(event.date);
            }
            
            // Geçerli tarih kontrolü
            if (!isNaN(eventDate.getTime()) && eventDate.getFullYear() > 2000) {
              const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
              
              // Her lokasyon tipi için ziyaret sayısını hesapla
              event.selectedLocationTypes.forEach(locationType => {
                const locations = event.selectedLocations[locationType] || [];
                const visitCount = locations.length;
                if (visitCount > 0) {
                  monthlyVisitsMap[monthKey] = (monthlyVisitsMap[monthKey] || 0) + visitCount;
                }
              });
            }
          } catch (e) {
            console.warn('Invalid event date for visits:', event.date, e);
          }
        }
      });
      
      const monthlyVisits = Object.keys(monthlyVisitsMap)
        .filter(key => key && !key.includes('NaN') && key.match(/^\d{4}-\d{2}$/)) // Geçerli format kontrolü
        .sort()
        .map(key => ({
          month: key,
          count: monthlyVisitsMap[key]
        }));

      // Dashboard Özellikleri - Top Registrars
      const memberRegistrationCounts = {};
      members.forEach(member => {
        memberRegistrationCounts[member.id] = {
          member,
          count: 0
        };
      });
      
      memberRegistrations.forEach(reg => {
        if (memberRegistrationCounts[reg.memberId]) {
          memberRegistrationCounts[reg.memberId].count += reg.count;
        }
      });
      
      const topRegistrars = Object.values(memberRegistrationCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Dashboard Özellikleri - Top Attendees
      const memberAttendanceCounts = {};
      members.forEach(member => {
        memberAttendanceCounts[member.id] = {
          member,
          count: 0
        };
      });
      
      filteredMeetings.forEach(meeting => {
        if (meeting.attendees) {
          meeting.attendees.forEach(attendee => {
            if (attendee.attended) {
              const attendeeMemberId = attendee.memberId || attendee.member_id;
              const memberIdStr = String(attendeeMemberId);
              const memberIdNum = Number(attendeeMemberId);
              
              const matchingMemberId = Object.keys(memberAttendanceCounts).find(id => {
                const idStr = String(id);
                const idNum = Number(id);
                return idStr === memberIdStr || idNum === memberIdNum || idStr === memberIdNum || idNum === memberIdStr;
              });
              
              if (matchingMemberId && memberAttendanceCounts[matchingMemberId]) {
                memberAttendanceCounts[matchingMemberId].count += 1;
              }
            }
          });
        }
      });
      
      const topAttendees = Object.values(memberAttendanceCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Performans Puanları Hesaplama
      const performanceScores = await calculateAllMemberScores(
        members,
        filteredMeetings,
        filteredEvents,
        memberRegistrations,
        {
          includeBonus: true,
          timeRange: 'all',
          weightRecent: false
        }
      );

      // Dashboard Özellikleri - Upcoming Events and Meetings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      const upcomingEventsList = filteredEvents
        .filter(event => {
          if (!event.date || event.archived) return false;
          try {
            let eventDate;
            if (event.date.includes('T')) {
              eventDate = new Date(event.date);
            } else if (event.date.includes('.')) {
              const [day, month, year] = event.date.split('.');
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(event.date);
            }
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today && eventDate <= nextWeek;
          } catch (e) {
            return false;
          }
        })
        .sort((a, b) => {
          try {
            const dateA = a.date.includes('T') ? new Date(a.date) : new Date(a.date.split('.').reverse().join('-'));
            const dateB = b.date.includes('T') ? new Date(b.date) : new Date(b.date.split('.').reverse().join('-'));
            return dateA - dateB;
          } catch (e) {
            return 0;
          }
        })
        .slice(0, 5);
      
      const upcomingMeetingsList = filteredMeetings
        .filter(meeting => {
          if (!meeting.date || meeting.archived) return false;
          try {
            let meetingDate;
            if (meeting.date.includes('T')) {
              meetingDate = new Date(meeting.date);
            } else if (meeting.date.includes('.')) {
              const [day, month, year] = meeting.date.split('.');
              meetingDate = new Date(year, month - 1, day);
            } else {
              meetingDate = new Date(meeting.date);
            }
            meetingDate.setHours(0, 0, 0, 0);
            return meetingDate >= today && meetingDate <= nextWeek;
          } catch (e) {
            return false;
          }
        })
        .sort((a, b) => {
          try {
            const dateA = a.date.includes('T') ? new Date(a.date) : new Date(a.date.split('.').reverse().join('-'));
            const dateB = b.date.includes('T') ? new Date(b.date) : new Date(b.date.split('.').reverse().join('-'));
            return dateA - dateB;
          } catch (e) {
            return 0;
          }
        })
        .slice(0, 5);

      setStats({
        totalMembers,
        totalMeetings,
        avgMeetingAttendanceRate,
        totalEvents,
        eventCategoryStats,
        totalNeighborhoods,
        totalNeighborhoodVisits,
        assignedNeighborhoodRepresentatives,
        neighborhoodRepresentativeAttendanceRate,
        totalVillages,
        totalVillageVisits,
        assignedVillageRepresentatives,
        villageRepresentativeAttendanceRate,
        totalSTKs,
        totalSTKVisits,
        topSTKs,
        totalPublicInstitutions,
        totalPublicInstitutionVisits,
        topPublicInstitutions,
        monthlyEventsAndMeetings,
        monthlyVisits,
        topRegistrars,
        topAttendees,
        upcomingEvents: upcomingEventsList,
        upcomingMeetings: upcomingMeetingsList,
        performanceScores,
      });
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Raporlar - Genel İstatistikler', 14, 22);
    
    doc.setFontSize(12);
    let yPos = 35;
    
    // Genel İstatistikler
    doc.setFontSize(14);
    doc.text('Genel İstatistikler', 14, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.text(`Toplam Üye: ${stats.totalMembers}`, 14, yPos);
    yPos += 7;
    doc.text(`Toplam Toplantı: ${stats.totalMeetings}`, 14, yPos);
    yPos += 7;
    doc.text(`Ortalama Katılım Oranı: ${stats.avgMeetingAttendanceRate}%`, 14, yPos);
    yPos += 7;
    doc.text(`Toplam Etkinlik: ${stats.totalEvents}`, 14, yPos);
    yPos += 10;
    
    // STK İstatistikleri
    doc.setFontSize(14);
    doc.text('STK İstatistikleri', 14, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Toplam STK: ${stats.totalSTKs}`, 14, yPos);
    yPos += 7;
    doc.text(`Toplam STK Ziyaret: ${stats.totalSTKVisits}`, 14, yPos);
    yPos += 10;
    
    // Kamu Kurumu İstatistikleri
    doc.setFontSize(14);
    doc.text('Kamu Kurumu İstatistikleri', 14, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Toplam Kamu Kurumu: ${stats.totalPublicInstitutions}`, 14, yPos);
    yPos += 7;
    doc.text(`Toplam Kamu Kurumu Ziyaret: ${stats.totalPublicInstitutionVisits}`, 14, yPos);
    
    doc.save('raporlar.pdf');
  };

  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Genel İstatistikler
    const generalData = [
      ['Metrik', 'Değer'],
      ['Toplam Üye', stats.totalMembers],
      ['Toplam Toplantı', stats.totalMeetings],
      ['Ortalama Katılım Oranı (%)', stats.avgMeetingAttendanceRate],
      ['Toplam Etkinlik', stats.totalEvents],
    ];
    const generalSheet = XLSX.utils.aoa_to_sheet(generalData);
    XLSX.utils.book_append_sheet(workbook, generalSheet, 'Genel İstatistikler');
    
    // STK İstatistikleri
    const stkData = [
      ['STK Adı', 'Ziyaret Sayısı'],
      ...stats.topSTKs.map(stk => [stk.name, stk.visitCount])
    ];
    const stkSheet = XLSX.utils.aoa_to_sheet(stkData);
    XLSX.utils.book_append_sheet(workbook, stkSheet, 'STK İstatistikleri');
    
    // Kamu Kurumu İstatistikleri
    const publicInstitutionData = [
      ['Kamu Kurumu Adı', 'Ziyaret Sayısı'],
      ...stats.topPublicInstitutions.map(inst => [inst.name, inst.visitCount])
    ];
    const publicInstitutionSheet = XLSX.utils.aoa_to_sheet(publicInstitutionData);
    XLSX.utils.book_append_sheet(workbook, publicInstitutionSheet, 'Kamu Kurumu İstatistikleri');
    
    // Kategori Bazında Etkinlik
    const categoryData = [
      ['Kategori', 'Etkinlik Sayısı', 'Toplam Katılım'],
      ...stats.eventCategoryStats.map(cat => [cat.categoryName, cat.eventCount, cat.totalAttendance])
    ];
    const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'Kategori İstatistikleri');
    
    XLSX.writeFile(workbook, 'raporlar.xlsx');
  };

  const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

  if (loading) {
    return (
      <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Raporlar</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Genel istatistikler ve performans metrikleri
            </p>
          </div>
        </div>

        {/* Tarih Filtreleme - Collapsible */}
        <div className="mb-6">
          <details className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Tarih Filtresi
                {(dateRange.startDate || dateRange.endDate) && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full">
                    Aktif
                  </span>
                )}
              </span>
              <svg className="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setDateRange({ startDate: '', endDate: '' })}
                    className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Temizle
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Genel İstatistikler - Dashboard ile birleştirildi */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Genel İstatistikler
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Üye</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalMembers}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Toplantı</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalMeetings}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ortalama Katılım Oranı</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.avgMeetingAttendanceRate}%
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Etkinlik</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalEvents}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Özellikleri - Top Registrars ve Top Attendees */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-6">
            <TopRegistrarsTable topRegistrars={stats.topRegistrars} />
            <TopAttendeesTable topAttendees={stats.topAttendees} />
          </div>

          {/* Dashboard Özellikleri - Upcoming Events and Meetings */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-6">
            {/* Upcoming Events */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Yaklaşan Etkinlikler</h3>
              {stats.upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {stats.upcomingEvents.map((event, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{event.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {event.date && (
                              <span>
                                {event.date.includes('T') 
                                  ? new Date(event.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : event.date}
                              </span>
                            )}
                          </p>
                          {event.location && (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">📍 {event.location}</p>
                          )}
                        </div>
                        {event.isPlanned && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                            Planlandı
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">Yaklaşan etkinlik bulunmuyor</p>
              )}
            </div>

            {/* Upcoming Meetings */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Yaklaşan Toplantılar</h3>
              {stats.upcomingMeetings.length > 0 ? (
                <div className="space-y-3">
                  {stats.upcomingMeetings.map((meeting, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{meeting.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {meeting.date && (
                              <span>
                                {meeting.date.includes('T') 
                                  ? new Date(meeting.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : meeting.date}
                              </span>
                            )}
                          </p>
                          {meeting.regions && meeting.regions.length > 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                              📍 {meeting.regions.join(', ')}
                            </p>
                          )}
                        </div>
                        {meeting.isPlanned && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                            Planlandı
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">Yaklaşan toplantı bulunmuyor</p>
              )}
            </div>
          </div>
        </div>

        {/* Grafikler */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Zaman Bazlı Grafikler
          </h2>
          {/* Birleştirilmiş Aylık Etkinlik ve Toplantı Grafiği */}
          {stats.monthlyEventsAndMeetings.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Aylık Etkinlik ve Toplantı Sayısı
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.monthlyEventsAndMeetings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="events" stroke="#6366F1" strokeWidth={2} name="Etkinlik Sayısı" />
                  <Line type="monotone" dataKey="meetings" stroke="#10B981" strokeWidth={2} name="Toplantı Sayısı" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Aylık Ziyaret Grafiği */}
          {stats.monthlyVisits.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Aylık Ziyaret Trendi
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.monthlyVisits}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} name="Ziyaret Sayısı" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Kategori Bazında Etkinlik Pasta Grafiği */}
          {stats.eventCategoryStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Kategori Bazında Etkinlik Dağılımı
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.eventCategoryStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.categoryName}: ${entry.eventCount}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="eventCount"
                    nameKey="categoryName"
                  >
                    {stats.eventCategoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} etkinlik`, props.payload.categoryName]} />
                  <Legend formatter={(value, entry) => entry.payload.categoryName} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Etkinlik Kategori İstatistikleri */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Kategori Bazında Etkinlik İstatistikleri
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Etkinlik Sayısı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Toplam Katılım
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {stats.eventCategoryStats.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Henüz kategori bazında etkinlik bulunmamaktadır
                      </td>
                    </tr>
                  ) : (
                    stats.eventCategoryStats.map((category) => (
                      <tr key={category.categoryId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {category.categoryName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {category.eventCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {category.totalAttendance}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Mahalle İstatistikleri */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Mahalle İstatistikleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Mahalle</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalNeighborhoods}
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Ziyaret</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalNeighborhoodVisits}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Atanmış Temsilci</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.assignedNeighborhoodRepresentatives}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Temsilci Katılım Oranı</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.neighborhoodRepresentativeAttendanceRate}%
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Köy İstatistikleri */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Köy İstatistikleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Köy</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalVillages}
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Ziyaret</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalVillageVisits}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Atanmış Temsilci</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.assignedVillageRepresentatives}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Temsilci Katılım Oranı</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.villageRepresentativeAttendanceRate}%
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STK İstatistikleri */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            STK İstatistikleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam STK</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalSTKs}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Ziyaret</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalSTKVisits}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {stats.topSTKs.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                En Çok Ziyaret Edilen STK'lar
              </h3>
              <div className="space-y-3">
                {stats.topSTKs.map((stk, index) => (
                  <div key={stk.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 font-bold mr-3">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{stk.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {stk.visitCount} ziyaret
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Performans Puanları */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Üye Performans Puanları
            </h2>
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
                placeholder="Üye ara (isim, görev, bölge)..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          
          {filteredScores.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stats.performanceScores.length === 0 
                  ? 'Henüz performans puanı hesaplanamadı'
                  : 'Arama kriterlerine uygun üye bulunamadı'}
              </p>
            </div>
          ) : mobileView ? (
            // Mobilde kart görünümü
            <div className="space-y-3">
                  {filteredScores.map((item, index) => (
                    <NativeCard key={item.member.id}>
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                          index === 1 ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                          index === 2 ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' :
                          'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                            {item.member.name}
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ 
                                backgroundColor: `${item.levelColor}20`,
                                color: item.levelColor,
                                border: `1px solid ${item.levelColor}40`
                              }}
                            >
                              {item.level}
                            </span>
                            <div className="flex items-center space-x-0.5">
                              {canSetStars ? (
                                [...Array(5)].map((_, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleSaveStars(item.member.id, i + 1)}
                                    disabled={savingStars[item.member.id]}
                                    className={`text-lg ${i < (item.member.manualStars || 0) ? 'text-yellow-400' : 'text-gray-300'} disabled:opacity-50`}
                                  >
                                    ★
                                  </button>
                                ))
                              ) : (
                                [...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={`text-sm ${i < (item.member.manualStars || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                                  >
                                    ★
                                  </span>
                                ))
                              )}
                            </div>
                            {canSetStars && (
                              <button
                                onClick={() => handleSaveStars(item.member.id, null)}
                                disabled={savingStars[item.member.id]}
                                className="ml-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                                title="Yıldızı temizle"
                              >
                                Temizle
                              </button>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            Toplam Puan: {item.totalScore}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            <div>📅 Toplantı: {item.details.meetingAttendance} (+{item.details.breakdown.meetingPoints})</div>
                            <div>🎉 Etkinlik: {item.details.eventAttendance} (+{item.details.breakdown.eventPoints})</div>
                            {item.details.meetingAbsence > 0 && (
                              <div className="text-red-600 dark:text-red-400">
                                ❌ Mazeretsiz: {item.details.meetingAbsence} ({item.details.breakdown.absencePenalty})
                              </div>
                            )}
                            {item.details.memberRegistrations > 0 && (
                              <div>👥 Kayıt: {item.details.memberRegistrations} (+{item.details.breakdown.registrationPoints})</div>
                            )}
                            {item.details.breakdown.bonusPoints > 0 && (
                              <div className="text-green-600 dark:text-green-400">
                                ⭐ Bonus: +{item.details.breakdown.bonusPoints}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </NativeCard>
                  ))}
                </div>
          ) : (
            // Desktop table görünümü
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Sıra
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Üye Adı
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Seviye
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Toplam Puan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Detaylar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredScores.map((item, index) => (
                        <tr key={item.member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                              index === 0 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                              index === 1 ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                              index === 2 ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' :
                              'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {item.member.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span 
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                                style={{ 
                                  backgroundColor: `${item.levelColor}20`,
                                  color: item.levelColor,
                                  border: `1px solid ${item.levelColor}40`
                                }}
                              >
                                {item.level}
                              </span>
                              <div className="flex items-center space-x-0.5">
                                {canSetStars ? (
                                  // Admin/District President için tıklanabilir yıldızlar
                                  [...Array(5)].map((_, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleSaveStars(item.member.id, i + 1)}
                                    disabled={savingStars[item.member.id]}
                                    className={`p-0.5 rounded transition-colors duration-200 ${
                                      i < item.stars 
                                        ? 'text-yellow-400 hover:text-yellow-500' 
                                        : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title={`${i + 1} yıldız ver`}
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </button>
                                ))
                              ) : (
                                // Normal kullanıcılar için sadece görüntüleme
                                [...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-4 h-4 ${i < item.stars ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))
                              )}
                            </div>
                            {canSetStars && (
                              <button
                                onClick={() => handleSaveStars(item.member.id, null)}
                                disabled={savingStars[item.member.id]}
                                className="ml-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                                title="Yıldızı temizle"
                              >
                                Temizle
                              </button>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({item.percentage}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {item.totalScore}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="space-y-1">
                            <div>📅 Toplantı: {item.details.meetingAttendance} (+{item.details.breakdown.meetingPoints})</div>
                            <div>🎉 Etkinlik: {item.details.eventAttendance} (+{item.details.breakdown.eventPoints})</div>
                            {item.details.meetingAbsence > 0 && (
                              <div className="text-red-600 dark:text-red-400">
                                ❌ Mazeretsiz: {item.details.meetingAbsence} ({item.details.breakdown.absencePenalty})
                              </div>
                            )}
                            {item.details.memberRegistrations > 0 && (
                              <div>👥 Kayıt: {item.details.memberRegistrations} (+{item.details.breakdown.registrationPoints})</div>
                            )}
                            {item.details.breakdown.bonusPoints > 0 && (
                              <div className="text-green-600 dark:text-green-400 space-y-0.5">
                                {item.details.bonuses.perfectMeetingAttendance > 0 && (
                                  <div>⭐ Toplantı Bonus: {item.details.bonuses.perfectMeetingMonths} ay × 50 = +{item.details.bonuses.perfectMeetingAttendance}</div>
                                )}
                                {item.details.bonuses.perfectEventAttendance > 0 && (
                                  <div>⭐ Etkinlik Bonus: {item.details.bonuses.perfectEventMonths} ay × 50 = +{item.details.bonuses.perfectEventAttendance}</div>
                                )}
                                <div className="font-semibold">Toplam Bonus: +{item.details.breakdown.bonusPoints}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>

        {/* Kamu Kurumu İstatistikleri */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Kamu Kurumu İstatistikleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Kamu Kurumu</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalPublicInstitutions}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Ziyaret</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalPublicInstitutionVisits}
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {stats.topPublicInstitutions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                En Çok Ziyaret Edilen Kamu Kurumları
              </h3>
              <div className="space-y-3">
                {stats.topPublicInstitutions.map((institution, index) => (
                  <div key={institution.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold mr-3">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{institution.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {institution.visitCount} ziyaret
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Export Butonları - En Alta */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center justify-center px-3 py-2 bg-red-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF İndir
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center px-3 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel İndir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

