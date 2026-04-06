const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is not set');
}

let jwtSecretMissing = !JWT_SECRET;

/**
 * JWT token doğrulama middleware'i
 * Authorization: Bearer <token> header'ından token alır ve doğrular
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Yetkilendirme token\'ı gerekli' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || decoded.type || 'member',
      type: decoded.type || decoded.role || 'member',
      memberId: decoded.memberId || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token süresi dolmuş, tekrar giriş yapın' });
    }
    return res.status(401).json({ success: false, message: 'Geçersiz token' });
  }
};

/**
 * Admin rolü kontrolü — authenticateToken'dan sonra kullanılmalı
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.type !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Bu işlem için admin yetkisi gerekli' });
  }
  next();
};

/**
 * JWT token oluştur
 * Oturum suresi ortam degiskeninden veya varsayilan olarak '7d' olarak alinir
 * Gecerli degerler: '1d', '3d', '7d', '30d'
 */
const getSessionDuration = () => {
  const duration = process.env.SESSION_DURATION || '7d';
  const validDurations = ['1d', '3d', '7d', '30d'];
  return validDurations.includes(duration) ? duration : '7d';
};

const generateToken = (payload) => {
  if (jwtSecretMissing) {
    throw new Error('JWT_SECRET tanımlı değil. Token oluşturulamıyor.');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: getSessionDuration() });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  generateToken,
  JWT_SECRET,
};
