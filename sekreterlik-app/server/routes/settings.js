const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

// Settings tablosu olustur (yoksa)
db.run(`CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('Error creating app_settings table:', err);
});

// GET /api/settings/data-retention
router.get('/data-retention', requireAdmin, async (req, res) => {
  try {
    const row = await new Promise((resolve, reject) => {
      db.get("SELECT value FROM app_settings WHERE key = 'data_retention_months'", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    res.json({ retention_months: row ? row.value : 'never' });
  } catch (error) {
    console.error('Error fetching data retention setting:', error);
    res.status(500).json({ message: 'Ayar yuklenirken hata olustu' });
  }
});

// PUT /api/settings/data-retention
router.put('/data-retention', requireAdmin, async (req, res) => {
  try {
    const { retention_months } = req.body;
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('data_retention_months', ?, datetime('now'))`,
        [String(retention_months)],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });
    res.json({ success: true, retention_months });
  } catch (error) {
    console.error('Error saving data retention setting:', error);
    res.status(500).json({ message: 'Ayar kaydedilirken hata olustu' });
  }
});

// POST /api/settings/purge-expired-data
router.post('/purge-expired-data', requireAdmin, async (req, res) => {
  try {
    const { retention_months } = req.body;
    if (!retention_months || isNaN(retention_months)) {
      return res.status(400).json({ message: 'Gecerli bir saklama suresi belirtiniz' });
    }

    const months = parseInt(retention_months);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const cutoffISO = cutoffDate.toISOString();

    // Arsivlenmis ve suresi dolmus kayitlari bul ve sil
    const expiredMembers = await new Promise((resolve, reject) => {
      db.all(
        "SELECT id FROM members WHERE archived = 1 AND archived_at IS NOT NULL AND archived_at < ?",
        [cutoffISO],
        (err, rows) => { if (err) reject(err); else resolve(rows || []); }
      );
    });

    let deletedCount = 0;
    for (const member of expiredMembers) {
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => { if (err) reject(err); else resolve(); });
      });
      try {
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM member_registrations WHERE member_id = ?', [member.id], (err) => { if (err) reject(err); else resolve(); });
        });
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM member_users WHERE member_id = ?', [member.id], (err) => { if (err) reject(err); else resolve(); });
        });
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM members WHERE id = ?', [member.id], (err) => { if (err) reject(err); else resolve(); });
        });
        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => { if (err) reject(err); else resolve(); });
        });
        deletedCount++;
      } catch (deleteErr) {
        await new Promise((resolve) => {
          db.run('ROLLBACK', () => resolve());
        });
        console.error(`Error purging member ${member.id}:`, deleteErr);
      }
    }

    res.json({ success: true, deleted_count: deletedCount });
  } catch (error) {
    console.error('Error purging expired data:', error);
    res.status(500).json({ message: 'Temizleme sirasinda hata olustu' });
  }
});

module.exports = router;
