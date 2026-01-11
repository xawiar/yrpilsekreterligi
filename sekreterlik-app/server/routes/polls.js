const express = require('express');
const PollController = require('../controllers/PollController');

const router = express.Router();

// Get all polls
router.get('/', PollController.getAll);

// Get active polls (for member dashboard)
router.get('/active', PollController.getActive);

// Create new poll
router.post('/', PollController.create);

// Get poll by ID
router.get('/:id', PollController.getById);

// Vote on poll
router.post('/:id/vote', PollController.vote);

// Get poll results
router.get('/:id/results', PollController.getResults);

// End poll manually
router.post('/:id/end', PollController.endPoll);

// Delete poll
router.delete('/:id', PollController.delete);

module.exports = router;

