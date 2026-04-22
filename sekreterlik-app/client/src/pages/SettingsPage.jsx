import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../utils/ApiService';
import { isMobile } from '../utils/capacitorUtils';
import { hasPermission as checkPermission } from '../utils/permissions';
import AdminSettings from '../components/AdminSettings';
import RegionsSettings from '../components/RegionsSettings';
import PositionsSettings from '../components/PositionsSettings';
import MemberUsersSettings from '../components/MemberUsersSettings';
import DistrictsSettings from '../components/DistrictsSettings';
import TownsSettings from '../components/TownsSettings';
import NeighborhoodsSettings from '../components/NeighborhoodsSettings';
import VillagesSettings from '../components/VillagesSettings';
import STKSettings from '../components/STKSettings';
import PublicInstitutionSettings from '../components/PublicInstitutionSettings';
import MosquesSettings from '../components/MosquesSettings';
import EventCategoriesSettings from '../components/EventCategoriesSettings';
import AuthorizationSettings from '../components/AuthorizationSettings';
import BylawsSettings from '../components/BylawsSettings';
import GeminiApiSettings from '../components/GeminiApiSettings';
import FirebaseConfigSettings from '../components/FirebaseConfigSettings';
import DeploymentConfigSettings from '../components/DeploymentConfigSettings';
import SmsSettings from '../components/SmsSettings';
import PushNotificationSettings from '../components/PushNotificationSettings';
import SyncToFirebasePage from './SyncToFirebasePage';
import PollsPage from './PollsPage';
import MemberDashboardAnalyticsPage from './MemberDashboardAnalyticsPage';
import AppBrandingSettings from '../components/AppBrandingSettings';
import ThemeSettings from '../components/ThemeSettings';
import PerformanceScoreSettings from '../components/PerformanceScoreSettings';
import SeçimEkleSettings from '../components/SeçimEkleSettings';
import ApiKeySettings from '../components/ApiKeySettings';
import VoterListSettings from '../components/VoterListSettings';
import DataRetentionSettings from '../components/DataRetentionSettings';
import DataDeletionRequestsAdmin from '../components/DataDeletionRequestsAdmin';
import DataProcessingInventory from '../components/DataProcessingInventory';
import KvkkComplianceReport from '../components/KvkkComplianceReport';
import DataBreachProcedure from '../components/DataBreachProcedure';
import VerbisGuide from '../components/VerbisGuide';
import AuditLogSettings from '../components/AuditLogSettings';
import AdminNotificationPanel from '../components/AdminNotificationPanel';
import MembershipApplicationsAdmin from '../components/MembershipApplicationsAdmin';
import LandingPageSettings from '../components/LandingPageSettings';
import {
  SettingsHeader,
  SettingsSummaryCards,
  SettingsTabs
} from '../components/Settings';
import NativeSettingsList from '../components/mobile/NativeSettingsList';

