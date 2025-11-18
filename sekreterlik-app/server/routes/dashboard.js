const express = require('express');
const DashboardController = require('../controllers/DashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard summary
// Requires authentication
router.get('/', authenticateToken, DashboardController.getDashboard);

module.exports = router;

