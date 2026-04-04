import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import { isNative } from './utils/capacitorUtils';
import {
  ProtectedRoute,
  AdminRoute,
  MemberRoute,
  DistrictPresidentRoute,
  TownPresidentRoute,
  STKManagerRoute,
  PublicInstitutionManagerRoute,
  MosqueManagerRoute,
  TownPresidentRoleRoute,
  PublicRoute,
  ChiefObserverRoute,
  CoordinatorRoute
} from './routes/RoleGuards';

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
const ElectionResultEditPage = lazy(() => import('./pages/ElectionResultEditPage'));
const ElectionComparisonPage = lazy(() => import('./pages/ElectionComparisonPage'));
const PublicElectionResultsPage = lazy(() => import('./pages/PublicElectionResultsPage'));
const BulkSmsPage = lazy(() => import('./pages/BulkSmsPage'));
const DistrictPresidentDashboardPage = lazy(() => import('./pages/DistrictPresidentDashboardPage'));
const TownPresidentDashboardPage = lazy(() => import('./pages/TownPresidentDashboardPage'));
const ChiefObserverLoginPage = lazy(() => import('./pages/ChiefObserverLoginPage'));
const ChiefObserverDashboardPage = lazy(() => import('./pages/ChiefObserverDashboardPage'));
const CoordinatorLoginPage = lazy(() => import('./pages/CoordinatorLoginPage'));
const CoordinatorDashboardPage = lazy(() => import('./pages/CoordinatorDashboardPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

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

// Page transition wrapper component
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

// Public Election Results - Standalone page without any layout
function PublicElectionResultsWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PublicElectionResultsPage />
    </Suspense>
  );
}

// Router içinde kullanılacak component - useNavigate burada güvenli
function RouterContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = React.useState(false);
  const [quickActionModal, setQuickActionModal] = React.useState({ open: false, type: null });

  // Public route ise layout gösterme
  if (location.pathname.startsWith('/public/election-results/')) {
    return <PublicElectionResultsWrapper />;
  }

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
          {/* Debug/Admin Routes - Only available in development mode */}
          {import.meta.env.DEV && (
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

          {/* Member Notifications Route */}
          <Route
            path="/member-notifications"
            element={
              <MemberRoute>
                <NotificationsPage />
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
            element={
              <ChiefObserverRoute>
                <ChiefObserverDashboardPage />
              </ChiefObserverRoute>
            }
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

          {/* Coordinator Routes */}
          <Route
            path="/coordinator-dashboard"
            element={
              <CoordinatorRoute>
                <CoordinatorDashboardPage />
              </CoordinatorRoute>
            }
          />

          {/* Coordinator Login - Artık /login?type=coordinator olarak yönlendirilecek */}
          <Route
            path="/coordinator-login"
            element={
              <PublicRoute>
                <Navigate to="/login?type=coordinator" replace />
              </PublicRoute>
            }
          />

          {/* Election Result Edit - Admin ve Coordinator erişebilir */}
          <Route
            path="/election-results/:electionId/edit/:resultId"
            element={
              <CoordinatorRoute>
                <ElectionResultEditPage />
              </CoordinatorRoute>
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
                        <AnimatePresence mode="wait">
                          <Routes key={location.pathname}>
                            <Route path="/members" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><MembersPage /></Suspense></PageTransition>} />
                            <Route path="/teşkilat" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><TeşkilatPage /></Suspense></PageTransition>} />
                            <Route path="/teşkilat/ilçeler" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><DistrictsPage /></Suspense></PageTransition>} />
                            <Route path="/teşkilat/kadın-kolları" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><KadınKollarıPage /></Suspense></PageTransition>} />
                            <Route path="/teşkilat/gençlik-kolları" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><GenclikKollarıPage /></Suspense></PageTransition>} />
                            <Route path="/districts" element={<Navigate to="/teşkilat/ilçeler" replace />} />
                            <Route path="/calendar" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><CalendarPage /></Suspense></PageTransition>} />
                            <Route path="/districts/:id/members" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><DistrictMembersPage /></Suspense></PageTransition>} />
                            <Route path="/districts/:id/details" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><DistrictDetailsPage /></Suspense></PageTransition>} />
                            <Route path="/towns/:id/members" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><TownMembersPage /></Suspense></PageTransition>} />
                            <Route path="/towns/:id/details" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><TownDetailsPage /></Suspense></PageTransition>} />
                            <Route path="/election-preparation/*" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><ElectionPreparationPage /></Suspense></PageTransition>} />
                            <Route path="/election-preparation/ballot-boxes/:id/details" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><BallotBoxDetailsPage /></Suspense></PageTransition>} />
                            <Route path="/elections" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><ElectionsListPage /></Suspense></PageTransition>} />
                            <Route path="/election-results/:electionId" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><ElectionResultsPage /></Suspense></PageTransition>} />
                            <Route path="/election-comparison" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><ElectionComparisonPage /></Suspense></PageTransition>} />
                            <Route path="/bulk-sms" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><BulkSmsPage /></Suspense></PageTransition>} />
                            <Route path="/meetings" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><MeetingsPage /></Suspense></PageTransition>} />
                            <Route path="/events" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><EventsPage /></Suspense></PageTransition>} />
                            <Route path="/reports" element={<Navigate to="/" replace />} />
                            <Route path="/" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><ReportsPage /></Suspense></PageTransition>} />
                            <Route path="/archive" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><ArchivePage /></Suspense></PageTransition>} />
                            <Route path="/management-chart" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><ManagementChartPage /></Suspense></PageTransition>} />
                            <Route path="/settings/*" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><SettingsPage /></Suspense></PageTransition>} />
                            <Route path="/notifications" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><NotificationsPage /></Suspense></PageTransition>} />
                            <Route path="/sync-to-firebase" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><SyncToFirebasePage /></Suspense></PageTransition>} />
                            <Route path="/remove-duplicate-meetings" element={<PageTransition><Suspense fallback={<LoadingSpinner />}><RemoveDuplicateMeetingsPage /></Suspense></PageTransition>} />

                            {/* STK Manager Routes */}
                            <Route path="/stk-management" element={
                              <PageTransition><Suspense fallback={<LoadingSpinner />}><STKManagerRoute><SettingsPage /></STKManagerRoute></Suspense></PageTransition>
                            } />
                            <Route path="/stk-events" element={
                              <PageTransition><Suspense fallback={<LoadingSpinner />}><STKManagerRoute><EventsPage /></STKManagerRoute></Suspense></PageTransition>
                            } />
                          </Routes>
                        </AnimatePresence>
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
            className="fixed bottom-24 right-6 z-40 w-14 h-14 bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
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
  // Initialize Capacitor plugins for native apps
  useEffect(() => {
    if (isNative()) {
      // Initialize StatusBar and SplashScreen for native apps
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        StatusBar.setStyle({ style: 'dark' });
        StatusBar.setBackgroundColor({ color: '#3b82f6' });
      }).catch(() => {
        // Plugin not available (web)
      });

      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide();
      }).catch(() => {
        // Plugin not available (web)
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
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
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
