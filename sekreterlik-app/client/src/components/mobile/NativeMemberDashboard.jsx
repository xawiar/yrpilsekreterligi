/**
 * Native Mobile Member Dashboard Component
 * Üye dashboard'u için native mobil görünümü (sadece dashboard view)
 */
import React from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

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

  // Hızlı işlemler için izinleri filtrele
  const quickActionPermissions = [
    'add_member', 'create_meeting', 'add_stk', 'manage_stk', 
    'add_public_institution', 'create_event', 'access_ballot_boxes', 
    'add_ballot_box', 'access_observers', 'add_observer'
  ].filter(perm => grantedPermissions.includes(perm));

  // Sayfa erişimleri için izinleri filtrele
  const pageAccessPermissions = [
    'access_members_page', 'access_meetings_page', 'access_events_page',
    'access_calendar_page', 'access_districts_page', 'access_archive_page',
    'access_management_chart_page', 'access_election_preparation_page',
    'access_representatives_page', 'access_neighborhoods_page',
    'access_villages_page', 'access_groups_page'
  ].filter(perm => grantedPermissions.includes(perm));

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Hoş Geldiniz
        </h1>
        {member && (
          <p className="text-gray-600 dark:text-gray-400 text-base">
            {member.name} - {member.position}
          </p>
        )}
      </div>

      {/* Hızlı İşlemler */}
      {quickActionPermissions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
            Hızlı İşlemler
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActionPermissions.map((permission) => {
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
        </div>
      )}

      {/* Sayfa Erişimleri */}
      {pageAccessPermissions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
            Sayfa Erişimleri
          </h2>
          <div className="space-y-2">
            {pageAccessPermissions.map((permission) => {
              const view = getPermissionView(permission);
              if (!view) return null;
              
              return (
                <NativeCard
                  key={permission}
                  onClick={() => onViewChange && onViewChange(view)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white">
                      {getPermissionIcon(permission)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                        {getPermissionLabel(permission)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </NativeCard>
              );
            })}
          </div>
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

