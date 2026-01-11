const db = require('../config/database');

class ElectionRegion {
  static validate(data) {
    const errors = [];
    if (!data.name || !data.name.trim()) errors.push('Bölge adı zorunludur');
    if (!data.supervisor_id) errors.push('Bölge sorumlusu zorunludur');
    if ((!data.neighborhood_ids || data.neighborhood_ids.length === 0) && 
        (!data.village_ids || data.village_ids.length === 0)) {
      errors.push('En az bir mahalle veya köy seçilmelidir');
    }
    return errors;
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM election_regions ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else {
          // Parse JSON fields
          const parsed = (rows || []).map(row => ({
            ...row,
            neighborhood_ids: row.neighborhood_ids ? JSON.parse(row.neighborhood_ids) : [],
            village_ids: row.village_ids ? JSON.parse(row.village_ids) : []
          }));
          resolve(parsed);
        }
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM election_regions WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          resolve({
            ...row,
            neighborhood_ids: row.neighborhood_ids ? JSON.parse(row.neighborhood_ids) : [],
            village_ids: row.village_ids ? JSON.parse(row.village_ids) : []
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  static async create(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO election_regions 
                   (name, supervisor_id, neighborhood_ids, village_ids, district_id) 
                   VALUES (?, ?, ?, ?, ?)`;
      const params = [
        data.name,
        data.supervisor_id,
        JSON.stringify(data.neighborhood_ids || []),
        JSON.stringify(data.village_ids || []),
        data.district_id || null
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else {
          db.get('SELECT * FROM election_regions WHERE id = ?', [this.lastID], (err, row) => {
            if (err) reject(err);
            else {
              resolve({
                ...row,
                neighborhood_ids: row.neighborhood_ids ? JSON.parse(row.neighborhood_ids) : [],
                village_ids: row.village_ids ? JSON.parse(row.village_ids) : []
              });
            }
          });
        }
      });
    });
  }

  static async update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE election_regions 
                   SET name = ?, supervisor_id = ?, neighborhood_ids = ?, 
                       village_ids = ?, district_id = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
      const params = [
        data.name,
        data.supervisor_id,
        JSON.stringify(data.neighborhood_ids || []),
        JSON.stringify(data.village_ids || []),
        data.district_id || null,
        id
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else {
          db.get('SELECT * FROM election_regions WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else {
              resolve({
                ...row,
                neighborhood_ids: row.neighborhood_ids ? JSON.parse(row.neighborhood_ids) : [],
                village_ids: row.village_ids ? JSON.parse(row.village_ids) : []
              });
            }
          });
        }
      });
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM election_regions WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = ElectionRegion;

