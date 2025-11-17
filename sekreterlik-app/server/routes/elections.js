const express = require('express');
const ElectionController = require('../controllers/ElectionController');
const router = express.Router();

// GET /api/elections - Get all elections
router.get('/', ElectionController.getAll);

// GET /api/elections/:id - Get election by ID
router.get('/:id', ElectionController.getById);

// POST /api/elections - Create new election
router.post('/', ElectionController.create);

// PUT /api/elections/:id - Update election
router.put('/:id', ElectionController.update);

// PATCH /api/elections/:id/status - Update election status
router.patch('/:id/status', ElectionController.updateStatus);

// DELETE /api/elections/:id - Delete election
router.delete('/:id', ElectionController.delete);

module.exports = router;

