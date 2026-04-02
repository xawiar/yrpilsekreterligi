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

console.log('Members router initialized');

// IMPORTANT: Specific routes must be defined BEFORE parameterized routes
// Test endpoint — sadece authenticated kullanıcılar
const { authenticateToken } = require('../middleware/auth');
router.get('/test-import', authenticateToken, (req, res) => {
  res.json({ message: 'Test import endpoint working' });
});

// Import members from Excel
router.post('/import', upload.single('file'), (req, res) => {
  console.log('POST /import route called');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  console.log('Request files:', req.files);
  MemberController.importFromExcel(req, res);
});

// Export members to Excel
router.get('/export', (req, res) => {
  console.log('GET /export route called');
  MemberController.exportToExcel(req, res);
});

// Upload member photo
router.post('/upload-photo', photoUpload.single('photo'), (req, res) => {
  console.log('POST /upload-photo route called');
  MemberController.uploadPhoto(req, res);
});

// Archive all members (completely new endpoint)
router.post('/bulk-archive', (req, res) => {
  console.log('POST /bulk-archive route called');
  MemberController.bulkArchive(req, res);
});

// Get all members
router.get('/', (req, res) => {
  console.log('GET / route called');
  MemberController.getAll(req, res);
});

// Get member by ID (must be defined AFTER specific routes)
router.get('/:id', (req, res) => {
  console.log('GET /:id route called with id:', req.params.id);
  MemberController.getById(req, res);
});

// Create new member
router.post('/', (req, res) => {
  console.log('POST / route called');
  MemberController.create(req, res);
});

// Update member
router.put('/:id', (req, res) => {
  console.log('PUT /:id route called with id:', req.params.id);
  MemberController.update(req, res);
});

// Archive member
router.delete('/:id/archive', (req, res) => {
  console.log('DELETE /:id/archive route called with id:', req.params.id);
  MemberController.archive(req, res);
});

// Restore archived member
router.post('/:id/restore', (req, res) => {
  console.log('POST /:id/restore route called with id:', req.params.id);
  MemberController.restore(req, res);
});

// Set manual stars for a member
router.put('/:id/stars', (req, res) => {
  console.log('PUT /:id/stars route called with id:', req.params.id);
  MemberController.setManualStars(req, res);
});

module.exports = router;