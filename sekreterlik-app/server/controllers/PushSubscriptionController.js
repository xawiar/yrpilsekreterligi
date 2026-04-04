const PushSubscription = require('../models/PushSubscription');
const PushNotificationService = require('../services/pushNotificationService');

class PushSubscriptionController {
  // Subscribe user to push notifications
  static async subscribe(req, res) {
    try {
      const { userId, subscription } = req.body;
      
      if (!userId || !subscription || !subscription.endpoint) {
        return res.status(400).json({ 
          success: false, 
          message: 'Kullanıcı ID ve subscription bilgileri gerekli' 
        });
      }

      const subscriptionData = {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: req.headers['user-agent']
      };

      // Check if user already has a subscription
      const existingSubscriptions = await PushSubscription.getByUserId(userId);
      
      if (existingSubscriptions.length > 0) {
        // Update existing subscription
        await PushSubscription.update(userId, subscriptionData);
        console.log(`Updated push subscription for user ${userId}`);
      } else {
        // Create new subscription
        await PushSubscription.create(subscriptionData);
        console.log(`Created new push subscription for user ${userId}`);
      }

      res.json({ 
        success: true, 
        message: 'Push notification aboneliği başarılı' 
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Push notification aboneliği sırasında hata oluştu' 
      });
    }
  }

  // Unsubscribe user from push notifications
  static async unsubscribe(req, res) {
    try {
      const { userId } = req.params;
      
      await PushSubscription.delete(userId);
      
      res.json({ 
        success: true, 
        message: 'Push notification aboneliği iptal edildi' 
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Push notification aboneliği iptal edilirken hata oluştu' 
      });
    }
  }

  // Get VAPID public key
  static async getVapidKey(req, res) {
    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        return res.status(500).json({
          success: false,
          message: 'VAPID_PUBLIC_KEY environment variable is not set'
        });
      }
      res.json({
        success: true,
        publicKey
      });
    } catch (error) {
      console.error('Error getting VAPID key:', error);
      res.status(500).json({
        success: false,
        message: 'VAPID anahtarı alınırken hata oluştu'
      });
    }
  }

  // Send test notification
  static async sendTestNotification(req, res) {
    try {
      // Get userId from request body or user from auth
      const userId = req.body?.userId || req.user?.id || req.user?.memberId;
      
      if (!userId) {
        // If no userId, send to all subscribers
        const subscriptions = await PushSubscription.getAll();

        if (subscriptions.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Aktif push subscription bulunamadı'
          });
        }

        const payload = PushNotificationService.createPayload(
          'Test Bildirimi',
          'Bu bir test bildirimidir. Push notification sistemi çalışıyor!',
          '/icon-192x192.png',
          '/badge-72x72.png',
          { type: 'test', action: 'view' }
        );

        // Format subscriptions for web-push
        const formattedSubscriptions = subscriptions.map(sub => ({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh || sub.keys?.p256dh,
            auth: sub.auth || sub.keys?.auth
          }
        }));
        const results = await PushNotificationService.sendToMultipleUsers(formattedSubscriptions, payload);

        return res.json({
          success: true,
          message: `Test bildirimi ${subscriptions.length} kullanıcıya gönderildi`,
          results
        });
      }

      const subscriptions = await PushSubscription.getByUserId(userId);

      if (subscriptions.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Kullanıcının aktif push subscription\'ı bulunamadı'
        });
      }

      const payload = PushNotificationService.createPayload(
        'Test Bildirimi',
        'Bu bir test bildirimidir. Push notification sistemi çalışıyor!',
        '/icon-192x192.png',
        '/badge-72x72.png',
        { type: 'test', action: 'view' }
      );

      // Format subscriptions for web-push
      const formattedSubs = subscriptions.map(sub => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh || sub.keys?.p256dh,
          auth: sub.auth || sub.keys?.auth
        }
      }));
      const results = await PushNotificationService.sendToMultipleUsers(formattedSubs, payload);
      
      res.json({ 
        success: true, 
        message: 'Test bildirimi gönderildi',
        results 
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Test bildirimi gönderilirken hata oluştu' 
      });
    }
  }

  // Send notification to all users
  static async sendToAll(req, res) {
    try {
      const { title, body } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ 
          success: false, 
          message: 'Başlık ve içerik gerekli' 
        });
      }

      const subscriptions = await PushSubscription.getAll();

      if (subscriptions.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aktif push subscription bulunamadı'
        });
      }

      // Format subscriptions for web-push
      const formattedSubscriptions = subscriptions.map(sub => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh || sub.keys?.p256dh,
          auth: sub.auth || sub.keys?.auth
        }
      }));

      const results = await PushNotificationService.sendGeneralNotification(
        formattedSubscriptions,
        title,
        body
      );

      res.json({
        success: true,
        message: 'Bildirim tüm kullanıcılara gönderildi',
        sentCount: results.filter(r => r.success).length,
        totalCount: subscriptions.length,
        results
      });
    } catch (error) {
      console.error('Error sending notification to all:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Bildirim gönderilirken hata oluştu' 
      });
    }
  }

  // Send notification to users with a specific role/user_type
  static async sendToRole(req, res) {
    try {
      const { title, body, role, url } = req.body;

      if (!title || !body || !role) {
        return res.status(400).json({
          success: false,
          message: 'Baslik, icerik ve rol bilgisi gerekli'
        });
      }

      const subscriptions = await PushSubscription.getByUserType(role);

      if (subscriptions.length === 0) {
        return res.status(404).json({
          success: false,
          message: `"${role}" rolune sahip aktif push subscription bulunamadi`
        });
      }

      const formattedSubscriptions = subscriptions.map(sub => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh || sub.keys?.p256dh,
          auth: sub.auth || sub.keys?.auth
        }
      }));

      const payload = PushNotificationService.createPayload(
        title,
        body,
        '/icon-192x192.png',
        '/badge-72x72.png',
        { type: 'role_notification', action: 'view', url: url || '/notifications' }
      );

      const results = await PushNotificationService.sendToMultipleUsers(formattedSubscriptions, payload);

      res.json({
        success: true,
        message: `Bildirim "${role}" rolundeki ${subscriptions.length} kullaniciya gonderildi`,
        sentCount: results.filter(r => r.success).length,
        totalCount: subscriptions.length,
        results
      });
    } catch (error) {
      console.error('Error sending notification to role:', error);
      res.status(500).json({
        success: false,
        message: 'Bildirim gonderilirken hata olustu'
      });
    }
  }

  // Get all subscriptions (admin only)
  static async getAll(req, res) {
    try {
      const subscriptions = await PushSubscription.getAll();
      
      res.json({ 
        success: true, 
        subscriptions 
      });
    } catch (error) {
      console.error('Error getting all subscriptions:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Abonelikler alınırken hata oluştu' 
      });
    }
  }
}

module.exports = PushSubscriptionController;
