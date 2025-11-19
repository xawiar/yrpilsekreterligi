const express = require('express');
const NewsController = require('../controllers/NewsController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Public routes - no authentication required
router.get('/', NewsController.getAll);
router.get('/:id', NewsController.getById);

// Protected routes - require authentication
router.post('/', authenticateToken, NewsController.create);
router.put('/:id', authenticateToken, NewsController.update);
router.delete('/:id', authenticateToken, NewsController.delete);

module.exports = router;

