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
          resolve();
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
      let sql = `
        SELECT 
          id,
          member_id,
          title,
          body,
          type,
          data,
          read,
          created_at,
          expires_at
        FROM notifications
        WHERE (member_id = ? OR member_id IS NULL)
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `;
      
      if (unreadOnly) {
        sql += ' AND read = 0';
      }
      
      sql += ' ORDER BY created_at DESC LIMIT 50';
      
      db.all(sql, [memberId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const notifications = rows.map(row => ({
            ...row,
            data: row.data ? JSON.parse(row.data) : null,
            read: row.read === 1
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
        FROM notifications
        WHERE (member_id = ? OR member_id IS NULL)
        AND read = 0
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `;
      
      db.get(sql, [memberId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row?.count || 0);
        }
      });
    });
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE notifications SET read = 1 WHERE id = ?';
      
      db.run(sql, [notificationId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Mark all notifications as read for a member
  static async markAllAsRead(memberId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE notifications SET read = 1 WHERE (member_id = ? OR member_id IS NULL) AND read = 0';
      
      db.run(sql, [memberId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
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

