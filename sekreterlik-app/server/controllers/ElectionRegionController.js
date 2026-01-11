const ElectionRegion = require('../models/ElectionRegion');

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

