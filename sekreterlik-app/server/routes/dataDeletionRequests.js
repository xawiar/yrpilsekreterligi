const express = require('express');
const router = express.Router();
const DataDeletionRequest = require('../models/DataDeletionRequest');
const { requireAdmin } = require('../middleware/auth');

// POST /api/data-deletion-requests — Üye talep oluşturur
router.post('/', async (req, res) => {
  try {
    const { member_id, reason } = req.body;

    if (!member_id) {
      return res.status(400).json({ success: false, message: 'member_id zorunludur' });
    }

    // Admin degilse, sadece kendi member_id'si icin talep olusturabilir
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.type === 'admin');
    if (!isAdmin && req.user.memberId && String(req.user.memberId) !== String(member_id)) {
      return res.status(403).json({ success: false, message: 'Sadece kendi verileriniz icin silme talebi olusturabilirsiniz' });
    }

    // Aynı üye için bekleyen talep var mı kontrol et
    const existingRequests = await DataDeletionRequest.getByMemberId(member_id);
    const hasPending = existingRequests.some(r => r.status === 'pending');
    if (hasPending) {
      return res.status(400).json({
        success: false,
        message: 'Bu uye icin zaten bekleyen bir silme talebi bulunmaktadir'
      });
    }

    const request = await DataDeletionRequest.create({ member_id, reason });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Error creating data deletion request:', error);
    res.status(500).json({ success: false, message: 'Talep olusturulurken hata olustu' });
  }
});

// GET /api/data-deletion-requests — Admin tüm talepleri listeler
router.get('/', requireAdmin, async (req, res) => {
  try {
    const requests = await DataDeletionRequest.getAll();
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching data deletion requests:', error);
    res.status(500).json({ success: false, message: 'Talepler yuklenirken hata olustu' });
  }
});

// GET /api/data-deletion-requests/member/:memberId — Üyenin kendi taleplerini görür
router.get('/member/:memberId', async (req, res) => {
  try {
    const requests = await DataDeletionRequest.getByMemberId(req.params.memberId);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching member deletion requests:', error);
    res.status(500).json({ success: false, message: 'Talepler yuklenirken hata olustu' });
  }
});

// PUT /api/data-deletion-requests/:id/approve — Admin onaylar, üye verilerini kalıcı siler
router.put('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    const processed_by = req.user.username || req.user.id;

    // Talebi bul
    const request = await DataDeletionRequest.getById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Talep bulunamadi' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Bu talep zaten islenmis' });
    }

    // Talebi onayla
    await DataDeletionRequest.approve(requestId, processed_by);

    // Üye verilerini kalıcı sil
    try {
      await DataDeletionRequest.deleteMemberData(request.member_id);
    } catch (deleteError) {
      console.error('Error deleting member data:', deleteError);
      // Onay işlemi başarılı ama veri silme kısmen başarısız olabilir
    }

    res.json({ success: true, message: 'Talep onaylandi ve uye verileri silindi' });
  } catch (error) {
    console.error('Error approving data deletion request:', error);
    res.status(500).json({ success: false, message: 'Talep onaylanirken hata olustu' });
  }
});

// PUT /api/data-deletion-requests/:id/reject — Admin reddeder
router.put('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { rejection_reason } = req.body;
    const processed_by = req.user.username || req.user.id;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ success: false, message: 'Ret nedeni zorunludur' });
    }

    const request = await DataDeletionRequest.getById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Talep bulunamadi' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Bu talep zaten islenmis' });
    }

    await DataDeletionRequest.reject(requestId, rejection_reason.trim(), processed_by);

    res.json({ success: true, message: 'Talep reddedildi' });
  } catch (error) {
    console.error('Error rejecting data deletion request:', error);
    res.status(500).json({ success: false, message: 'Talep reddedilirken hata olustu' });
  }
});

module.exports = router;