const SettingsPage = ({ tab }) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Başlangıç tab'ını prop'a göre set et
  const getInitialTab = () => {
    if (tab === 'stks') return 'stks';
    if (tab === 'public-institutions') return 'public-institutions';
    if (searchParams.get('tab') === 'stks') return 'stks';
    if (searchParams.get('tab') === 'public-institutions') return 'public-institutions';
    return 'admin';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [grantedPermissions, setGrantedPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const isSTKManagement = searchParams.get('tab') === 'stks' || tab === 'stks';
  const isPublicInstitutionManagement = searchParams.get('tab') === 'public-institutions' || tab === 'public-institutions';

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Check if user has permission for a tab (centralized utility)
  const hasPermission = React.useCallback((tabName) => {
    return checkPermission(tabName, isAdmin, grantedPermissions, loadingPermissions);
  }, [isAdmin, loadingPermissions, grantedPermissions]);

  // Load user permissions
  useEffect(() => {
    const loadPermissions = async () => {
      if (isAdmin) {
        // Admin has all permissions
        setGrantedPermissions(['*']);
        setLoadingPermissions(false);
        return;
      }

      if (user?.role === 'member' && user?.position) {
        try {
          const perms = await ApiService.getPermissionsForPosition(user.position);
          setGrantedPermissions(Array.isArray(perms) ? perms : []);
        } catch (error) {
          console.error('Error loading permissions:', error);
          setGrantedPermissions([]);
        }
      } else {
        setGrantedPermissions([]);
      }
      setLoadingPermissions(false);
    };

    loadPermissions();
  }, [user, isAdmin]);

  // Set initial tab based on URL params and permissions
  useEffect(() => {
    if (loadingPermissions) return;

    // Eğer tab prop'u geçilmişse, direkt o tab'ı aç (yetki kontrolü MemberDashboardPage'de yapılıyor)
    if (tab) {
      if (tab === 'stks') {
        setActiveTab('stks');
        return;
      }
      if (tab === 'public-institutions') {
        setActiveTab('public-institutions');
        return;
      }
    }

    // URL params kontrolü (geriye dönük uyumluluk)
    if (isSTKManagement) {
      setActiveTab('stks');
    } else if (isPublicInstitutionManagement) {
      setActiveTab('public-institutions');
    }
  }, [tab, isSTKManagement, isPublicInstitutionManagement, loadingPermissions]);

  const mobileView = isMobile();

  // Tab listesi oluştur (native görünüm için)
  const getTabsList = () => {
    const tabs = [
      { id: 'admin', name: 'Kullanıcı Bilgileri', description: 'Mevcut admin bilgileri', permission: '*' },
      { id: 'push-notifications', name: 'Bildirim Ayarları', description: 'Push notification yönetimi', permission: '*' },
      { id: 'notification-panel', name: 'Bildirim Gonder', description: 'Uyelere bildirim gonderme paneli', permission: '*' },
      { id: 'regions', name: 'Bölge Ekle', description: 'Bölge tanımlama', permission: 'add_region' },
      { id: 'positions', name: 'Görev Ekle', description: 'Görev tanımlama', permission: 'add_position' },
      { id: 'member-users', name: 'Üye Kullanıcıları', description: 'Üye kullanıcı yönetimi', permission: 'manage_member_users' },
      { id: 'membership-applications', name: 'Basvurular', description: 'Uyelik basvuru yonetimi', permission: '*' },
      { id: 'landing-page', name: 'Tanıtım Sayfası', description: 'Halka açık landing sayfası CMS', permission: '*' },
      { id: 'districts', name: 'İlçe Ekle', description: 'İlçe tanımlama', permission: 'add_district' },
      { id: 'towns', name: 'Belde Ekle', description: 'Belde tanımlama', permission: 'add_town' },
      { id: 'neighborhoods', name: 'Mahalle Ekle', description: 'Mahalle tanımlama', permission: 'add_neighborhood' },
      { id: 'villages', name: 'Köy Ekle', description: 'Köy tanımlama', permission: 'add_village' },
      { id: 'stks', name: 'STK Ekle', description: 'STK yönetimi', permission: 'manage_stk' },
      { id: 'public-institutions', name: 'Kamu Kurumu Ekle', description: 'Kamu kurumu yönetimi', permission: 'add_public_institution' },
      { id: 'mosques', name: 'Cami Ekle', description: 'Cami tanımlama', permission: 'add_mosque' },
      { id: 'event-categories', name: 'Etkinlik Kategorileri', description: 'Etkinlik kategorisi yönetimi', permission: 'manage_event_categories' },
      { id: 'authorization', name: 'Yetkilendirme', description: 'Kullanıcı yetkilendirme', permission: false },
      { id: 'bylaws', name: 'Tüzük Yönetimi', description: 'Tüzük düzenleme', permission: 'manage_bylaws' },
      { id: 'polls', name: 'Anketler', description: 'Anket yönetimi', permission: 'manage_polls' },
      { id: 'member-dashboard-analytics', name: 'Üye Dashboard Analitik', description: 'Dashboard analitikleri', permission: 'access_member_dashboard_analytics' },
      { id: 'app-branding', name: 'Uygulama Markası', description: 'Uygulama marka ayarları', permission: 'manage_app_branding' },
      { id: 'theme-settings', name: 'Tema Ozellestirme', description: 'Renk temasi ve gorunum ayarlari', permission: 'manage_app_branding' },
      { id: 'voter-list', name: 'Seçmen Listesi', description: 'Seçmen listesi yönetimi', permission: 'voter-list' },
      { id: 'seçim-ekle', name: 'Seçim Ekle', description: 'Seçim yönetimi', permission: 'manage_elections' },
    ];

    // Admin-only tabs
    if (isAdmin) {
      tabs.push(
        { id: 'gemini-api', name: 'Gemini AI', description: 'Gemini AI API ayarları', permission: false },
        { id: 'firebase-config', name: 'Firebase Config', description: 'Firebase yapılandırması', permission: false },
        { id: 'deployment-config', name: 'Deployment Config', description: 'Deployment ayarları', permission: false },
        { id: 'sms-config', name: 'SMS Config', description: 'SMS ayarları', permission: false },
        { id: 'firebase-sync', name: 'Firebase Sync', description: 'Firebase senkronizasyonu', permission: false },
        { id: 'performance-score', name: 'Performance Score', description: 'Performans skoru ayarları', permission: false },
        { id: 'api-keys', name: 'API Keys', description: 'API anahtarları', permission: false },
        { id: 'data-retention', name: 'Veri Saklama (KVKK)', description: 'Veri saklama suresi ayari', permission: false },
        { id: 'data-deletion-requests', name: 'Veri Silme Talepleri', description: 'KVKK veri silme talepleri', permission: false },
        { id: 'data-processing-inventory', name: 'Veri Isleme Envanteri', description: 'KVKK veri isleme envanteri', permission: false },
        { id: 'kvkk-compliance', name: 'KVKK Uyum Durumu', description: 'KVKK uyum raporu', permission: false },
        { id: 'data-breach-procedure', name: 'Veri Ihlali Proseduru', description: 'Veri ihlali bildirim proseduru', permission: false },
        { id: 'verbis-guide', name: 'VERBIS Kayit Rehberi', description: 'VERBIS kayit bilgilendirme', permission: false },
        { id: 'audit-log', name: 'Denetim Kayitlari', description: 'Sistem denetim log kayitlari', permission: false }
      );
    }

    return tabs;
  };

  // Native mobile görünümü için
  if (mobileView && !tab && !isSTKManagement && !isPublicInstitutionManagement) {
    return (
      <>
        <NativeSettingsList
          tabs={getTabsList()}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          grantedPermissions={grantedPermissions}
          isAdmin={isAdmin}
        />

        {/* Tab Content */}
        {loadingPermissions ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-6 flex justify-center items-center min-h-[400px]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              {!hasPermission(activeTab) ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Yetki Gerekli</h3>
                  <p className="text-gray-600 dark:text-gray-400">Bu sayfaya erişmek için gerekli yetkiniz bulunmamaktadır.</p>
                </div>
              ) : (
                <>
                  {activeTab === 'admin' && <AdminSettings />}
                  {activeTab === 'push-notifications' && hasPermission('push-notifications') && <PushNotificationSettings />}
                  {activeTab === 'notification-panel' && hasPermission('notification-panel') && <AdminNotificationPanel />}
                  {activeTab === 'regions' && hasPermission('regions') && <RegionsSettings />}
                  {activeTab === 'positions' && hasPermission('positions') && <PositionsSettings />}
                  {activeTab === 'member-users' && hasPermission('member-users') && <MemberUsersSettings />}
                  {activeTab === 'membership-applications' && hasPermission('membership-applications') && <MembershipApplicationsAdmin />}
                  {activeTab === 'landing-page' && hasPermission('landing-page') && <LandingPageSettings />}
                  {activeTab === 'districts' && hasPermission('districts') && <DistrictsSettings />}
                  {activeTab === 'towns' && hasPermission('towns') && <TownsSettings />}
                  {activeTab === 'neighborhoods' && hasPermission('neighborhoods') && <NeighborhoodsSettings />}
                  {activeTab === 'villages' && hasPermission('villages') && <VillagesSettings />}
                  {activeTab === 'stks' && hasPermission('stks') && <STKSettings />}
                  {activeTab === 'public-institutions' && hasPermission('public-institutions') && <PublicInstitutionSettings />}
                  {activeTab === 'mosques' && hasPermission('mosques') && <MosquesSettings />}
                  {activeTab === 'event-categories' && hasPermission('event-categories') && <EventCategoriesSettings />}
                  {activeTab === 'authorization' && hasPermission('authorization') && <AuthorizationSettings />}
                  {activeTab === 'bylaws' && hasPermission('bylaws') && <BylawsSettings />}
                  {activeTab === 'gemini-api' && hasPermission('gemini-api') && <GeminiApiSettings />}
                  {activeTab === 'firebase-config' && hasPermission('firebase-config') && <FirebaseConfigSettings />}
                  {activeTab === 'deployment-config' && hasPermission('deployment-config') && <DeploymentConfigSettings />}
                  {activeTab === 'sms-config' && hasPermission('sms-config') && <SmsSettings />}
                  {activeTab === 'firebase-sync' && hasPermission('firebase-sync') && <SyncToFirebasePage />}
                  {activeTab === 'polls' && hasPermission('polls') && <PollsPage />}
                  {activeTab === 'performance-score' && hasPermission('performance-score') && <PerformanceScoreSettings />}
                  {activeTab === 'member-dashboard-analytics' && hasPermission('member-dashboard-analytics') && <MemberDashboardAnalyticsPage />}
                  {activeTab === 'app-branding' && hasPermission('app-branding') && <AppBrandingSettings />}
                  {activeTab === 'theme-settings' && hasPermission('theme-settings') && <ThemeSettings />}
                  {activeTab === 'seçim-ekle' && hasPermission('seçim-ekle') && <SeçimEkleSettings />}
                  {activeTab === 'api-keys' && hasPermission('api-keys') && <ApiKeySettings />}
                  {activeTab === 'voter-list' && hasPermission('voter-list') && <VoterListSettings />}
                  {activeTab === 'data-retention' && hasPermission('data-retention') && <DataRetentionSettings />}
                  {activeTab === 'data-deletion-requests' && hasPermission('data-deletion-requests') && <DataDeletionRequestsAdmin />}
                  {activeTab === 'data-processing-inventory' && hasPermission('data-processing-inventory') && <DataProcessingInventory />}
                  {activeTab === 'kvkk-compliance' && hasPermission('kvkk-compliance') && <KvkkComplianceReport />}
                  {activeTab === 'data-breach-procedure' && hasPermission('data-breach-procedure') && <DataBreachProcedure />}
                  {activeTab === 'verbis-guide' && hasPermission('verbis-guide') && <VerbisGuide />}
                  {activeTab === 'audit-log' && hasPermission('audit-log') && <AuditLogSettings />}
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop görünümü (mevcut)
  return (
    <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden pb-24 lg:pb-6">
      {/* Header Section */}
      {isSTKManagement && !loadingPermissions && hasPermission('stks') ? (
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">STK Yönetimi</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">STK ekleme, düzenleme ve silme işlemleri</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">STK Birim Başkanı</span>
              </div>
            </div>
          </div>
        </div>
      ) : isPublicInstitutionManagement && !loadingPermissions && hasPermission('public-institutions') ? (
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kamu Kurumu Yönetimi</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Kamu kurumu ekleme, düzenleme ve silme işlemleri</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <SettingsHeader />
          <SettingsSummaryCards />
          {!loadingPermissions && (
            <SettingsTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              grantedPermissions={grantedPermissions}
              isAdmin={isAdmin}
            />
          )}
        </>
      )}

      {/* Tab Content */}
      {loadingPermissions ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-6 min-h-[400px] animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-72"></div>
            <div className="space-y-3 mt-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            {/* STK ve Kamu Kurumu tab'ları - yetki kontrolü ile */}
            {(tab === 'stks' || isSTKManagement) && hasPermission('stks') && <STKSettings />}
            {(tab === 'public-institutions' || isPublicInstitutionManagement) && hasPermission('public-institutions') && <PublicInstitutionSettings />}
            {((tab === 'stks' || isSTKManagement) && !hasPermission('stks')) && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Yetki Gerekli</h3>
                <p className="text-gray-600 dark:text-gray-400">STK yönetimi için gerekli yetkiniz bulunmamaktadır.</p>
              </div>
            )}
            {((tab === 'public-institutions' || isPublicInstitutionManagement) && !hasPermission('public-institutions')) && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Yetki Gerekli</h3>
                <p className="text-gray-600 dark:text-gray-400">Kamu kurumu yönetimi için gerekli yetkiniz bulunmamaktadır.</p>
              </div>
            )}
            {/* Diğer tab'lar için yetki kontrolü yap */}
            {!tab && !isSTKManagement && !isPublicInstitutionManagement && (
              <>
                {!hasPermission(activeTab) ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Yetki Gerekli</h3>
                    <p className="text-gray-600 dark:text-gray-400">Bu sayfaya erişmek için gerekli yetkiniz bulunmamaktadır.</p>
                  </div>
                ) : (
                  <>
                    {activeTab === 'admin' && <AdminSettings />}
                    {activeTab === 'push-notifications' && hasPermission('push-notifications') && <PushNotificationSettings />}
                  {activeTab === 'notification-panel' && hasPermission('notification-panel') && <AdminNotificationPanel />}
                    {activeTab === 'regions' && hasPermission('regions') && <RegionsSettings />}
                    {activeTab === 'positions' && hasPermission('positions') && <PositionsSettings />}
                    {activeTab === 'member-users' && hasPermission('member-users') && <MemberUsersSettings />}
                    {activeTab === 'membership-applications' && hasPermission('membership-applications') && <MembershipApplicationsAdmin />}
                  {activeTab === 'landing-page' && hasPermission('landing-page') && <LandingPageSettings />}
                    {activeTab === 'districts' && hasPermission('districts') && <DistrictsSettings />}
                    {activeTab === 'towns' && hasPermission('towns') && <TownsSettings />}
                    {activeTab === 'neighborhoods' && hasPermission('neighborhoods') && <NeighborhoodsSettings />}
                    {activeTab === 'villages' && hasPermission('villages') && <VillagesSettings />}
                    {activeTab === 'stks' && hasPermission('stks') && <STKSettings />}
                    {activeTab === 'public-institutions' && hasPermission('public-institutions') && <PublicInstitutionSettings />}
                    {activeTab === 'mosques' && hasPermission('mosques') && <MosquesSettings />}
                    {activeTab === 'event-categories' && hasPermission('event-categories') && <EventCategoriesSettings />}
                    {activeTab === 'authorization' && hasPermission('authorization') && <AuthorizationSettings />}
                    {activeTab === 'bylaws' && hasPermission('bylaws') && <BylawsSettings />}
                    {activeTab === 'gemini-api' && hasPermission('gemini-api') && <GeminiApiSettings />}
                    {activeTab === 'firebase-config' && hasPermission('firebase-config') && <FirebaseConfigSettings />}
                    {activeTab === 'deployment-config' && hasPermission('deployment-config') && <DeploymentConfigSettings />}
                    {activeTab === 'sms-config' && hasPermission('sms-config') && <SmsSettings />}
                    {activeTab === 'firebase-sync' && hasPermission('firebase-sync') && <SyncToFirebasePage />}
                    {activeTab === 'polls' && hasPermission('polls') && <PollsPage />}
                    {activeTab === 'performance-score' && hasPermission('performance-score') && <PerformanceScoreSettings />}
                    {activeTab === 'member-dashboard-analytics' && hasPermission('member-dashboard-analytics') && <MemberDashboardAnalyticsPage />}
                    {activeTab === 'app-branding' && hasPermission('app-branding') && <AppBrandingSettings />}
                    {activeTab === 'theme-settings' && hasPermission('theme-settings') && <ThemeSettings />}
                    {activeTab === 'seçim-ekle' && hasPermission('seçim-ekle') && <SeçimEkleSettings />}
                    {activeTab === 'api-keys' && hasPermission('api-keys') && <ApiKeySettings />}
                    {activeTab === 'voter-list' && hasPermission('voter-list') && <VoterListSettings />}
                    {activeTab === 'data-retention' && hasPermission('data-retention') && <DataRetentionSettings />}
                    {activeTab === 'data-deletion-requests' && hasPermission('data-deletion-requests') && <DataDeletionRequestsAdmin />}
                    {activeTab === 'data-processing-inventory' && hasPermission('data-processing-inventory') && <DataProcessingInventory />}
                    {activeTab === 'kvkk-compliance' && hasPermission('kvkk-compliance') && <KvkkComplianceReport />}
                    {activeTab === 'data-breach-procedure' && hasPermission('data-breach-procedure') && <DataBreachProcedure />}
                    {activeTab === 'verbis-guide' && hasPermission('verbis-guide') && <VerbisGuide />}
                    {activeTab === 'audit-log' && hasPermission('audit-log') && <AuditLogSettings />}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;