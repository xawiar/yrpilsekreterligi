import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { isMobile } from '../utils/capacitorUtils';
import { 
  DashboardHeader, 
  DashboardStatsCards, 
  TopRegistrarsTable, 
  TopAttendeesTable 
} from '../components/Dashboard';
import NativeDashboardExample from '../components/mobile/NativeDashboardExample';
import Modal from '../components/Modal';
import MeetingDetails from '../components/MeetingDetails';
import { useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
  
  // Debug log (production'da kaldırılacak)
  if (typeof window !== 'undefined') {
    console.log('[DEBUG] Dashboard - isMobile:', mobileView, 'window.innerWidth:', window.innerWidth);
  }

  // Native mobile görünümü için
  if (mobileView) {
    return (
      <>
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
      <DashboardHeader />

      {/* Stats Cards - Mobilde tek kolon, desktop'ta çoklu kolon */}
      <DashboardStatsCards stats={stats} />

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
        <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6`}>
          <h3 className={`text-lg mb-4 font-semibold text-gray-900 dark:text-gray-100`}>Yaklaşan Etkinlikler</h3>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <div key={index} className={`p-3 bg-gray-50 dark:bg-gray-700 rounded-lg`}>
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
        <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6`}>
          <h3 className={`text-lg mb-4 font-semibold text-gray-900 dark:text-gray-100`}>Yaklaşan Toplantılar</h3>
          {upcomingMeetings.length > 0 ? (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting, index) => (
                <div key={index} className={`p-3 bg-gray-50 dark:bg-gray-700 rounded-lg`}>
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
  );
};

export default DashboardPage;