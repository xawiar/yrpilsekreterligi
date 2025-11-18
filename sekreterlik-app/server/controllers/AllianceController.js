const db = require('../config/database');

class AllianceController {
  /**
   * Get all alliances for an election
   */
  static async getByElection(req, res) {
    try {
      const { electionId } = req.params;
      
      const alliances = await db.all(
        'SELECT * FROM alliances WHERE election_id = ? ORDER BY created_at ASC',
        [electionId]
      );
      
      // Parse JSON fields
      const parsedAlliances = alliances.map(alliance => ({
        ...alliance,
        party_ids: alliance.party_ids ? JSON.parse(alliance.party_ids) : []
      }));
      
      res.json(parsedAlliances);
    } catch (error) {
      console.error('Error fetching alliances:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  /**
   * Get alliance by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const alliance = await db.get('SELECT * FROM alliances WHERE id = ?', [id]);
      
      if (!alliance) {
        return res.status(404).json({ message: 'İttifak bulunamadı' });
      }
      
      alliance.party_ids = alliance.party_ids ? JSON.parse(alliance.party_ids) : [];
      res.json(alliance);
    } catch (error) {
      console.error('Error fetching alliance:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  /**
   * Create new alliance
   */
  static async create(req, res) {
    try {
      const { election_id, name, party_ids } = req.body;
      const userId = req.user?.id || null;

      // Validation
      const errors = [];
      if (!election_id) errors.push('Seçim ID zorunludur');
      if (!name || !name.trim()) errors.push('İttifak adı zorunludur');
      if (!party_ids || !Array.isArray(party_ids) || party_ids.length < 2) {
        errors.push('İttifak en az 2 parti içermelidir');
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      // Check if election exists
      const election = await db.get('SELECT id FROM elections WHERE id = ?', [election_id]);
      if (!election) {
        return res.status(404).json({ message: 'Seçim bulunamadı' });
      }

      // Check for duplicate alliance name in same election
      const existing = await db.get(
        'SELECT id FROM alliances WHERE election_id = ? AND name = ?',
        [election_id, name.trim()]
      );
      if (existing) {
        return res.status(400).json({ message: 'Bu seçimde aynı isimde bir ittifak zaten var' });
      }

      // Check if any party is already in another alliance
      const existingAlliances = await db.all(
        'SELECT * FROM alliances WHERE election_id = ?',
        [election_id]
      );
      
      for (const existingAlliance of existingAlliances) {
        const existingPartyIds = existingAlliance.party_ids ? JSON.parse(existingAlliance.party_ids) : [];
        const overlap = party_ids.some(pid => existingPartyIds.includes(pid));
        if (overlap) {
          return res.status(400).json({ 
            message: `Bir veya daha fazla parti zaten "${existingAlliance.name}" ittifakında` 
          });
        }
      }

      const sql = `INSERT INTO alliances (election_id, name, party_ids) 
                   VALUES (?, ?, ?)`;
      
      const result = await db.run(sql, [
        election_id,
        name.trim(),
        JSON.stringify(party_ids)
      ]);
      
      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, new_data) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, req.user?.type || 'admin', 'create', 'alliance', result.lastID, JSON.stringify(req.body)]
      );

      const newAlliance = await db.get('SELECT * FROM alliances WHERE id = ?', [result.lastID]);
      newAlliance.party_ids = JSON.parse(newAlliance.party_ids);
      
      res.status(201).json(newAlliance);
    } catch (error) {
      console.error('Error creating alliance:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  /**
   * Update alliance
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, party_ids } = req.body;
      const userId = req.user?.id || null;

      // Get existing alliance
      const existing = await db.get('SELECT * FROM alliances WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ message: 'İttifak bulunamadı' });
      }

      // Validation
      const errors = [];
      if (name && !name.trim()) errors.push('İttifak adı boş olamaz');
      if (party_ids && (!Array.isArray(party_ids) || party_ids.length < 2)) {
        errors.push('İttifak en az 2 parti içermelidir');
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      // Check for duplicate name if name changed
      if (name && name.trim() !== existing.name) {
        const duplicate = await db.get(
          'SELECT id FROM alliances WHERE election_id = ? AND name = ? AND id != ?',
          [existing.election_id, name.trim(), id]
        );
        if (duplicate) {
          return res.status(400).json({ message: 'Bu seçimde aynı isimde bir ittifak zaten var' });
        }
      }

      // Check party overlap if party_ids changed
      if (party_ids) {
        const existingAlliances = await db.all(
          'SELECT * FROM alliances WHERE election_id = ? AND id != ?',
          [existing.election_id, id]
        );
        
        for (const existingAlliance of existingAlliances) {
          const existingPartyIds = existingAlliance.party_ids ? JSON.parse(existingAlliance.party_ids) : [];
          const overlap = party_ids.some(pid => existingPartyIds.includes(pid));
          if (overlap) {
            return res.status(400).json({ 
              message: `Bir veya daha fazla parti zaten "${existingAlliance.name}" ittifakında` 
            });
          }
        }
      }

      const updateFields = [];
      const params = [];

      if (name) {
        updateFields.push('name = ?');
        params.push(name.trim());
      }

      if (party_ids) {
        updateFields.push('party_ids = ?');
        params.push(JSON.stringify(party_ids));
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: 'Güncellenecek alan bulunamadı' });
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE alliances SET ${updateFields.join(', ')} WHERE id = ?`;
      await db.run(sql, params);

      // Audit log
      const oldData = {
        name: existing.name,
        party_ids: existing.party_ids ? JSON.parse(existing.party_ids) : []
      };
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data, new_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, req.user?.type || 'admin', 'update', 'alliance', id, JSON.stringify(oldData), JSON.stringify(req.body)]
      );

      const updated = await db.get('SELECT * FROM alliances WHERE id = ?', [id]);
      updated.party_ids = JSON.parse(updated.party_ids);
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating alliance:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  /**
   * Delete alliance
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;

      const alliance = await db.get('SELECT * FROM alliances WHERE id = ?', [id]);
      if (!alliance) {
        return res.status(404).json({ message: 'İttifak bulunamadı' });
      }

      await db.run('DELETE FROM alliances WHERE id = ?', [id]);

      // Audit log
      await db.run(
        `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, old_data) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, req.user?.type || 'admin', 'delete', 'alliance', id, JSON.stringify(alliance)]
      );

      res.json({ message: 'İttifak silindi' });
    } catch (error) {
      console.error('Error deleting alliance:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = AllianceController;

