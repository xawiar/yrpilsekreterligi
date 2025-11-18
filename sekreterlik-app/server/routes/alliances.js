const express = require('express');
const router = express.Router();
const AllianceController = require('../controllers/AllianceController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all alliances for an election
router.get('/election/:electionId', authenticateToken, AllianceController.getByElection);

// Get alliance by ID
router.get('/:id', authenticateToken, AllianceController.getById);

// Create alliance (admin only)
router.post('/', authenticateToken, requireAdmin, AllianceController.create);

// Update alliance (admin only)
router.put('/:id', authenticateToken, requireAdmin, AllianceController.update);

// Delete alliance (admin only)
router.delete('/:id', authenticateToken, requireAdmin, AllianceController.delete);

module.exports = router;

