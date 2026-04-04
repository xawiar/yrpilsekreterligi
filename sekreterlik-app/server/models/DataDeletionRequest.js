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
    return new Promise((resolve, reject) => {
      // Üyeyi ve ilgili tüm verileri kalıcı olarak sil
      const queries = [
        'DELETE FROM member_registrations WHERE member_id = ?',
        'DELETE FROM personal_documents WHERE member_id = ?',
        'DELETE FROM members WHERE id = ?'
      ];

      let completed = 0;
      let errors = [];

      queries.forEach((query) => {
        db.run(query, [member_id], (err) => {
          completed++;
          if (err) {
            errors.push(err.message);
          }
          if (completed === queries.length) {
            if (errors.length > 0) {
              reject(new Error('Bazı veriler silinemedi: ' + errors.join(', ')));
            } else {
              resolve({ success: true, member_id });
            }
          }
        });
      });
    });
  }
}

module.exports = DataDeletionRequest;
