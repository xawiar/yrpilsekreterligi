const express = require('express');
const ElectionRegionController = require('../controllers/ElectionRegionController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all regions
router.get('/', authenticateToken, ElectionRegionController.getAll);

// Get region by ID
router.get('/:id', authenticateToken, ElectionRegionController.getById);

// Create new region
router.post('/', authenticateToken, ElectionRegionController.create);

// Update region
router.put('/:id', authenticateToken, ElectionRegionController.update);

// Delete region
router.delete('/:id', authenticateToken, ElectionRegionController.delete);

module.exports = router;

