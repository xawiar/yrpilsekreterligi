const ApiKey = require('../models/ApiKey');

class ApiKeyController {
  static async create(req, res) {
    try {
      const { name, permissions } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'API key adı gereklidir' });
      }

      const keyPermissions = permissions || ['read'];
      const result = await ApiKey.create(name.trim(), keyPermissions);
      
      res.status(201).json({
        success: true,
        message: 'API key oluşturuldu',
        data: result
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({ error: 'API key oluşturulurken hata oluştu' });
    }
  }

  static async getAll(req, res) {
    try {
      const keys = await ApiKey.getAll();
      res.json({
        success: true,
        data: keys
      });
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ error: 'API key\'ler yüklenirken hata oluştu' });
    }
  }

  static async deactivate(req, res) {
    try {
      const { id } = req.params;
      await ApiKey.deactivate(id);
      res.json({
        success: true,
        message: 'API key deaktif edildi'
      });
    } catch (error) {
      console.error('Error deactivating API key:', error);
      res.status(500).json({ error: 'API key deaktif edilirken hata oluştu' });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      await ApiKey.delete(id);
      res.json({
        success: true,
        message: 'API key silindi'
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ error: 'API key silinirken hata oluştu' });
    }
  }
}

module.exports = ApiKeyController;

