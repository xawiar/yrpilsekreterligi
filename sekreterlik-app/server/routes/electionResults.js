const express = require('express');
const ElectionResultController = require('../controllers/ElectionResultController');
const router = express.Router();

// GET /api/election-results - Get all election results
router.get('/', ElectionResultController.getAll);

// GET /api/election-results/election/:election_id/ballot-box/:ballot_box_id - Get result by election and ballot box
router.get('/election/:election_id/ballot-box/:ballot_box_id', ElectionResultController.getByElectionAndBallotBox);

// GET /api/election-results/pending - Get pending election results (chief observer only)
router.get('/pending', ElectionResultController.getPending);

// GET /api/election-results/:id - Get election result by ID
router.get('/:id', ElectionResultController.getById);

// POST /api/election-results - Create new election result
router.post('/', ElectionResultController.create);

// PUT /api/election-results/:id - Update election result
router.put('/:id', ElectionResultController.update);

// POST /api/election-results/:id/approve - Approve election result (chief observer only)
router.post('/:id/approve', ElectionResultController.approve);

// POST /api/election-results/:id/reject - Reject election result (chief observer only)
router.post('/:id/reject', ElectionResultController.reject);

// DELETE /api/election-results/:id - Delete election result
router.delete('/:id', ElectionResultController.delete);

module.exports = router;

