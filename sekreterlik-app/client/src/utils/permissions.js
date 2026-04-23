/**
 * Centralized permission checking utility.
 * Single source of truth for tab/feature permission mappings.
 * Used by SettingsPage, SettingsTabs, and MemberDashboardPage.
 */

const PERMISSION_MAP = {
  'admin': { alwaysAllow: true },
  'regions': { requires: 'add_region' },
  'positions': { requires: 'add_position' },
  'member-users': { requires: 'manage_member_users' },
  'membership-applications': { adminOnly: true },
  'landing-page': { adminOnly: true },
  'districts': { requires: 'add_district' },
  'towns': { requires: 'add_town' },
  'neighborhoods': { requires: 'add_neighborhood' },
  'villages': { requires: 'add_village' },
  'stks': { requires: ['manage_stk', 'add_stk'] },
  'public-institutions': { requires: 'add_public_institution' },
  'mosques': { requires: 'add_mosque' },
  'event-categories': { requires: 'manage_event_categories' },
  'authorization': { adminOnly: true },
  'bylaws': { requires: 'manage_bylaws' },
  'gemini-api': { adminOnly: true },
  'firebase-config': { adminOnly: true },
  'deployment-config': { adminOnly: true },
  'sms-config': { adminOnly: true },
  'firebase-sync': { adminOnly: true },
  'polls': { requires: 'manage_polls' },
  'member-dashboard-analytics': { requires: 'access_member_dashboard_analytics' },
  'app-branding': { requires: 'manage_app_branding' },
  'performance-score': { adminOnly: true },
  'se\u00e7im-ekle': { requires: 'manage_elections', adminAlso: true },
  'api-keys': { adminOnly: true },
  'voter-list': { requires: 'manage_voters', adminAlso: true },
  'voter-search': { requires: 'access_voter_list', adminAlso: true },
  'member-list': { requires: 'view_member_list', adminAlso: true },
  'push-notifications': { alwaysAllow: true },
  'data-retention': { adminOnly: true },
  'data-deletion-requests': { adminOnly: true },
  'data-processing-inventory': { adminOnly: true },
  'kvkk-compliance': { adminOnly: true },
  'data-breach-procedure': { adminOnly: true },
  'verbis-guide': { adminOnly: true },
  'audit-log': { adminOnly: true },
};

/**
 * Check if a user has permission for a given tab/feature.
 * @param {string} tabName - The tab identifier
 * @param {boolean} isAdmin - Whether the user is an admin
 * @param {string[]} grantedPermissions - List of granted permission strings
 * @param {boolean} loadingPermissions - Whether permissions are still loading
 * @returns {boolean}
 */
export const hasPermission = (tabName, isAdmin, grantedPermissions = [], loadingPermissions = false) => {
  if (isAdmin) return true;
  if (loadingPermissions) return false;

  const rule = PERMISSION_MAP[tabName];
  if (!rule) return false;

  if (rule.alwaysAllow) return true;
  if (rule.adminOnly) return false;

  if (rule.adminAlso && isAdmin) return true;

  if (Array.isArray(rule.requires)) {
    return rule.requires.some(perm => grantedPermissions.includes(perm));
  }

  if (rule.requires) {
    return grantedPermissions.includes(rule.requires);
  }

  return false;
};
