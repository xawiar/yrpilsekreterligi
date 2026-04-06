/**
 * ID normalization utilities.
 * Ensures consistent string-based ID comparison across the app,
 * preventing mismatches between numeric and string IDs from the database.
 */

export const normalizeId = (id) => id != null ? String(id) : null;

export const compareIds = (a, b) => {
  if (a == null || b == null) return false;
  return String(a) === String(b);
};

/**
 * Normalize member ID from various field name formats.
 * Firestore docs may have: id, memberId, member_id
 * @param {Object} obj - Object that may contain member ID in various fields
 * @returns {string|null} The normalized member ID as string
 */
export const getMemberId = (obj) => {
  if (!obj) return null;
  const id = obj.memberId || obj.member_id || obj.id;
  return id != null ? String(id) : null;
};

/**
 * Normalize auth UID from various field name formats.
 * @param {Object} obj
 * @returns {string|null}
 */
export const getAuthUid = (obj) => {
  if (!obj) return null;
  return obj.authUid || obj.auth_uid || obj.uid || null;
};
