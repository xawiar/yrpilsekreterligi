const db = require('../config/database');

function validateVoteData(data, res) {
  const errors = [];

  const totalVoters = parseInt(data.total_voters) || 0;
  const usedVotes = parseInt(data.used_votes) || 0;
  const validVotes = parseInt(data.valid_votes) || 0;
  const invalidVotes = parseInt(data.invalid_votes) || 0;

  // 1. Negatif değer kontrolü
  if (totalVoters < 0 || usedVotes < 0 || validVotes < 0 || invalidVotes < 0) {
    errors.push('Oy değerleri negatif olamaz');
  }

  // 2. Kullanılan oy <= Toplam seçmen
  if (usedVotes > totalVoters) {
    errors.push(`Kullanılan oy (${usedVotes}) toplam seçmenden (${totalVoters}) fazla olamaz`);
  }

  // 3. Geçerli + Geçersiz = Kullanılan
  if (validVotes + invalidVotes !== usedVotes) {
    errors.push(`Geçerli (${validVotes}) + Geçersiz (${invalidVotes}) = ${validVotes + invalidVotes}, ama kullanılan oy ${usedVotes}`);
  }

  // 4. Parti oy toplamı = Geçerli oy (for each vote category)
  const voteCategories = ['cb_votes', 'mv_votes', 'mayor_votes', 'municipal_council_votes', 'provincial_assembly_votes'];
  voteCategories.forEach(category => {
    if (data[category] && typeof data[category] === 'object' && Object.keys(data[category]).length > 0) {
      const partyTotal = Object.values(data[category]).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
      if (partyTotal !== validVotes) {
        errors.push(`${category} parti toplamı (${partyTotal}) geçerli oy sayısından (${validVotes}) farklı`);
      }
    }
  });

  if (errors.length > 0) {
    res.status(400).json({ success: false, errors });
    return false;
  }
  return true; // valid
}

// Koordinatör/başmüşahit rol bazlı sandık filtreleme yardımcı fonksiyonu
async function getCoordinatorBallotBoxIds(user, dbConn) {
  const coordinatorId = user.id || user.coordinatorId;
  const role = user.type || user.role;

  if (role === 'provincial_coordinator' || role === 'admin') {
    return null; // tüm sandıklar
  }

  if (role === 'institution_supervisor') {
    // Kendi kurumundaki sandıklar
    const coordinator = await dbConn.get('SELECT institution_name FROM election_coordinators WHERE id = ?', [coordinatorId]);
    if (!coordinator?.institution_name) return [];
    const boxes = await dbConn.all('SELECT id FROM ballot_boxes WHERE institution_name = ?', [coordinator.institution_name]);
    return boxes.map(b => b.id);
  }

  if (role === 'region_supervisor') {
    // Kendi bölgesindeki sandıklar
    const regions = await dbConn.all('SELECT neighborhood_ids, village_ids FROM election_regions WHERE supervisor_id = ?', [coordinatorId]);
    if (!regions.length) return [];

    let neighborhoodIds = [];
    let villageIds = [];
    for (const region of regions) {
      const nIds = typeof region.neighborhood_ids === 'string' ? JSON.parse(region.neighborhood_ids || '[]') : (region.neighborhood_ids || []);
      const vIds = typeof region.village_ids === 'string' ? JSON.parse(region.village_ids || '[]') : (region.village_ids || []);
      neighborhoodIds.push(...nIds);
      villageIds.push(...vIds);
    }

    let conditions = [];
    let boxParams = [];
    if (neighborhoodIds.length) {
      conditions.push(`neighborhood_id IN (${neighborhoodIds.map(() => '?').join(',')})`);
      boxParams.push(...neighborhoodIds);
    }
    if (villageIds.length) {
      conditions.push(`village_id IN (${villageIds.map(() => '?').join(',')})`);
      boxParams.push(...villageIds);
    }
    if (!conditions.length) return [];

    const boxes = await dbConn.all(`SELECT id FROM ballot_boxes WHERE ${conditions.join(' OR ')}`, boxParams);
    return boxes.map(b => b.id);
  }

  if (role === 'district_supervisor') {
    // Alt koordinatörlerin bölgelerindeki sandıklar
    const subCoordinators = await dbConn.all('SELECT id FROM election_coordinators WHERE parent_coordinator_id = ?', [coordinatorId]);
    const subIds = subCoordinators.map(c => c.id);
    if (!subIds.length) return [];

    const regions = await dbConn.all(`SELECT neighborhood_ids, village_ids FROM election_regions WHERE supervisor_id IN (${subIds.map(() => '?').join(',')})`, subIds);

    let neighborhoodIds = [];
    let villageIds = [];
    for (const region of regions) {
      const nIds = typeof region.neighborhood_ids === 'string' ? JSON.parse(region.neighborhood_ids || '[]') : (region.neighborhood_ids || []);
      const vIds = typeof region.village_ids === 'string' ? JSON.parse(region.village_ids || '[]') : (region.village_ids || []);
      neighborhoodIds.push(...nIds);
      villageIds.push(...vIds);
    }

    let conditions = [];
    let boxParams = [];
    if (neighborhoodIds.length) {
      conditions.push(`neighborhood_id IN (${neighborhoodIds.map(() => '?').join(',')})`);
      boxParams.push(...neighborhoodIds);
    }
    if (villageIds.length) {
      conditions.push(`village_id IN (${villageIds.map(() => '?').join(',')})`);
      boxParams.push(...villageIds);
    }
    if (!conditions.length) return [];

    const boxes = await dbConn.all(`SELECT id FROM ballot_boxes WHERE ${conditions.join(' OR ')}`, boxParams);
    return boxes.map(b => b.id);
  }

  return null; // bilinmeyen rol — tüm sonuçlar
}

