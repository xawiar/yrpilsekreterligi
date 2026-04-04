const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// VAPID keys from environment variables
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

// Configure web-push only if both keys are present
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.warn('[pushNotificationService] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing. Push notification setup will be skipped.');
} else {
  webpush.setVapidDetails(
    'mailto:admin@sekreterlik.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

class PushNotificationService {
  // Send notification to a single user
  static async sendToUser(subscription, payload) {
    try {
      const result = await webpush.sendNotification(subscription, JSON.stringify(payload));
      console.log('Push notification sent successfully:', result);
      return { success: true, result };
    } catch (error) {
      // Expired veya gecersiz subscription'lari otomatik temizle
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.warn(`Expired/invalid subscription detected (${error.statusCode}), cleaning up:`, subscription.endpoint);
        try {
          await PushSubscription.deleteByEndpoint(subscription.endpoint);
        } catch (cleanupErr) {
          console.error('Error cleaning up expired subscription:', cleanupErr);
        }
      }
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message, statusCode: error.statusCode };
    }
  }

  // Send notification to multiple users
  static async sendToMultipleUsers(subscriptions, payload) {
    const results = [];

    for (const subscription of subscriptions) {
      try {
        const result = await webpush.sendNotification(subscription, JSON.stringify(payload));
        results.push({ success: true, subscription, result });
      } catch (error) {
        // Expired veya gecersiz subscription'lari otomatik temizle
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.warn(`Expired/invalid subscription detected (${error.statusCode}), cleaning up:`, subscription.endpoint);
          try {
            await PushSubscription.deleteByEndpoint(subscription.endpoint);
          } catch (cleanupErr) {
            console.error('Error cleaning up expired subscription:', cleanupErr);
          }
        }
        console.error('Error sending to subscription:', error);
        results.push({ success: false, subscription, error: error.message, statusCode: error.statusCode });
      }
    }

    return results;
  }

  // Create notification payload
  static createPayload(title, body, icon = '/icon-192x192.png', badge = '/badge-72x72.png', data = {}, badgeCount = null) {
    const payload = {
      title,
      body,
      icon,
      badge,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        badgeCount: badgeCount || 1
      },
      actions: [
        {
          action: 'view',
          title: 'Görüntüle'
        },
        {
          action: 'close',
          title: 'Kapat'
        }
      ],
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200], // Vibrate pattern: 200ms, pause 100ms, 200ms
      sound: '/notification-sound.mp3', // Sound file (optional, browser may ignore)
      tag: data.type || 'general', // Tag for grouping notifications
      renotify: true, // Re-notify if same tag exists
      timestamp: Date.now()
    };
    
    // Add badge count if provided
    if (badgeCount !== null) {
      payload.badge = badgeCount.toString();
    }
    
    return payload;
  }

  // Send event notification
  static async sendEventNotification(subscriptions, eventTitle, eventDate) {
    const payload = this.createPayload(
      'Yeni Etkinlik Oluşturuldu',
      `${eventTitle} - ${eventDate}`,
      '/icon-192x192.png',
      '/badge-72x72.png',
      { type: 'event', action: 'view', url: '/events' }
    );

    return await this.sendToMultipleUsers(subscriptions, payload);
  }

  // Send message notification
  static async sendMessageNotification(subscriptions, senderName, message) {
    const payload = this.createPayload(
      `${senderName} mesaj gönderdi`,
      message.length > 100 ? message.substring(0, 100) + '...' : message,
      '/icon-192x192.png',
      '/badge-72x72.png',
      { type: 'message', action: 'view', url: '/notifications' }
    );

    return await this.sendToMultipleUsers(subscriptions, payload);
  }

  // Send general notification
  static async sendGeneralNotification(subscriptions, title, body) {
    const payload = this.createPayload(
      title,
      body,
      '/icon-192x192.png',
      '/badge-72x72.png',
      { type: 'general', action: 'view' }
    );
    
    return await this.sendToMultipleUsers(subscriptions, payload);
  }
}

module.exports = PushNotificationService;
