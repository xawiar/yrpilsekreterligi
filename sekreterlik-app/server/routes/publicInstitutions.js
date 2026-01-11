const express = require('express');
const PublicInstitutionController = require('../controllers/PublicInstitutionController');

const router = express.Router();

// Get all Public Institutions
router.get('/', PublicInstitutionController.getAll);

// Create new Public Institution
router.post('/', PublicInstitutionController.create);

// Update Public Institution
router.put('/:id', PublicInstitutionController.update);

// Delete Public Institution
router.delete('/:id', PublicInstitutionController.delete);

module.exports = router;

