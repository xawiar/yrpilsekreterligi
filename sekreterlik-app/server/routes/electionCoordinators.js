const express = require('express');
const ElectionCoordinatorController = require('../controllers/ElectionCoordinatorController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all coordinators
router.get('/', authenticateToken, ElectionCoordinatorController.getAll);

// Get coordinator by ID
router.get('/:id', authenticateToken, ElectionCoordinatorController.getById);

// Create new coordinator
router.post('/', authenticateToken, ElectionCoordinatorController.create);

// Update coordinator
router.put('/:id', authenticateToken, ElectionCoordinatorController.update);

// Delete coordinator
router.delete('/:id', authenticateToken, ElectionCoordinatorController.delete);

module.exports = router;

