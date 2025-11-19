const express = require('express');
const ElectionCoordinatorController = require('../controllers/ElectionCoordinatorController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all coordinators
router.get('/', authenticate, ElectionCoordinatorController.getAll);

// Get coordinator by ID
router.get('/:id', authenticate, ElectionCoordinatorController.getById);

// Create new coordinator
router.post('/', authenticate, ElectionCoordinatorController.create);

// Update coordinator
router.put('/:id', authenticate, ElectionCoordinatorController.update);

// Delete coordinator
router.delete('/:id', authenticate, ElectionCoordinatorController.delete);

module.exports = router;

