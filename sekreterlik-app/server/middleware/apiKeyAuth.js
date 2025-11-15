const ApiKey = require('../models/ApiKey');

/**
 * Middleware to authenticate API requests using API key
 * Expects API key in header: X-API-Key or Authorization: Bearer <key>
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    // Get API key from header
    let apiKey = req.headers['x-api-key'] || req.headers['x-apikey'];
    
    // Also check Authorization header
    if (!apiKey && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key gereklidir. X-API-Key header\'ında veya Authorization: Bearer <key> formatında gönderin.' 
      });
    }

    // Find and validate API key
    const keyData = await ApiKey.findByKey(apiKey);
    
    if (!keyData || !keyData.isActive) {
      return res.status(401).json({ error: 'Geçersiz veya deaktif API key' });
    }

    // Update last used timestamp
    await ApiKey.updateLastUsed(apiKey);

    // Attach key data to request
    req.apiKey = keyData;
    req.apiKeyPermissions = keyData.permissions;

    next();
  } catch (error) {
    console.error('Error in API key authentication:', error);
    res.status(500).json({ error: 'API key doğrulama hatası' });
  }
};

/**
 * Middleware to check if API key has required permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKeyPermissions) {
      return res.status(403).json({ error: 'Yetki kontrolü yapılamadı' });
    }

    if (!req.apiKeyPermissions.includes(permission) && !req.apiKeyPermissions.includes('*')) {
      return res.status(403).json({ 
        error: `Bu işlem için '${permission}' yetkisi gereklidir` 
      });
    }

    next();
  };
};

module.exports = {
  apiKeyAuth,
  requirePermission
};

