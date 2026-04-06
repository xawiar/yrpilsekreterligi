const db = require('../config/database');

/**
 * Audit log middleware - kritik islemleri kaydeder
 * @param {string} action - Islem adi (ornegin: 'login', 'member_create', 'election_result_create', 'settings_update')
 */
const auditLog = (action) => async (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    // Async olarak log kaydet - response'u geciktirme
    setImmediate(async () => {
      try {
        const logEntry = {
          user_id: req.user?.id || null,
          user_type: req.user?.type || req.user?.role || 'anonymous',
          action: action,
          entity_type: action.split('_')[0] || 'system',
          entity_id: req.params?.id || null,
          method: req.method,
          path: req.originalUrl,
          ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown',
          user_agent: req.get('user-agent') || '',
          status_code: res.statusCode,
          new_data: req.method !== 'GET' ? JSON.stringify(sanitizeBody(req.body)) : null,
        };

        await db.run(
          `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, new_data, ip_address, user_agent, method, path, status_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logEntry.user_id,
            logEntry.user_type,
            logEntry.action,
            logEntry.entity_type,
            logEntry.entity_id,
            logEntry.new_data,
            logEntry.ip_address,
            logEntry.user_agent,
            logEntry.method,
            logEntry.path,
            logEntry.status_code,
          ]
        );
      } catch (err) {
        console.warn('Audit log kayit hatasi (non-critical):', err.message);
      }
    });

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Hassas verileri body'den temizle
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  // Sifre ve token bilgilerini maskeleme
  const sensitiveFields = [
    'password', 'token', 'secret', 'api_key', 'apiKey',
    'tc', 'tcNo', 'tc_number', 'tc_kimlik',
    'phone', 'telefon', 'cep_telefon', 'phone_number',
    'address', 'adres', 'email', 'e_posta',
    'subscription', 'vapidKey', 'encryption_key'
  ];
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***MASKED***';
    }
  }
  // Nested objelerde de temizle
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  return sanitized;
}

module.exports = { auditLog };