class ElectionResultController {
  static async getAll(req, res) {
    try {
      const { election_id, ballot_box_id, has_protocol, has_data, has_objection } = req.query;
      let sql = `SELECT er.*, e.name as election_name, e.type as election_type, e.status as election_status
                 FROM election_results er
                 LEFT JOIN elections e ON er.election_id = e.id
                 WHERE 1=1`;
      const params = [];

      // Rol bazlı sonuç filtreleme
      if (req.user) {
        const userType = req.user.type || req.user.role;

        if (userType === 'chief_observer') {
          // Başmüşahit sadece kendi sandığının sonuçlarını görebilir
          if (req.user.ballot_box_id) {
            sql += ' AND er.ballot_box_id = ?';
            params.push(req.user.ballot_box_id);
          }
        } else if (['region_supervisor', 'district_supervisor', 'institution_supervisor'].includes(userType)) {
          // Koordinatörler sadece kendi sandıklarının sonuçlarını görebilir
          const allowedBallotBoxIds = await getCoordinatorBallotBoxIds(req.user, db);
          if (allowedBallotBoxIds && allowedBallotBoxIds.length > 0) {
            sql += ` AND er.ballot_box_id IN (${allowedBallotBoxIds.map(() => '?').join(',')})`;
            params.push(...allowedBallotBoxIds);
          } else if (allowedBallotBoxIds !== null) {
            // Boş dizi döndü — hiç sandık yok, boş sonuç dönsün
            sql += ' AND 1=0';
          }
          // allowedBallotBoxIds === null → tüm sonuçlar (filtre yok)
        }
        // admin ve provincial_coordinator → tüm sonuçlar (filtre yok)
      }

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

      // Vote data validation
      if (!validateVoteData(resultData, res)) return;

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

      // K3: Müşahit atanmadan sonuç girilmesini engelle
      const observers = await db.all(
        'SELECT id FROM ballot_box_observers WHERE ballot_box_id = ?',
        [resultData.ballot_box_id]
      );
      if (!observers || observers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Bu sandığa henüz müşahit atanmamıştır. Önce müşahit ataması yapılmalıdır.'
        });
      }

