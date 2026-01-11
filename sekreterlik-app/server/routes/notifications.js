const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { authenticateToken } = require('../middleware/auth');

// Get notifications for a member
router.get('/member/:memberId', authenticateToken, NotificationController.getByMemberId);

// Get unread count
router.get('/member/:memberId/unread-count', authenticateToken, NotificationController.getUnreadCount);

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, NotificationController.markAsRead);

// Mark all as read
router.put('/member/:memberId/read-all', authenticateToken, NotificationController.markAllAsRead);

// Delete notification
router.delete('/:notificationId', authenticateToken, NotificationController.delete);

// Delete expired notifications (admin only)
router.delete('/expired', authenticateToken, NotificationController.deleteExpired);

module.exports = router;

