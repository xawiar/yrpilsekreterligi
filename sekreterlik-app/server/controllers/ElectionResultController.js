const db = require('../config/database');

class ElectionResultController {
  static async getAll(req, res) {
    try {
      const { election_id, ballot_box_id, has_protocol, has_data, has_objection } = req.query;
      let sql = `SELECT er.*, e.name as election_name, e.type as election_type, e.status as election_status
                 FROM election_results er
                 LEFT JOIN elections e ON er.election_id = e.id
                 WHERE 1=1`;
      const params = [];

      if (election_id) {
        sql += ' AND er.election_id = ?';
        params.push(election_id);
      }

      if (ballot_box_id) {
        sql += ' AND er.ballot_box_id = ?';
        params.push(ballot_box_id);
      }

      if (has_protocol === 'true') {
        sql += ' AND (er.signed_protocol_photo IS NOT NULL AND er.signed_protocol_photo != "")';
      } else if (has_protocol === 'false') {
        sql += ' AND (er.signed_protocol_photo IS NULL OR er.signed_protocol_photo = "")';
      }

      if (has_data === 'true') {
        sql += ' AND er.used_votes > 0';
      } else if (has_data === 'false') {
        sql += ' AND (er.used_votes IS NULL OR er.used_votes = 0)';
      }

      if (has_objection === 'true') {
        sql += ' AND er.has_objection = 1';
      } else if (has_objection === 'false') {
        sql += ' AND (er.has_objection = 0 OR er.has_objection IS NULL)';
      }

      sql += ' ORDER BY er.created_at DESC';

      const results = await db.all(sql, params);
      
      // Parse JSON fields
      const parsedResults = results.map(result => ({
        ...result,
        cb_votes: result.cb_votes ? JSON.parse(result.cb_votes) : {},
        mv_votes: result.mv_votes ? JSON.parse(result.mv_votes) : {},
        mayor_votes: result.mayor_votes ? JSON.parse(result.mayor_votes) : {},
        provincial_assembly_votes: result.provincial_assembly_votes ? JSON.parse(result.provincial_assembly_votes) : {},
        municipal_council_votes: result.municipal_council_votes ? JSON.parse(result.municipal_council_votes) : {},
        referendum_votes: result.referendum_votes ? JSON.parse(result.referendum_votes) : {},
        party_votes: result.party_votes ? JSON.parse(result.party_votes) : {},
        candidate_votes: result.candidate_votes ? JSON.parse(result.candidate_votes) : {}
      }));

      res.json(parsedResults);
    } catch (error) {
      console.error('Error fetching election results:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.get(`
        SELECT er.*, e.name as election_name, e.type as election_type, e.status as election_status
        FROM election_results er
        LEFT JOIN elections e ON er.election_id = e.id
        WHERE er.id = ?
      `, [id]);
      
      if (!result) {
        return res.status(404).json({ message: 'Seçim sonucu bulunamadı' });
      }

      // Parse JSON fields
      const parsedResult = {
        ...result,
        cb_votes: result.cb_votes ? JSON.parse(result.cb_votes) : {},
        mv_votes: result.mv_votes ? JSON.parse(result.mv_votes) : {},
        mayor_votes: result.mayor_votes ? JSON.parse(result.mayor_votes) : {},
        provincial_assembly_votes: result.provincial_assembly_votes ? JSON.parse(result.provincial_assembly_votes) : {},
        municipal_council_votes: result.municipal_council_votes ? JSON.parse(result.municipal_council_votes) : {},
        referendum_votes: result.referendum_votes ? JSON.parse(result.referendum_votes) : {},
        party_votes: result.party_votes ? JSON.parse(result.party_votes) : {},
        candidate_votes: result.candidate_votes ? JSON.parse(result.candidate_votes) : {}
      };
      
      res.json(parsedResult);
    } catch (error) {
      console.error('Error fetching election result:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getByElectionAndBallotBox(req, res) {
    try {
      const { election_id, ballot_box_id } = req.params;
      const result = await db.get(`
        SELECT er.*, e.name as election_name, e.type as election_type, e.status as election_status
        FROM election_results er
        LEFT JOIN elections e ON er.election_id = e.id
        WHERE er.election_id = ? AND er.ballot_box_id = ?
      `, [election_id, ballot_box_id]);
      
      if (!result) {
        return res.status(404).json({ message: 'Seçim sonucu bulunamadı' });
      }

      // Parse JSON fields
      const parsedResult = {
        ...result,
        cb_votes: result.cb_votes ? JSON.parse(result.cb_votes) : {},
        mv_votes: result.mv_votes ? JSON.parse(result.mv_votes) : {},
        mayor_votes: result.mayor_votes ? JSON.parse(result.mayor_votes) : {},
        provincial_assembly_votes: result.provincial_assembly_votes ? JSON.parse(result.provincial_assembly_votes) : {},
        municipal_council_votes: result.municipal_council_votes ? JSON.parse(result.municipal_council_votes) : {},
        referendum_votes: result.referendum_votes ? JSON.parse(result.referendum_votes) : {},
        party_votes: result.party_votes ? JSON.parse(result.party_votes) : {},
        candidate_votes: result.candidate_votes ? JSON.parse(result.candidate_votes) : {}
      };
      
      res.json(parsedResult);
    } catch (error) {
      console.error('Error fetching election result:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const resultData = req.body;
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Validation
      const errors = [];
      if (!resultData.election_id) errors.push('Seçim ID zorunludur');
      if (!resultData.ballot_box_id) errors.push('Sandık ID zorunludur');

      // Check if election is active
      const election = await db.get('SELECT * FROM elections WHERE id = ?', [resultData.election_id]);
      if (!election) {
        return res.status(404).json({ message: 'Seçim bulunamadı' });
      }
      if (election.status === 'closed') {
        return res.status(400).json({ message: 'Kapalı seçimde sonuç girişi yapılamaz' });
      }
      
      // Check election date - allow result entry only on election day or after (with 7 days grace period)
      if (election.date) {
        const electionDate = new Date(election.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        electionDate.setHours(0, 0, 0, 0);
        
        // Allow entry 1 day before election (for preparation) and up to 7 days after
        const daysBefore = 1;
        const daysAfter = 7;
        const minDate = new Date(electionDate);
        minDate.setDate(minDate.getDate() - daysBefore);
        const maxDate = new Date(electionDate);
        maxDate.setDate(maxDate.getDate() + daysAfter);
        
        if (today < minDate) {
          return res.status(400).json({ 
            message: `Seçim sonucu girişi seçim tarihinden ${daysBefore} gün önce başlayabilir. Seçim tarihi: ${new Date(election.date).toLocaleDateString('tr-TR')}` 
          });
        }
        if (today > maxDate && req.user?.type !== 'admin') {
          return res.status(400).json({ 
            message: `Seçim sonucu girişi seçim tarihinden sonra ${daysAfter} gün içinde yapılabilir. Sadece admin daha sonra giriş yapabilir.` 
          });
        }
      }

      // Check if result already exists
      const existingResult = await db.get(
        'SELECT * FROM election_results WHERE election_id = ? AND ballot_box_id = ?',
        [resultData.election_id, resultData.ballot_box_id]
      );
      if (existingResult) {
        return res.status(400).json({ message: 'Bu sandık için zaten sonuç girilmiş' });
      }

      // Determine approval status: if filled by AI, it needs approval, otherwise auto-approved
      const filledByAI = resultData.filled_by_ai === true || resultData.filled_by_ai === 1;
      const approvalStatus = filledByAI ? 'pending' : (resultData.approval_status || 'approved');

      const sql = `INSERT INTO election_results 
                   (election_id, ballot_box_id, ballot_number, region_name, district_name, town_name, 
                    neighborhood_name, village_name, total_voters, used_votes, invalid_votes, valid_votes,
                    cb_votes, mv_votes, mayor_votes, provincial_assembly_votes, municipal_council_votes,
                    referendum_votes, party_votes, candidate_votes, signed_protocol_photo, 
                    objection_protocol_photo, has_objection, objection_reason, notes, created_by,
                    filled_by_ai, approval_status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      const params = [
        resultData.election_id,
        resultData.ballot_box_id,
        resultData.ballot_number || null,
        resultData.region_name || null,
        resultData.district_name || null,
        resultData.town_name || null,
        resultData.neighborhood_name || null,
        resultData.village_name || null,
        resultData.total_voters || null,
        resultData.used_votes || null,
        resultData.invalid_votes || null,
        resultData.valid_votes || null,
        JSON.stringify(resultData.cb_votes || {}),
        JSON.stringify(resultData.mv_votes || {}),
        JSON.stringify(resultData.mayor_votes || {}),
        JSON.stringify(resultData.provincial_assembly_votes || {}),
        JSON.stringify(resultData.municipal_council_votes || {}),
        JSON.stringify(resultData.referendum_votes || {}),
        JSON.stringify(resultData.party_votes || {}),
        JSON.stringify(resultData.candidate_votes || {}),
        resultData.signed_protocol_photo || null,
        resultData.objection_protocol_photo || null,
        resultData.has_objection ? 1 : 0,
        resultData.objection_reason || null,
        resultData.notes || null,
        userId,
        filledByAI ? 1 : 0,
        approvalStatus
      ];

      const dbResult = await db.run(sql, params);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, new_data, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, req.user?.type || 'observer', 'create', 'election_result', dbResult.lastID, JSON.stringify(resultData), ipAddress, userAgent]
      );

      const newResult = await db.get('SELECT * FROM election_results WHERE id = ?', [dbResult.lastID]);
      
      res.status(201).json({ message: 'Seçim sonucu başarıyla kaydedildi', result: newResult });
    } catch (error) {
      console.error('Error creating election result:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const resultData = req.body;
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Get old data for audit
      const oldResult = await db.get('SELECT * FROM election_results WHERE id = ?', [id]);
      if (!oldResult) {
        return res.status(404).json({ message: 'Seçim sonucu bulunamadı' });
      }

      // Check if election is closed
      const election = await db.get('SELECT * FROM elections WHERE id = ?', [oldResult.election_id]);
      if (election && election.status === 'closed') {
        // Only admin can edit closed elections
        if (req.user?.type !== 'admin') {
          return res.status(403).json({ message: 'Kapalı seçimde sadece admin düzenleme yapabilir' });
        }
      }
      
      // Check election date - allow result update only on election day or after (with 7 days grace period)
      if (election && election.date) {
        const electionDate = new Date(election.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        electionDate.setHours(0, 0, 0, 0);
        
        // Allow entry 1 day before election (for preparation) and up to 7 days after
        const daysBefore = 1;
        const daysAfter = 7;
        const minDate = new Date(electionDate);
        minDate.setDate(minDate.getDate() - daysBefore);
        const maxDate = new Date(electionDate);
        maxDate.setDate(maxDate.getDate() + daysAfter);
        
        if (today < minDate && req.user?.type !== 'admin') {
          return res.status(400).json({ 
            message: `Seçim sonucu güncelleme seçim tarihinden ${daysBefore} gün önce başlayabilir. Seçim tarihi: ${new Date(election.date).toLocaleDateString('tr-TR')}` 
          });
        }
        if (today > maxDate && req.user?.type !== 'admin') {
          return res.status(400).json({ 
            message: `Seçim sonucu güncelleme seçim tarihinden sonra ${daysAfter} gün içinde yapılabilir. Sadece admin daha sonra güncelleme yapabilir.` 
          });
        }
      }

      const sql = `UPDATE election_results 
                   SET ballot_number = ?, region_name = ?, district_name = ?, town_name = ?, 
                       neighborhood_name = ?, village_name = ?, total_voters = ?, used_votes = ?, 
                       invalid_votes = ?, valid_votes = ?, cb_votes = ?, mv_votes = ?, 
                       mayor_votes = ?, provincial_assembly_votes = ?, municipal_council_votes = ?,
                       referendum_votes = ?, party_votes = ?, candidate_votes = ?,
                       signed_protocol_photo = ?, objection_protocol_photo = ?, has_objection = ?,
                       objection_reason = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
      
      const params = [
        resultData.ballot_number || oldResult.ballot_number,
        resultData.region_name || oldResult.region_name,
        resultData.district_name || oldResult.district_name,
        resultData.town_name || oldResult.town_name,
        resultData.neighborhood_name || oldResult.neighborhood_name,
        resultData.village_name || oldResult.village_name,
        resultData.total_voters !== undefined ? resultData.total_voters : oldResult.total_voters,
        resultData.used_votes !== undefined ? resultData.used_votes : oldResult.used_votes,
        resultData.invalid_votes !== undefined ? resultData.invalid_votes : oldResult.invalid_votes,
        resultData.valid_votes !== undefined ? resultData.valid_votes : oldResult.valid_votes,
        JSON.stringify(resultData.cb_votes || (oldResult.cb_votes ? JSON.parse(oldResult.cb_votes) : {})),
        JSON.stringify(resultData.mv_votes || (oldResult.mv_votes ? JSON.parse(oldResult.mv_votes) : {})),
        JSON.stringify(resultData.mayor_votes || (oldResult.mayor_votes ? JSON.parse(oldResult.mayor_votes) : {})),
        JSON.stringify(resultData.provincial_assembly_votes || (oldResult.provincial_assembly_votes ? JSON.parse(oldResult.provincial_assembly_votes) : {})),
        JSON.stringify(resultData.municipal_council_votes || (oldResult.municipal_council_votes ? JSON.parse(oldResult.municipal_council_votes) : {})),
        JSON.stringify(resultData.referendum_votes || (oldResult.referendum_votes ? JSON.parse(oldResult.referendum_votes) : {})),
        JSON.stringify(resultData.party_votes || (oldResult.party_votes ? JSON.parse(oldResult.party_votes) : {})),
        JSON.stringify(resultData.candidate_votes || (oldResult.candidate_votes ? JSON.parse(oldResult.candidate_votes) : {})),
        resultData.signed_protocol_photo !== undefined ? resultData.signed_protocol_photo : oldResult.signed_protocol_photo,
        resultData.objection_protocol_photo !== undefined ? resultData.objection_protocol_photo : oldResult.objection_protocol_photo,
        resultData.has_objection !== undefined ? (resultData.has_objection ? 1 : 0) : oldResult.has_objection,
        resultData.objection_reason !== undefined ? resultData.objection_reason : oldResult.objection_reason,
        resultData.notes !== undefined ? resultData.notes : oldResult.notes,
        userId,
        id
      ];

      await db.run(sql, params);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, req.user?.type || 'observer', 'update', 'election_result', id, JSON.stringify(oldResult), JSON.stringify(resultData), ipAddress, userAgent]
      );
      
      res.json({ message: 'Seçim sonucu başarıyla güncellendi' });
    } catch (error) {
      console.error('Error updating election result:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;

      // Only admin can delete
      if (req.user?.type !== 'admin') {
        return res.status(403).json({ message: 'Sadece admin sonuç silebilir' });
      }

      // Get old data for audit
      const oldResult = await db.get('SELECT * FROM election_results WHERE id = ?', [id]);
      if (!oldResult) {
        return res.status(404).json({ message: 'Seçim sonucu bulunamadı' });
      }

      await db.run('DELETE FROM election_results WHERE id = ?', [id]);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, 'admin', 'delete', 'election_result', id, JSON.stringify(oldResult)]
      );
      
      res.json({ message: 'Seçim sonucu başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting election result:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Get pending election results (for chief observer approval)
  static async getPending(req, res) {
    try {
      // Only chief observers can see pending results
      if (req.user?.type !== 'chief_observer') {
        return res.status(403).json({ message: 'Sadece başmüşahit bekleyen onayları görebilir' });
      }

      const sql = `SELECT er.*, e.name as election_name, e.type as election_type, e.date as election_date,
                          bb.ballot_number, bb.voter_count,
                          m.name as creator_name
                   FROM election_results er
                   LEFT JOIN elections e ON er.election_id = e.id
                   LEFT JOIN ballot_boxes bb ON er.ballot_box_id = bb.id
                   LEFT JOIN members m ON er.created_by = m.id
                   WHERE er.approval_status = 'pending'
                   ORDER BY er.created_at DESC`;

      const results = await db.all(sql);
      
      // Parse JSON fields
      const parsedResults = results.map(result => ({
        ...result,
        cb_votes: result.cb_votes ? JSON.parse(result.cb_votes) : {},
        mv_votes: result.mv_votes ? JSON.parse(result.mv_votes) : {},
        mayor_votes: result.mayor_votes ? JSON.parse(result.mayor_votes) : {},
        provincial_assembly_votes: result.provincial_assembly_votes ? JSON.parse(result.provincial_assembly_votes) : {},
        municipal_council_votes: result.municipal_council_votes ? JSON.parse(result.municipal_council_votes) : {},
        referendum_votes: result.referendum_votes ? JSON.parse(result.referendum_votes) : {},
        party_votes: result.party_votes ? JSON.parse(result.party_votes) : {},
        candidate_votes: result.candidate_votes ? JSON.parse(result.candidate_votes) : {},
        filled_by_ai: result.filled_by_ai === 1 || result.filled_by_ai === true
      }));

      res.json({ success: true, results: parsedResults });
    } catch (error) {
      console.error('Error fetching pending election results:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Approve election result (chief observer only)
  static async approve(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Only chief observers can approve
      if (req.user?.type !== 'chief_observer') {
        return res.status(403).json({ message: 'Sadece başmüşahit onaylayabilir' });
      }

      // Get the result
      const result = await db.get('SELECT * FROM election_results WHERE id = ?', [id]);
      if (!result) {
        return res.status(404).json({ message: 'Seçim sonucu bulunamadı' });
      }

      // Check if already approved or rejected
      if (result.approval_status === 'approved') {
        return res.status(400).json({ message: 'Bu sonuç zaten onaylanmış' });
      }

      // Update approval status
      await db.run(
        `UPDATE election_results 
         SET approval_status = 'approved', 
             approved_by = ?, 
             approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, id]
      );

      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, new_data, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'chief_observer', 'approve', 'election_result', id, JSON.stringify({ approval_status: 'approved' }), ipAddress, userAgent]
      );

