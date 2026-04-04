const ElectionRegion = require('../models/ElectionRegion');
const db = require('../config/database');

class ElectionRegionController {
  static async getAll(req, res) {
    try {
      const regions = await ElectionRegion.getAll();
      res.json(regions);
    } catch (error) {
      console.error('Error getting regions:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const region = await ElectionRegion.getById(id);
      if (!region) {
        return res.status(404).json({ message: 'Bölge bulunamadı' });
      }
      res.json(region);
    } catch (error) {
      console.error('Error getting region:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const regionData = req.body;
      const errors = ElectionRegion.validate(regionData);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      // K7: Bölge sorumlusu rol validasyonu
      if (regionData.supervisor_id) {
        const supervisor = await db.get(
          'SELECT id, role FROM election_coordinators WHERE id = ?',
          [regionData.supervisor_id]
        );
        if (!supervisor || supervisor.role !== 'region_supervisor') {
          return res.status(400).json({
            success: false,
            message: 'Bölge sorumlusu olarak sadece "Bölge Sorumlusu" rolündeki koordinatörler atanabilir.'
          });
        }
      }

      // Mahalle uniqueness kontrolü
      const allRegions = await ElectionRegion.getAll();
      if (regionData.neighborhood_ids && regionData.neighborhood_ids.length > 0) {
        for (const region of allRegions) {
          const existingIds = (region.neighborhood_ids || []).map(Number);
          const overlap = regionData.neighborhood_ids.filter(id => existingIds.includes(Number(id)));
          if (overlap.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Seçilen mahallelerden bazıları zaten başka bir bölgeye atanmış (${region.name || region.id + " no'lu bölge"}).`
            });
          }
        }
      }

      // Köy uniqueness kontrolü
      if (regionData.village_ids && regionData.village_ids.length > 0) {
        for (const region of allRegions) {
          const existingIds = (region.village_ids || []).map(Number);
          const overlap = regionData.village_ids.filter(id => existingIds.includes(Number(id)));
          if (overlap.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Seçilen köylerden bazıları zaten başka bir bölgeye atanmış (${region.name || region.id + " no'lu bölge"}).`
            });
          }
        }
      }

      const newRegion = await ElectionRegion.create(regionData);
      res.status(201).json({ success: true, message: 'Bölge başarıyla oluşturuldu', region: newRegion });
    } catch (error) {
      console.error('Error creating region:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const regionData = req.body;
      const errors = ElectionRegion.validate(regionData);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      const existing = await ElectionRegion.getById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Bölge bulunamadı' });
      }

      // K7: Bölge sorumlusu rol validasyonu
      if (regionData.supervisor_id) {
        const supervisor = await db.get(
          'SELECT id, role FROM election_coordinators WHERE id = ?',
          [regionData.supervisor_id]
        );
        if (!supervisor || supervisor.role !== 'region_supervisor') {
          return res.status(400).json({
            success: false,
            message: 'Bölge sorumlusu olarak sadece "Bölge Sorumlusu" rolündeki koordinatörler atanabilir.'
          });
        }
      }

      // Mahalle uniqueness kontrolü (kendi bölgesini hariç tut)
      const allRegions = await ElectionRegion.getAll();
      const otherRegions = allRegions.filter(r => String(r.id) !== String(id));
      if (regionData.neighborhood_ids && regionData.neighborhood_ids.length > 0) {
        for (const region of otherRegions) {
          const existingIds = (region.neighborhood_ids || []).map(Number);
          const overlap = regionData.neighborhood_ids.filter(nid => existingIds.includes(Number(nid)));
          if (overlap.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Seçilen mahallelerden bazıları zaten başka bir bölgeye atanmış (${region.name || region.id + " no'lu bölge"}).`
            });
          }
        }
      }

      // Köy uniqueness kontrolü (kendi bölgesini hariç tut)
      if (regionData.village_ids && regionData.village_ids.length > 0) {
        for (const region of otherRegions) {
          const existingIds = (region.village_ids || []).map(Number);
          const overlap = regionData.village_ids.filter(vid => existingIds.includes(Number(vid)));
          if (overlap.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Seçilen köylerden bazıları zaten başka bir bölgeye atanmış (${region.name || region.id + " no'lu bölge"}).`
            });
          }
        }
      }

      const updatedRegion = await ElectionRegion.update(id, regionData);
      res.json({ success: true, message: 'Bölge başarıyla güncellendi', region: updatedRegion });
    } catch (error) {
      console.error('Error updating region:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await ElectionRegion.delete(id);
      if (result.changes === 0) {
        return res.status(404).json({ message: 'Bölge bulunamadı' });
      }
      res.json({ success: true, message: 'Bölge başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting region:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = ElectionRegionController;

