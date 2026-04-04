const db = require('../config/database');

class Notification {
  static init() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_id INTEGER,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          type TEXT DEFAULT 'general',
          data TEXT,
          read BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
        )
      `;

      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating notifications table:', err);
          reject(err);
        } else {
          console.log('Notifications table created successfully');
          // Broadcast bildirimler icin per-user okundu takip tablosu
          const readsSql = `
            CREATE TABLE IF NOT EXISTS notification_reads (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              notification_id INTEGER NOT NULL,
              member_id INTEGER NOT NULL,
              read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(notification_id, member_id),
              FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
            )
          `;
          db.run(readsSql, (err2) => {
            if (err2) {
              console.error('Error creating notification_reads table:', err2);
              reject(err2);
            } else {
              console.log('Notification reads table created successfully');
              resolve();
            }
          });
        }
      });
    });
  }

  // Create a new notification
  static async create(notificationData) {
    return new Promise((resolve, reject) => {
      const { memberId, title, body, type = 'general', data = null, expiresAt = null } = notificationData;
      
      // Calculate expires_at (default: 7 days from now)
      let expiresAtValue = expiresAt;
      if (!expiresAtValue) {
        const expiresDate = new Date();
        expiresDate.setDate(expiresDate.getDate() + 7); // 7 days
        expiresAtValue = expiresDate.toISOString();
      }
      
      const sql = `
        INSERT INTO notifications (member_id, title, body, type, data, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const dataJson = data ? JSON.stringify(data) : null;
      
      db.run(sql, [memberId, title, body, type, dataJson, expiresAtValue], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...notificationData });
        }
      });
    });
  }

  // Get notifications for a specific member
  static async getByMemberId(memberId, unreadOnly = false) {
    return new Promise((resolve, reject) => {
      // Broadcast (member_id IS NULL) bildirimlerin okundu durumu notification_reads tablosundan kontrol edilir
      let sql = `
        SELECT
          n.id,
          n.member_id,
          n.title,
          n.body,
          n.type,
          n.data,
          CASE
            WHEN n.member_id IS NULL THEN COALESCE(nr.id IS NOT NULL, 0)
            ELSE n.read
          END as read,
          n.created_at,
          n.expires_at
        FROM notifications n
        LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.member_id = ?
        WHERE (n.member_id = ? OR n.member_id IS NULL)
        AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))
      `;

      if (unreadOnly) {
        sql += ` AND (
          (n.member_id IS NOT NULL AND n.read = 0)
          OR (n.member_id IS NULL AND nr.id IS NULL)
        )`;
      }

      sql += ' ORDER BY n.created_at DESC LIMIT 50';

      db.all(sql, [memberId, memberId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const notifications = rows.map(row => ({
            ...row,
            data: row.data ? JSON.parse(row.data) : null,
            read: row.read === 1 || row.read === true
          }));
          resolve(notifications);
        }
      });
    });
  }

  // Get unread count for a member
  static async getUnreadCount(memberId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as count
        FROM notifications n
        LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.member_id = ?
        WHERE (n.member_id = ? OR n.member_id IS NULL)
        AND (
          (n.member_id IS NOT NULL AND n.read = 0)
          OR (n.member_id IS NULL AND nr.id IS NULL)
        )
        AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))
      `;

      db.get(sql, [memberId, memberId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row?.count || 0);
        }
      });
    });
  }

  // Mark notification as read
  static async markAsRead(notificationId, memberId = null) {
    // Bildirimin broadcast olup olmadigini kontrol et
    const notification = await new Promise((resolve, reject) => {
      db.get('SELECT member_id FROM notifications WHERE id = ?', [notificationId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (notification && notification.member_id === null && memberId) {
      // Broadcast bildirim: notification_reads tablosuna kayit ekle
      return new Promise((resolve, reject) => {
        const sql = 'INSERT OR IGNORE INTO notification_reads (notification_id, member_id) VALUES (?, ?)';
        db.run(sql, [notificationId, memberId], function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        });
      });
    }

    // Kisisel bildirim: dogrudan guncelle
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE notifications SET read = 1 WHERE id = ?';
      db.run(sql, [notificationId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  // Mark all notifications as read for a member
  static async markAllAsRead(memberId) {
    // 1. Kullanicinin kendi bildirimlerini okundu yap
    const personalUpdate = new Promise((resolve, reject) => {
      const sql = 'UPDATE notifications SET read = 1 WHERE member_id = ? AND read = 0';
      db.run(sql, [memberId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    // 2. Broadcast (member_id IS NULL) bildirimler icin notification_reads tablosuna kayit ekle
    const broadcastUpdate = new Promise((resolve, reject) => {
      const sql = `
        INSERT OR IGNORE INTO notification_reads (notification_id, member_id)
        SELECT n.id, ?
        FROM notifications n
        LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.member_id = ?
        WHERE n.member_id IS NULL
        AND nr.id IS NULL
        AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))
      `;
      db.run(sql, [memberId, memberId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    const [personalChanges, broadcastChanges] = await Promise.all([personalUpdate, broadcastUpdate]);
    return { changes: personalChanges + broadcastChanges };
  }

  // Delete expired notifications
  static async deleteExpired() {
    return new Promise((resolve, reject) => {
      const sql = "DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < datetime('now')";
      
      db.run(sql, [], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ deleted: this.changes });
        }
      });
    });
  }

  // Delete notification
  static async delete(notificationId) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM notifications WHERE id = ?';
      
      db.run(sql, [notificationId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
}

module.exports = Notification;

