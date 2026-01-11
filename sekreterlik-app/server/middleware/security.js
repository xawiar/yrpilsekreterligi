// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' ws: wss:; " +
    "frame-ancestors 'none';"
  );
  
  next();
};

// Rate limiting middleware
const rateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [key, value] of requests.entries()) {
      if (value.timestamp < windowStart) {
        requests.delete(key);
      }
    }
    
    // Check current IP
    const ipData = requests.get(ip);
    if (!ipData) {
      requests.set(ip, { count: 1, timestamp: now });
      return next();
    }
    
    if (ipData.timestamp < windowStart) {
      requests.set(ip, { count: 1, timestamp: now });
      return next();
    }
    
    if (ipData.count >= max) {
      return res.status(429).json({
        success: false,
        message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.'
      });
    }
    
    ipData.count++;
    next();
  };
};

// Input validation middleware - Güçlendirilmiş XSS ve SQL injection koruması
const validateInput = (req, res, next) => {
  // SQL injection patterns
  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|TRUNCATE|GRANT|REVOKE)\b)|(\b(OR|AND)\s+\d+\s*=\s*\d+)|(--|;|\/\*|\*\/)/i;
  
  // XSS patterns
  const xssPattern = /<script|javascript:|onerror=|onload=|onclick=|onmouseover=|<iframe|data:text\/html|vbscript:/i;
  
  // Path traversal patterns
  const pathTraversalPattern = /\.\.\/|\.\.\\|\.\.%2F|\.\.%5C/i;
  
  // Command injection patterns
  const commandInjectionPattern = /[;&|`$(){}[\]]/;
  
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove null bytes
    str = str.replace(/\0/g, '');
    
    // Check for dangerous patterns
    if (sqlInjectionPattern.test(str)) {
      return null; // Mark as dangerous
    }
    if (xssPattern.test(str)) {
      return null; // Mark as dangerous
    }
    if (pathTraversalPattern.test(str)) {
      return null; // Mark as dangerous
    }
    
    return str;
  };
  
  const checkObject = (obj, depth = 0) => {
    // Prevent deep nesting (DoS protection)
    if (depth > 10) {
      return false;
    }
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Check key name for dangerous patterns
        if (sqlInjectionPattern.test(key) || xssPattern.test(key)) {
          return false;
        }
        
        const value = obj[key];
        
        if (typeof value === 'string') {
          const sanitized = sanitizeString(value);
          if (sanitized === null) {
            return false; // Dangerous content found
          }
        } else if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            // Check array elements
            for (const item of value) {
              if (typeof item === 'string') {
                const sanitized = sanitizeString(item);
                if (sanitized === null) {
                  return false;
                }
              } else if (typeof item === 'object' && item !== null) {
                if (!checkObject(item, depth + 1)) {
                  return false;
                }
              }
            }
          } else {
            // Recursive check for nested objects
            if (!checkObject(value, depth + 1)) {
              return false;
            }
          }
        }
      }
    }
    return true;
  };
  
  // Validate all input sources
  if (!checkObject(req.body) || !checkObject(req.query) || !checkObject(req.params)) {
    console.warn('⚠️ Suspicious input detected:', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return res.status(400).json({
      success: false,
      message: 'Geçersiz giriş verisi - Güvenlik kontrolü başarısız'
    });
  }
  
  next();
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = {
  securityHeaders,
  rateLimit,
  validateInput,
  corsOptions
};
