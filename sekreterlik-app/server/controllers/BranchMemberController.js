const db = require('../config/database');
const BranchMember = require('../models/BranchMember');

class BranchMemberController {
  // Tum kol uyelerini getir (branch_type filtreyle)
  static async getAll(req, res) {
    try {
      const { branch_type } = req.query;
      let sql = 'SELECT * FROM branch_members';
      const params = [];

      if (branch_type) {
        sql += ' WHERE branch_type = ?';
        params.push(branch_type);
      }

      sql += ' ORDER BY created_at DESC';
      const members = await db.all(sql, params);
      res.json(members);
    } catch (error) {
      console.error('Error fetching branch members:', error);
      res.status(500).json({ message: 'Kol uyeleri getirilirken hata olustu' });
    }
  }

  // Tek kol uyesi getir
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const member = await db.get('SELECT * FROM branch_members WHERE id = ?', [parseInt(id)]);

      if (!member) {
        return res.status(404).json({ message: 'Kol uyesi bulunamadi' });
      }

      res.json(member);
    } catch (error) {
      console.error('Error fetching branch member:', error);
      res.status(500).json({ message: 'Kol uyesi getirilirken hata olustu' });
    }
  }

  // Yeni kol uyesi ekle
  static async create(req, res) {
    try {
      const { branch_type, name, tc, phone, position, district_id } = req.body;

      const errors = BranchMember.validate({ branch_type, name });
      if (errors.length > 0) {
        return res.status(400).json({ message: errors.join(', ') });
      }

      const result = await db.run(
        'INSERT INTO branch_members (branch_type, name, tc, phone, position, district_id) VALUES (?, ?, ?, ?, ?, ?)',
        [branch_type, name, tc || null, phone || null, position || null, district_id || null]
      );

      res.status(201).json({
        id: result.lastID,
        branch_type,
        name,
        tc,
        phone,
        position,
        district_id
      });
    } catch (error) {
      console.error('Error creating branch member:', error);
      res.status(500).json({ message: 'Kol uyesi eklenirken hata olustu' });
    }
  }

  // Kol uyesi guncelle
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { branch_type, name, tc, phone, position, district_id } = req.body;

      const existing = await db.get('SELECT * FROM branch_members WHERE id = ?', [parseInt(id)]);
      if (!existing) {
        return res.status(404).json({ message: 'Kol uyesi bulunamadi' });
      }

      await db.run(
        'UPDATE branch_members SET branch_type = ?, name = ?, tc = ?, phone = ?, position = ?, district_id = ? WHERE id = ?',
        [
          branch_type || existing.branch_type,
          name || existing.name,
          tc !== undefined ? tc : existing.tc,
          phone !== undefined ? phone : existing.phone,
          position !== undefined ? position : existing.position,
          district_id !== undefined ? district_id : existing.district_id,
          parseInt(id)
        ]
      );

      const updated = await db.get('SELECT * FROM branch_members WHERE id = ?', [parseInt(id)]);
      res.json(updated);
    } catch (error) {
      console.error('Error updating branch member:', error);
      res.status(500).json({ message: 'Kol uyesi guncellenirken hata olustu' });
    }
  }

  // Kol uyesi sil
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const existing = await db.get('SELECT * FROM branch_members WHERE id = ?', [parseInt(id)]);
      if (!existing) {
        return res.status(404).json({ message: 'Kol uyesi bulunamadi' });
      }

      await db.run('DELETE FROM branch_members WHERE id = ?', [parseInt(id)]);
      res.json({ message: 'Kol uyesi silindi' });
    } catch (error) {
      console.error('Error deleting branch member:', error);
      res.status(500).json({ message: 'Kol uyesi silinirken hata olustu' });
    }
  }
}

module.exports = BranchMemberController;
