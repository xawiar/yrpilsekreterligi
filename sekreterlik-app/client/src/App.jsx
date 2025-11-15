import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Lazy loading - Code splitting için
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ManagementChartPage = lazy(() => import('./pages/ManagementChartPage'));
const MemberDashboardPage = lazy(() => import('./pages/MemberDashboardPage'));
const DistrictsPage = lazy(() => import('./pages/DistrictsPage'));
const TeşkilatPage = lazy(() => import('./pages/TeşkilatPage'));
const KadınKollarıPage = lazy(() => import('./pages/KadınKollarıPage'));
const GenclikKollarıPage = lazy(() => import('./pages/GenclikKollarıPage'));
const DistrictMembersPage = lazy(() => import('./pages/DistrictMembersPage'));
const DistrictDetailsPage = lazy(() => import('./pages/DistrictDetailsPage'));
const TownMembersPage = lazy(() => import('./pages/TownMembersPage'));
const TownDetailsPage = lazy(() => import('./pages/TownDetailsPage'));
const ElectionPreparationPage = lazy(() => import('./pages/ElectionPreparationPage'));
const BallotBoxesPage = lazy(() => import('./pages/BallotBoxesPage'));
const BallotBoxDetailsPage = lazy(() => import('./pages/BallotBoxDetailsPage'));
const ObserversPage = lazy(() => import('./pages/ObserversPage'));
const RepresentativesPage = lazy(() => import('./pages/RepresentativesPage'));
const NeighborhoodsPage = lazy(() => import('./pages/NeighborhoodsPage'));
const VillagesPage = lazy(() => import('./pages/VillagesPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ElectionsListPage = lazy(() => import('./pages/ElectionsListPage'));
const ElectionResultsPage = lazy(() => import('./pages/ElectionResultsPage'));
const BulkSmsPage = lazy(() => import('./pages/BulkSmsPage'));
const DistrictPresidentDashboardPage = lazy(() => import('./pages/DistrictPresidentDashboardPage'));
const TownPresidentDashboardPage = lazy(() => import('./pages/TownPresidentDashboardPage'));
const ChiefObserverLoginPage = lazy(() => import('./pages/ChiefObserverLoginPage'));
const ChiefObserverDashboardPage = lazy(() => import('./pages/ChiefObserverDashboardPage'));

// Debug pages
const CreateAdminPage = lazy(() => import('./pages/CreateAdminPage'));
const CheckAdminPage = lazy(() => import('./pages/CheckAdminPage'));
const DebugFirebasePage = lazy(() => import('./pages/DebugFirebasePage'));
const FirebaseTestPage = lazy(() => import('./pages/FirebaseTestPage'));
const ClearAllDataPage = lazy(() => import('./pages/ClearAllDataPage'));
const FirebaseAuthUsersPage = lazy(() => import('./pages/FirebaseAuthUsersPage'));
const SyncToFirebasePage = lazy(() => import('./pages/SyncToFirebasePage'));
const RemoveDuplicateMeetingsPage = lazy(() => import('./pages/RemoveDuplicateMeetingsPage'));

// Components
const Sidebar = lazy(() => import('./components/Sidebar'));
const Footer = lazy(() => import('./components/Footer'));
const PWANotification = lazy(() => import('./components/PWANotification'));
const AppInstallBanner = lazy(() => import('./components/AppInstallBanner'));
const OfflineStatus = lazy(() => import('./components/OfflineStatus'));
const MobileBottomNav = lazy(() => import('./components/MobileBottomNav'));
const Chatbot = lazy(() => import('./components/Chatbot'));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  return isLoggedIn ? children : <Navigate to="/login" />;
};

// Admin only route component
const AdminRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  
  // Başmüşahit kullanıcısını kendi dashboard'ına yönlendir
  const userRole = localStorage.getItem('userRole');
  if (userRole === 'chief_observer') {
    return <Navigate to="/chief-observer-dashboard" replace />;
  }
  
  if (user?.role !== 'admin') return <Navigate to="/member-dashboard" />;
  return children;
};

// Member route component (for members only)
const MemberRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role !== 'member') return <Navigate to="/" />;
  return children;
};

