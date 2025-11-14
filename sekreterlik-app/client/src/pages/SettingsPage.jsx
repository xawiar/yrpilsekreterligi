import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../utils/ApiService';
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
import GroqApiSettings from '../components/GroqApiSettings';
import FirebaseConfigSettings from '../components/FirebaseConfigSettings';
import DeploymentConfigSettings from '../components/DeploymentConfigSettings';
import SmsSettings from '../components/SmsSettings';
import SyncToFirebasePage from './SyncToFirebasePage';
import PollsPage from './PollsPage';
import MemberDashboardAnalyticsPage from './MemberDashboardAnalyticsPage';
import AppBrandingSettings from '../components/AppBrandingSettings';
import PerformanceScoreSettings from '../components/PerformanceScoreSettings';
import { 
  SettingsHeader, 
  SettingsSummaryCards, 
  SettingsTabs 
} from '../components/Settings';

const SettingsPage = ({ tab }) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('admin');
  const [grantedPermissions, setGrantedPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const isSTKManagement = searchParams.get('tab') === 'stks' || tab === 'stks';
  const isPublicInstitutionManagement = searchParams.get('tab') === 'public-institutions' || tab === 'public-institutions';

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Check if user has permission for a tab
  const hasPermission = React.useCallback((tabName) => {
    if (isAdmin) return true;
    if (loadingPermissions) return false;

    const permissionMap = {
      'admin': true, // Everyone can see their own info
      'regions': grantedPermissions.includes('add_region'),
      'positions': grantedPermissions.includes('add_position'),
      'member-users': grantedPermissions.includes('manage_member_users'),
      'districts': grantedPermissions.includes('add_district'),
      'towns': grantedPermissions.includes('add_town'),
      'neighborhoods': grantedPermissions.includes('add_neighborhood'),
      'villages': grantedPermissions.includes('add_village'),
      'stks': grantedPermissions.includes('manage_stk') || grantedPermissions.includes('add_stk'),
      'public-institutions': grantedPermissions.includes('add_public_institution'),
      'mosques': grantedPermissions.includes('add_mosque'),
      'event-categories': grantedPermissions.includes('manage_event_categories'),
      'authorization': false, // Admin only
      'bylaws': grantedPermissions.includes('manage_bylaws'),
      'groq-api': false, // Admin only
      'firebase-config': false, // Admin only
      'deployment-config': false, // Admin only
      'sms-config': false, // Admin only
      'firebase-sync': false, // Admin only
      'polls': grantedPermissions.includes('manage_polls'),
      'member-dashboard-analytics': grantedPermissions.includes('access_member_dashboard_analytics'),
      'app-branding': grantedPermissions.includes('manage_app_branding'),
    };

    return permissionMap[tabName] || false;
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

    if (isSTKManagement && hasPermission('stks')) {
      setActiveTab('stks');
    } else if (isPublicInstitutionManagement && hasPermission('public-institutions')) {
      setActiveTab('public-institutions');
    } else if (isSTKManagement && !hasPermission('stks')) {
      // If user doesn't have permission for STK, redirect to admin tab
      setActiveTab('admin');
    } else if (isPublicInstitutionManagement && !hasPermission('public-institutions')) {
      // If user doesn't have permission for public institutions, redirect to admin tab
      setActiveTab('admin');
    }
  }, [isSTKManagement, isPublicInstitutionManagement, loadingPermissions, hasPermission]);

  return (
    <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
      {/* Header Section */}
      {isSTKManagement && !loadingPermissions && hasPermission('stks') ? (
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="p-6 flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
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
                {activeTab === 'regions' && hasPermission('regions') && <RegionsSettings />}
                {activeTab === 'positions' && hasPermission('positions') && <PositionsSettings />}
                {activeTab === 'member-users' && hasPermission('member-users') && <MemberUsersSettings />}
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
                {activeTab === 'groq-api' && hasPermission('groq-api') && <GroqApiSettings />}
                {activeTab === 'firebase-config' && hasPermission('firebase-config') && <FirebaseConfigSettings />}
                {activeTab === 'deployment-config' && hasPermission('deployment-config') && <DeploymentConfigSettings />}
                {activeTab === 'sms-config' && hasPermission('sms-config') && <SmsSettings />}
                {activeTab === 'firebase-sync' && hasPermission('firebase-sync') && <SyncToFirebasePage />}
                {activeTab === 'polls' && hasPermission('polls') && <PollsPage />}
                {activeTab === 'performance-score' && hasPermission('performance-score') && <PerformanceScoreSettings />}
                {activeTab === 'member-dashboard-analytics' && hasPermission('member-dashboard-analytics') && <MemberDashboardAnalyticsPage />}
                {activeTab === 'app-branding' && hasPermission('app-branding') && <AppBrandingSettings />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;