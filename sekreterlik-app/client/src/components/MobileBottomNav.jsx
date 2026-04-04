import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MobileBottomNav = ({ grantedPermissions = [], memberPosition = null }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Check if user has "Hizli Islemler" permissions
  const hasAddMember = grantedPermissions.includes('add_member');
  const hasCreateMeeting = grantedPermissions.includes('create_meeting');
  const hasAddSTK = grantedPermissions.includes('add_stk');
  const hasAddPublicInstitution = grantedPermissions.includes('add_public_institution');

  const allQuickActions = [];

  if (hasAddMember) {
    allQuickActions.push({
      name: 'Uye Ekle',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>
      ),
      action: 'add-member',
    });
  }

  if (hasCreateMeeting) {
    allQuickActions.push({
      name: 'Toplanti',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      ),
      action: 'create-meeting',
    });
  }

  if (hasAddSTK) {
    allQuickActions.push({
      name: 'STK Ekle',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ),
      action: 'add-stk',
    });
  }

  if (hasAddPublicInstitution) {
    allQuickActions.push({
      name: 'Kamu Kurumu',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ),
      action: 'add-public-institution',
    });
  }

  // Max 2 quick action buttons in bottom nav, rest go to overflow menu
  const MAX_VISIBLE_ACTIONS = 2;
  const visibleActions = allQuickActions.slice(0, MAX_VISIBLE_ACTIONS);
  const overflowActions = allQuickActions.slice(MAX_VISIBLE_ACTIONS);
  const hasOverflow = overflowActions.length > 0;

  const handleQuickAction = (action) => {
    const event = new CustomEvent('memberQuickAction', { detail: { action } });
    window.dispatchEvent(event);
    setMoreMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = () => {
    if (hasOverflow) {
      setMoreMenuOpen(!moreMenuOpen);
    } else {
      const event = new CustomEvent('openMobileMenu');
      window.dispatchEvent(event);
    }
  };

  return (
    <>
      {/* Overflow menu popup */}
      {moreMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-30" onClick={() => setMoreMenuOpen(false)} />
          <div className="lg:hidden fixed bottom-[68px] left-2 right-2 z-30 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 space-y-1 safe-area-inset-bottom">
            {overflowActions.map((item) => (
              <button
                key={item.action}
                onClick={() => handleQuickAction(item.action)}
                className="flex items-center w-full px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-[0.98]"
              >
                <span className="text-gray-500 dark:text-gray-400 mr-3">{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </button>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  const event = new CustomEvent('openMobileMenu');
                  window.dispatchEvent(event);
                }}
                className="flex items-center w-full px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-[0.98]"
              >
                <span className="text-gray-500 dark:text-gray-400 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="text-sm font-medium">Tam Menu</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom nav bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 safe-area-inset-bottom shadow-lg pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {/* Visible quick actions (max 2) */}
          {visibleActions.map((item) => (
            <button
              key={item.action}
              onClick={() => handleQuickAction(item.action)}
              className="flex flex-col items-center justify-center flex-1 min-w-0 h-14 rounded-xl transition-all duration-200 active:scale-95"
            >
              <span className="mb-0.5 text-gray-500 dark:text-gray-400">{item.icon}</span>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[64px]">{item.name}</span>
            </button>
          ))}

          {/* Menu / Daha Fazla button */}
          <button
            onClick={handleMenuClick}
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-14 rounded-xl transition-all duration-200 active:scale-95"
          >
            <span className="mb-0.5 text-gray-500 dark:text-gray-400">
              {hasOverflow ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
              {hasOverflow ? 'Daha Fazla' : 'Menu'}
            </span>
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-14 rounded-xl transition-all duration-200 active:scale-95 text-red-600 dark:text-red-400"
          >
            <span className="mb-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="text-[10px] font-medium">Cikis</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
