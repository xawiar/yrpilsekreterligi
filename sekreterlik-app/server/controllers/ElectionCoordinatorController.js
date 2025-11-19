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

      const newCoordinator = await ElectionCoordinator.create(coordinatorData);
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

