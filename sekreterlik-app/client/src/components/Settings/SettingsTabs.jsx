import React, { useState } from 'react';
import { hasPermission as checkPermission } from '../../utils/permissions';

const SettingsTabs = ({ activeTab, setActiveTab, grantedPermissions = [], isAdmin = false }) => {
  // Check if user has permission for a tab (centralized utility)
  const hasPermission = (tabName) => {
    return checkPermission(tabName, isAdmin, grantedPermissions, false);
  };

  // Tab group definitions
  const tabGroups = [
    {
      id: 'geographic',
      name: 'Cografi Ayarlar',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      tabs: [
        { id: 'regions', name: 'Bolge Ekle' },
        { id: 'districts', name: 'Ilce Ekle' },
        { id: 'towns', name: 'Belde Ekle' },
        { id: 'neighborhoods', name: 'Mahalle Ekle' },
        { id: 'villages', name: 'Koy Ekle' },
      ]
    },
    {
      id: 'institution',
      name: 'Kurum Ayarlari',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      tabs: [
        { id: 'stks', name: 'STK Ekle' },
        { id: 'public-institutions', name: 'Kamu Kurumu Ekle' },
        { id: 'mosques', name: 'Cami Ekle' },
      ]
    },
    {
      id: 'user',
      name: 'Kullanici Ayarlari',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      tabs: [
        { id: 'admin', name: 'Kullanici Bilgileri' },
        { id: 'member-users', name: 'Uye Kullanicilari' },
        { id: 'membership-applications', name: 'Basvurular' },
        { id: 'authorization', name: 'Yetkilendirme' },
        { id: 'push-notifications', name: 'Bildirim Ayarlari' },
        { id: 'notification-panel', name: 'Bildirim Gonder' },
      ]
    },
    {
      id: 'content',
      name: 'Icerik Ayarlari',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      tabs: [
        { id: 'positions', name: 'Gorev Ekle' },
        { id: 'event-categories', name: 'Etkinlik Kategorileri' },
        { id: 'polls', name: 'Anketler' },
        { id: 'bylaws', name: 'Parti Tuzugu' },
        { id: 'seçim-ekle', name: 'Secim Ekle' },
        { id: 'voter-list', name: 'Secmen Listesi' },
        { id: 'landing-page', name: 'Tanitim Sayfasi' },
      ]
    },
    {
      id: 'system',
      name: 'Sistem Ayarlari',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      tabs: [
        { id: 'firebase-config', name: 'Firebase Yapilandirmasi' },
        { id: 'deployment-config', name: 'Deployment Yapilandirmasi' },
        { id: 'sms-config', name: 'SMS Yapilandirmasi' },
        { id: 'gemini-api', name: 'Gemini AI' },
        { id: 'api-keys', name: 'API Key Yonetimi' },
        { id: 'firebase-sync', name: "Firebase'e Veri Aktarimi" },
        { id: 'performance-score', name: 'Yildiz Hesaplama Ayarlari' },
        { id: 'member-dashboard-analytics', name: 'Uye Dashboard Analitik' },
        { id: 'app-branding', name: 'Uygulama Gorunumu' },
        { id: 'theme-settings', name: 'Tema Ozellestirme' },
      ]
    },
    {
      id: 'data',
      name: 'Veri & KVKK',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      tabs: [
        { id: 'data-retention', name: 'Veri Saklama (KVKK)' },
        { id: 'data-deletion-requests', name: 'Veri Silme Talepleri' },
        { id: 'data-processing-inventory', name: 'Veri Isleme Envanteri' },
        { id: 'kvkk-compliance', name: 'KVKK Uyum Durumu' },
        { id: 'data-breach-procedure', name: 'Veri Ihlali Proseduru' },
        { id: 'verbis-guide', name: 'VERBIS Kayit Rehberi' },
        { id: 'audit-log', name: 'Denetim Kayitlari' },
      ]
    },
  ];

  // Determine which group the active tab belongs to
  const findActiveGroup = () => {
    for (const group of tabGroups) {
      if (group.tabs.some(t => t.id === activeTab)) {
        return group.id;
      }
    }
    return 'user'; // default
  };

  const [expandedGroups, setExpandedGroups] = useState(() => {
    const activeGroupId = findActiveGroup();
    return new Set([activeGroupId]);
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Filter groups to only show ones with permitted tabs
  const visibleGroups = tabGroups.map(group => ({
    ...group,
    tabs: group.tabs.filter(tab => hasPermission(tab.id))
  })).filter(group => group.tabs.length > 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 border border-gray-200 dark:border-gray-700 overflow-hidden">
      {visibleGroups.map((group, groupIndex) => (
        <div key={group.id} className={groupIndex > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}>
          {/* Group header */}
          <button
            onClick={() => toggleGroup(group.id)}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-500 dark:text-gray-400">
                {group.icon}
              </span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {group.name}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {group.tabs.length}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedGroups.has(group.id) ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Group tabs */}
          {expandedGroups.has(group.id) && (
            <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {group.tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  } px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 text-left`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SettingsTabs;