      // Check if result already exists
      const existingResult = await db.get(
        'SELECT * FROM election_results WHERE election_id = ? AND ballot_box_id = ?',
        [resultData.election_id, resultData.ballot_box_id]
      );
      if (existingResult) {
        return res.status(400).json({ message: 'Bu sandık için zaten sonuç girilmiş' });
      }

      // K10: Köy sandıklarında mayor ve municipal_council oyu olmamalı
      const ballotBox = await db.get('SELECT * FROM ballot_boxes WHERE id = ?', [resultData.ballot_box_id]);
      if (ballotBox && ballotBox.village_id && !ballotBox.neighborhood_id) {
        const villageErrors = [];
        if (resultData.mayor_votes) {
          const mayorData = typeof resultData.mayor_votes === 'object' ? resultData.mayor_votes : JSON.parse(resultData.mayor_votes || '{}');
          const mayorTotal = Object.values(mayorData).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
          if (mayorTotal > 0) {
            villageErrors.push('Köy sandıklarında belediye başkanı oyu girilemez');
          }
        }
        if (resultData.municipal_council_votes) {
          const mcData = typeof resultData.municipal_council_votes === 'object' ? resultData.municipal_council_votes : JSON.parse(resultData.municipal_council_votes || '{}');
          const mcTotal = Object.values(mcData).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
          if (mcTotal > 0) {
            villageErrors.push('Köy sandıklarında belediye meclisi oyu girilemez');
          }
        }
        if (villageErrors.length > 0) {
          return res.status(400).json({ success: false, errors: villageErrors });
        }
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

      // Vote data validation
      if (!validateVoteData(resultData, res)) return;

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

      // K10: Köy sandıklarında mayor ve municipal_council oyu olmamalı
      const ballotBox = await db.get('SELECT * FROM ballot_boxes WHERE id = ?', [oldResult.ballot_box_id]);
      if (ballotBox && ballotBox.village_id && !ballotBox.neighborhood_id) {
        const villageErrors = [];
        if (resultData.mayor_votes) {
          const mayorData = typeof resultData.mayor_votes === 'object' ? resultData.mayor_votes : JSON.parse(resultData.mayor_votes || '{}');
          const mayorTotal = Object.values(mayorData).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
          if (mayorTotal > 0) {
            villageErrors.push('Köy sandıklarında belediye başkanı oyu girilemez');
          }
        }
        if (resultData.municipal_council_votes) {
          const mcData = typeof resultData.municipal_council_votes === 'object' ? resultData.municipal_council_votes : JSON.parse(resultData.municipal_council_votes || '{}');
          const mcTotal = Object.values(mcData).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
          if (mcTotal > 0) {
            villageErrors.push('Köy sandıklarında belediye meclisi oyu girilemez');
          }
        }
        if (villageErrors.length > 0) {
          return res.status(400).json({ success: false, errors: villageErrors });
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

      // K6: Başmüşahit sadece kendi sandığının sonucunu onaylayabilir
      if (req.user?.type === 'chief_observer' && req.user?.ballot_box_id) {
        if (String(result.ballot_box_id) !== String(req.user.ballot_box_id)) {
          return res.status(403).json({
            success: false,
            message: 'Sadece kendi sandığınızın sonuçlarını onaylayabilirsiniz.'
          });
        }
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

      // K6: Başmüşahit sadece kendi sandığının sonucunu reddedebilir
      if (req.user?.type === 'chief_observer' && req.user?.ballot_box_id) {
        if (String(result.ballot_box_id) !== String(req.user.ballot_box_id)) {
          return res.status(403).json({
            success: false,
            message: 'Sadece kendi sandığınızın sonuçlarını reddedebilirsiniz.'
          });
        }
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

