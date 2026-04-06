const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

class Admin {
  // Initialize admin table
  static init() {
    return new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS admin (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          // Check if admin exists
          Admin.getAdmin().then(() => {
            resolve();
          }).catch(() => {
            // Admin doesn't exist — must be created via /create-admin route
            console.warn('No admin account found. Use /create-admin to set up.');
            resolve();
          });
        }
      });
    });
  }

  // Get admin credentials
  static getAdmin() {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM admin ORDER BY id LIMIT 1', (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(row);
        } else {
          reject(new Error('Admin not found'));
        }
      });
    });
  }

  // Create admin
  static createAdmin(username, password) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO admin (username, password) VALUES (?, ?)',
        [username, password],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, username, password });
          }
        }
      );
    });
  }

  // Update admin credentials
  static async updateAdmin(username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE admin SET username = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [username, hashedPassword],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ username, password: hashedPassword });
          }
        }
      );
    });
  }

  // Verify admin credentials
  static async verifyAdmin(username, password) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM admin WHERE username = ?',
        [username],
        async (err, admin) => {
          if (err) {
            reject(err);
            return;
          }
          if (!admin) {
            resolve(false);
            return;
          }
          try {
            const isValid = await bcrypt.compare(password, admin.password);
            if (isValid) {
              resolve(true);
              return;
            }
            resolve(false);
          } catch (compareErr) {
            console.error('Password verification error:', compareErr.message);
            resolve(false);
          }
        }
      );
    });
  }
  // ============ 2FA TOTP Methods ============

  // 2FA secret'i olustur ve kaydet
  static async enable2FA() {
    const secret = crypto.randomBytes(20).toString('hex').slice(0, 20).toUpperCase();
    // Base32 encode for TOTP apps
    const base32Secret = Admin._hexToBase32(secret);
    return new Promise((resolve, reject) => {
      // totp_secret kolonu yoksa olustur
      db.run('ALTER TABLE admin ADD COLUMN totp_secret TEXT', () => {
        db.run('UPDATE admin SET totp_secret = ? WHERE id = 1', [base32Secret], function(err) {
          if (err) reject(err);
          else resolve({ secret: base32Secret });
        });
      });
    });
  }

  // 2FA'yi devre disi birak
  static async disable2FA() {
    return new Promise((resolve, reject) => {
      db.run('UPDATE admin SET totp_secret = NULL WHERE id = 1', function(err) {
        if (err) reject(err);
        else resolve({ success: true });
      });
    });
  }

  // 2FA aktif mi kontrol et
  static async is2FAEnabled() {
    return new Promise((resolve, reject) => {
      db.get('SELECT totp_secret FROM admin WHERE id = 1', (err, row) => {
        if (err) {
          // Kolon yoksa 2FA aktif degil
          resolve(false);
          return;
        }
        resolve(!!row?.totp_secret);
      });
    });
  }

  // TOTP secret'i getir
  static async get2FASecret() {
    return new Promise((resolve, reject) => {
      db.get('SELECT totp_secret FROM admin WHERE id = 1', (err, row) => {
        if (err) {
          resolve(null);
          return;
        }
        resolve(row?.totp_secret || null);
      });
    });
  }

  // TOTP kodu dogrula
  static verifyTOTP(secret, code) {
    if (!secret || !code) return false;
    const codeStr = String(code).trim();
    if (codeStr.length !== 6 || !/^\d{6}$/.test(codeStr)) return false;

    // Simdiki zaman ve +/- 30sn penceresi ile kontrol
    const now = Math.floor(Date.now() / 1000);
    for (let i = -1; i <= 1; i++) {
      const timeStep = Math.floor((now + i * 30) / 30);
      const generated = Admin._generateTOTP(secret, timeStep);
      if (generated === codeStr) return true;
    }
    return false;
  }

  // TOTP kodu uret (basit HMAC-SHA1 implementasyonu)
  static _generateTOTP(secret, timeStep) {
    try {
      const key = Admin._base32ToBuffer(secret);
      const timeBuffer = Buffer.alloc(8);
      timeBuffer.writeBigUInt64BE(BigInt(timeStep));

      const hmac = crypto.createHmac('sha1', key);
      hmac.update(timeBuffer);
      const hash = hmac.digest();

      const offset = hash[hash.length - 1] & 0x0f;
      const code = (
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff)
      ) % 1000000;

      return String(code).padStart(6, '0');
    } catch (err) {
      console.warn('TOTP generation error:', err.message);
      return '';
    }
  }

  // Hex string'i base32'ye cevir
  static _hexToBase32(hex) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = Buffer.from(hex, 'hex');
    let bits = '';
    for (const byte of bytes) {
      bits += byte.toString(2).padStart(8, '0');
    }
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, '0');
      result += base32chars[parseInt(chunk, 2)];
    }
    return result;
  }

  // Base32 string'i Buffer'a cevir
  static _base32ToBuffer(base32) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const char of base32.toUpperCase()) {
      const idx = base32chars.indexOf(char);
      if (idx === -1) continue;
      bits += idx.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }
}

module.exports = Admin;
