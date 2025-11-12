import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const MobileBottomNav = ({ grantedPermissions = [], memberPosition = null }) => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Check if user has "Hızlı İşlemler" permissions
  const hasAddMember = grantedPermissions.includes('add_member');
  const hasCreateMeeting = grantedPermissions.includes('create_meeting');
  const hasAddSTK = grantedPermissions.includes('add_stk');
  const hasAddPublicInstitution = grantedPermissions.includes('add_public_institution');

  const navItems = [];

  // Add Üye Ekle button if user has permission
  if (hasAddMember) {
    navItems.push({
      name: 'Üye Ekle',
      href: '#add-member',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>
      ),
      isQuickAction: true,
      action: 'add-member',
    });
  }

  // Add Toplantı Oluştur button if user has permission
  if (hasCreateMeeting) {
    navItems.push({
      name: 'Toplantı Oluştur',
      href: '#create-meeting',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      ),
      isQuickAction: true,
      action: 'create-meeting',
    });
  }

  // Add STK Ekle button if user has permission
  if (hasAddSTK) {
    navItems.push({
      name: 'STK Ekle',
      href: '#add-stk',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ),
      isQuickAction: true,
      action: 'add-stk',
    });
  }

  // Add Kamu Kurumu Ekle button if user has permission
  if (hasAddPublicInstitution) {
    navItems.push({
      name: 'Kamu Kurumu Ekle',
      href: '#add-public-institution',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ),
      isQuickAction: true,
      action: 'add-public-institution',
    });
  }

  // Add menu button (always show)
  navItems.push({
    name: 'Menü',
    href: '#menu',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
    isMenu: true,
  });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          if (item.isMenu) {
            return (
              <button
                key={item.name}
                onClick={() => {
                  // Menu açma işlemi App.jsx'te yapılacak
                  const event = new CustomEvent('openMobileMenu');
                  window.dispatchEvent(event);
                }}
                className="flex flex-col items-center justify-center min-w-[60px] min-h-[60px] rounded-xl transition-all duration-200 active:scale-95"
              >
                <span className={`mb-1 ${isActive('/settings') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {item.icon}
                </span>
                <span className={`text-xs font-medium ${isActive('/settings') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {item.name}
                </span>
              </button>
            );
          }

          if (item.isQuickAction) {
            return (
              <button
                key={item.name}
                onClick={() => {
                  // Quick action event - MemberDashboardPage'de dinlenecek
                  const event = new CustomEvent('memberQuickAction', { detail: { action: item.action } });
                  window.dispatchEvent(event);
                }}
                className={`flex flex-col items-center justify-center min-w-[60px] min-h-[60px] rounded-xl transition-all duration-200 active:scale-95 ${
                  isActive(item.href)
                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                    : ''
                }`}
              >
                <span className={`mb-1 ${isActive(item.href) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {item.icon}
                </span>
                <span className={`text-xs font-medium ${isActive(item.href) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {item.name}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center justify-center min-w-[60px] min-h-[60px] rounded-xl transition-all duration-200 active:scale-95 ${
                isActive(item.href)
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : ''
              }`}
            >
              <span className={`mb-1 ${isActive(item.href) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {item.icon}
              </span>
              <span className={`text-xs font-medium ${isActive(item.href) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;

