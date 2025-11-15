import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
const BulkSmsPage = lazy(() => import('./pages/BulkSmsPage'));
const DistrictPresidentDashboardPage = lazy(() => import('./pages/DistrictPresidentDashboardPage'));
const TownPresidentDashboardPage = lazy(() => import('./pages/TownPresidentDashboardPage'));
const ChiefObserverLoginPage = lazy(() => import('./pages/ChiefObserverLoginPage'));
const ChiefObserverDashboardPage = lazy(() => import('./pages/ChiefObserverDashboardPage'));
const ElectionResultsPage = lazy(() => import('./pages/ElectionResultsPage'));
const ElectionsListPage = lazy(() => import('./pages/ElectionsListPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const CreateAdminPage = lazy(() => import('./pages/CreateAdminPage'));
const CheckAdminPage = lazy(() => import('./pages/CheckAdminPage'));
const DebugFirebasePage = lazy(() => import('./pages/DebugFirebasePage'));
const ClearAllDataPage = lazy(() => import('./pages/ClearAllDataPage'));
const FirebaseAuthUsersPage = lazy(() => import('./pages/FirebaseAuthUsersPage'));
const SyncToFirebasePage = lazy(() => import('./pages/SyncToFirebasePage'));
const FirebaseTestPage = lazy(() => import('./pages/FirebaseTestPage'));
const RemoveDuplicateMeetingsPage = lazy(() => import('./pages/RemoveDuplicateMeetingsPage'));
const Sidebar = lazy(() => import('./components/Sidebar'));
const Footer = lazy(() => import('./components/Footer'));
const MobileBottomNav = lazy(() => import('./components/MobileBottomNav'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

// Non-lazy components (small, frequently used)
import Chatbot from './components/Chatbot';
const PWANotification = lazy(() => import('./components/PWANotification'));
const AppInstallBanner = lazy(() => import('./components/AppInstallBanner'));
const OfflineStatus = lazy(() => import('./components/OfflineStatus'));

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
  if (user?.role === 'admin') return children;
  if (user?.role === 'member') return <Navigate to="/member-dashboard" />;
  if (user?.role === 'district_president') return <Navigate to="/district-president-dashboard" />;
  if (user?.role === 'town_president') return <Navigate to="/town-president-dashboard" />;
  return <Navigate to="/login" />;
};

// Member only route component
const MemberRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  
  // Wait for auth state to load, but prioritize localStorage
  if (loading) {
    // Check if we have saved user in localStorage (for faster initial load)
    const savedUser = localStorage.getItem('user');
    const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (savedUser && savedIsLoggedIn === 'true') {
      // User is likely logged in, wait a bit more
      return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
    }
    
    // No saved user, show loading
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }
  
  // If not logged in, check localStorage one more time
  if (!isLoggedIn) {
    const savedUser = localStorage.getItem('user');
    const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (savedUser && savedIsLoggedIn === 'true') {
      // localStorage'da user var, kullanıcıyı yükle
      try {
        const userData = JSON.parse(savedUser);
        // User data valid ise, allow access (AuthContext will update state)
        if (userData && userData.role) {
          // Don't redirect, let AuthContext handle it
          return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
        }
      } catch (e) {
        // Invalid user data, redirect to login
        return <Navigate to="/login" replace />;
      }
    }
    
    return <Navigate to="/login" replace />;
  }
  
  if (user?.role === 'admin') return children; // Admin can access everything
  if (user?.role === 'member') return children;
  if (user?.role === 'district_president') return <Navigate to="/district-president-dashboard" replace />;
  if (user?.role === 'town_president') return <Navigate to="/town-president-dashboard" replace />;
  return <Navigate to="/login" replace />;
};

// STK Manager route component (for STK birim başk)
const STKManagerRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role === 'admin') return children; // Admin can access everything
  if (user?.role === 'member' && (user?.position === 'STK birim başk' || user?.position === 'Stk Birim Başk')) {
    return children;
  }
  return <Navigate to="/member-dashboard" />;
};

// District President route component
const DistrictPresidentRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role === 'admin') return children; // Admin can access everything
  if (user?.role === 'district_president') return children;
  return <Navigate to="/login" />;
};

// Town President route component
const TownPresidentRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role === 'admin') return children; // Admin can access everything
  if (user?.role === 'town_president') return children;
  return <Navigate to="/login" />;
};

// Public route component (redirects to appropriate dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  
  // SORUN #3 FIX: Loading durumunu düzgün kontrol et
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }
  
  // Chief observer login sayfasını kontrol et
  // Chief observer'lar AuthContext kullanmıyor, localStorage kontrolü yap
  const userRole = localStorage.getItem('userRole');
  const isChiefObserverLoggedIn = userRole === 'chief_observer' && localStorage.getItem('isLoggedIn') === 'true';
  
  if (isChiefObserverLoggedIn && window.location.pathname === '/chief-observer-login') {
    return <Navigate to="/chief-observer-dashboard" replace />;
  }
  
  // SORUN #3 FIX: Eğer giriş yapılmamışsa children'ı göster (döngü yok)
  if (!isLoggedIn) return children;
  
  // SORUN #3 FIX: Giriş yapılmışsa, sadece LOGIN sayfasındaysak yönlendir
  // Diğer sayfalarda yönlendirme yapma
  const currentPath = window.location.pathname;
  if (currentPath !== '/login') {
    return children; // Döngüyü önlemek için children'ı döndür
  }
  
  // Sadece /login sayfasındayken yönlendir
  if (user?.role === 'admin') return <Navigate to="/" replace />;
  if (user?.role === 'member') return <Navigate to="/member-dashboard" replace />;
  if (user?.role === 'district_president') return <Navigate to="/district-president-dashboard" replace />;
  if (user?.role === 'town_president') return <Navigate to="/town-president-dashboard" replace />;
  return <Navigate to="/" replace />;
};

function AppContent() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = React.useState(false);
  const { isLoggedIn, user } = useAuth();

  const [quickActionModal, setQuickActionModal] = React.useState({ open: false, type: null });

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
  const navigate = useNavigate();
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
          {/* Admin-only routes (accessible in production for admins) */}
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
            path="/chief-observer-login" 
            element={
              <PublicRoute>
                <ChiefObserverLoginPage />
              </PublicRoute>
            } 
          />
          <Route 
            path="/chief-observer-dashboard" 
            element={<ChiefObserverDashboardPage />} 
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
            <Route path="/election-preparation" element={<ElectionPreparationPage />} />
            <Route path="/election-preparation/ballot-boxes" element={<BallotBoxesPage />} />
            <Route path="/election-preparation/ballot-boxes/:id/details" element={<BallotBoxDetailsPage />} />
            <Route path="/election-preparation/observers" element={<ObserversPage />} />
            <Route path="/election-preparation/representatives" element={<RepresentativesPage />} />
            <Route path="/election-preparation/neighborhoods" element={<NeighborhoodsPage />} />
            <Route path="/election-preparation/villages" element={<VillagesPage />} />
            <Route path="/elections" element={<ElectionsListPage />} />
            <Route path="/election-results/:electionId" element={<ElectionResultsPage />} />
            <Route path="/bulk-sms" element={<BulkSmsPage />} />
            <Route path="/election-preparation/groups" element={<GroupsPage />} />
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
        </Suspense>
        
        {/* Chatbot Floating Button - Only show for admin users */}
        {isLoggedIn && user?.role === 'admin' && (
          <button
            onClick={() => setIsChatbotOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
            title="İlçe Sekreterlik Asistanı"
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
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
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