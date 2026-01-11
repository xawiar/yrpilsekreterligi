const express = require('express');
const ApiKeyController = require('../controllers/ApiKeyController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Create new API key
router.post('/', ApiKeyController.create);

// Get all API keys
router.get('/', ApiKeyController.getAll);

// Deactivate API key
router.patch('/:id/deactivate', ApiKeyController.deactivate);

// Delete API key
router.delete('/:id', ApiKeyController.delete);

module.exports = router;

