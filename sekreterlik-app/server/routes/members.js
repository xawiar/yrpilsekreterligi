const express = require('express');
const multer = require('multer');
const MemberController = require('../controllers/MemberController');

// Set up multer for file uploads - support both single and multiple file uploads
const storage = multer.memoryStorage();

// Sadece Excel ve CSV dosyalarına izin ver (import için)
const excelFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Sadece Excel ve CSV dosyaları kabul edilir'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: excelFileFilter
});

// Fotoğraf yükleme için ayrı multer yapılandırması
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/photos/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları (JPEG, PNG, GIF, WebP) kabul edilir'), false);
    }
  }
});

const router = express.Router();

// IMPORTANT: Specific routes must be defined BEFORE parameterized routes
// Test endpoint — sadece authenticated kullanıcılar
const { authenticateToken, requireAdmin } = require('../middleware/auth');
router.get('/test-import', authenticateToken, (req, res) => {
  res.json({ message: 'Test import endpoint working' });
});

// Import members from Excel (admin only)
router.post('/import', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  MemberController.importFromExcel(req, res);
});

// Export members to Excel (admin only)
router.get('/export', authenticateToken, requireAdmin, (req, res) => {
  MemberController.exportToExcel(req, res);
});

// Upload member photo
router.post('/upload-photo', photoUpload.single('photo'), (req, res) => {
  MemberController.uploadPhoto(req, res);
});

// Archive all members (admin only)
router.post('/bulk-archive', authenticateToken, requireAdmin, (req, res) => {
  MemberController.bulkArchive(req, res);
});

// Get all members
router.get('/', (req, res) => {
  MemberController.getAll(req, res);
});

// Get member by ID (must be defined AFTER specific routes)
router.get('/:id', (req, res) => {
  MemberController.getById(req, res);
});

// Create new member
router.post('/', (req, res) => {
  MemberController.create(req, res);
});

// Update member
router.put('/:id', (req, res) => {
  MemberController.update(req, res);
});

// Archive member
router.delete('/:id/archive', (req, res) => {
  MemberController.archive(req, res);
});

// Restore archived member
router.post('/:id/restore', (req, res) => {
  MemberController.restore(req, res);
});

// Set manual stars for a member
router.put('/:id/stars', (req, res) => {
  MemberController.setManualStars(req, res);
});

module.exports = router;