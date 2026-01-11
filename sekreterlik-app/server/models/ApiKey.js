const db = require('../config/database');
const crypto = require('crypto');

class ApiKey {
  static async create(name, permissions = ['read']) {
    // Generate a secure API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO api_keys (name, api_key_hash, permissions, created_at, last_used_at, is_active) 
         VALUES (?, ?, ?, datetime('now'), NULL, 1)`,
        [name, hashedKey, JSON.stringify(permissions)],
        function(err) {
          if (err) {
            reject(err);
          } else {
            // Return the plain API key (only shown once)
            resolve({
              id: this.lastID,
              name,
              apiKey, // Plain key - only returned on creation
              permissions,
              createdAt: new Date().toISOString(),
              isActive: true
            });
          }
        }
      );
    });
  }

  static async findByKey(apiKey) {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM api_keys WHERE api_key_hash = ? AND is_active = 1`,
        [hashedKey],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            if (row) {
              resolve({
                id: row.id,
                name: row.name,
                permissions: JSON.parse(row.permissions || '[]'),
                createdAt: row.created_at,
                lastUsedAt: row.last_used_at,
                isActive: row.is_active === 1
              });
            } else {
              resolve(null);
            }
          }
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, permissions, created_at, last_used_at, is_active 
         FROM api_keys 
         ORDER BY created_at DESC`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              id: row.id,
              name: row.name,
              permissions: JSON.parse(row.permissions || '[]'),
              createdAt: row.created_at,
              lastUsedAt: row.last_used_at,
              isActive: row.is_active === 1
            })));
          }
        }
      );
    });
  }

  static async updateLastUsed(apiKey) {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE api_keys SET last_used_at = datetime('now') WHERE api_key_hash = ?`,
        [hashedKey],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  static async deactivate(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE api_keys SET is_active = 0 WHERE id = ?`,
        [id],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM api_keys WHERE id = ?`,
        [id],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  static async initTable() {
    return new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          api_key_hash TEXT NOT NULL UNIQUE,
          permissions TEXT NOT NULL DEFAULT '["read"]',
          created_at TEXT NOT NULL,
          last_used_at TEXT,
          is_active INTEGER NOT NULL DEFAULT 1
        )`,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }
}

module.exports = ApiKey;

