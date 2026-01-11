const db = require('../config/database');

class ElectionCoordinator {
  static validate(data) {
    const errors = [];
    if (!data.name || !data.name.trim()) errors.push('Ad soyad zorunludur');
    if (!data.tc || data.tc.length !== 11) errors.push('TC kimlik numarası 11 haneli olmalıdır');
    if (!data.phone || !data.phone.trim()) errors.push('Telefon numarası zorunludur');
    if (!data.role || !['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'].includes(data.role)) {
      errors.push('Geçerli bir rol seçilmelidir');
    }
    if (data.role === 'institution_supervisor' && !data.institution_name) {
      errors.push('Kurum sorumlusu için kurum adı zorunludur');
    }
    return errors;
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM election_coordinators ORDER BY role, name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM election_coordinators WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async create(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO election_coordinators 
                   (name, tc, phone, role, parent_coordinator_id, district_id, institution_name) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.name,
        data.tc,
        data.phone,
        data.role,
        data.parent_coordinator_id || null,
        data.district_id || null,
        data.institution_name || null
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else {
          db.get('SELECT * FROM election_coordinators WHERE id = ?', [this.lastID], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        }
      });
    });
  }

  static async update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE election_coordinators 
                   SET name = ?, tc = ?, phone = ?, role = ?, 
                       parent_coordinator_id = ?, district_id = ?, 
                       institution_name = ?,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
      const params = [
        data.name,
        data.tc,
        data.phone,
        data.role,
        data.parent_coordinator_id || null,
        data.district_id || null,
        data.institution_name || null,
        id
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else {
          db.get('SELECT * FROM election_coordinators WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        }
      });
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM election_coordinators WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = ElectionCoordinator;

