import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../utils/ApiService';
import { isMobile } from '../utils/capacitorUtils';
import NativeMemberDashboard from '../components/mobile/NativeMemberDashboard';
import MemberDetails from '../components/MemberDetails';
import { calculateMeetingStats } from '../components/Members/membersUtils';
import SettingsPage from './SettingsPage';
import EventsPage from './EventsPage';
import BallotBoxesPage from './BallotBoxesPage';
import ObserversPage from './ObserversPage';
import MemberForm from '../components/MemberForm';
import CreateMeetingForm from '../components/CreateMeetingForm';
import MembersPage from './MembersPage';
import MeetingsPage from './MeetingsPage';
import CalendarPage from './CalendarPage';
import DistrictsPage from './DistrictsPage';
import ArchivePage from './ArchivePage';
import ManagementChartPage from './ManagementChartPage';
import ElectionPreparationPage from './ElectionPreparationPage';
import RepresentativesPage from './RepresentativesPage';
import NeighborhoodsPage from './NeighborhoodsPage';
import VillagesPage from './VillagesPage';
import GroupsPage from './GroupsPage';
import Footer from '../components/Footer';
import PollVotingComponent from '../components/PollVotingComponent';
import PollResultsComponent from '../components/PollResultsComponent';
import Modal from '../components/Modal';
import MobileBottomNav from '../components/MobileBottomNav';
import BranchManagementSection from '../components/BranchManagementSection';

const MemberDashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [events, setEvents] = useState([]);
  const [memberRegistrations, setMemberRegistrations] = useState([]);
  const [polls, setPolls] = useState([]);
  const [pollResults, setPollResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'stk-management', 'stk-events', 'public-institution-management', 'ballot-boxes', 'observers', 'members-page', 'meetings-page', 'calendar-page', 'districts-page', 'events-page', 'archive-page', 'management-chart-page', 'election-preparation-page', 'representatives-page', 'neighborhoods-page', 'villages-page', 'groups-page'
  const [grantedPermissions, setGrantedPermissions] = useState([]);

  // View-permission mapping: Her view için hangi permission gerektiğini tanımla
  const viewPermissionMap = {
    'dashboard': ['access_dashboard'], // Dashboard her zaman erişilebilir
    'stk-management': ['manage_stk', 'add_stk'],
    'stk-events': ['create_event'],
    'public-institution-management': ['add_public_institution'],
    'add-member': ['add_member'],
    'create-meeting': ['create_meeting'],
    'ballot-boxes': ['access_ballot_boxes', 'add_ballot_box'],
    'observers': ['access_observers', 'add_observer'],
    'members-page': ['access_members_page'],
    'meetings-page': ['access_meetings_page'],
    'events-page': ['access_events_page'],
    'calendar-page': ['access_calendar_page'],
    'districts-page': ['access_districts_page'],
    'archive-page': ['access_archive_page'],
    'management-chart-page': ['access_management_chart_page'],
    'election-preparation-page': ['access_election_preparation_page'],
    'representatives-page': ['access_representatives_page'],
    'neighborhoods-page': ['access_neighborhoods_page'],
    'villages-page': ['access_villages_page'],
    'groups-page': ['access_groups_page'],
  };

  // Yetki kontrolü yapan wrapper fonksiyon
  const setViewWithPermission = React.useCallback((view) => {
    // Dashboard her zaman erişilebilir
    if (view === 'dashboard') {
      setCurrentView('dashboard');
      return;
    }

    // View için gerekli permission'ları kontrol et
    const requiredPermissions = viewPermissionMap[view] || [];
    
    // Eğer permission tanımlı değilse, erişime izin ver (geriye dönük uyumluluk)
    if (requiredPermissions.length === 0) {
      console.warn(`View '${view}' için permission tanımı bulunamadı`);
      setCurrentView(view);
      return;
    }

    // Kullanıcının en az bir permission'ı var mı kontrol et
    const hasPermission = requiredPermissions.some(perm => 
      grantedPermissions.includes(perm)
    );

    if (hasPermission) {
      setCurrentView(view);
    } else {
      // Yetki yoksa dashboard'a dön ve uyarı göster
      console.warn(`Kullanıcının '${view}' view'ine erişim yetkisi yok`);
      setCurrentView('dashboard');
      setError(`Bu sayfaya erişim yetkiniz bulunmamaktadır.`);
      // 3 saniye sonra hatayı temizle
      setTimeout(() => setError(''), 3000);
    }
  }, [grantedPermissions]);

  // Helper fonksiyon: View için yetki kontrolü
  const hasViewPermission = React.useCallback((view) => {
    // Dashboard her zaman erişilebilir
    if (view === 'dashboard') {
      return true;
    }

    // View için gerekli permission'ları kontrol et
    const requiredPermissions = viewPermissionMap[view] || [];
    
    // Eğer permission tanımlı değilse, erişime izin ver (geriye dönük uyumluluk)
    if (requiredPermissions.length === 0) {
      console.warn(`View '${view}' için permission tanımı bulunamadı`);
      return true;
    }

    // Kullanıcının en az bir permission'ı var mı kontrol et
    return requiredPermissions.some(perm => 
      grantedPermissions.includes(perm)
    );
  }, [grantedPermissions]);

  const [regions, setRegions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [isWomenBranchPresident, setIsWomenBranchPresident] = useState(false);
  const [isYouthBranchPresident, setIsYouthBranchPresident] = useState(false);
  const [womenBranchManagement, setWomenBranchManagement] = useState([]);
  const [youthBranchManagement, setYouthBranchManagement] = useState([]);
  
  // Analytics tracking
  const sessionIdRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const pageViewsRef = useRef(0);

  useEffect(() => {
    if (user && user.role === 'member') {
      fetchMemberData();
      startAnalyticsSession();
    }
    
    // Cleanup: End session when component unmounts
    return () => {
      endAnalyticsSession();
    };
  }, [user]);

  // Listen for mobile quick actions
  useEffect(() => {
    const handleQuickAction = (event) => {
      const { action } = event.detail;
      switch (action) {
        case 'add-member':
          setViewWithPermission('add-member');
          break;
        case 'create-meeting':
          setViewWithPermission('create-meeting');
          break;
        case 'add-stk':
          setViewWithPermission('stk-management');
          break;
        case 'add-public-institution':
          setViewWithPermission('public-institution-management');
          break;
        default:
          break;
      }
    };

    window.addEventListener('memberQuickAction', handleQuickAction);
    return () => {
      window.removeEventListener('memberQuickAction', handleQuickAction);
    };
  }, []);

  // Track page views
  useEffect(() => {
    if (user && user.role === 'member' && sessionIdRef.current) {
      pageViewsRef.current += 1;
      updateAnalyticsSession();
    }
  }, [currentView]);


  // Start analytics session
  const startAnalyticsSession = async () => {
    try {
      const memberId = user?.memberId || user?.id;
      if (!memberId) return;
      
      const response = await ApiService.startAnalyticsSession(memberId);
      if (response.success && response.session) {
        sessionIdRef.current = response.session.id;
        sessionStartTimeRef.current = new Date();
        pageViewsRef.current = 1;
      }
    } catch (error) {
      console.error('Error starting analytics session:', error);
    }
  };

  // Update analytics session
  const updateAnalyticsSession = async () => {
    if (!sessionIdRef.current) return;
    
    try {
      const now = new Date();
      const durationSeconds = sessionStartTimeRef.current 
        ? Math.floor((now - sessionStartTimeRef.current) / 1000)
        : 0;
      
      await ApiService.updateAnalyticsSession(sessionIdRef.current, {
        sessionEnd: null, // Still active
        durationSeconds,
        pageViews: pageViewsRef.current
      });
    } catch (error) {
      console.error('Error updating analytics session:', error);
    }
  };

  // End analytics session
  const endAnalyticsSession = async () => {
    if (!sessionIdRef.current || !sessionStartTimeRef.current) return;
    
    try {
      const now = new Date();
      const durationSeconds = Math.floor((now - sessionStartTimeRef.current) / 1000);
      
      await ApiService.updateAnalyticsSession(sessionIdRef.current, {
        sessionEnd: now.toISOString(),
        durationSeconds,
        pageViews: pageViewsRef.current
      });
      
      sessionIdRef.current = null;
      sessionStartTimeRef.current = null;
      pageViewsRef.current = 0;
    } catch (error) {
      console.error('Error ending analytics session:', error);
    }
  };

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      
      // Get member ID - use memberId if available, otherwise use user.id
      const memberId = user.memberId || user.id;
      
      if (!memberId) {
        console.error('Member ID not found in user data:', user);
        setError('Üye bilgisi bulunamadı');
        setLoading(false);
        return;
      }
      
      // Fetch member details
      const memberResponse = await ApiService.getMemberById(memberId);
      setMember(memberResponse);
      
      // Fetch all members for management chart
      const membersResponse = await ApiService.getMembers();
      setMembers(membersResponse);
      
      // Fetch meetings
      const meetingsResponse = await ApiService.getMeetings();
      setMeetings(meetingsResponse);
      
      // Fetch events
      const eventsResponse = await ApiService.getEvents();
      setEvents(eventsResponse);
      
      // Fetch member registrations
      const registrationsResponse = await ApiService.getMemberRegistrations();
      setMemberRegistrations(registrationsResponse);

      // Fetch all polls (active and ended)
      try {
        const allPolls = await ApiService.getPolls('all');
        setPolls(allPolls || []);
        
        // Fetch results for ended polls
        const endedPolls = (allPolls || []).filter(p => {
          const endDate = new Date(p.endDate);
          return endDate <= new Date() || p.status !== 'active';
        });
        
        const resultsMap = {};
        for (const poll of endedPolls) {
          try {
            const results = await ApiService.getPollResults(poll.id);
            resultsMap[poll.id] = results;
          } catch (err) {
            console.error('Error fetching poll results:', err);
          }
        }
        setPollResults(resultsMap);
      } catch (err) {
        console.error('Error fetching polls:', err);
        setPolls([]);
      }


      // Fetch regions/positions for forms
      try {
        const [regionsRes, positionsRes] = await Promise.all([
          ApiService.getRegions(),
          ApiService.getPositions()
        ]);
        setRegions(Array.isArray(regionsRes) ? regionsRes : []);
        setPositions(Array.isArray(positionsRes) ? positionsRes : []);
      } catch (_) {}

      // load position-based permissions
      try {
        const perms = await ApiService.getPermissionsForPosition(memberResponse.position);
        setGrantedPermissions(Array.isArray(perms) ? perms : []);
      } catch (_) {
        setGrantedPermissions([]);
      }

      // Check if member is a Women's Branch President
      try {
        const womenPresidents = await ApiService.getWomenBranchPresidents();
        const isWomenPresident = womenPresidents.some(
          p => String(p.member_id) === String(memberId) && p.region === memberResponse.region
        );
        setIsWomenBranchPresident(isWomenPresident);
        
        if (isWomenPresident) {
          const womenManagement = await ApiService.getWomenBranchManagement(memberId);
          setWomenBranchManagement(womenManagement || []);
        }
      } catch (error) {
        console.error('Error checking women branch president:', error);
        setIsWomenBranchPresident(false);
      }

      // Check if member is a Youth Branch President
      try {
        const youthPresidents = await ApiService.getYouthBranchPresidents();
        const isYouthPresident = youthPresidents.some(
          p => String(p.member_id) === String(memberId) && p.region === memberResponse.region
        );
        setIsYouthBranchPresident(isYouthPresident);
        
        if (isYouthPresident) {
          const youthManagement = await ApiService.getYouthBranchManagement(memberId);
          setYouthBranchManagement(youthManagement || []);
        }
      } catch (error) {
        console.error('Error checking youth branch president:', error);
        setIsYouthBranchPresident(false);
      }
      
    } catch (error) {
      console.error('Error fetching member data:', error);
      setError('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 font-medium">Kişisel bilgileriniz yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Hata Oluştu</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Üye Bulunamadı</h2>
          <p className="text-gray-600 dark:text-gray-400">Üye bilgileri bulunamadı</p>
        </div>
      </div>
    );
  }

  // STK Management view
  if (currentView === 'stk-management') {
    // Yetki kontrolü
    if (!hasViewPermission('stk-management')) {
      setViewWithPermission('dashboard');
      return null;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">STK Yönetimi</h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">STK ekleme, düzenleme ve silme işlemleri</p>
                </div>
                <button
                  onClick={() => setViewWithPermission('dashboard')}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Geri Dön
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <SettingsPage tab="stks" />
        </div>
      </div>
    );
  }

  // Public Institution Management view
  if (currentView === 'public-institution-management') {
    if (!hasViewPermission('public-institution-management')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kamu Kurumu Yönetimi</h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Kamu kurumu ekleme, düzenleme ve silme işlemleri</p>
                </div>
                <button
                  onClick={() => setViewWithPermission('dashboard')}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Dashboard'a Dön
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <SettingsPage tab="public-institutions" />
        </div>
      </div>
    );
  }

  // STK Events view
  if (currentView === 'stk-events') {
    if (!hasViewPermission('stk-events')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Etkinlik Yönetimi</h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Etkinlik oluşturma ve yönetimi</p>
                </div>
                <button
                  onClick={() => setViewWithPermission('dashboard')}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Geri Dön
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <EventsPage />
        </div>
      </div>
    );
  }

  // Add Member view
  if (currentView === 'add-member') {
    if (!hasViewPermission('add-member')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Üye Ekle</h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Yeni üye kaydı oluşturun</p>
                </div>
                <button
                  onClick={() => setViewWithPermission('dashboard')}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Geri Dön
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
            <MemberForm
              regions={regions.map(r => r.name)}
              positions={positions.map(p => p.name)}
              onClose={() => setViewWithPermission('dashboard')}
              onMemberSaved={() => setViewWithPermission('dashboard')}
            />
          </div>
        </div>
      </div>
    );
  }

  // Create Meeting view
  if (currentView === 'create-meeting') {
    if (!hasViewPermission('create-meeting')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Toplantı Oluştur</h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Seçili bölgelere toplantı planlayın</p>
                </div>
                <button
                  onClick={() => setViewWithPermission('dashboard')}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Geri Dön
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
            <CreateMeetingForm
              regions={regions}
              onClose={() => setViewWithPermission('dashboard')}
              onMeetingCreated={() => setViewWithPermission('dashboard')}
            />
          </div>
        </div>
      </div>
    );
  }

  // Embedded Pages via permissions
  if (currentView === 'members-page') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Üyeler</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <MembersPage />
        </div>
      </div>
    );
  }
  if (currentView === 'meetings-page') {
    if (!hasViewPermission('meetings-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Toplantılar</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <MeetingsPage />
        </div>
      </div>
    );
  }
  if (currentView === 'calendar-page') {
    if (!hasViewPermission('calendar-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Takvim</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <CalendarPage />
        </div>
      </div>
    );
  }
  if (currentView === 'districts-page') {
    if (!hasViewPermission('districts-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">İlçeler</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <DistrictsPage />
        </div>
      </div>
    );
  }
  if (currentView === 'events-page') {
    if (!hasViewPermission('events-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Etkinlikler</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <EventsPage />
        </div>
      </div>
    );
  }
  if (currentView === 'archive-page') {
    if (!hasViewPermission('archive-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Arşiv</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ArchivePage />
        </div>
      </div>
    );
  }
  if (currentView === 'management-chart-page') {
    if (!hasViewPermission('management-chart-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yönetim Şeması</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ManagementChartPage />
        </div>
      </div>
    );
  }
  if (currentView === 'election-preparation-page') {
    if (!hasViewPermission('election-preparation-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seçim Hazırlık</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ElectionPreparationPage />
        </div>
      </div>
    );
  }
  if (currentView === 'representatives-page') {
    if (!hasViewPermission('representatives-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Temsilciler</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <RepresentativesPage />
        </div>
      </div>
    );
  }
  if (currentView === 'neighborhoods-page') {
    if (!hasViewPermission('neighborhoods-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahalleler</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <NeighborhoodsPage />
        </div>
      </div>
    );
  }
  if (currentView === 'villages-page') {
    if (!hasViewPermission('villages-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Köyler</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <VillagesPage />
        </div>
      </div>
    );
  }
  if (currentView === 'groups-page') {
    if (!hasViewPermission('groups-page')) {
      setViewWithPermission('dashboard');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gruplar</h1>
              <button onClick={() => setViewWithPermission('dashboard')} className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600">Geri Dön</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <GroupsPage />
        </div>
      </div>
    );
  }

  // Default dashboard view
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6 lg:py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Hoş Geldiniz, {member.name}
                  </h1>
                  <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 mt-1">
                    {member.position} - {member.region}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Kullanıcı Adı</p>
                  <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">{user.username}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                >
                  <svg className="-ml-1 mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Çıkış Yap</span>
                  <span className="sm:hidden">Çıkış</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8">
        {/* View Navigation */}
        {currentView !== 'dashboard' && (
          <div className="mb-6">
            <button
              onClick={() => setViewWithPermission('dashboard')}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard'a Dön
            </button>
          </div>
        )}

        {/* Render different views - Bu bölüm kaldırıldı, çünkü early return kullanılıyor */}
        

        {currentView === 'dashboard' && (
        <>
          {isMobile() ? (
            <NativeMemberDashboard
              member={member}
              user={user}
              grantedPermissions={grantedPermissions}
              onViewChange={setViewWithPermission}
              onLogout={handleLogout}
              polls={polls}
              pollResults={pollResults}
              PollVotingComponent={PollVotingComponent}
              PollResultsComponent={PollResultsComponent}
              isWomenBranchPresident={isWomenBranchPresident}
              isYouthBranchPresident={isYouthBranchPresident}
              womenBranchManagement={womenBranchManagement}
              youthBranchManagement={youthBranchManagement}
              BranchManagementSection={BranchManagementSection}
              loading={loading}
            />
          ) : (
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
          {/* Welcome Card */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 lg:p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-10"></div>
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Kişisel Dashboard</h2>
                  <p className="text-indigo-100 text-xs sm:text-sm md:text-base lg:text-lg">
                    Bu sayfada sadece sizin bilgileriniz ve katılım durumunuz görüntülenmektedir.
                  </p>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 bg-white bg-opacity-10 rounded-full -translate-y-8 sm:-translate-y-12 lg:-translate-y-16 translate-x-8 sm:translate-x-12 lg:translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 bg-white bg-opacity-10 rounded-full translate-y-6 sm:translate-y-8 lg:translate-y-12 -translate-x-6 sm:-translate-x-8 lg:-translate-x-12"></div>
          </div>

          {/* Eski dağınık bölümler kaldırıldı - Tüm yetkiler Hızlı İşlemler'de */}

          {/* Hızlı İşlemler - Tüm yetkiler tek bir bölümde */}
          {(grantedPermissions.includes('add_member') || 
            grantedPermissions.includes('create_meeting') || 
            grantedPermissions.includes('add_stk') || 
            grantedPermissions.includes('manage_stk') ||
            grantedPermissions.includes('add_public_institution') ||
            grantedPermissions.includes('create_event') ||
            grantedPermissions.includes('add_ballot_box') ||
            grantedPermissions.includes('add_observer') ||
            grantedPermissions.includes('access_ballot_boxes') ||
            grantedPermissions.includes('access_observers') ||
            grantedPermissions.includes('access_members_page') ||
            grantedPermissions.includes('access_meetings_page') ||
            grantedPermissions.includes('access_events_page') ||
            grantedPermissions.includes('access_calendar_page') ||
            grantedPermissions.includes('access_districts_page') ||
            grantedPermissions.includes('access_archive_page') ||
            grantedPermissions.includes('access_management_chart_page') ||
            grantedPermissions.includes('access_election_preparation_page') ||
            grantedPermissions.includes('access_representatives_page') ||
            grantedPermissions.includes('access_neighborhoods_page') ||
            grantedPermissions.includes('access_villages_page') ||
            grantedPermissions.includes('access_groups_page')) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Hızlı İşlemler
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">Yetkilendirildiğiniz işlemler ve sayfalar</p>
              </div>
              <div className="p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                  {grantedPermissions.includes('add_member') && (
                    <button
                      onClick={() => setViewWithPermission('add-member')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg sm:rounded-xl border border-teal-200 dark:border-teal-700 hover:from-teal-100 hover:to-teal-200 dark:hover:from-teal-800 dark:hover:to-teal-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-teal-500 dark:bg-teal-600 rounded-lg flex items-center justify-center group-hover:bg-teal-600 dark:group-hover:bg-teal-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3M9 7a4 4 0 100 8 4 4 0 000-8z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-teal-700 dark:group-hover:text-teal-400">Üye Ekle</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni üye kaydı oluştur</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('create_meeting') && (
                    <button
                      onClick={() => setViewWithPermission('create-meeting')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg sm:rounded-xl border border-purple-200 dark:border-purple-700 hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800 dark:hover:to-purple-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 dark:bg-purple-600 rounded-lg flex items-center justify-center group-hover:bg-purple-600 dark:group-hover:bg-purple-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400">Toplantı Oluştur</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Bölgelere toplantı planla</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {(grantedPermissions.includes('add_stk') || grantedPermissions.includes('manage_stk')) && (
                    <button
                      onClick={() => setViewWithPermission('stk-management')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800 rounded-lg sm:rounded-xl border border-emerald-200 dark:border-emerald-700 hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-800 dark:hover:to-emerald-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 dark:bg-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 dark:group-hover:bg-emerald-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">STK Ekle</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni STK kaydı oluştur</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('add_public_institution') && (
                    <button
                      onClick={() => setViewWithPermission('public-institution-management')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg sm:rounded-xl border border-blue-200 dark:border-blue-700 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800 dark:hover:to-blue-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 dark:group-hover:bg-blue-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">Kamu Kurumu Ekle</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni kamu kurumu kaydı oluştur</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('create_event') && (
                    <button
                      onClick={() => setViewWithPermission('stk-events')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 rounded-lg sm:rounded-xl border border-indigo-200 dark:border-indigo-700 hover:from-indigo-100 hover:to-indigo-200 dark:hover:from-indigo-800 dark:hover:to-indigo-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-500 dark:bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 dark:group-hover:bg-indigo-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">Etkinlik Oluştur</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni etkinlik planla</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {(grantedPermissions.includes('access_ballot_boxes') || grantedPermissions.includes('add_ballot_box')) && (
                    <button
                      onClick={() => setViewWithPermission('ballot-boxes')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-lg sm:rounded-xl border border-orange-200 dark:border-orange-700 hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-800 dark:hover:to-orange-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 dark:bg-orange-600 rounded-lg flex items-center justify-center group-hover:bg-orange-600 dark:group-hover:bg-orange-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-orange-700 dark:group-hover:text-orange-400">Sandıklar</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Sandık yönetimi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {(grantedPermissions.includes('access_observers') || grantedPermissions.includes('add_observer')) && (
                    <button
                      onClick={() => setViewWithPermission('observers')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900 dark:to-pink-800 rounded-lg sm:rounded-xl border border-pink-200 dark:border-pink-700 hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-800 dark:hover:to-pink-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-pink-500 dark:bg-pink-600 rounded-lg flex items-center justify-center group-hover:bg-pink-600 dark:group-hover:bg-pink-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-pink-700 dark:group-hover:text-pink-400">Müşahitler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Müşahit yönetimi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_election_preparation_page') && (
                    <button
                      onClick={() => setViewWithPermission('election-preparation-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 rounded-lg sm:rounded-xl border border-red-200 dark:border-red-700 hover:from-red-100 hover:to-red-200 dark:hover:from-red-800 dark:hover:to-red-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 dark:bg-red-600 rounded-lg flex items-center justify-center group-hover:bg-red-600 dark:group-hover:bg-red-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-red-700 dark:group-hover:text-red-400">Seçim Hazırlık</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Seçim hazırlık işlemleri</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_members_page') && (
                    <button
                      onClick={() => setViewWithPermission('members-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-cyan-50 to-cyan-100 dark:from-cyan-900 dark:to-cyan-800 rounded-lg sm:rounded-xl border border-cyan-200 dark:border-cyan-700 hover:from-cyan-100 hover:to-cyan-200 dark:hover:from-cyan-800 dark:hover:to-cyan-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-cyan-500 dark:bg-cyan-600 rounded-lg flex items-center justify-center group-hover:bg-cyan-600 dark:group-hover:bg-cyan-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400">Üyeler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Üye listesi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_meetings_page') && (
                    <button
                      onClick={() => setViewWithPermission('meetings-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-violet-50 to-violet-100 dark:from-violet-900 dark:to-violet-800 rounded-lg sm:rounded-xl border border-violet-200 dark:border-violet-700 hover:from-violet-100 hover:to-violet-200 dark:hover:from-violet-800 dark:hover:to-violet-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-violet-500 dark:bg-violet-600 rounded-lg flex items-center justify-center group-hover:bg-violet-600 dark:group-hover:bg-violet-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-violet-700 dark:group-hover:text-violet-400">Toplantılar</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Toplantı listesi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_events_page') && (
                    <button
                      onClick={() => setViewWithPermission('events-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-rose-50 to-rose-100 dark:from-rose-900 dark:to-rose-800 rounded-lg sm:rounded-xl border border-rose-200 dark:border-rose-700 hover:from-rose-100 hover:to-rose-200 dark:hover:from-rose-800 dark:hover:to-rose-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-500 dark:bg-rose-600 rounded-lg flex items-center justify-center group-hover:bg-rose-600 dark:group-hover:bg-rose-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-rose-700 dark:group-hover:text-rose-400">Etkinlikler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Etkinlik listesi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_calendar_page') && (
                    <button
                      onClick={() => setViewWithPermission('calendar-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800 rounded-lg sm:rounded-xl border border-amber-200 dark:border-amber-700 hover:from-amber-100 hover:to-amber-200 dark:hover:from-amber-800 dark:hover:to-amber-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 dark:bg-amber-600 rounded-lg flex items-center justify-center group-hover:bg-amber-600 dark:group-hover:bg-amber-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">Takvim</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Takvim görünümü</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_districts_page') && (
                    <button
                      onClick={() => setViewWithPermission('districts-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-lime-50 to-lime-100 dark:from-lime-900 dark:to-lime-800 rounded-lg sm:rounded-xl border border-lime-200 dark:border-lime-700 hover:from-lime-100 hover:to-lime-200 dark:hover:from-lime-800 dark:hover:to-lime-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-lime-500 dark:bg-lime-600 rounded-lg flex items-center justify-center group-hover:bg-lime-600 dark:group-hover:bg-lime-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h1.5M21 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0H21m-1.5 0H18" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-lime-700 dark:group-hover:text-lime-400">İlçeler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">İlçe yönetimi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_archive_page') && (
                    <button
                      onClick={() => setViewWithPermission('archive-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-600 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-500 dark:bg-gray-600 rounded-lg flex items-center justify-center group-hover:bg-gray-600 dark:group-hover:bg-gray-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300">Arşiv</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Arşiv görünümü</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_management_chart_page') && (
                    <button
                      onClick={() => setViewWithPermission('management-chart-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-900 dark:to-sky-800 rounded-lg sm:rounded-xl border border-sky-200 dark:border-sky-700 hover:from-sky-100 hover:to-sky-200 dark:hover:from-sky-800 dark:hover:to-sky-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sky-500 dark:bg-sky-600 rounded-lg flex items-center justify-center group-hover:bg-sky-600 dark:group-hover:bg-sky-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-sky-700 dark:group-hover:text-sky-400">Yönetim Şeması</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Organizasyon şeması</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_representatives_page') && (
                    <button
                      onClick={() => setViewWithPermission('representatives-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-lg sm:rounded-xl border border-yellow-200 dark:border-yellow-700 hover:from-yellow-100 hover:to-yellow-200 dark:hover:from-yellow-800 dark:hover:to-yellow-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500 dark:bg-yellow-600 rounded-lg flex items-center justify-center group-hover:bg-yellow-600 dark:group-hover:bg-yellow-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-yellow-700 dark:group-hover:text-yellow-400">Temsilciler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Temsilci listesi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_neighborhoods_page') && (
                    <button
                      onClick={() => setViewWithPermission('neighborhoods-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-900 dark:to-fuchsia-800 rounded-lg sm:rounded-xl border border-fuchsia-200 dark:border-fuchsia-700 hover:from-fuchsia-100 hover:to-fuchsia-200 dark:hover:from-fuchsia-800 dark:hover:to-fuchsia-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-fuchsia-500 dark:bg-fuchsia-600 rounded-lg flex items-center justify-center group-hover:bg-fuchsia-600 dark:group-hover:bg-fuchsia-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h1.5M21 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0H21m-1.5 0H18" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-400">Mahalleler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Mahalle yönetimi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_villages_page') && (
                    <button
                      onClick={() => setViewWithPermission('villages-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800 rounded-lg sm:rounded-xl border border-emerald-200 dark:border-emerald-700 hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-800 dark:hover:to-emerald-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 dark:bg-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 dark:group-hover:bg-emerald-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h1.5M21 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0H21m-1.5 0H18" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Köyler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Köy yönetimi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_groups_page') && (
                    <button
                      onClick={() => setViewWithPermission('groups-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg sm:rounded-xl border border-teal-200 dark:border-teal-700 hover:from-teal-100 hover:to-teal-200 dark:hover:from-teal-800 dark:hover:to-teal-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-teal-500 dark:bg-teal-600 rounded-lg flex items-center justify-center group-hover:bg-teal-600 dark:group-hover:bg-teal-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-teal-700 dark:group-hover:text-teal-400">Gruplar</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Grup yönetimi</p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sayfa Erişimleri - görev bazlı - TÜM SAYFALAR */}
          {(grantedPermissions.includes('access_dashboard') || 
            grantedPermissions.includes('access_members_page') || 
            grantedPermissions.includes('access_meetings_page') || 
            grantedPermissions.includes('access_events_page') ||
            grantedPermissions.includes('access_calendar_page') || 
            grantedPermissions.includes('access_districts_page') ||
            grantedPermissions.includes('access_archive_page') ||
            grantedPermissions.includes('access_management_chart_page') ||
            grantedPermissions.includes('access_election_preparation_page') ||
            grantedPermissions.includes('access_representatives_page') ||
            grantedPermissions.includes('access_neighborhoods_page') ||
            grantedPermissions.includes('access_villages_page') ||
            grantedPermissions.includes('access_groups_page') ||
            grantedPermissions.includes('access_bulk_sms_page')) && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-900 dark:to-sky-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Sayfa Erişimleri
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Yetkilendirildiğiniz sayfalara erişim</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {grantedPermissions.includes('access_members_page') && (
                    <button 
                      onClick={() => setViewWithPermission('members-page')} 
                      className="group p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-xl border border-blue-200 dark:border-blue-700 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800 dark:hover:to-blue-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m8-4a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Üyeler</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_meetings_page') && (
                    <button 
                      onClick={() => setViewWithPermission('meetings-page')} 
                      className="group p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-xl border border-purple-200 dark:border-purple-700 hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800 dark:hover:to-purple-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-500 dark:bg-purple-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Toplantılar</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_events_page') && (
                    <button 
                      onClick={() => setViewWithPermission('events-page')} 
                      className="group p-4 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900 dark:to-pink-800 rounded-xl border border-pink-200 dark:border-pink-700 hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-800 dark:hover:to-pink-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-pink-500 dark:bg-pink-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Etkinlikler</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_calendar_page') && (
                    <button 
                      onClick={() => setViewWithPermission('calendar-page')} 
                      className="group p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-xl border border-green-200 dark:border-green-700 hover:from-green-100 hover:to-green-200 dark:hover:from-green-800 dark:hover:to-green-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-500 dark:bg-green-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Takvim</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_districts_page') && (
                    <button 
                      onClick={() => setViewWithPermission('districts-page')} 
                      className="group p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-xl border border-orange-200 dark:border-orange-700 hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-800 dark:hover:to-orange-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-orange-500 dark:bg-orange-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">İlçeler</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_archive_page') && (
                    <button 
                      onClick={() => setViewWithPermission('archive-page')} 
                      className="group p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-500 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Arşiv</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_management_chart_page') && (
                    <button 
                      onClick={() => setViewWithPermission('management-chart-page')} 
                      className="group p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 rounded-xl border border-indigo-200 dark:border-indigo-700 hover:from-indigo-100 hover:to-indigo-200 dark:hover:from-indigo-800 dark:hover:to-indigo-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-indigo-500 dark:bg-indigo-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Yönetim Şeması</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_election_preparation_page') && (
                    <button 
                      onClick={() => setViewWithPermission('election-preparation-page')} 
                      className="group p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-xl border border-yellow-200 dark:border-yellow-700 hover:from-yellow-100 hover:to-yellow-200 dark:hover:from-yellow-800 dark:hover:to-yellow-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-yellow-500 dark:bg-yellow-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Seçim Hazırlık</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_representatives_page') && (
                    <button 
                      onClick={() => setViewWithPermission('representatives-page')} 
                      className="group p-4 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-xl border border-teal-200 dark:border-teal-700 hover:from-teal-100 hover:to-teal-200 dark:hover:from-teal-800 dark:hover:to-teal-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-teal-500 dark:bg-teal-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Temsilciler</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_neighborhoods_page') && (
                    <button 
                      onClick={() => setViewWithPermission('neighborhoods-page')} 
                      className="group p-4 bg-gradient-to-r from-cyan-50 to-cyan-100 dark:from-cyan-900 dark:to-cyan-800 rounded-xl border border-cyan-200 dark:border-cyan-700 hover:from-cyan-100 hover:to-cyan-200 dark:hover:from-cyan-800 dark:hover:to-cyan-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-cyan-500 dark:bg-cyan-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Mahalleler</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_villages_page') && (
                    <button 
                      onClick={() => setViewWithPermission('villages-page')} 
                      className="group p-4 bg-gradient-to-r from-lime-50 to-lime-100 dark:from-lime-900 dark:to-lime-800 rounded-xl border border-lime-200 dark:border-lime-700 hover:from-lime-100 hover:to-lime-200 dark:hover:from-lime-800 dark:hover:to-lime-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-lime-500 dark:bg-lime-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Köyler</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_groups_page') && (
                    <button 
                      onClick={() => setViewWithPermission('groups-page')} 
                      className="group p-4 bg-gradient-to-r from-violet-50 to-violet-100 dark:from-violet-900 dark:to-violet-800 rounded-xl border border-violet-200 dark:border-violet-700 hover:from-violet-100 hover:to-violet-200 dark:hover:from-violet-800 dark:hover:to-violet-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-violet-500 dark:bg-violet-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m8-4a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Gruplar</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_election_preparation_page') && (
                    <button 
                      onClick={() => setViewWithPermission('election-preparation-page')} 
                      className="group p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 rounded-xl border border-red-200 dark:border-red-700 hover:from-red-100 hover:to-red-200 dark:hover:from-red-800 dark:hover:to-red-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-500 dark:bg-red-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Seçim Hazırlık</span>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('access_bulk_sms_page') && (
                    <button
                      onClick={() => navigate('/bulk-sms')} 
                      className="group p-4 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900 dark:to-pink-800 rounded-xl border border-pink-200 dark:border-pink-700 hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-800 dark:hover:to-pink-700 transition-all duration-200 hover:shadow-md text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-pink-500 dark:bg-pink-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">Toplu SMS</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Active Polls Section */}
          {polls.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900 dark:to-purple-900">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Anketler/Oylamalar
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Aktif anketlere katılın ve sonlanmış anketlerin sonuçlarını görüntüleyin</p>
              </div>
              <div className="p-6 space-y-4">
                {polls.map((poll) => {
                  const isActive = poll.status === 'active' && new Date(poll.endDate) > new Date();
                  const results = pollResults[poll.id];
                  
                  return (
                    <div key={poll.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{poll.title}</h4>
                          {poll.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{poll.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className={`px-2 py-1 rounded-full ${
                              isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              {isActive ? 'Aktif' : 'Sonlanmış'}
                            </span>
                            <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                              {poll.type === 'poll' ? 'Oylama' : 'Anket'}
                            </span>
                            <span>Bitiş: {new Date(poll.endDate).toLocaleDateString('tr-TR', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                          </div>
                        </div>
                      </div>
                      
                      {isActive ? (
                        <PollVotingComponent 
                          poll={poll} 
                          memberId={member?.id || user?.memberId || user?.id}
                          onVote={() => {
                            fetchMemberData();
                          }}
                        />
                      ) : results ? (
                        <PollResultsComponent results={results} />
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Sonuçlar yükleniyor...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kadın Kolları Yönetim - Sadece kadın kolları başkanı görsün */}
          {isWomenBranchPresident && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900 dark:to-pink-800 px-6 py-4 border-b border-pink-200 dark:border-pink-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Kadın Kolları Yönetimim ({member.region})
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Kadın kolları yönetim ekibinizi ekleyin ve yönetin
                </p>
              </div>
              <div className="p-6">
                {/* Yönetim listesi ve ekleme formu BranchManagementSection component'inde */}
                <BranchManagementSection
                  branchType="women"
                  memberRegion={member.region}
                  memberId={member.id}
                  management={womenBranchManagement}
                  setManagement={setWomenBranchManagement}
                />
              </div>
            </div>
          )}

          {/* Gençlik Kolları Yönetim - Sadece gençlik kolları başkanı görsün */}
          {isYouthBranchPresident && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 px-6 py-4 border-b border-blue-200 dark:border-blue-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Gençlik Kolları Yönetimim ({member.region})
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Gençlik kolları yönetim ekibinizi ekleyin ve yönetin
                </p>
              </div>
              <div className="p-6">
                {/* Yönetim listesi ve ekleme formu BranchManagementSection component'inde */}
                <BranchManagementSection
                  branchType="youth"
                  memberRegion={member.region}
                  memberId={member.id}
                  management={youthBranchManagement}
                  setManagement={setYouthBranchManagement}
                />
              </div>
            </div>
          )}

          {/* Member Details */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <MemberDetails
              member={member}
              members={members}
              meetings={meetings}
              events={events}
              memberRegistrations={memberRegistrations}
              calculateMeetingStats={calculateMeetingStats}
            />
          </div>
        </div>
          )}
        </>
        )}
      </div>
      <Footer />
      
      {/* Mobile Bottom Navigation - Only show if user has "Hızlı İşlemler" permissions */}
      {(
        grantedPermissions.includes('add_member') ||
        grantedPermissions.includes('create_meeting') ||
        grantedPermissions.includes('add_stk') ||
        grantedPermissions.includes('add_public_institution')
      ) && (
        <MobileBottomNav 
          grantedPermissions={grantedPermissions}
          memberPosition={member?.position}
        />
      )}
    </div>
  );
};

export default MemberDashboardPage;
