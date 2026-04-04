import React, { useState, useEffect, useMemo } from 'react';
import ApiService from '../utils/ApiService';
import { isMobile } from '../utils/capacitorUtils';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import {
  DashboardHeader,
  DashboardStatsCards,
  TopRegistrarsTable,
  TopAttendeesTable,
  SystemHealthWidget
} from '../components/Dashboard';
import NativeDashboardExample from '../components/mobile/NativeDashboardExample';
import Modal from '../components/Modal';
import MeetingDetails from '../components/MeetingDetails';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import VisitMap from '../components/VisitMap';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalMeetings: 0,
    totalEvents: 0,
    totalNeighborhoodRepresentatives: 0,
    totalVillageRepresentatives: 0,
    avgAttendanceRate: 0
  });
  
  const [topRegistrars, setTopRegistrars] = useState([]);
  const [topAttendees, setTopAttendees] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [allMeetings, setAllMeetings] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    fetchAllMeetings();
  }, []);

  const fetchAllMeetings = async () => {
    try {
      const data = await ApiService.getMeetings(false);
      setAllMeetings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching meetings for trend:', error);
    }
  };

  // Compute 6-month attendance trend data
  const attendanceTrendData = useMemo(() => {
    const months = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const now = new Date();
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const label = `${months[month]} ${year}`;

      // Find meetings in this month
      const monthMeetings = allMeetings.filter(m => {
        if (!m.date) return false;
        let d;
        if (m.date.includes('.')) {
          const [day, mon, yr] = m.date.split('.');
          d = new Date(yr, parseInt(mon) - 1, day);
        } else if (m.date.includes('T') || m.date.includes('-')) {
          d = new Date(m.date);
        } else {
          d = new Date(m.date);
        }
        return d.getFullYear() === year && d.getMonth() === month;
      });

      let totalRate = 0;
      let validCount = 0;
      monthMeetings.forEach(meeting => {
        if (meeting.attendees && Array.isArray(meeting.attendees) && meeting.attendees.length > 0) {
          const attended = meeting.attendees.filter(a => a.attended === true || a.attended === 1).length;
          const rate = (attended / meeting.attendees.length) * 100;
          totalRate += rate;
          validCount++;
        }
      });

      result.push({
        name: label,
        katilim: validCount > 0 ? Math.round(totalRate / validCount) : 0,
        toplanti: monthMeetings.length
      });
    }

    return result;
  }, [allMeetings]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard data from backend (all calculations done server-side)
      const response = await ApiService.getDashboard();
      
      if (response.success) {
        // Set stats from backend
        setStats(response.stats || {
          totalMembers: 0,
          totalMeetings: 0,
          totalEvents: 0,
          totalNeighborhoodRepresentatives: 0,
          totalVillageRepresentatives: 0,
          avgAttendanceRate: 0
        });
        
        // Set top registrars and attendees from backend
        setTopRegistrars(response.topRegistrars || []);
        setTopAttendees(response.topAttendees || []);
        
        // Set upcoming events and meetings from backend
        setUpcomingEvents(response.upcomingEvents || []);
        setUpcomingMeetings(response.upcomingMeetings || []);
      } else {
        console.error('Dashboard API error:', response.message);
        // Fallback to empty data
        setStats({
          totalMembers: 0,
          totalMeetings: 0,
          totalEvents: 0,
          totalNeighborhoodRepresentatives: 0,
          totalVillageRepresentatives: 0,
          avgAttendanceRate: 0
        });
        setTopRegistrars([]);
        setTopAttendees([]);
        setUpcomingEvents([]);
        setUpcomingMeetings([]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to empty data on error
      setStats({
        totalMembers: 0,
        totalMeetings: 0,
        totalEvents: 0,
        totalNeighborhoodRepresentatives: 0,
        totalVillageRepresentatives: 0,
        avgAttendanceRate: 0
      });
      setTopRegistrars([]);
      setTopAttendees([]);
      setUpcomingEvents([]);
      setUpcomingMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
        <DashboardHeader />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  const handleMeetingClick = async (meeting) => {
    try {
      const meetingDetails = await ApiService.getMeetingById(meeting.id);
      setSelectedMeeting(meetingDetails);
      setIsMeetingModalOpen(true);
    } catch (error) {
      console.error('Error fetching meeting details:', error);
    }
  };

  const handleMemberClick = (member) => {
    if (member?.id) {
      navigate(`/members?memberId=${member.id}`);
    }
  };

  const handleEventClick = (event) => {
    if (event?.id) {
      navigate(`/events?eventId=${event.id}`);
    }
  };

  const mobileView = isMobile();
  
  // Pull-to-refresh for mobile
  const { isRefreshing, pullProgress } = usePullToRefresh(
    fetchDashboardData,
    { disabled: !mobileView }
  );
  
  // Native mobile görünümü için
  if (mobileView) {
    return (
      <>
        {/* Pull-to-refresh indicator */}
        {isRefreshing && (
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-center items-center bg-indigo-600 text-white py-2">
            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Yenileniyor...</span>
          </div>
        )}
        <NativeDashboardExample
          stats={stats}
          topRegistrars={topRegistrars}
          topAttendees={topAttendees}
          upcomingEvents={upcomingEvents}
          upcomingMeetings={upcomingMeetings}
          onMeetingClick={handleMeetingClick}
          onMemberClick={handleMemberClick}
          onEventClick={handleEventClick}
        />
        {/* Mobilde de Ziyaret Haritasi goster */}
        <div className="px-4 pb-24">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Ziyaret Haritasi
              </h3>
              <button
                onClick={() => navigate('/locations')}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Detayli Goruntule
              </button>
            </div>
            <VisitMap height="250px" mini={true} />
          </div>
        </div>
        <Modal
          isOpen={isMeetingModalOpen}
          onClose={() => {
            setIsMeetingModalOpen(false);
            setSelectedMeeting(null);
          }}
          title={selectedMeeting ? selectedMeeting.name : "Toplantı Detayları"}
        >
          {selectedMeeting && (
            <MeetingDetails meeting={selectedMeeting} />
          )}
        </Modal>
      </>
    );
  }

  // Desktop görünümü (mevcut)
  return (
    <div className={`py-2 sm:py-4 md:py-6 w-full overflow-x-hidden lg:pb-6`}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <button
          onClick={() => { fetchDashboardData(); fetchAllMeetings(); }}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Yenile"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Stats Cards - Mobilde tek kolon, desktop'ta çoklu kolon */}
      <DashboardStatsCards stats={stats} />

      {/* System Health - Admin Monitoring */}
      <SystemHealthWidget />

      {/* Mobil: Dikey stack, Desktop: Yatay grid */}
      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6`}>
        {/* Top Registrars */}
        <TopRegistrarsTable topRegistrars={topRegistrars} />

        {/* Top Attendees */}
        <TopAttendeesTable topAttendees={topAttendees} />
      </div>

      {/* Upcoming Events and Meetings - Mobilde tek kolon, desktop'ta çoklu kolon */}
      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-6`}>
        {/* Upcoming Events - Mobilde tam genişlik, desktop'ta yarım */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6`}>
          <h3 className={`text-lg mb-4 font-semibold text-gray-900 dark:text-gray-100`}>Yaklaşan Etkinlikler</h3>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <div key={index} onClick={() => handleEventClick(event)} className={`p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors`}>
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

        {/* Upcoming Meetings - Mobilde tam genişlik, desktop'ta yarım */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6`}>
          <h3 className={`text-lg mb-4 font-semibold text-gray-900 dark:text-gray-100`}>Yaklaşan Toplantılar</h3>
          {upcomingMeetings.length > 0 ? (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting, index) => (
                <div key={index} onClick={() => handleMeetingClick(meeting)} className={`p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors`}>
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

      {/* Üye Performans Özeti */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Performans Özeti
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Ortalama Katılım */}
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className={`text-2xl font-bold ${
              stats.avgAttendanceRate >= 70 ? 'text-green-600 dark:text-green-400' :
              stats.avgAttendanceRate >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              %{stats.avgAttendanceRate || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ort. Katilim</div>
          </div>
          {/* Toplam Üye */}
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalMembers || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplam Uye</div>
          </div>
          {/* Toplantı Sayısı */}
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.totalMeetings || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplanti Sayisi</div>
          </div>
          {/* Etkinlik Sayısı */}
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.totalEvents || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Etkinlik Sayisi</div>
          </div>
        </div>
      </div>

      {/* Son 6 Ay Katilim Trendi */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Son 6 Ay Katilim Trendi
        </h3>
        {attendanceTrendData.some(d => d.toplanti > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={attendanceTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" unit="%" />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'katilim') return [`%${value}`, 'Ort. Katilim'];
                  if (name === 'toplanti') return [value, 'Toplanti Sayisi'];
                  return [value, name];
                }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="katilim"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
                name="katilim"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Son 6 ayda toplanti verisi bulunmuyor
          </div>
        )}
      </div>

      {/* Ziyaret Haritasi Mini Widget */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Ziyaret Haritasi
          </h3>
          <button
            onClick={() => navigate('/locations')}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Detayli Goruntule
          </button>
        </div>
        <VisitMap height="300px" mini={true} />
      </div>
    </div>
  );
};

export default DashboardPage;