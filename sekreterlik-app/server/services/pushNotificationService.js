const webpush = require('web-push');

// VAPID keys
const vapidKeys = {
  publicKey: 'BO9vjwvHvLDxeP-H2IY92hsQlWGYTCW7NpX3M0GAyooyTbT30Y_0q_ahIsomr38bsL2Nbh7DHEZKMD7YTsiEYf8',
  privateKey: 'qeBR6H6KXMWnJWdva1oXIRlWfYB04p4CnM-oAXVQWzA'
};

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@sekreterlik.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

class PushNotificationService {
  // Send notification to a single user
  static async sendToUser(subscription, payload) {
    try {
      const result = await webpush.sendNotification(subscription, JSON.stringify(payload));
      console.log('Push notification sent successfully:', result);
      return { success: true, result };
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message };
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
        console.error('Error sending to subscription:', error);
        results.push({ success: false, subscription, error: error.message });
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
      { type: 'event', action: 'view' }
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
      { type: 'message', action: 'view' }
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