// District President route component
const DistrictPresidentRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role !== 'district_president') return <Navigate to="/" />;
  return children;
};

// Town President route component
const TownPresidentRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role !== 'town_president') return <Navigate to="/" />;
  return children;
};

// STK Manager route component (for STK management permission)
const STKManagerRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  // İleri seviye: İzin kontrolü yapılabilir (grantedPermissions)
  // Şu an için admin, member veya district_president'a izin ver
  if (user?.role === 'admin' || user?.role === 'member' || user?.role === 'district_president') {
    return children;
  }
  return <Navigate to="/" />;
};

// Public Institution Manager route component
const PublicInstitutionManagerRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  // İleri seviye: İzin kontrolü yapılabilir (grantedPermissions)
  // Şu an için admin, member veya district_president'a izin ver
  if (user?.role === 'admin' || user?.role === 'member' || user?.role === 'district_president') {
    return children;
  }
  return <Navigate to="/" />;
};

// Mosque Manager route component
const MosqueManagerRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  // İleri seviye: İzin kontrolü yapılabilir (grantedPermissions)
  // Şu an için admin, member veya district_president'a izin ver
  if (user?.role === 'admin' || user?.role === 'member' || user?.role === 'district_president') {
    return children;
  }
  return <Navigate to="/" />;
};

// Town President role-based route
const TownPresidentRoleRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role === 'town_president') return children;
  return <Navigate to="/login" />;
};

// Public route component - Sadece loading kontrolü yapar
// NOT: Yönlendirme yapmıyor - login sayfası kendi içinde kontrol edecek
const PublicRoute = ({ children }) => {
  const { loading } = useAuth();
  const location = useLocation();
  
  // Sadece loading kontrolü
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }
  
  // Login sayfasındaysak ve zaten giriş yapılmışsa yönlendir
  if (location.pathname === '/login') {
    const userRole = localStorage.getItem('userRole');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedUser = localStorage.getItem('user');
    
    if (userRole === 'chief_observer' && isLoggedIn && savedUser) {
      try {
        JSON.parse(savedUser);
        return <Navigate to="/chief-observer-dashboard" replace />;
      } catch (e) {
        // JSON parse hatası - devam et
      }
    }
  }
  
  // Children'ı göster - yönlendirme yapmadan
  return children;
};

// Chief Observer için özel route guard
// NOT: useRef ile bir kez kontrol et - sonsuz döngüyü önle
const ChiefObserverRoute = ({ children }) => {
  const { loading } = useAuth();
  const hasCheckedAuth = React.useRef(false);
  const authResult = React.useRef(null);
  
  // Loading state
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }
  
  // Authentication kontrolü - sadece bir kez yap
  if (!hasCheckedAuth.current) {
    hasCheckedAuth.current = true;
    
    const userRole = localStorage.getItem('userRole');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedUser = localStorage.getItem('user');
    
    // Temel kontroller
    let isAuthenticated = false;
    if (savedUser && userRole === 'chief_observer' && isLoggedIn) {
      try {
        JSON.parse(savedUser);
        isAuthenticated = true;
      } catch (e) {
        // JSON parse hatası - authenticated değil
        isAuthenticated = false;
      }
    }
    
    authResult.current = isAuthenticated;
  }
  
  // Eğer authenticated değilse login'e yönlendir
  // NOT: Sadece bir kez yönlendir - replace ile
  if (!authResult.current) {
    return <Navigate to="/login?type=chief-observer" replace />;
  }
  
  // Tüm kontroller geçti - dashboard'ı göster
  return children;
};

