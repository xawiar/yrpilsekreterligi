const db = require('../config/database');

class ElectionController {
  static async getAll(req, res) {
    try {
      const { status, type } = req.query;
      let sql = 'SELECT * FROM elections WHERE 1=1';
      const params = [];

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }

      sql += ' ORDER BY date DESC, created_at DESC';

      const elections = await db.all(sql, params);
      
      // Parse JSON fields
      const parsedElections = elections.map(election => ({
        ...election,
        cb_candidates: election.cb_candidates ? JSON.parse(election.cb_candidates) : [],
        parties: election.parties ? JSON.parse(election.parties) : [],
        independent_cb_candidates: election.independent_cb_candidates ? JSON.parse(election.independent_cb_candidates) : [],
        independent_mv_candidates: election.independent_mv_candidates ? JSON.parse(election.independent_mv_candidates) : [],
        mayor_parties: election.mayor_parties ? JSON.parse(election.mayor_parties) : [],
        mayor_candidates: election.mayor_candidates ? JSON.parse(election.mayor_candidates) : [],
        provincial_assembly_parties: election.provincial_assembly_parties ? JSON.parse(election.provincial_assembly_parties) : [],
        municipal_council_parties: election.municipal_council_parties ? JSON.parse(election.municipal_council_parties) : [],
        baraj_percent: election.baraj_percent || 7.0
      }));

      res.json(parsedElections);
    } catch (error) {
      console.error('Error fetching elections:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const election = await db.get('SELECT * FROM elections WHERE id = ?', [id]);
      
      if (!election) {
        return res.status(404).json({ message: 'Seçim bulunamadı' });
      }

      // Parse JSON fields
      const parsedElection = {
        ...election,
        cb_candidates: election.cb_candidates ? JSON.parse(election.cb_candidates) : [],
        parties: election.parties ? JSON.parse(election.parties) : [],
        independent_cb_candidates: election.independent_cb_candidates ? JSON.parse(election.independent_cb_candidates) : [],
        independent_mv_candidates: election.independent_mv_candidates ? JSON.parse(election.independent_mv_candidates) : [],
        mayor_parties: election.mayor_parties ? JSON.parse(election.mayor_parties) : [],
        mayor_candidates: election.mayor_candidates ? JSON.parse(election.mayor_candidates) : [],
        provincial_assembly_parties: election.provincial_assembly_parties ? JSON.parse(election.provincial_assembly_parties) : [],
        municipal_council_parties: election.municipal_council_parties ? JSON.parse(election.municipal_council_parties) : [],
        baraj_percent: election.baraj_percent || 7.0
      };
      
      res.json(parsedElection);
    } catch (error) {
      console.error('Error fetching election:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const electionData = req.body;
      const userId = req.user?.id || null;

      // Validation
      const errors = [];
      if (!electionData.name) errors.push('Seçim adı zorunludur');
      if (!electionData.date) errors.push('Seçim tarihi zorunludur');
      const validTypes = ['cb', 'mv', 'genel', 'yerel', 'referandum', 'yerel_metropolitan_mayor', 'yerel_city_mayor', 'yerel_district_mayor', 'yerel_provincial_assembly', 'yerel_municipal_council'];
      if (!electionData.type || !validTypes.includes(electionData.type)) {
        errors.push('Geçerli bir seçim türü seçilmelidir');
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      const sql = `INSERT INTO elections 
                   (name, date, type, status, voter_count, cb_candidates, parties, independent_cb_candidates, 
                    independent_mv_candidates, mayor_parties, mayor_candidates, provincial_assembly_parties, 
                    municipal_council_parties, baraj_percent) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      const params = [
        electionData.name,
        electionData.date,
        electionData.type,
        electionData.status || 'draft',
        electionData.voter_count || null,
        JSON.stringify(electionData.cb_candidates || []),
        JSON.stringify(electionData.parties || []),
        JSON.stringify(electionData.independent_cb_candidates || []),
        JSON.stringify(electionData.independent_mv_candidates || []),
        JSON.stringify(electionData.mayor_parties || []),
        JSON.stringify(electionData.mayor_candidates || []),
        JSON.stringify(electionData.provincial_assembly_parties || []),
        JSON.stringify(electionData.municipal_council_parties || []),
        electionData.baraj_percent || 7.0
      ];

      const result = await db.run(sql, params);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, new_data) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, 'admin', 'create', 'election', result.lastID, JSON.stringify(electionData)]
      );

      const newElection = await db.get('SELECT * FROM elections WHERE id = ?', [result.lastID]);
      
      res.status(201).json({ message: 'Seçim başarıyla oluşturuldu', election: newElection });
    } catch (error) {
      console.error('Error creating election:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const electionData = req.body;
      const userId = req.user?.id || null;

      // Get old data for audit
      const oldElection = await db.get('SELECT * FROM elections WHERE id = ?', [id]);
      if (!oldElection) {
        return res.status(404).json({ message: 'Seçim bulunamadı' });
      }

      const sql = `UPDATE elections 
                   SET name = ?, date = ?, type = ?, status = ?, voter_count = ?, 
                       cb_candidates = ?, parties = ?, independent_cb_candidates = ?, 
                       independent_mv_candidates = ?, mayor_parties = ?, mayor_candidates = ?, 
                       provincial_assembly_parties = ?, municipal_council_parties = ?,
                       baraj_percent = ?,
                       updated_at = CURRENT_TIMESTAMP,
                       closed_at = CASE WHEN ? = 'closed' AND status != 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END
                   WHERE id = ?`;
      
      const params = [
        electionData.name,
        electionData.date,
        electionData.type,
        electionData.status || oldElection.status,
        electionData.voter_count || null,
        JSON.stringify(electionData.cb_candidates || []),
        JSON.stringify(electionData.parties || []),
        JSON.stringify(electionData.independent_cb_candidates || []),
        JSON.stringify(electionData.independent_mv_candidates || []),
        JSON.stringify(electionData.mayor_parties || []),
        JSON.stringify(electionData.mayor_candidates || []),
        JSON.stringify(electionData.provincial_assembly_parties || []),
        JSON.stringify(electionData.municipal_council_parties || []),
        electionData.baraj_percent !== undefined ? electionData.baraj_percent : (oldElection.baraj_percent || 7.0),
        electionData.status || oldElection.status,
        id
      ];

      await db.run(sql, params);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data, new_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'admin', 'update', 'election', id, JSON.stringify(oldElection), JSON.stringify(electionData)]
      );
      
      res.json({ message: 'Seçim başarıyla güncellendi' });
    } catch (error) {
      console.error('Error updating election:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;

      // Get old data for audit
      const oldElection = await db.get('SELECT * FROM elections WHERE id = ?', [id]);
      if (!oldElection) {
        return res.status(404).json({ message: 'Seçim bulunamadı' });
      }

      await db.run('DELETE FROM elections WHERE id = ?', [id]);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, 'admin', 'delete', 'election', id, JSON.stringify(oldElection)]
      );
      
      res.json({ message: 'Seçim başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting election:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.id || null;

      if (!['draft', 'active', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Geçersiz durum' });
      }

      const oldElection = await db.get('SELECT * FROM elections WHERE id = ?', [id]);
      if (!oldElection) {
        return res.status(404).json({ message: 'Seçim bulunamadı' });
      }

      const sql = `UPDATE elections 
                   SET status = ?, 
                       updated_at = CURRENT_TIMESTAMP,
                       closed_at = CASE WHEN ? = 'closed' AND status != 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END
                   WHERE id = ?`;
      
      await db.run(sql, [status, status, id]);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data, new_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'admin', 'update_status', 'election', id, JSON.stringify({ status: oldElection.status }), JSON.stringify({ status })]
      );
      
      res.json({ message: 'Seçim durumu güncellendi' });
    } catch (error) {
      console.error('Error updating election status:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = ElectionController;

