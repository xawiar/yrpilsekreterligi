const db = require('../config/database');
const PushSubscription = require('../models/PushSubscription');
const PushNotificationService = require('./pushNotificationService');
const Notification = require('../models/Notification');

class ScheduledNotificationService {
  /**
   * Planlanan toplantı/etkinlik için zamanlanmış bildirimleri kontrol et ve gönder
   */
  static async checkAndSendScheduledNotifications() {
    try {
      const now = new Date();
      
      // Planlanan toplantıları kontrol et
      await this.checkMeetings(now);
      
      // Planlanan etkinlikleri kontrol et
      await this.checkEvents(now);
      
    } catch (error) {
      console.error('Error checking scheduled notifications:', error);
    }
  }

  /**
   * Planlanan toplantıları kontrol et
   */
  static async checkMeetings(now) {
    try {
      // Planlanan ve arşivlenmemiş toplantıları al
      // is_planned kolonu yoksa veya NULL ise, date gelecekte olan toplantıları al
      const meetings = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM meetings 
           WHERE archived = 0 
           AND date IS NOT NULL 
           AND (is_planned = 1 OR (is_planned IS NULL AND date > datetime('now')))`,
          [],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      for (const meeting of meetings) {
        try {
          const meetingDate = new Date(meeting.date);
          
          // Toplantı tarihi geçmişse atla
          if (meetingDate < now) {
            continue;
          }

          // Bildirim durumunu kontrol et
          const notificationStatus = meeting.notification_status 
            ? JSON.parse(meeting.notification_status) 
            : { oneDayBefore: false, oneHourBefore: false, started: false };

          // 1 gün önce bildirimi (24 saat önce, ±5 dakika tolerans)
          const oneDayBefore = new Date(meetingDate);
          oneDayBefore.setDate(oneDayBefore.getDate() - 1);
          const oneDayBeforeDiff = Math.abs(now - oneDayBefore) / (1000 * 60); // dakika cinsinden
          
          if (!notificationStatus.oneDayBefore && oneDayBeforeDiff <= 5) {
            await this.sendNotification(
              'meeting',
              meeting.id,
              meeting.name,
              meetingDate,
              '1 gün sonra',
              'Toplantı 1 gün sonra başlayacak'
            );
            
            // Bildirim durumunu güncelle
            notificationStatus.oneDayBefore = true;
            await this.updateMeetingNotificationStatus(meeting.id, notificationStatus);
          }

          // 1 saat önce bildirimi (1 saat önce, ±5 dakika tolerans)
          const oneHourBefore = new Date(meetingDate);
          oneHourBefore.setHours(oneHourBefore.getHours() - 1);
          const oneHourBeforeDiff = Math.abs(now - oneHourBefore) / (1000 * 60); // dakika cinsinden
          
          if (!notificationStatus.oneHourBefore && oneHourBeforeDiff <= 5) {
            await this.sendNotification(
              'meeting',
              meeting.id,
              meeting.name,
              meetingDate,
              '1 saat sonra',
              'Toplantı 1 saat sonra başlayacak'
            );
            
            // Bildirim durumunu güncelle
            notificationStatus.oneHourBefore = true;
            await this.updateMeetingNotificationStatus(meeting.id, notificationStatus);
          }

          // Başladı bildirimi (toplantı başladı, ±5 dakika tolerans)
          const startedDiff = Math.abs(now - meetingDate) / (1000 * 60); // dakika cinsinden
          
          if (!notificationStatus.started && startedDiff <= 5 && now >= meetingDate) {
            await this.sendNotification(
              'meeting',
              meeting.id,
              meeting.name,
              meetingDate,
              'başladı',
              'Toplantı başladı'
            );
            
            // Bildirim durumunu güncelle
            notificationStatus.started = true;
            await this.updateMeetingNotificationStatus(meeting.id, notificationStatus);
          }

        } catch (error) {
          console.error(`Error processing meeting ${meeting.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking meetings:', error);
    }
  }

  /**
   * Planlanan etkinlikleri kontrol et
   */
  static async checkEvents(now) {
    try {
      // Planlanan ve arşivlenmemiş etkinlikleri al
      // is_planned kolonu yoksa veya NULL ise, date gelecekte olan etkinlikleri al
      const events = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM events 
           WHERE archived = 0 
           AND date IS NOT NULL 
           AND (is_planned = 1 OR (is_planned IS NULL AND date > datetime('now')))`,
          [],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      for (const event of events) {
        try {
          const eventDate = new Date(event.date);
          
          // Etkinlik tarihi geçmişse atla
          if (eventDate < now) {
            continue;
          }

          // Bildirim durumunu kontrol et
          const notificationStatus = event.notification_status 
            ? JSON.parse(event.notification_status) 
            : { oneDayBefore: false, oneHourBefore: false, started: false };

          // 1 gün önce bildirimi (24 saat önce, ±5 dakika tolerans)
          const oneDayBefore = new Date(eventDate);
          oneDayBefore.setDate(oneDayBefore.getDate() - 1);
          const oneDayBeforeDiff = Math.abs(now - oneDayBefore) / (1000 * 60); // dakika cinsinden
          
          if (!notificationStatus.oneDayBefore && oneDayBeforeDiff <= 5) {
            await this.sendNotification(
              'event',
              event.id,
              event.name,
              eventDate,
              '1 gün sonra',
              'Etkinlik 1 gün sonra başlayacak'
            );
            
            // Bildirim durumunu güncelle
            notificationStatus.oneDayBefore = true;
            await this.updateEventNotificationStatus(event.id, notificationStatus);
          }

          // 1 saat önce bildirimi (1 saat önce, ±5 dakika tolerans)
          const oneHourBefore = new Date(eventDate);
          oneHourBefore.setHours(oneHourBefore.getHours() - 1);
          const oneHourBeforeDiff = Math.abs(now - oneHourBefore) / (1000 * 60); // dakika cinsinden
          
          if (!notificationStatus.oneHourBefore && oneHourBeforeDiff <= 5) {
            await this.sendNotification(
              'event',
              event.id,
              event.name,
              eventDate,
              '1 saat sonra',
              'Etkinlik 1 saat sonra başlayacak'
            );
            
            // Bildirim durumunu güncelle
            notificationStatus.oneHourBefore = true;
            await this.updateEventNotificationStatus(event.id, notificationStatus);
          }

          // Başladı bildirimi (etkinlik başladı, ±5 dakika tolerans)
          const startedDiff = Math.abs(now - eventDate) / (1000 * 60); // dakika cinsinden
          
          if (!notificationStatus.started && startedDiff <= 5 && now >= eventDate) {
            await this.sendNotification(
              'event',
              event.id,
              event.name,
              eventDate,
              'başladı',
              'Etkinlik başladı'
            );
            
            // Bildirim durumunu güncelle
            notificationStatus.started = true;
            await this.updateEventNotificationStatus(event.id, notificationStatus);
          }

        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking events:', error);
    }
  }

  /**
   * Bildirim gönder
   */
  static async sendNotification(type, id, name, date, timing, message) {
    try {
      const subscriptions = await PushSubscription.getAll();
      
      if (subscriptions.length === 0) {
        return;
      }

      // Tarih formatla
      const dateStr = new Date(date).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Bildirim başlığı ve içeriği
      const title = type === 'meeting' 
        ? `Toplantı ${timing}: ${name}`
        : `Etkinlik ${timing}: ${name}`;
      
      const body = `${message} - ${dateStr}`;

      // Unread count al
      const unreadCount = await Notification.getUnreadCount(null);

      // Push notification gönder
      const payload = PushNotificationService.createPayload(
        title,
        body,
        '/icon-192x192.png',
        '/badge-72x72.png',
        { type, id, action: 'view' },
        unreadCount + 1
      );

      await PushNotificationService.sendToMultipleUsers(subscriptions, payload);
      console.log(`✅ Zamanlanmış bildirim gönderildi: ${title} - ${subscriptions.length} kullanıcı`);

      // Database'e bildirim kaydet
      await Notification.create({
        memberId: null, // Tüm üyelere
        title,
        body,
        type: type === 'meeting' ? 'meeting_reminder' : 'event_reminder',
        data: { 
          [type === 'meeting' ? 'meetingId' : 'eventId']: id,
          name,
          date: date.toISOString(),
          timing
        }
      });

    } catch (error) {
      console.error('Error sending scheduled notification:', error);
    }
  }

  /**
   * Toplantı bildirim durumunu güncelle
   */
  static async updateMeetingNotificationStatus(meetingId, status) {
    return new Promise((resolve, reject) => {
      // Önce notification_status kolonunun var olup olmadığını kontrol et
      db.run(
        `UPDATE meetings SET notification_status = ? WHERE id = ?`,
        [JSON.stringify(status), meetingId],
        function(err) {
          if (err) {
            // Kolon yoksa ekle
            db.run(
              `ALTER TABLE meetings ADD COLUMN notification_status TEXT`,
              (alterErr) => {
                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                  reject(alterErr);
                } else {
                  // Tekrar dene
                  db.run(
                    `UPDATE meetings SET notification_status = ? WHERE id = ?`,
                    [JSON.stringify(status), meetingId],
                    function(retryErr) {
                      if (retryErr) reject(retryErr);
                      else resolve({ changes: this.changes });
                    }
                  );
                }
              }
            );
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  /**
   * Etkinlik bildirim durumunu güncelle
   */
  static async updateEventNotificationStatus(eventId, status) {
    return new Promise((resolve, reject) => {
      // Önce notification_status kolonunun var olup olmadığını kontrol et
      db.run(
        `UPDATE events SET notification_status = ? WHERE id = ?`,
        [JSON.stringify(status), eventId],
        function(err) {
          if (err) {
            // Kolon yoksa ekle
            db.run(
              `ALTER TABLE events ADD COLUMN notification_status TEXT`,
              (alterErr) => {
                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                  reject(alterErr);
                } else {
                  // Tekrar dene
                  db.run(
                    `UPDATE events SET notification_status = ? WHERE id = ?`,
                    [JSON.stringify(status), eventId],
                    function(retryErr) {
                      if (retryErr) reject(retryErr);
                      else resolve({ changes: this.changes });
                    }
                  );
                }
              }
            );
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }
}

module.exports = ScheduledNotificationService;

