/**
 * Shared constants used across the application.
 */

const EMAIL_DOMAIN = '@ilsekreterlik.local';

/**
 * Format a username into an email address.
 * If the username already contains '@', return as-is.
 */
function formatEmail(username) {
  if (!username) return null;
  if (username.includes('@')) return username;
  return `${username}${EMAIL_DOMAIN}`;
}

/**
 * Extract username from an email address by stripping the domain.
 */
function extractUsername(email) {
  if (!email) return null;
  return email.replace(EMAIL_DOMAIN, '');
}

module.exports = { EMAIL_DOMAIN, formatEmail, extractUsername };
