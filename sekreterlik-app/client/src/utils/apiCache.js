/**
 * In-memory cache utility for reducing excessive Firestore reads.
 * Used by ApiService to cache frequently-accessed, rarely-changing data
 * such as members, districts, towns, neighborhoods, and villages.
 */

const cache = new Map();
const CACHE_TTL = 60000; // 1 dakika (60 saniye)

/**
 * Get cached data by key. Returns null if not found or expired.
 * @param {string} key - Cache key
 * @returns {*} Cached data or null
 */
export const getCached = (key) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
};

/**
 * Set data in cache with current timestamp.
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 */
export const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

/**
 * Clear cache entries. If keyPrefix is provided, only clears entries starting with that prefix.
 * If no prefix, clears all cache.
 * @param {string} [keyPrefix] - Optional prefix to selectively clear
 */
export const clearCache = (keyPrefix) => {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key);
    }
  }
};
