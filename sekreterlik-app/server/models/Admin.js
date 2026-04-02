const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

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
          // Check if admin exists, if not create default admin
          Admin.getAdmin().then(() => {
            resolve();
          }).catch(() => {
            // Admin doesn't exist, create default
            const hashedPassword = bcrypt.hashSync('1491aaa1491', 10);
            Admin.createAdmin('admin', hashedPassword).then(() => {
              resolve();
            }).catch(reject);
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
            // Backward compatible: check plaintext match and migrate
            if (password === admin.password) {
              const hashed = await bcrypt.hash(password, 10);
              db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, admin.id]);
              resolve(true);
              return;
            }
            resolve(false);
          } catch (compareErr) {
            // If bcrypt.compare throws (e.g. plaintext stored), fall back to direct comparison
            if (password === admin.password) {
              bcrypt.hash(password, 10).then(hashed => {
                db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, admin.id]);
              });
              resolve(true);
            } else {
              resolve(false);
            }
          }
        }
      );
    });
  }
}

module.exports = Admin;
