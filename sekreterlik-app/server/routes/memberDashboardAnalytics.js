const express = require('express');
const router = express.Router();
const MemberDashboardAnalyticsController = require('../controllers/MemberDashboardAnalyticsController');
const { authenticateToken } = require('../middleware/auth');

// Start a new session
router.post('/session/start', authenticateToken, MemberDashboardAnalyticsController.startSession);

// Update session
router.put('/session/:sessionId', authenticateToken, MemberDashboardAnalyticsController.updateSession);

// Get analytics for a specific member
router.get('/member/:memberId', authenticateToken, MemberDashboardAnalyticsController.getByMemberId);

// Get summary for a specific member
router.get('/member/:memberId/summary', authenticateToken, MemberDashboardAnalyticsController.getMemberSummary);

// Get all analytics (admin only)
router.get('/all', authenticateToken, MemberDashboardAnalyticsController.getAll);

// Get all summary (admin only)
router.get('/summary', authenticateToken, MemberDashboardAnalyticsController.getAllSummary);

module.exports = router;

