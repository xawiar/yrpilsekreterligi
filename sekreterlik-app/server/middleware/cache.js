// Very simple in-memory cache for idempotent GET requests
// Keyed by originalUrl, with TTL in seconds

const store = new Map();
const MAX_CACHE_SIZE = 500;

// LRU helper: move key to end of Map (most recently used)
function touchKey(key) {
  const val = store.get(key);
  if (val) {
    store.delete(key);
    store.set(key, val);
  }
}

// Evict oldest entry (first key in Map) when cache is full
function evictIfNeeded() {
  if (store.size >= MAX_CACHE_SIZE) {
    const firstKey = store.keys().next().value;
    store.delete(firstKey);
  }
}

function cache(ttlSeconds = 60) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = req.originalUrl;
    const now = Date.now();
    const hit = store.get(key);
    if (hit && (now - hit.ts) < ttlSeconds * 1000) {
      touchKey(key); // Mark as recently used (LRU)
      res.setHeader('X-Cache', 'HIT');
      return res.status(hit.status).set(hit.headers).send(hit.body);
    }

    // Remove stale entry if TTL expired
    if (hit) {
      store.delete(key);
    }

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalStatus = res.status.bind(res);

    let statusCode = 200;
    res.status = (code) => { statusCode = code; return originalStatus(code); };

    // Capture JSON responses
    res.json = (data) => {
      try {
        evictIfNeeded();
        store.set(key, { ts: Date.now(), body: data, headers: {}, status: statusCode, ttl: ttlSeconds });
        res.setHeader('X-Cache', 'MISS');
      } catch (_) {}
      return originalJson(data);
    };

    // Capture text responses
    res.send = (data) => {
      try {
        evictIfNeeded();
        store.set(key, { ts: Date.now(), body: data, headers: {}, status: statusCode, ttl: ttlSeconds });
        res.setHeader('X-Cache', 'MISS');
      } catch (_) {}
      return originalSend(data);
    };

    next();
  };
}

// Periodic cleanup: remove expired entries every hour
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, val] of store) {
    const ttlMs = (val.ttl || 60) * 1000;
    if ((now - val.ts) >= ttlMs) {
      store.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[Cache] Periodic cleanup removed ${cleaned} expired entries, ${store.size} remaining`);
  }
}, 60 * 60 * 1000); // Every hour

module.exports = { cache };

// Invalidate cached entries by URL prefix
function invalidate(prefix) {
  try {
    const keys = Array.from(store.keys());
    let deleted = 0;
    for (const k of keys) {
      if (k.startsWith(prefix)) {
        store.delete(k);
        deleted++;
      }
    }
    console.log(`[Cache] Invalidated ${deleted} entries for prefix: ${prefix}`);
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
  }
}

// Clear all cache
function clearAll() {
  store.clear();
  console.log('[Cache] All cache cleared');
}

module.exports.invalidate = invalidate;
module.exports.clearAll = clearAll;


