import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const MobileBottomNav = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      name: 'Hızlı Toplantı',
      href: '#quick-meeting',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      ),
      isQuickAction: true,
      action: 'quick-meeting',
    },
    {
      name: 'Hızlı Etkinlik',
      href: '#quick-event',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      ),
      isQuickAction: true,
      action: 'quick-event',
    },
    {
      name: 'Üyeler',
      href: '/members',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
      ),
    },
    {
      name: 'Menü',
      href: '#menu',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      ),
      isMenu: true,
    },
  ];

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
                  // Quick action event
                  const event = new CustomEvent('quickAction', { detail: { action: item.action } });
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

