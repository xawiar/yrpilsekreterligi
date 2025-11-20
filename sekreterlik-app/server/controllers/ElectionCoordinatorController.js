const ElectionCoordinator = require('../models/ElectionCoordinator');

class ElectionCoordinatorController {
  static async getAll(req, res) {
    try {
      const coordinators = await ElectionCoordinator.getAll();
      res.json(coordinators);
    } catch (error) {
      console.error('Error getting coordinators:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const coordinator = await ElectionCoordinator.getById(id);
      if (!coordinator) {
        return res.status(404).json({ message: 'Sorumlu bulunamadı' });
      }
      res.json(coordinator);
    } catch (error) {
      console.error('Error getting coordinator:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const coordinatorData = req.body;
      const errors = ElectionCoordinator.validate(coordinatorData);
      
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      // Check if TC already exists
      const existing = await ElectionCoordinator.getAll();
      const existingByTc = existing.find(c => c.tc === coordinatorData.tc);
      if (existingByTc) {
        return res.status(400).json({ message: 'Bu TC kimlik numarası zaten kayıtlı' });
      }

      // Kurum sorumlusu için otomatik bölge sorumlusu atama
      if (coordinatorData.role === 'institution_supervisor' && coordinatorData.institution_name) {
        const db = require('../config/database');
        
        // Kurumun sandıklarını bul
        const ballotBoxes = await new Promise((resolve, reject) => {
          db.all('SELECT * FROM ballot_boxes WHERE institution_name = ?', [coordinatorData.institution_name], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });

        if (ballotBoxes.length > 0) {
          // İlk sandığın neighborhood_id veya village_id'sini al
          const firstBox = ballotBoxes[0];
          const neighborhoodId = firstBox.neighborhood_id;
          const villageId = firstBox.village_id;

          // Bu mahalle/köy hangi bölgede?
          const regions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM election_regions', [], (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });

          // Bölgeyi bul
          let foundRegion = null;
          for (const region of regions) {
            const neighborhoodIds = region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : [];
            const villageIds = region.village_ids ? JSON.parse(region.village_ids) : [];
            
            if ((neighborhoodId && neighborhoodIds.includes(neighborhoodId)) ||
                (villageId && villageIds.includes(villageId))) {
              foundRegion = region;
              break;
            }
          }

          // Bölge bulunduysa, o bölgenin sorumlusunu parent olarak ata
          if (foundRegion && foundRegion.supervisor_id) {
            coordinatorData.parent_coordinator_id = foundRegion.supervisor_id;
          }
        }
      }

      const newCoordinator = await ElectionCoordinator.create(coordinatorData);
      
      // Kurum sorumlusu için member_user oluştur
      if (newCoordinator) {
        const MemberUser = require('../models/MemberUser');
        try {
          await MemberUser.create({
            username: newCoordinator.tc,
            password: newCoordinator.phone,
            user_type: 'coordinator',
            coordinator_id: newCoordinator.id,
            is_active: true
          });
        } catch (memberUserError) {
          console.error('Error creating member user for coordinator:', memberUserError);
          // Member user oluşturulamazsa devam et, kritik değil
        }
      }
      
      res.status(201).json({ success: true, message: 'Sorumlu başarıyla oluşturuldu', coordinator: newCoordinator });
    } catch (error) {
      console.error('Error creating coordinator:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ message: 'Bu TC kimlik numarası zaten kayıtlı' });
      } else {
        res.status(500).json({ message: 'Sunucu hatası', error: error.message });
      }
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const coordinatorData = req.body;
      const errors = ElectionCoordinator.validate(coordinatorData);
      
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      const existing = await ElectionCoordinator.getById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Sorumlu bulunamadı' });
      }

      // Check if TC already exists (excluding current)
      const allCoordinators = await ElectionCoordinator.getAll();
      const existingByTc = allCoordinators.find(c => c.tc === coordinatorData.tc && c.id !== parseInt(id));
      if (existingByTc) {
        return res.status(400).json({ message: 'Bu TC kimlik numarası zaten kayıtlı' });
      }

      const updatedCoordinator = await ElectionCoordinator.update(id, coordinatorData);
      res.json({ success: true, message: 'Sorumlu başarıyla güncellendi', coordinator: updatedCoordinator });
    } catch (error) {
      console.error('Error updating coordinator:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await ElectionCoordinator.delete(id);
      if (result.changes === 0) {
        return res.status(404).json({ message: 'Sorumlu bulunamadı' });
      }
      res.json({ success: true, message: 'Sorumlu başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting coordinator:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = ElectionCoordinatorController;

