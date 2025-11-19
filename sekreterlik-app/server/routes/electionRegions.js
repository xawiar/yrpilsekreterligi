const express = require('express');
const ElectionRegionController = require('../controllers/ElectionRegionController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all regions
router.get('/', authenticate, ElectionRegionController.getAll);

// Get region by ID
router.get('/:id', authenticate, ElectionRegionController.getById);

// Create new region
router.post('/', authenticate, ElectionRegionController.create);

// Update region
router.put('/:id', authenticate, ElectionRegionController.update);

// Delete region
router.delete('/:id', authenticate, ElectionRegionController.delete);

module.exports = router;