      res.json({ message: 'Seçim sonucu başarıyla onaylandı' });
    } catch (error) {
      console.error('Error approving election result:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Reject election result (chief observer only)
  static async reject(req, res) {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Only chief observers can reject
      if (req.user?.type !== 'chief_observer') {
        return res.status(403).json({ message: 'Sadece başmüşahit reddedebilir' });
      }

      // Get the result
      const result = await db.get('SELECT * FROM election_results WHERE id = ?', [id]);
      if (!result) {
        return res.status(404).json({ message: 'Seçim sonucu bulunamadı' });
      }

      // Check if already approved or rejected
      if (result.approval_status === 'approved') {
        return res.status(400).json({ message: 'Onaylanmış sonuç reddedilemez. Önce onayı kaldırın.' });
      }

      // Update rejection status
      await db.run(
        `UPDATE election_results 
         SET approval_status = 'rejected', 
             approved_by = ?, 
             approved_at = CURRENT_TIMESTAMP,
             rejection_reason = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, rejection_reason || 'Reddedilme nedeni belirtilmedi', id]
      );

      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, new_data, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'chief_observer', 'reject', 'election_result', id, JSON.stringify({ approval_status: 'rejected', rejection_reason }), ipAddress, userAgent]
      );

      res.json({ message: 'Seçim sonucu reddedildi' });
    } catch (error) {
      console.error('Error rejecting election result:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Proxy image from Firebase Storage (for OCR - bypasses CORS)
  static async proxyImage(req, res) {
    try {
      const { imageUrl } = req.query;

      if (!imageUrl) {
        return res.status(400).json({ message: 'imageUrl parametresi gerekli' });
      }

      // Validate URL (sadece Firebase Storage URL'lerine izin ver)
      if (!imageUrl.includes('firebasestorage.googleapis.com')) {
        return res.status(400).json({ message: 'Geçersiz URL. Sadece Firebase Storage URL\'leri desteklenir.' });
      }

      // Fetch image from Firebase Storage
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ElectionSystem/1.0)'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ message: 'Görüntü alınamadı' });
      }

      // Get image buffer
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Send image
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error proxying image:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = ElectionResultController;

