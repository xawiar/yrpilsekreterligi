/**
 * Native Mobile Member Dashboard Component
 * Üye dashboard'u için native mobil görünümü (sadece dashboard view)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';
import DataDeletionRequestButton from '../DataDeletionRequestButton';
import MemberProfilePanel from '../MemberProfilePanel';
import PersonalDocuments from '../PersonalDocuments';
import ProfileUpdateRequestModal from '../ProfileUpdateRequestModal';
import MemberProfileRequestsList from '../MemberProfileRequestsList';
import MemberApplicationsPanel from '../MemberApplicationsPanel';
import Modal from '../Modal';
import MemberRequestsPage from '../../pages/MemberRequestsPage';

const NativeMemberDashboard = ({
  member = null,
  user = null,
  grantedPermissions = [],
  onViewChange,
  onLogout,
  polls = [],
  pollResults = {},
  PollVotingComponent = null,
  PollResultsComponent = null,
  isWomenBranchPresident = false,
  isYouthBranchPresident = false,
  womenBranchManagement = [],
  youthBranchManagement = [],
  BranchManagementSection = null,
  loading = false
}) => {
  const getPermissionIcon = (permission) => {
    const icons = {
      'add_member': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3M9 7a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ),
      'create_meeting': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      'add_stk': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      'add_public_institution': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      'access_members_page': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      'access_meetings_page': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      'access_events_page': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      'access_election_preparation_page': (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    };

    return icons[permission] || (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    );
  };

  const getPermissionLabel = (permission) => {
    const labels = {
      'add_member': 'Üye Ekle',
      'create_meeting': 'Toplantı Oluştur',
      'add_stk': 'STK Ekle',
      'manage_stk': 'STK Yönet',
      'add_public_institution': 'Kamu Kurumu Ekle',
      'create_event': 'Etkinlik Oluştur',
      'access_ballot_boxes': 'Sandıklar',
      'add_ballot_box': 'Sandık Ekle',
      'access_observers': 'Müşahitler',
      'add_observer': 'Müşahit Ekle',
      'access_members_page': 'Üyeler',
      'access_meetings_page': 'Toplantılar',
      'access_events_page': 'Etkinlikler',
      'access_calendar_page': 'Takvim',
      'access_districts_page': 'İlçeler',
      'access_archive_page': 'Arşiv',
      'access_management_chart_page': 'Yönetim Şeması',
      'access_election_preparation_page': 'Seçim Hazırlık',
      'access_representatives_page': 'Temsilciler',
      'access_neighborhoods_page': 'Mahalleler',
      'access_villages_page': 'Köyler',
      'access_groups_page': 'Gruplar',
    };

    return labels[permission] || permission;
  };

  const getPermissionView = (permission) => {
    const viewMap = {
      'add_member': 'add-member',
      'create_meeting': 'create-meeting',
      'add_stk': 'stk-management',
      'manage_stk': 'stk-management',
      'add_public_institution': 'public-institution-management',
      'create_event': 'stk-events',
      'access_ballot_boxes': 'ballot-boxes',
      'add_ballot_box': 'ballot-boxes',
      'access_observers': 'observers',
      'add_observer': 'observers',
      'access_members_page': 'members-page',
      'access_meetings_page': 'meetings-page',
      'access_events_page': 'events-page',
      'access_calendar_page': 'calendar-page',
      'access_districts_page': 'districts-page',
      'access_archive_page': 'archive-page',
      'access_management_chart_page': 'management-chart-page',
      'access_election_preparation_page': 'election-preparation-page',
      'access_representatives_page': 'representatives-page',
      'access_neighborhoods_page': 'neighborhoods-page',
      'access_villages_page': 'villages-page',
      'access_groups_page': 'groups-page',
    };

    return viewMap[permission] || null;
  };

  // Kategorize menu yapisi
  const categories = [
    {
      title: 'Uye Islemleri',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      permissions: ['add_member', 'access_members_page', 'add_stk', 'manage_stk', 'add_public_institution', 'access_districts_page', 'access_representatives_page', 'access_neighborhoods_page', 'access_villages_page', 'access_groups_page'],
      color: 'from-teal-500 to-emerald-500',
    },
    {
      title: 'Toplanti & Etkinlik',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      permissions: ['create_meeting', 'access_meetings_page', 'create_event', 'access_events_page', 'access_calendar_page'],
      color: 'from-indigo-500 to-purple-500',
    },
    {
      title: 'Secim & Hazirlik',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      permissions: ['access_ballot_boxes', 'add_ballot_box', 'access_observers', 'add_observer', 'access_election_preparation_page'],
      color: 'from-orange-500 to-red-500',
    },
    {
      title: 'Diger',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      permissions: ['access_archive_page', 'access_management_chart_page'],
      color: 'from-gray-500 to-slate-500',
    },
  ];

  // Sadece kullanicinin yetkisi olan kategorileri filtrele
  const activeCategories = categories
    .map(cat => ({
      ...cat,
      activePermissions: cat.permissions.filter(p => grantedPermissions.includes(p)),
    }))
    .filter(cat => cat.activePermissions.length > 0);

  // Accordion state - ilk kategori acik
  const [openCategory, setOpenCategory] = React.useState(0);
  const [profileRequestModalOpen, setProfileRequestModalOpen] = React.useState(false);
  const [profileViewModalOpen, setProfileViewModalOpen] = React.useState(false);
  const [profileRequestsKey, setProfileRequestsKey] = React.useState(0);
  const [memberState, setMemberState] = React.useState(member);
  const [actionsExpanded, setActionsExpanded] = React.useState(false);
  const [actionsTab, setActionsTab] = React.useState('requests');
  const { isDarkMode, toggleTheme } = useTheme();
  React.useEffect(() => { setMemberState(member); }, [member]);

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Tema Toggle */}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
        >
          {isDarkMode ? (
            <>
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Gündüz</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Gece</span>
            </>
          )}
        </button>
      </div>

      {/* Profil Başlığı — tıklanınca profil modal */}
      {memberState && (
        <button
          type="button"
          onClick={() => setProfileViewModalOpen(true)}
          className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl shadow-lg p-4 text-white mb-4 flex items-center space-x-3 active:scale-95 transition-transform text-left"
        >
          {memberState.photo ? (
            <img src={memberState.photo} alt={memberState.name || 'Profil'} className="w-12 h-12 rounded-full object-cover border-2 border-white/30 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
              {(memberState.name || 'Ü').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{memberState.name || 'Üye'}</div>
            <div className="text-indigo-100 text-xs truncate">{memberState.position || 'Üye'}</div>
          </div>
          <svg className="w-5 h-5 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Kategorize Menu - Akordeon */}
      {activeCategories.length > 0 && (
        <div className="space-y-2">
          {activeCategories.map((category, index) => (
            <NativeCard key={category.title} className="overflow-hidden !p-0">
              {/* Akordeon basligi */}
              <button
                onClick={() => setOpenCategory(openCategory === index ? -1 : index)}
                className="flex items-center w-full px-4 py-3 text-left"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${category.color} flex items-center justify-center flex-shrink-0 text-white mr-3`}>
                  {category.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {category.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {category.activePermissions.length} islem
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openCategory === index ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Akordeon icerik */}
              {openCategory === index && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                  {category.activePermissions.map((permission) => {
                    const view = getPermissionView(permission);
                    if (!view) return null;
                    return (
                      <NativeButton
                        key={permission}
                        variant="secondary"
                        fullWidth
                        icon={getPermissionIcon(permission)}
                        onClick={() => onViewChange && onViewChange(view)}
                      >
                        {getPermissionLabel(permission)}
                      </NativeButton>
                    );
                  })}
                </div>
              )}
            </NativeCard>
          ))}
        </div>
      )}

      {/* Anketler */}
      {polls.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
            Anketler/Oylamalar
          </h2>
          {polls.map((poll) => {
            const isActive = poll.status === 'active' && new Date(poll.endDate) > new Date();
            const results = pollResults[poll.id];
            
            return (
              <NativeCard key={poll.id}>
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-2">
                  {poll.title}
                </div>
                {poll.description && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {poll.description}
                  </div>
                )}
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                    isActive
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {isActive ? 'Aktif' : 'Sonlanmış'}
                  </span>
                </div>
                {isActive && PollVotingComponent && (
                  <PollVotingComponent 
                    poll={poll} 
                    memberId={member?.id || user?.memberId || user?.id}
                    onVote={() => {}}
                  />
                )}
                {!isActive && results && PollResultsComponent && (
                  <PollResultsComponent results={results} />
                )}
              </NativeCard>
            );
          })}
        </div>
      )}

      {/* Kişisel Belgeler paneli kaldırıldı — Profilim modal'ı içinde */}

      {/* Tanıtım Sayfası Yönetimi — yetkisi varsa görünür */}
      {grantedPermissions.includes('manage_landing_page') && (
        <button
          type="button"
          onClick={() => onViewChange && onViewChange('landing-page')}
          className="block w-full text-left bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 active:scale-95 transition-transform"
        >
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">Tanıtım Sayfası</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Landing sayfası içeriğini düzenle</div>
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
          className="block bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 active:scale-95 transition-transform"
        >
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">Seçmen Sorgulama</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">TC, ad, soyad, sandık no ile ara</div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Taleplerim & Başvurularım — Akordeon */}
      <NativeCard className="!p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setActionsExpanded((v) => !v)}
          className="w-full flex items-center px-4 py-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white mr-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
              Taleplerim & Başvurularım
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Talep oluştur, başvurulara katıl
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
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <button
                type="button"
                onClick={() => setActionsTab('requests')}
                className={`flex-1 py-3 px-2 text-xs font-medium ${
                  actionsTab === 'requests'
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 bg-white dark:bg-gray-800'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Talepler
              </button>
              <button
                type="button"
                onClick={() => setActionsTab('applications')}
                className={`flex-1 py-3 px-2 text-xs font-medium ${
                  actionsTab === 'applications'
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 bg-white dark:bg-gray-800'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Başvurular
              </button>
            </div>
            <div className="p-1">
              {actionsTab === 'requests' && <MemberRequestsPage />}
              {actionsTab === 'applications' && memberState && <MemberApplicationsPanel member={memberState} />}
            </div>
          </div>
        )}
      </NativeCard>

      {/* Profil Görüntüleme Modal */}
      {memberState && (
        <Modal
          isOpen={profileViewModalOpen}
          onClose={() => setProfileViewModalOpen(false)}
          title="Profilim"
        >
          <div className="space-y-4">
            <MemberProfilePanel
              member={memberState}
              onRequestChange={() => {
                setProfileViewModalOpen(false);
                setProfileRequestModalOpen(true);
              }}
              onPhotoUpdated={(newUrl) => setMemberState((m) => ({ ...m, photo: newUrl }))}
            />
            <MemberProfileRequestsList
              key={profileRequestsKey}
              memberId={memberState.id}
            />
            {/* Kişisel Belgeler — profil modal içinde */}
            {memberState?.id && <PersonalDocuments memberId={memberState.id} />}
          </div>
        </Modal>
      )}

      {/* Profil Değişiklik Talebi Modal */}
      {memberState && (
        <ProfileUpdateRequestModal
          isOpen={profileRequestModalOpen}
          onClose={() => setProfileRequestModalOpen(false)}
          member={memberState}
          onSubmitted={() => setProfileRequestsKey((k) => k + 1)}
        />
      )}

      {/* KVKK - Veri Silme Talep Butonu */}
      <DataDeletionRequestButton memberId={memberState?.id} />

      {/* Logout Button */}
      <NativeButton
        variant="danger"
        fullWidth
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        }
        onClick={onLogout}
      >
        Çıkış Yap
      </NativeButton>
    </div>
  );
};

export default NativeMemberDashboard;

