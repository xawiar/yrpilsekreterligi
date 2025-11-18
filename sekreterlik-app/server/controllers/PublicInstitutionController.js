const db = require('../config/database');

class PublicInstitutionController {
  // Get all Public Institutions
  static async getAll(req, res) {
    try {
      const publicInstitutions = await db.all('SELECT * FROM public_institutions ORDER BY name');
      res.json(publicInstitutions);
    } catch (error) {
      console.error('Error getting Public Institutions:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Get Public Institution by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const publicInstitution = await db.get('SELECT * FROM public_institutions WHERE id = ?', [parseInt(id)]);
      
      if (!publicInstitution) {
        return res.status(404).json({ message: 'Kamu kurumu bulunamadı' });
      }
      
      res.json(publicInstitution);
    } catch (error) {
      console.error('Error getting Public Institution by ID:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Create new Public Institution
  static async create(req, res) {
    try {
      const { name, description } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Kamu kurumu adı gereklidir' });
      }
      
      // Check if Public Institution already exists
      const existingPublicInstitution = await db.get('SELECT * FROM public_institutions WHERE name = ?', [name.trim()]);
      if (existingPublicInstitution) {
        return res.status(400).json({ message: 'Bu kamu kurumu zaten kayıtlı' });
      }
      
      const result = await db.run('INSERT INTO public_institutions (name, description) VALUES (?, ?)', [name.trim(), description?.trim() || null]);
      const newPublicInstitution = await db.get('SELECT * FROM public_institutions WHERE id = ?', [result.lastID]);
      
      res.status(201).json(newPublicInstitution);
    } catch (error) {
      console.error('Error creating Public Institution:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Update Public Institution
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Kamu kurumu adı gereklidir' });
      }
      
      // Check if Public Institution exists
      const existingPublicInstitution = await db.get('SELECT * FROM public_institutions WHERE id = ?', [id]);
      if (!existingPublicInstitution) {
        return res.status(404).json({ message: 'Kamu kurumu bulunamadı' });
      }
      
      // Check if new name already exists
      const duplicatePublicInstitution = await db.get('SELECT * FROM public_institutions WHERE name = ? AND id != ?', [name.trim(), id]);
      if (duplicatePublicInstitution) {
        return res.status(400).json({ message: 'Bu kamu kurumu adı zaten kullanılıyor' });
      }
      
      await db.run('UPDATE public_institutions SET name = ?, description = ? WHERE id = ?', [name.trim(), description?.trim() || null, id]);
      const updatedPublicInstitution = await db.get('SELECT * FROM public_institutions WHERE id = ?', [id]);
      
      res.json(updatedPublicInstitution);
    } catch (error) {
      console.error('Error updating Public Institution:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Delete Public Institution
  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Check if Public Institution exists
      const existingPublicInstitution = await db.get('SELECT * FROM public_institutions WHERE id = ?', [id]);
      if (!existingPublicInstitution) {
        return res.status(404).json({ message: 'Kamu kurumu bulunamadı' });
      }
      
      await db.run('DELETE FROM public_institutions WHERE id = ?', [id]);
      
      res.json({ message: 'Kamu kurumu başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting Public Institution:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = PublicInstitutionController;

