/**
 * Photo URL helper - Converts localhost URLs to production URLs
 * and handles relative paths
 */

// Firebase kullanımı kontrolü
const VITE_USE_FIREBASE_ENV = import.meta.env.VITE_USE_FIREBASE;
const USE_FIREBASE = 
  VITE_USE_FIREBASE_ENV === 'true' || 
  VITE_USE_FIREBASE_ENV === true ||
  String(VITE_USE_FIREBASE_ENV).toLowerCase() === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname.includes('render.com') && VITE_USE_FIREBASE_ENV !== undefined);

/**
 * Normalizes photo URL to use correct base URL
 * @param {string} photoUrl - Photo URL from database
 * @returns {string|null} Normalized photo URL or null if invalid
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

  // If Firebase is used and photo is in /uploads/photos/ (old local disk path), return null
  // These files don't exist in Firebase Storage, so we should not try to load them
  if (USE_FIREBASE && (photoUrl.startsWith('/uploads/photos/') || photoUrl.startsWith('uploads/photos/'))) {
    // Try to extract member ID from filename and check Firebase Storage
    // Format: member-{id}-{timestamp}-{filename}
    const match = photoUrl.match(/member-(\d+)-/);
    if (match) {
      const memberId = match[1];
      // Return null to trigger fallback avatar
      // The component will handle this with onError handler
      return null;
    }
    // If we can't extract member ID, return null
    return null;
  }

  // If it's a relative path (starts with /uploads/), prepend base URL (only if NOT using Firebase)
  if (!USE_FIREBASE && (photoUrl.startsWith('/uploads/') || photoUrl.startsWith('uploads/'))) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://yrpilsekreterligi.onrender.com';
    const normalizedPath = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
    return `${baseUrl}${normalizedPath}`;
  }

  // If it's a relative path (starts with /), prepend base URL (only if NOT using Firebase)
  if (!USE_FIREBASE && photoUrl.startsWith('/')) {
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

