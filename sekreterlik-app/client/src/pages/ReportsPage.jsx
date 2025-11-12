import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
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
    monthlyEvents: [],
    monthlyMeetings: [],
    monthlyVisits: [],
  });

  useEffect(() => {
    fetchReportsData();
  }, [dateRange.startDate, dateRange.endDate]);

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
        publicInstitutionVisitCounts
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
        ApiService.getAllVisitCounts('public_institution')
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

      // Grafik Verileri - Aylık Etkinlik Grafiği
      const monthlyEventsMap = {};
      filteredEvents.forEach(event => {
        if (event.date) {
          const date = new Date(event.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyEventsMap[monthKey] = (monthlyEventsMap[monthKey] || 0) + 1;
        }
      });
      const monthlyEvents = Object.keys(monthlyEventsMap)
        .sort()
        .map(key => ({
          month: key,
          count: monthlyEventsMap[key]
        }));

      // Aylık Toplantı Grafiği
      const monthlyMeetingsMap = {};
      filteredMeetings.forEach(meeting => {
        if (meeting.date) {
          const date = new Date(meeting.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyMeetingsMap[monthKey] = (monthlyMeetingsMap[monthKey] || 0) + 1;
        }
      });
      const monthlyMeetings = Object.keys(monthlyMeetingsMap)
        .sort()
        .map(key => ({
          month: key,
          count: monthlyMeetingsMap[key]
        }));

      // Aylık Ziyaret Grafiği (Tüm ziyaret türleri)
      const monthlyVisitsMap = {};
      [...neighborhoodVisitCounts, ...villageVisitCounts, ...stkVisitCounts, ...publicInstitutionVisitCounts].forEach(visit => {
        if (visit.last_visit_date || visit.updated_at) {
          const date = new Date(visit.last_visit_date || visit.updated_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyVisitsMap[monthKey] = (monthlyVisitsMap[monthKey] || 0) + (visit.visit_count || 0);
        }
      });
      const monthlyVisits = Object.keys(monthlyVisitsMap)
        .sort()
        .map(key => ({
          month: key,
          count: monthlyVisitsMap[key]
        }));

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
        monthlyEvents,
        monthlyMeetings,
        monthlyVisits,
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
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Raporlar</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Genel istatistikler ve performans metrikleri
            </p>
          </div>
          
          {/* Export Butonları */}
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF İndir
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel İndir
            </button>
          </div>
        </div>

        {/* Tarih Filtreleme */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setDateRange({ startDate: '', endDate: '' })}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Filtreyi Temizle
              </button>
            </div>
          </div>
        </div>

        {/* Genel İstatistikler */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Genel İstatistikler
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>

        {/* Grafikler */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Zaman Bazlı Grafikler
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Aylık Etkinlik Grafiği */}
            {stats.monthlyEvents.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Aylık Etkinlik Sayısı
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.monthlyEvents}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} name="Etkinlik Sayısı" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Aylık Toplantı Grafiği */}
            {stats.monthlyMeetings.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Aylık Toplantı Sayısı
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.monthlyMeetings}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#10B981" name="Toplantı Sayısı" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

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
                    label={({ categoryName, eventCount }) => `${categoryName}: ${eventCount}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="eventCount"
                  >
                    {stats.eventCategoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
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
      </div>
    </div>
  );
};

export default ReportsPage;

