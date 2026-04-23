import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
import MemberListPage from './MemberListPage';
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
import useRealtimeNotifications from '../hooks/useRealtimeNotifications';
import NotificationDrawer from '../components/NotificationDrawer';
import PollVotingComponent from '../components/PollVotingComponent';
import PollResultsComponent from '../components/PollResultsComponent';
import Modal from '../components/Modal';
import MobileBottomNav from '../components/MobileBottomNav';
import BranchManagementSection from '../components/BranchManagementSection';
import DataDeletionRequestButton from '../components/DataDeletionRequestButton';
import MemberProfilePanel from '../components/MemberProfilePanel';
import PersonalDocuments from '../components/PersonalDocuments';
import ProfileUpdateRequestModal from '../components/ProfileUpdateRequestModal';
import MemberProfileRequestsList from '../components/MemberProfileRequestsList';
import MemberApplicationsPanel from '../components/MemberApplicationsPanel';
import MemberRequestsPage from './MemberRequestsPage';

// URL path <-> view name mappings
const viewToPathMap = {
  'dashboard': '',
  'stk-management': 'stk-management',
  'stk-events': 'stk-events',
  'public-institution-management': 'public-institution-management',
  'add-member': 'add-member',
  'create-meeting': 'create-meeting',
  'members-page': 'members',
  'meetings-page': 'meetings',
  'calendar-page': 'calendar',
  'districts-page': 'districts',
  'events-page': 'events',
  'archive-page': 'archive',
  'management-chart-page': 'management-chart',
  'election-preparation-page': 'election-preparation',
  'representatives-page': 'representatives',
  'neighborhoods-page': 'neighborhoods',
  'villages-page': 'villages',
  'groups-page': 'groups',
  'member-list-page': 'member-list',
  'ballot-boxes': 'ballot-boxes',
  'observers': 'observers',
  'landing-page': 'landing-page',
};

const pathToViewMap = Object.fromEntries(
  Object.entries(viewToPathMap).map(([view, path]) => [path, view])
);

const getViewFromPathname = (pathname) => {
  const subPath = pathname.replace(/^\/member-dashboard\/?/, '').replace(/\/$/, '');
  if (!subPath) return 'dashboard';
  return pathToViewMap[subPath] || 'dashboard';
};

