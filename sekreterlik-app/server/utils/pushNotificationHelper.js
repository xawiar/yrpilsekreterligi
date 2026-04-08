const PushSubscription = require('../models/PushSubscription');
const PushNotificationService = require('../services/pushNotificationService');
const Notification = require('../models/Notification');

/**
 * Broadcast a push notification to all subscribed users and save to DB.
 *
 * @param {object} opts
 * @param {string} opts.title - Notification title
 * @param {string} opts.body  - Notification body text
 * @param {string} opts.type  - Notification type (e.g. 'event', 'meeting', 'poll')
 * @param {object} opts.data  - Extra data payload for the push notification
 * @param {number|null} [opts.memberId=null] - Target member ID (null = all members)
 */
async function broadcastNotification({ title, body, type, data, memberId = null }) {
  const subscriptions = await PushSubscription.getAll();
  if (subscriptions.length > 0) {
    const unreadCount = await Notification.getUnreadCount(memberId);

    const payload = PushNotificationService.createPayload(
      title,
      body,
      '/icon-192x192.png',
      '/badge-72x72.png',
      { type, ...data },
      unreadCount + 1
    );

    const formattedSubscriptions = subscriptions.map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh || sub.keys?.p256dh,
        auth: sub.auth || sub.keys?.auth
      }
    }));

    await PushNotificationService.sendToMultipleUsers(formattedSubscriptions, payload);
  }

  // Save notification to database
  await Notification.create({
    memberId: memberId,
    title,
    body,
    type,
    data: typeof data === 'string' ? data : data
  });
}

module.exports = { broadcastNotification };
