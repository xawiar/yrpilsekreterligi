/**
 * Photo URL helper - Converts localhost URLs to production URLs
 * and handles relative paths
 */

/**
 * Normalizes photo URL to use correct base URL
 * @param {string} photoUrl - Photo URL from database
 * @returns {string} Normalized photo URL
 */
export function normalizePhotoUrl(photoUrl) {
  if (!photoUrl) {
    return null;
  }

  // If already a full HTTPS URL (Firebase Storage veya başka bir URL), return as is
  if (photoUrl.startsWith('https://')) {
    return photoUrl;
  }

  // Firebase Storage URL'i kontrol et
  if (photoUrl.includes('firebasestorage.googleapis.com') || photoUrl.includes('firebase.storage')) {
    return photoUrl;
  }

  // If it's a localhost URL, replace with production URL
  if (photoUrl.startsWith('http://localhost:5000') || photoUrl.startsWith('http://127.0.0.1:5000')) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://yrpilsekreterligi.onrender.com';
    // Remove http://localhost:5000 or http://127.0.0.1:5000 prefix
    const path = photoUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1):5000/, '');
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  // If it's a relative path (starts with /uploads/), prepend base URL (eski local disk dosyaları için)
  if (photoUrl.startsWith('/uploads/') || photoUrl.startsWith('uploads/')) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://yrpilsekreterligi.onrender.com';
    const normalizedPath = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
    return `${baseUrl}${normalizedPath}`;
  }

  // If it's a relative path (starts with /), prepend base URL
  if (photoUrl.startsWith('/')) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://yrpilsekreterligi.onrender.com';
    return `${baseUrl}${photoUrl}`;
  }

  // If it's already a full HTTP URL (not localhost), convert to HTTPS
  if (photoUrl.startsWith('http://')) {
    return photoUrl.replace('http://', 'https://');
  }

  // Return as is if none of the above
  return photoUrl;
}

/**
 * Normalizes photo URLs in a member object
 * @param {object} member - Member object
 * @returns {object} Member object with normalized photo URL
 */
export function normalizeMemberPhoto(member) {
  if (!member) {
    return member;
  }

  if (member.photo) {
    return {
      ...member,
      photo: normalizePhotoUrl(member.photo)
    };
  }

  return member;
}

/**
 * Normalizes photo URLs in an array of members
 * @param {Array} members - Array of member objects
 * @returns {Array} Array of member objects with normalized photo URLs
 */
export function normalizeMembersPhotos(members) {
  if (!Array.isArray(members)) {
    return members;
  }

  return members.map(normalizeMemberPhoto);
}