const MemberDashboardPage = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [member, setMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [events, setEvents] = useState([]);
  const [memberRegistrations, setMemberRegistrations] = useState([]);
  const [polls, setPolls] = useState([]);
  const [pollResults, setPollResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState(() => getViewFromPathname(location.pathname));
  const [grantedPermissions, setGrantedPermissions] = useState([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [showAllSections, setShowAllSections] = useState(false);
  const { unreadCount } = useRealtimeNotifications(user?.id || user?.uid);

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
    'member-list-page': ['view_member_list'],
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
    'landing-page': ['manage_landing_page'],
  };

  // Navigate to a view by updating the URL (which in turn updates currentView via useEffect)
  const navigateToView = React.useCallback((view) => {
    const urlPath = viewToPathMap[view];
    if (urlPath === undefined) {
      // Unknown view, go to dashboard
      navigate('/member-dashboard', { replace: true });
    } else if (urlPath === '') {
      navigate('/member-dashboard', { replace: false });
    } else {
      navigate(`/member-dashboard/${urlPath}`, { replace: false });
    }
  }, [navigate]);

  // Yetki kontrolü yapan wrapper fonksiyon
  const setViewWithPermission = React.useCallback((view) => {
    // Dashboard her zaman erişilebilir
    if (view === 'dashboard') {
      navigateToView('dashboard');
      return;
    }

    // View için gerekli permission'ları kontrol et
    const requiredPermissions = viewPermissionMap[view] || [];

    // Eğer permission tanımlı değilse, erişime izin ver (geriye dönük uyumluluk)
    if (requiredPermissions.length === 0) {
      console.warn(`View '${view}' için permission tanımı bulunamadı`);
      navigateToView(view);
      return;
    }

    // Kullanıcının en az bir permission'ı var mı kontrol et
    const hasPermission = requiredPermissions.some(perm =>
      grantedPermissions.includes(perm)
    );

    if (hasPermission) {
      navigateToView(view);
    } else {
      // Yetki yoksa dashboard'a dön ve uyarı göster
      console.warn(`Kullanıcının '${view}' view'ine erişim yetkisi yok`);
      navigateToView('dashboard');
      setError(`Bu sayfaya erişim yetkiniz bulunmamaktadır.`);
      // 3 saniye sonra hatayı temizle
      setTimeout(() => setError(''), 3000);
    }
  }, [grantedPermissions, navigateToView]);

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

  // Gomulu view'lar icin wrapper - MobileBottomNav ve alt bosluk ekler
  const renderEmbeddedView = (title, subtitle, content) => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
              </div>
              <button
                onClick={() => setViewWithPermission('dashboard')}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                Geri Don
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
          {content}
        </div>
        <MobileBottomNav grantedPermissions={grantedPermissions} memberPosition={member?.position} />
        <NotificationDrawer isOpen={notifDrawerOpen} onClose={() => setNotifDrawerOpen(false)} />
      </div>
    );
  };

  const [regions, setRegions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [isWomenBranchPresident, setIsWomenBranchPresident] = useState(false);
  const [isYouthBranchPresident, setIsYouthBranchPresident] = useState(false);
  const [womenBranchManagement, setWomenBranchManagement] = useState([]);
  const [youthBranchManagement, setYouthBranchManagement] = useState([]);
  const [profileRequestModalOpen, setProfileRequestModalOpen] = useState(false);
  const [profileRequestsRefreshKey, setProfileRequestsRefreshKey] = useState(0);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [actionsTab, setActionsTab] = useState('requests'); // 'requests' | 'applications'
  
  // URL pathname degistiginde currentView'i guncelle
  useEffect(() => {
    const viewFromPath = getViewFromPathname(location.pathname);
    if (viewFromPath !== currentView) {
      setCurrentView(viewFromPath);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Eski ?view= query param destegi (bildirim yonlendirmeleri icin)
  // Eski formattan yeni URL formatina yonlendir
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam) {
      // Eski ?view= formatindan yeni URL formatina redirect et
      const urlPath = viewToPathMap[viewParam];
      if (urlPath !== undefined) {
        navigate(urlPath === '' ? '/member-dashboard' : `/member-dashboard/${urlPath}`, { replace: true });
      } else {
        // Bilinmeyen view, dashboard'a git
        navigate('/member-dashboard', { replace: true });
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Redirect to dashboard if current view no longer has permission (CRITICAL 4)
  useEffect(() => {
    if (currentView !== 'dashboard' && !hasViewPermission(currentView)) {
      navigate('/member-dashboard', { replace: true });
    }
  }, [currentView, grantedPermissions]); // eslint-disable-line react-hooks/exhaustive-deps


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
    if (!hasViewPermission('stk-management')) return null;
    return renderEmbeddedView('STK Yonetimi', 'STK ekleme, duzenleme ve silme islemleri', <SettingsPage tab="stks" />);
  }

  // Public Institution Management view
  if (currentView === 'public-institution-management') {
    if (!hasViewPermission('public-institution-management')) return null;
    return renderEmbeddedView('Kamu Kurumu Yonetimi', 'Kamu kurumu ekleme, duzenleme ve silme islemleri', <SettingsPage tab="public-institutions" />);
  }

  // Landing Page (Tanıtım Sayfası) view — embedded
  if (currentView === 'landing-page') {
    if (!hasViewPermission('landing-page')) return null;
    return renderEmbeddedView('Tanıtım Sayfası Yönetimi', 'Halka açık landing sayfası içeriğini düzenleyin', <SettingsPage tab="landing-page" />);
  }

  // STK Events view
  if (currentView === 'stk-events') {
    if (!hasViewPermission('stk-events')) return null;
    return renderEmbeddedView('Etkinlik Yonetimi', 'Etkinlik olusturma ve yonetimi', <EventsPage />);
  }

  // Add Member view
  if (currentView === 'add-member') {
    if (!hasViewPermission('add-member')) return null;
    return renderEmbeddedView('Uye Ekle', 'Yeni uye kaydi olusturun',
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
          <MemberForm
            regions={regions.map(r => r.name)}
            positions={positions.map(p => p.name)}
            onClose={() => setViewWithPermission('dashboard')}
            onMemberSaved={() => setViewWithPermission('dashboard')}
          />
        </div>
      </div>
    );
  }

  // Create Meeting view
  if (currentView === 'create-meeting') {
    if (!hasViewPermission('create-meeting')) return null;
    return renderEmbeddedView('Toplanti Olustur', 'Secili bolgelere toplanti planlayin',
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
          <CreateMeetingForm
            regions={regions}
            onClose={() => setViewWithPermission('dashboard')}
            onMeetingCreated={() => setViewWithPermission('dashboard')}
          />
        </div>
      </div>
    );
  }

  // Embedded Pages via permissions
  if (currentView === 'member-list-page') {
    if (!hasViewPermission('member-list-page')) return null;
    return renderEmbeddedView('Üye Listesi', null, <MemberListPage />);
  }
  if (currentView === 'members-page') {
    if (!hasViewPermission('members-page')) return null;
    return renderEmbeddedView('Uyeler', null, <MembersPage />);
  }
  if (currentView === 'meetings-page') {
    if (!hasViewPermission('meetings-page')) return null;
    return renderEmbeddedView('Toplantilar', null, <MeetingsPage />);
  }
  if (currentView === 'calendar-page') {
    if (!hasViewPermission('calendar-page')) return null;
    return renderEmbeddedView('Takvim', null, <CalendarPage />);
  }
  if (currentView === 'districts-page') {
    if (!hasViewPermission('districts-page')) return null;
    return renderEmbeddedView('Ilceler', null, <DistrictsPage />);
  }
  if (currentView === 'events-page') {
    if (!hasViewPermission('events-page')) return null;
    return renderEmbeddedView('Etkinlikler', null, <EventsPage />);
  }
  if (currentView === 'archive-page') {
    if (!hasViewPermission('archive-page')) return null;
    return renderEmbeddedView('Arsiv', null, <ArchivePage />);
  }
  if (currentView === 'management-chart-page') {
    if (!hasViewPermission('management-chart-page')) return null;
    return renderEmbeddedView('Yonetim Semasi', null, <ManagementChartPage />);
  }
  if (currentView === 'election-preparation-page') {
    if (!hasViewPermission('election-preparation-page')) return null;
    return renderEmbeddedView('Secim Hazirlik', null, <ElectionPreparationPage />);
  }
  if (currentView === 'representatives-page') {
    if (!hasViewPermission('representatives-page')) return null;
    return renderEmbeddedView('Temsilciler', null, <RepresentativesPage />);
  }
  if (currentView === 'neighborhoods-page') {
    if (!hasViewPermission('neighborhoods-page')) return null;
    return renderEmbeddedView('Mahalleler', null, <NeighborhoodsPage />);
  }
  if (currentView === 'villages-page') {
    if (!hasViewPermission('villages-page')) return null;
    return renderEmbeddedView('Koyler', null, <VillagesPage />);
  }
  if (currentView === 'groups-page') {
    if (!hasViewPermission('groups-page')) return null;
    return renderEmbeddedView('Gruplar', null, <GroupsPage />);
  }
  if (currentView === 'ballot-boxes') {
    if (!hasViewPermission('ballot-boxes')) return null;
    return renderEmbeddedView('Sandiklar', null, <BallotBoxesPage />);
  }
  if (currentView === 'observers') {
    if (!hasViewPermission('observers')) return null;
    return renderEmbeddedView('Musahitler', null, <ObserversPage />);
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
                    {member.position ? `${member.position} — ` : ''}{member.region}
                  </p>
                  {member.inspectorTitle && (
                    <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 mt-0.5 font-medium">
                      {member.inspectorTitle}{member.inspectorDistrict ? ` — ${member.inspectorDistrict} İlçesi` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Kullanıcı Adı</p>
                  <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">{user.username}</p>
                </div>
                {/* Bildirim Zili */}
                <button
                  onClick={() => setNotifDrawerOpen(true)}
                  className="relative inline-flex items-center justify-center p-2 sm:p-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Bildirimler"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
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
          {/* Tema Toggle — sağ üst köşe */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow transition-all"
              title={isDarkMode ? 'Gündüz moduna geç' : 'Gece moduna geç'}
            >
              {isDarkMode ? (
                <>
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Gündüz Modu</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Gece Modu</span>
                </>
              )}
            </button>
          </div>

          {/* Kompakt Profil Başlığı — avatar tıklanınca profil modalı */}
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl shadow-xl p-4 text-white relative overflow-hidden hover:shadow-2xl transition-shadow text-left"
          >
            <div className="flex items-center space-x-4">
              {member?.photo ? (
                <img src={member.photo} alt={member?.name || 'Profil'} className="w-14 h-14 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm text-xl font-bold">
                  {(member?.name || 'Ü').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold truncate">{member?.name || 'Üye'}</div>
                <div className="text-indigo-100 text-sm truncate">{member?.position || 'Üye'} · {member?.region || ''}</div>
                <div className="text-white/80 text-xs mt-0.5">Profili görüntülemek için dokun</div>
              </div>
              <svg className="w-5 h-5 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

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
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                {/* Primary actions - always visible */}
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
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-teal-700 dark:group-hover:text-teal-400">Uye Ekle</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni uye kaydi olustur</p>
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
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400">Toplanti Olustur</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Bolgelere toplanti planla</p>
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
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400">Uyeler</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Uye listesi</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {grantedPermissions.includes('view_member_list') && (
                    <button
                      onClick={() => setViewWithPermission('member-list-page')}
                      className="group p-3 sm:p-4 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg sm:rounded-xl border border-teal-200 dark:border-teal-700 hover:from-teal-100 hover:to-teal-200 dark:hover:from-teal-800 dark:hover:to-teal-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-teal-500 dark:bg-teal-600 rounded-lg flex items-center justify-center group-hover:bg-teal-600 dark:group-hover:bg-teal-700 transition-colors duration-200 flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-teal-700 dark:group-hover:text-teal-400">Üye Listesi</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Bölge, görev, müfettişlik</p>
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
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-violet-700 dark:group-hover:text-violet-400">Toplantilar</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Toplanti listesi</p>
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
                </div>

                {/* Secondary actions - collapsible */}
                {(() => {
                  const secondaryButtons = [];
                  if (grantedPermissions.includes('add_stk') || grantedPermissions.includes('manage_stk')) {
                    secondaryButtons.push(
                      <button key="stk" onClick={() => setViewWithPermission('stk-management')} className="group p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800 rounded-lg sm:rounded-xl border border-emerald-200 dark:border-emerald-700 hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-800 dark:hover:to-emerald-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 dark:bg-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 dark:group-hover:bg-emerald-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">STK Ekle</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni STK kaydi olustur</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('add_public_institution')) {
                    secondaryButtons.push(
                      <button key="pub-inst" onClick={() => setViewWithPermission('public-institution-management')} className="group p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg sm:rounded-xl border border-blue-200 dark:border-blue-700 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800 dark:hover:to-blue-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 dark:group-hover:bg-blue-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">Kamu Kurumu Ekle</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni kamu kurumu kaydi olustur</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('create_event')) {
                    secondaryButtons.push(
                      <button key="stk-events" onClick={() => setViewWithPermission('stk-events')} className="group p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 rounded-lg sm:rounded-xl border border-indigo-200 dark:border-indigo-700 hover:from-indigo-100 hover:to-indigo-200 dark:hover:from-indigo-800 dark:hover:to-indigo-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-500 dark:bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 dark:group-hover:bg-indigo-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">Etkinlik Olustur</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yeni etkinlik planla</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_ballot_boxes') || grantedPermissions.includes('add_ballot_box')) {
                    secondaryButtons.push(
                      <button key="ballot" onClick={() => setViewWithPermission('ballot-boxes')} className="group p-3 sm:p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-lg sm:rounded-xl border border-orange-200 dark:border-orange-700 hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-800 dark:hover:to-orange-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 dark:bg-orange-600 rounded-lg flex items-center justify-center group-hover:bg-orange-600 dark:group-hover:bg-orange-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-orange-700 dark:group-hover:text-orange-400">Sandiklar</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Sandik yonetimi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_observers') || grantedPermissions.includes('add_observer')) {
                    secondaryButtons.push(
                      <button key="observers" onClick={() => setViewWithPermission('observers')} className="group p-3 sm:p-4 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900 dark:to-pink-800 rounded-lg sm:rounded-xl border border-pink-200 dark:border-pink-700 hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-800 dark:hover:to-pink-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-pink-500 dark:bg-pink-600 rounded-lg flex items-center justify-center group-hover:bg-pink-600 dark:group-hover:bg-pink-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-pink-700 dark:group-hover:text-pink-400">Musahitler</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Musahit yonetimi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_election_preparation_page')) {
                    secondaryButtons.push(
                      <button key="election" onClick={() => setViewWithPermission('election-preparation-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 rounded-lg sm:rounded-xl border border-red-200 dark:border-red-700 hover:from-red-100 hover:to-red-200 dark:hover:from-red-800 dark:hover:to-red-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 dark:bg-red-600 rounded-lg flex items-center justify-center group-hover:bg-red-600 dark:group-hover:bg-red-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-red-700 dark:group-hover:text-red-400">Secim Hazirlik</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Secim hazirlik islemleri</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_calendar_page')) {
                    secondaryButtons.push(
                      <button key="calendar" onClick={() => setViewWithPermission('calendar-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800 rounded-lg sm:rounded-xl border border-amber-200 dark:border-amber-700 hover:from-amber-100 hover:to-amber-200 dark:hover:from-amber-800 dark:hover:to-amber-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 dark:bg-amber-600 rounded-lg flex items-center justify-center group-hover:bg-amber-600 dark:group-hover:bg-amber-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">Takvim</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Takvim gorunumu</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_districts_page')) {
                    secondaryButtons.push(
                      <button key="districts" onClick={() => setViewWithPermission('districts-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-lime-50 to-lime-100 dark:from-lime-900 dark:to-lime-800 rounded-lg sm:rounded-xl border border-lime-200 dark:border-lime-700 hover:from-lime-100 hover:to-lime-200 dark:hover:from-lime-800 dark:hover:to-lime-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-lime-500 dark:bg-lime-600 rounded-lg flex items-center justify-center group-hover:bg-lime-600 dark:group-hover:bg-lime-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-lime-700 dark:group-hover:text-lime-400">Ilceler</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Ilce yonetimi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_archive_page')) {
                    secondaryButtons.push(
                      <button key="archive" onClick={() => setViewWithPermission('archive-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-600 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-500 dark:bg-gray-600 rounded-lg flex items-center justify-center group-hover:bg-gray-600 dark:group-hover:bg-gray-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300">Arsiv</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Arsiv gorunumu</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_management_chart_page')) {
                    secondaryButtons.push(
                      <button key="mgmt-chart" onClick={() => setViewWithPermission('management-chart-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-900 dark:to-sky-800 rounded-lg sm:rounded-xl border border-sky-200 dark:border-sky-700 hover:from-sky-100 hover:to-sky-200 dark:hover:from-sky-800 dark:hover:to-sky-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sky-500 dark:bg-sky-600 rounded-lg flex items-center justify-center group-hover:bg-sky-600 dark:group-hover:bg-sky-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-sky-700 dark:group-hover:text-sky-400">Yonetim Semasi</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Organizasyon semasi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_representatives_page')) {
                    secondaryButtons.push(
                      <button key="reps" onClick={() => setViewWithPermission('representatives-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-lg sm:rounded-xl border border-yellow-200 dark:border-yellow-700 hover:from-yellow-100 hover:to-yellow-200 dark:hover:from-yellow-800 dark:hover:to-yellow-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500 dark:bg-yellow-600 rounded-lg flex items-center justify-center group-hover:bg-yellow-600 dark:group-hover:bg-yellow-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-yellow-700 dark:group-hover:text-yellow-400">Temsilciler</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Temsilci listesi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_neighborhoods_page')) {
                    secondaryButtons.push(
                      <button key="neighborhoods" onClick={() => setViewWithPermission('neighborhoods-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-900 dark:to-fuchsia-800 rounded-lg sm:rounded-xl border border-fuchsia-200 dark:border-fuchsia-700 hover:from-fuchsia-100 hover:to-fuchsia-200 dark:hover:from-fuchsia-800 dark:hover:to-fuchsia-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-fuchsia-500 dark:bg-fuchsia-600 rounded-lg flex items-center justify-center group-hover:bg-fuchsia-600 dark:group-hover:bg-fuchsia-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-400">Mahalleler</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Mahalle yonetimi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_villages_page')) {
                    secondaryButtons.push(
                      <button key="villages" onClick={() => setViewWithPermission('villages-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800 rounded-lg sm:rounded-xl border border-emerald-200 dark:border-emerald-700 hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-800 dark:hover:to-emerald-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 dark:bg-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 dark:group-hover:bg-emerald-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Koyler</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Koy yonetimi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (grantedPermissions.includes('access_groups_page')) {
                    secondaryButtons.push(
                      <button key="groups" onClick={() => setViewWithPermission('groups-page')} className="group p-3 sm:p-4 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg sm:rounded-xl border border-teal-200 dark:border-teal-700 hover:from-teal-100 hover:to-teal-200 dark:hover:from-teal-800 dark:hover:to-teal-700 transition-all duration-200 hover:shadow-md text-left w-full active:scale-[0.98]">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-teal-500 dark:bg-teal-600 rounded-lg flex items-center justify-center group-hover:bg-teal-600 dark:group-hover:bg-teal-700 transition-colors duration-200 flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-teal-700 dark:group-hover:text-teal-400">Gruplar</h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Grup yonetimi</p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  if (secondaryButtons.length === 0) return null;
                  return (
                    <div className="mt-3 sm:mt-4">
                      <button
                        onClick={() => setShowAllSections(!showAllSections)}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <svg className={`w-4 h-4 transition-transform ${showAllSections ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {showAllSections ? 'Daha Az Goster' : 'Tum Yetkili Sayfalar'}
                        <span className="ml-auto text-xs text-gray-400">{secondaryButtons.length} sayfa</span>
                      </button>
                      {showAllSections && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                          {secondaryButtons}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Empty state kaldırıldı — yetki yoksa bölüm gizli */}

          {/* Active Polls Section */}
          {polls.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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

          {/* Kişisel Belgeler panel olarak kaldırıldı — Profilim modal'ı içinde */}

          {/* Tanıtım Sayfası Yönetimi — yetkisi varsa görünür */}
          {grantedPermissions.includes('manage_landing_page') && (
            <button
              type="button"
              onClick={() => setViewWithPermission('landing-page')}
              className="block w-full text-left bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tanıtım Sayfası Yönetimi</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Halka açık landing sayfası içeriğini düzenle</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )}

          {/* Seçmen Sorgulama — yetkisi varsa görünür */}
          {grantedPermissions.includes('access_voter_list') && (
            <Link
              to="/voter-search"
              className="block bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Seçmen Sorgulama</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">TC, ad, soyad veya sandık no ile ara</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )}

          {/* Taleplerim & Başvurularım — Tek Akordeon */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setActionsExpanded((v) => !v)}
              className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Taleplerim & Başvurularım
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    Talep oluştur, aktif başvurulara katıl
                  </p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${actionsExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {actionsExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {/* Tab başlıkları */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <button
                    type="button"
                    onClick={() => setActionsTab('requests')}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                      actionsTab === 'requests'
                        ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 bg-white dark:bg-gray-800'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Taleplerim & Şikayetlerim
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionsTab('applications')}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                      actionsTab === 'applications'
                        ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 bg-white dark:bg-gray-800'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Başvurular
                  </button>
                </div>

                {/* Tab içerik */}
                <div className="p-2 sm:p-4">
                  {actionsTab === 'requests' && <MemberRequestsPage />}
                  {actionsTab === 'applications' && member && <MemberApplicationsPanel member={member} />}
                </div>
              </div>
            )}
          </div>

          {/* Member Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <MemberDetails
              member={member}
              members={members}
              meetings={meetings}
              events={events}
              memberRegistrations={memberRegistrations}
              calculateMeetingStats={calculateMeetingStats}
            />
          </div>

          {/* KVKK - Veri Silme Talep Butonu */}
          <DataDeletionRequestButton memberId={member?.id} />

          {/* Profil Görüntüleme Modal (avatar tıklanınca) */}
          {member && (
            <Modal
              isOpen={profileModalOpen}
              onClose={() => setProfileModalOpen(false)}
              title="Profilim"
            >
              <div className="space-y-4">
                <MemberProfilePanel
                  member={member}
                  onRequestChange={() => {
                    setProfileModalOpen(false);
                    setProfileRequestModalOpen(true);
                  }}
                  onPhotoUpdated={(newUrl) => setMember((m) => ({ ...m, photo: newUrl }))}
                />
                <MemberProfileRequestsList
                  key={profileRequestsRefreshKey}
                  memberId={member.id}
                />
                {/* Kişisel Belgeler — profil modal içinde */}
                {member?.id && <PersonalDocuments memberId={member.id} />}
              </div>
            </Modal>
          )}

          {/* Profil Değişiklik Talebi Modal */}
          {member && (
            <ProfileUpdateRequestModal
              isOpen={profileRequestModalOpen}
              onClose={() => setProfileRequestModalOpen(false)}
              member={member}
              onSubmitted={() => setProfileRequestsRefreshKey((k) => k + 1)}
            />
          )}
        </div>
          )}
        </>
        )}
      </div>
      <div className="hidden lg:block"><Footer /></div>
      
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
      {/* Bildirim Drawer */}
      <NotificationDrawer isOpen={notifDrawerOpen} onClose={() => setNotifDrawerOpen(false)} />
    </div>
  );
};

export default MemberDashboardPage;
