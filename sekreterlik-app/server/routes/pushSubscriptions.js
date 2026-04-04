const express = require('express');
const router = express.Router();
const PushSubscriptionController = require('../controllers/PushSubscriptionController');
const { authenticateToken } = require('../middleware/auth');

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, PushSubscriptionController.subscribe);

// Unsubscribe from push notifications
router.delete('/unsubscribe/:userId', authenticateToken, PushSubscriptionController.unsubscribe);

// Get VAPID public key
router.get('/vapid-key', PushSubscriptionController.getVapidKey);

// Send test notification
router.post('/test', authenticateToken, PushSubscriptionController.sendTestNotification);

// Send notification to all users (admin only)
router.post('/send-to-all', authenticateToken, PushSubscriptionController.sendToAll);

// Send push notification with provided subscriptions (Firebase mode support)
router.post('/send-direct', authenticateToken, PushSubscriptionController.sendDirect);

// Send notification to users with a specific role (admin only)
router.post('/send-to-role', authenticateToken, PushSubscriptionController.sendToRole);

// Get all subscriptions (admin only)
router.get('/all', authenticateToken, PushSubscriptionController.getAll);

module.exports = router;
