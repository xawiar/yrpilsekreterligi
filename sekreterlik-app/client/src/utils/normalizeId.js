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