// Router içinde kullanılacak component - useNavigate burada güvenli
function RouterContent() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = React.useState(false);
  const [quickActionModal, setQuickActionModal] = React.useState({ open: false, type: null });

  const handleQuickActionClose = () => {
    setQuickActionModal({ open: false, type: null });
  };

  // Mobile menu event listener
  React.useEffect(() => {
    const handleOpenMobileMenu = () => {
      setIsMobileMenuOpen(true);
    };
    window.addEventListener('openMobileMenu', handleOpenMobileMenu);
    return () => {
      window.removeEventListener('openMobileMenu', handleOpenMobileMenu);
    };
  }, []);

  // Quick action event listener
  React.useEffect(() => {
    const handleQuickAction = (e) => {
      const { action } = e.detail;
      if (action === 'quick-meeting') {
        // Navigate to meetings page with create modal
        navigate('/meetings?create=true', { replace: false });
      } else if (action === 'quick-event') {
        // Navigate to events page with create modal
        navigate('/events?create=true', { replace: false });
      }
    };
    window.addEventListener('quickAction', handleQuickAction);
    return () => {
      window.removeEventListener('quickAction', handleQuickAction);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Suspense fallback={<LoadingSpinner />}>
          <Routes>
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />
          {/* Debug/Admin Routes - Only accessible in development or by admin with debug flag */}
          {(import.meta.env.DEV || (import.meta.env.VITE_ENABLE_DEBUG === 'true' && isLoggedIn && user?.role === 'admin')) && (
            <>
              <Route 
                path="/create-admin" 
                element={<CreateAdminPage />} 
              />
              <Route 
                path="/check-admin" 
                element={<CheckAdminPage />} 
              />
              <Route 
                path="/debug-firebase" 
                element={<DebugFirebasePage />} 
              />
              <Route 
                path="/firebase-test" 
                element={<FirebaseTestPage />} 
              />
            </>
          )}
          <Route 
            path="/clear-all-data" 
            element={
              <AdminRoute>
                <ClearAllDataPage />
              </AdminRoute>
            } 
          />
          <Route 
            path="/firebase-auth-users" 
            element={
              <AdminRoute>
                <FirebaseAuthUsersPage />
              </AdminRoute>
            } 
          />
          
          {/* Member Dashboard Route */}
          <Route 
            path="/member-dashboard" 
            element={
              <MemberRoute>
                <MemberDashboardPage />
              </MemberRoute>
            } 
          />
          
          {/* District President Dashboard Route */}
          <Route 
            path="/district-president-dashboard" 
            element={
              <DistrictPresidentRoute>
                <DistrictPresidentDashboardPage />
              </DistrictPresidentRoute>
            } 
          />
          
          {/* Town President Dashboard Route */}
          <Route 
            path="/town-president-dashboard" 
            element={
              <TownPresidentRoute>
                <TownPresidentDashboardPage />
              </TownPresidentRoute>
            } 
          />
          
          {/* Chief Observer Routes */}
          <Route 
            path="/chief-observer-dashboard" 
            element={<ChiefObserverDashboardPage />} 
          />
          
          {/* Chief Observer Login - Artık /login?type=chief-observer olarak yönlendirilecek */}
          <Route 
            path="/chief-observer-login" 
            element={
              <PublicRoute>
                <Navigate to="/login?type=chief-observer" replace />
              </PublicRoute>
            } 
          />
          
          {/* Admin Routes */}
          <Route 
            path="/*" 
            element={
              <AdminRoute>
                <div className="flex h-screen">
                  {/* Desktop Sidebar */}
                  <div className="hidden lg:block">
                    <Sidebar />
                  </div>
                  
                  {/* Main Content Area */}
                  <div className="flex-1 flex flex-col">
                    {/* Mobile Header with Hamburger */}
                    <div className="lg:hidden bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                          className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                        </button>
                        <h1 className="text-lg font-bold text-indigo-700 dark:text-indigo-400">Parti Sekreterliği</h1>
                        <div className="w-10"></div> {/* Spacer for centering */}
                      </div>
                    </div>
                    
                    {/* Mobile Menu Overlay with Swipe Support */}
                    {isMobileMenuOpen && (
                      <div 
                        className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50 dark:bg-opacity-70 transition-opacity duration-300" 
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div 
                          className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300"
                          onClick={(e) => e.stopPropagation()}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            e.currentTarget.dataset.touchStartX = touch.clientX.toString();
                          }}
                          onTouchMove={(e) => {
                            const touch = e.touches[0];
                            const startX = parseFloat(e.currentTarget.dataset.touchStartX || '0');
                            const diff = touch.clientX - startX;
                            if (diff < 0) {
                              e.currentTarget.style.transform = `translateX(${diff}px)`;
                            }
                          }}
                          onTouchEnd={(e) => {
                            const touch = e.changedTouches[0];
                            const startX = parseFloat(e.currentTarget.dataset.touchStartX || '0');
                            const diff = touch.clientX - startX;
                            if (diff < -100) {
                              setIsMobileMenuOpen(false);
                            }
                            e.currentTarget.style.transform = '';
                          }}
                        >
                          <Sidebar onMobileMenuClose={() => setIsMobileMenuOpen(false)} />
                        </div>
                      </div>
                    )}
                    
                    <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 pb-20 lg:pb-6">
                      <div className="w-full max-w-7xl mx-auto">
                        <Routes>
                          <Route path="/members" element={<MembersPage />} />
                          <Route path="/teşkilat" element={<TeşkilatPage />} />
                          <Route path="/teşkilat/ilçeler" element={<DistrictsPage />} />
                          <Route path="/teşkilat/kadın-kolları" element={<KadınKollarıPage />} />
                          <Route path="/teşkilat/gençlik-kolları" element={<GenclikKollarıPage />} />
                          <Route path="/districts" element={<Navigate to="/teşkilat/ilçeler" replace />} />
                          <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/districts/:id/members" element={<DistrictMembersPage />} />
            <Route path="/districts/:id/details" element={<DistrictDetailsPage />} />
            <Route path="/towns/:id/members" element={<TownMembersPage />} />
            <Route path="/towns/:id/details" element={<TownDetailsPage />} />
            <Route path="/election-preparation/*" element={<ElectionPreparationPage />} />
            <Route path="/election-preparation/ballot-boxes/:id/details" element={<BallotBoxDetailsPage />} />
            <Route path="/elections" element={<ElectionsListPage />} />
            <Route path="/election-results/:electionId" element={<ElectionResultsPage />} />
            <Route path="/bulk-sms" element={<BulkSmsPage />} />
                          <Route path="/meetings" element={<MeetingsPage />} />
                          <Route path="/events" element={<EventsPage />} />
                          <Route path="/reports" element={<Navigate to="/" replace />} />
                          <Route path="/" element={<ReportsPage />} />
                          <Route path="/archive" element={<ArchivePage />} />
                          <Route path="/management-chart" element={<ManagementChartPage />} />
                          <Route path="/settings/*" element={<SettingsPage />} />
                          <Route path="/sync-to-firebase" element={<SyncToFirebasePage />} />
                          <Route path="/remove-duplicate-meetings" element={<RemoveDuplicateMeetingsPage />} />
                          
                          {/* STK Manager Routes */}
                          <Route path="/stk-management" element={
                            <STKManagerRoute>
                              <SettingsPage />
                            </STKManagerRoute>
                          } />
                          <Route path="/stk-events" element={
                            <STKManagerRoute>
                              <EventsPage />
                            </STKManagerRoute>
                          } />
                        </Routes>
                      </div>
                    </main>
                    
                    {/* Footer */}
                    <Footer />
                    
                    {/* Mobile Bottom Navigation */}
                    <Suspense fallback={null}>
                      <MobileBottomNav />
                    </Suspense>
                  </div>
                </div>
              </AdminRoute>
            }
          />
        </Routes>
        
        {/* Floating Chatbot Button - Only show for admin users */}
        {isLoggedIn && user?.role === 'admin' && (
          <button
            onClick={() => setIsChatbotOpen(!isChatbotOpen)}
            className="fixed bottom-24 right-6 z-40 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
            aria-label="AI Chatbot'u Aç"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        )}
        
        {/* Chatbot Modal - Only show for admin users */}
        {isLoggedIn && user?.role === 'admin' && (
          <Chatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
        )}
      </Suspense>
    </div>
  );
}

// Component wrapper
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <RouterContent />
        </Router>
        <PWANotification />
        <AppInstallBanner />
        <OfflineStatus />
        {/* PerformanceMonitor temporarily disabled - causes localhost:5000 errors */}
        {/* <PerformanceMonitor /> */}
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
