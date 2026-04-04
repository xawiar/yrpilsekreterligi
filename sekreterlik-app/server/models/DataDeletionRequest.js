const db = require('../config/database');

class DataDeletionRequest {
  static init() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS data_deletion_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_id INTEGER NOT NULL,
          reason TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
          admin_note TEXT,
          rejection_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME,
          processed_by TEXT,
          FOREIGN KEY (member_id) REFERENCES members (id)
        )
      `;

      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating data_deletion_requests table:', err);
          reject(err);
        } else {
          console.log('Data deletion requests table created successfully');
          resolve();
        }
      });
    });
  }

  static async create(data) {
    return new Promise((resolve, reject) => {
      const { member_id, reason } = data;
      const sql = `
        INSERT INTO data_deletion_requests (member_id, reason, status)
        VALUES (?, ?, 'pending')
      `;

      db.run(sql, [member_id, reason], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, member_id, reason, status: 'pending' });
        }
      });
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ddr.*, m.name as member_name, m.tc as member_tc, m.phone as member_phone
        FROM data_deletion_requests ddr
        LEFT JOIN members m ON ddr.member_id = m.id
        ORDER BY ddr.created_at DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ddr.*, m.name as member_name, m.tc as member_tc, m.phone as member_phone
        FROM data_deletion_requests ddr
        LEFT JOIN members m ON ddr.member_id = m.id
        WHERE ddr.id = ?
      `;

      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async getByMemberId(member_id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM data_deletion_requests
        WHERE member_id = ?
        ORDER BY created_at DESC
      `;

      db.all(sql, [member_id], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static async approve(id, processed_by) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE data_deletion_requests
        SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ?
        WHERE id = ? AND status = 'pending'
      `;

      db.run(sql, [processed_by, id], function (err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Talep bulunamadi veya zaten islenmis'));
        } else {
          resolve({ id, status: 'approved' });
        }
      });
    });
  }

  static async reject(id, rejection_reason, processed_by) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE data_deletion_requests
        SET status = 'rejected', rejection_reason = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
        WHERE id = ? AND status = 'pending'
      `;

      db.run(sql, [rejection_reason, processed_by, id], function (err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Talep bulunamadi veya zaten islenmis'));
        } else {
          resolve({ id, status: 'rejected', rejection_reason });
        }
      });
    });
  }

  static async deleteMemberData(member_id) {
    const runQuery = (sql, params) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };

    // Transaction ile uye ve iliskili tum verileri kalici olarak sil
    await runQuery('BEGIN TRANSACTION', []);
    try {
      // Iliskili tablolardan sil (hata olsa da devam et - tablo olmayabilir)
      const relatedQueries = [
        'DELETE FROM member_registrations WHERE member_id = ?',
        'DELETE FROM member_users WHERE member_id = ?',
        'DELETE FROM data_deletion_requests WHERE member_id = ? AND status != \'approved\'',
      ];

      for (const sql of relatedQueries) {
        try {
          await runQuery(sql, [member_id]);
        } catch (err) {
          // Tablo yoksa veya baska hata olursa devam et
          console.warn(`KVKK silme uyarisi (${sql}):`, err.message);
        }
      }

      // Ana uye kaydini sil
      await runQuery('DELETE FROM members WHERE id = ?', [member_id]);

      await runQuery('COMMIT', []);
      return { success: true, member_id };
    } catch (error) {
      try {
        await runQuery('ROLLBACK', []);
      } catch (rollbackErr) {
        console.error('Rollback hatasi:', rollbackErr);
      }
      throw new Error('Uye verileri silinirken hata: ' + error.message);
    }
  }
}

module.exports = DataDeletionRequest;
