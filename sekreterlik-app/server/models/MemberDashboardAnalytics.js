const db = require('../config/database');

class MemberDashboardAnalytics {
  static init() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS member_dashboard_analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_id INTEGER NOT NULL,
          session_start DATETIME NOT NULL,
          session_end DATETIME,
          duration_seconds INTEGER,
          page_views INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
        )
      `;
      
      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating member_dashboard_analytics table:', err);
          reject(err);
        } else {
          console.log('Member dashboard analytics table created successfully');
          resolve();
        }
      });
    });
  }

  // Start a new session
  static async startSession(memberId) {
    return new Promise((resolve, reject) => {
      const sessionStart = new Date().toISOString();
      const sql = `
        INSERT INTO member_dashboard_analytics (member_id, session_start, page_views)
        VALUES (?, ?, 1)
      `;
      
      db.run(sql, [memberId, sessionStart], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, memberId, sessionStart });
        }
      });
    });
  }

  // Update session (end time, duration, page views)
  static async updateSession(sessionId, updates) {
    return new Promise((resolve, reject) => {
      const { sessionEnd, durationSeconds, pageViews } = updates;
      const sql = `
        UPDATE member_dashboard_analytics
        SET session_end = ?,
            duration_seconds = ?,
            page_views = ?
        WHERE id = ?
      `;
      
      db.run(sql, [sessionEnd, durationSeconds, pageViews, sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Get analytics for a specific member
  static async getByMemberId(memberId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id,
          member_id,
          session_start,
          session_end,
          duration_seconds,
          page_views,
          created_at
        FROM member_dashboard_analytics
        WHERE member_id = ?
        ORDER BY session_start DESC
      `;
      
      db.all(sql, [memberId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get all analytics (admin view)
  static async getAll() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          a.id,
          a.member_id,
          m.name,
          m.surname,
          m.tc,
          a.session_start,
          a.session_end,
          a.duration_seconds,
          a.page_views,
          a.created_at
        FROM member_dashboard_analytics a
        LEFT JOIN members m ON a.member_id = m.id
        ORDER BY a.session_start DESC
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get summary statistics for a member
  static async getMemberSummary(memberId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_sessions,
          SUM(duration_seconds) as total_duration_seconds,
          SUM(page_views) as total_page_views,
          MIN(session_start) as first_session,
          MAX(session_start) as last_session,
          AVG(duration_seconds) as avg_duration_seconds
        FROM member_dashboard_analytics
        WHERE member_id = ?
      `;
      
      db.get(sql, [memberId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {
            total_sessions: 0,
            total_duration_seconds: 0,
            total_page_views: 0,
            first_session: null,
            last_session: null,
            avg_duration_seconds: 0
          });
        }
      });
    });
  }

  // Get summary statistics for all members (admin view)
  static async getAllSummary() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          m.id as member_id,
          m.name,
          m.surname,
          m.tc,
          COUNT(a.id) as total_sessions,
          COALESCE(SUM(a.duration_seconds), 0) as total_duration_seconds,
          COALESCE(SUM(a.page_views), 0) as total_page_views,
          MIN(a.session_start) as first_session,
          MAX(a.session_start) as last_session,
          COALESCE(AVG(a.duration_seconds), 0) as avg_duration_seconds
        FROM members m
        LEFT JOIN member_dashboard_analytics a ON m.id = a.member_id
        WHERE m.archived = 0
        GROUP BY m.id, m.name, m.surname, m.tc
        HAVING COUNT(a.id) > 0
        ORDER BY total_sessions DESC, last_session DESC
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = MemberDashboardAnalytics;

