// Simple in-memory rate limiter per IP
// Defaults: 100 requests per 15 minutes

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;

const ipStore = new Map();

function cleanup() {
  const now = Date.now();
  for (const [ip, data] of ipStore.entries()) {
    if (now - data.start > WINDOW_MS) ipStore.delete(ip);
  }
}

setInterval(cleanup, 60 * 1000).unref();

const GET_MAX_REQUESTS = 500;
const getIpStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of getIpStore.entries()) {
    if (now - data.start > WINDOW_MS) getIpStore.delete(ip);
  }
}, 60 * 1000).unref();

function rateLimit(req, res, next) {
  // In development, skip rate limiting entirely
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.path === '/health') return next();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // GET istekleri için daha yüksek limit (500 req/15min)
  if (req.method === 'GET') {
    let getData = getIpStore.get(ip);
    if (!getData) {
      getData = { start: now, count: 0 };
      getIpStore.set(ip, getData);
    }
    if (now - getData.start > WINDOW_MS) {
      getData.start = now;
      getData.count = 0;
    }
    getData.count += 1;
    if (getData.count > GET_MAX_REQUESTS) {
      res.setHeader('Retry-After', Math.ceil((getData.start + WINDOW_MS - now) / 1000));
      return res.status(429).json({ message: 'Çok fazla istek gönderdiniz' });
    }
    return next();
  }

  let data = ipStore.get(ip);
  if (!data) {
    data = { start: now, count: 0 };
    ipStore.set(ip, data);
  }
  if (now - data.start > WINDOW_MS) {
    data.start = now;
    data.count = 0;
  }
  data.count += 1;

  if (data.count > MAX_REQUESTS) {
    res.setHeader('Retry-After', Math.ceil((data.start + WINDOW_MS - now) / 1000));
    return res.status(429).json({ message: 'Çok fazla istek, lütfen daha sonra tekrar deneyin.' });
  }
  next();
}

module.exports = { rateLimit };

// Factory to create custom limiters for specific routes
function createRateLimiter({ windowMs = WINDOW_MS, max = MAX_REQUESTS } = {}) {
  const localStore = new Map();
  function cleanupLocal() {
    const now = Date.now();
    for (const [ip, data] of localStore.entries()) {
      if (now - data.start > windowMs) localStore.delete(ip);
    }
  }
  setInterval(cleanupLocal, 60 * 1000).unref();
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let data = localStore.get(ip);
    if (!data) {
      data = { start: now, count: 0 };
      localStore.set(ip, data);
    }
    if (now - data.start > windowMs) {
      data.start = now;
      data.count = 0;
    }
    data.count += 1;
    if (data.count > max) {
      res.setHeader('Retry-After', Math.ceil((data.start + windowMs - now) / 1000));
      return res.status(429).json({ message: 'Çok fazla istek, lütfen daha sonra tekrar deneyin.' });
    }
    next();
  };
}

module.exports.createRateLimiter = createRateLimiter;


