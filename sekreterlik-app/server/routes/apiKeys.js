const express = require('express');
const ApiKeyController = require('../controllers/ApiKeyController');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Create new API key
router.post('/', ApiKeyController.create);

// Get all API keys
router.get('/', ApiKeyController.getAll);

// Deactivate API key
router.patch('/:id/deactivate', ApiKeyController.deactivate);

// Delete API key
router.delete('/:id', ApiKeyController.delete);

module.exports = router;

