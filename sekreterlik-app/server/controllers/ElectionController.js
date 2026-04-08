const db = require('../config/database');

function safeParse(str, fallback = null) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

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
        cb_candidates: safeParse(election.cb_candidates, []),
        parties: safeParse(election.parties, []),
        independent_cb_candidates: safeParse(election.independent_cb_candidates, []),
        independent_mv_candidates: safeParse(election.independent_mv_candidates, []),
        mayor_parties: safeParse(election.mayor_parties, []),
        mayor_candidates: safeParse(election.mayor_candidates, []),
        provincial_assembly_parties: safeParse(election.provincial_assembly_parties, []),
        municipal_council_parties: safeParse(election.municipal_council_parties, []),
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
        cb_candidates: safeParse(election.cb_candidates, []),
        parties: safeParse(election.parties, []),
        independent_cb_candidates: safeParse(election.independent_cb_candidates, []),
        independent_mv_candidates: safeParse(election.independent_mv_candidates, []),
        mayor_parties: safeParse(election.mayor_parties, []),
        mayor_candidates: safeParse(election.mayor_candidates, []),
        provincial_assembly_parties: safeParse(election.provincial_assembly_parties, []),
        municipal_council_parties: safeParse(election.municipal_council_parties, []),
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

      // Seçim durumu geçiş kontrolü
      if (electionData.status && electionData.status !== oldElection.status) {
        const allowedTransitions = {
          'draft': ['active'],
          'active': ['closed'],
          'closed': []
        };
        const currentStatus = oldElection.status || 'draft';
        const allowed = allowedTransitions[currentStatus] || [];
        if (!allowed.includes(electionData.status)) {
          return res.status(400).json({
            message: `Seçim durumu '${currentStatus}' → '${electionData.status}' geçişi yapılamaz`
          });
        }
      }

      // Seçim aktifleştirme hazırlık checklist'i
      const newStatus = electionData.status || oldElection.status;
      const oldStatus = oldElection.status || 'draft';
      let activationWarnings = [];
      if (newStatus === 'active' && oldStatus === 'draft') {
        // 1. Sandık var mı?
        const ballotBoxes = await db.all('SELECT id, ballot_number, neighborhood_id, village_id FROM ballot_boxes');
        if (ballotBoxes.length === 0) {
          activationWarnings.push('Hiç sandık tanımlanmamış');
        } else {
          // 2. Müşahitsiz sandıklar
          const observerCounts = await db.all(
            'SELECT ballot_box_id, COUNT(*) as count FROM ballot_box_observers GROUP BY ballot_box_id'
          );
          const observerMap = new Map(observerCounts.map(o => [o.ballot_box_id, o.count]));
          const noObserverBoxes = ballotBoxes.filter(bb => !observerMap.has(bb.id));
          if (noObserverBoxes.length > 0) {
            activationWarnings.push(`${noObserverBoxes.length} sandıkta müşahit atanmamış`);
          }

          // 3. Başmüşahitsiz sandıklar
          const chiefCounts = await db.all(
            'SELECT ballot_box_id, COUNT(*) as count FROM ballot_box_observers WHERE is_chief_observer = 1 GROUP BY ballot_box_id'
          );
          const chiefMap = new Map(chiefCounts.map(c => [c.ballot_box_id, c.count]));
          const noChiefBoxes = ballotBoxes.filter(bb => !chiefMap.has(bb.id));
          if (noChiefBoxes.length > 0) {
            activationWarnings.push(`${noChiefBoxes.length} sandıkta başmüşahit atanmamış`);
          }
        }

        // 4. Bölge tanımlı mı?
        const regions = await db.all('SELECT id FROM election_regions');
        if (regions.length === 0) {
          activationWarnings.push('Hiç seçim bölgesi tanımlanmamış');
        }
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
        newStatus,
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
        newStatus,
        id
      ];

      await db.run(sql, params);

      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data, new_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'admin', 'update', 'election', id, JSON.stringify(oldElection), JSON.stringify(electionData)]
      );

      const response = { message: 'Seçim başarıyla güncellendi' };
      if (activationWarnings.length > 0) {
        response.warnings = activationWarnings;
      }
      res.json(response);
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

      // Seçim durumu geçiş kontrolü
      if (status !== oldElection.status) {
        const allowedTransitions = {
          'draft': ['active'],
          'active': ['closed'],
          'closed': []
        };
        const currentStatus = oldElection.status || 'draft';
        const allowed = allowedTransitions[currentStatus] || [];
        if (!allowed.includes(status)) {
          return res.status(400).json({
            message: `Seçim durumu '${currentStatus}' → '${status}' geçişi yapılamaz`
          });
        }
      }

      // Seçim aktifleştirme hazırlık checklist'i
      let activationWarnings = [];
      if (status === 'active' && (oldElection.status || 'draft') === 'draft') {
        // 1. Sandık var mı?
        const ballotBoxes = await db.all('SELECT id, ballot_number, neighborhood_id, village_id FROM ballot_boxes');
        if (ballotBoxes.length === 0) {
          activationWarnings.push('Hiç sandık tanımlanmamış');
        } else {
          // 2. Müşahitsiz sandıklar
          const observerCounts = await db.all(
            'SELECT ballot_box_id, COUNT(*) as count FROM ballot_box_observers GROUP BY ballot_box_id'
          );
          const observerMap = new Map(observerCounts.map(o => [o.ballot_box_id, o.count]));
          const noObserverBoxes = ballotBoxes.filter(bb => !observerMap.has(bb.id));
          if (noObserverBoxes.length > 0) {
            activationWarnings.push(`${noObserverBoxes.length} sandıkta müşahit atanmamış`);
          }

          // 3. Başmüşahitsiz sandıklar
          const chiefCounts = await db.all(
            'SELECT ballot_box_id, COUNT(*) as count FROM ballot_box_observers WHERE is_chief_observer = 1 GROUP BY ballot_box_id'
          );
          const chiefMap = new Map(chiefCounts.map(c => [c.ballot_box_id, c.count]));
          const noChiefBoxes = ballotBoxes.filter(bb => !chiefMap.has(bb.id));
          if (noChiefBoxes.length > 0) {
            activationWarnings.push(`${noChiefBoxes.length} sandıkta başmüşahit atanmamış`);
          }
        }

        // 4. Bölge tanımlı mı?
        const regions = await db.all('SELECT id FROM election_regions');
        if (regions.length === 0) {
          activationWarnings.push('Hiç seçim bölgesi tanımlanmamış');
        }
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

      const response = { message: 'Seçim durumu güncellendi' };
      if (activationWarnings.length > 0) {
        response.warnings = activationWarnings;
      }
      res.json(response);
    } catch (error) {
      console.error('Error updating election status:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = ElectionController;

