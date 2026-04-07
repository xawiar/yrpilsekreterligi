const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { ROLES } = require('../utils/roles');

// GET /api/audit-logs - Tum audit loglari getir (sadece admin)
router.get('/', async (req, res) => {
  try {
    // Admin kontrolu middleware ile yapiliyor, burada ekstra kontrol
    if (req.user?.type !== ROLES.ADMIN && req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Bu islem icin admin yetkisi gerekli' });
    }

    const { page = 1, limit = 50, action, user_id, date_from, date_to } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (user_id) {
      sql += ' AND user_id = ?';
      params.push(parseInt(user_id));
    }

    if (date_from) {
      sql += ' AND created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }

    // Count total
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await db.get(countSql, params);
    const total = countResult?.total || 0;

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = await db.all(sql, params);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

// GET /api/audit-logs/actions - Mevcut action tiplerini getir
router.get('/actions', async (req, res) => {
  try {
    if (req.user?.type !== ROLES.ADMIN && req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin yetkisi gerekli' });
    }

    const actions = await db.all('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    res.json({ success: true, data: actions.map(a => a.action) });
  } catch (error) {
    console.error('Error fetching audit log actions:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

module.exports = router;
