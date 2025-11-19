const db = require('../config/database');

class News {
  static init() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS news (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,
          image_url TEXT,
          author TEXT,
          category TEXT DEFAULT 'general',
          status TEXT DEFAULT 'published',
          published_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          views INTEGER DEFAULT 0
        )
      `;
      
      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating news table:', err);
          reject(err);
        } else {
          console.log('News table created successfully');
          resolve();
        }
      });
    });
  }

  static async getAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM news WHERE 1=1';
      const params = [];

      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }

      sql += ' ORDER BY published_at DESC, created_at DESC';

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error fetching news:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM news WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error fetching news by id:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async create(newsData) {
    return new Promise((resolve, reject) => {
      const {
        title,
        content,
        summary,
        image_url,
        author,
        category = 'general',
        status = 'published',
        published_at
      } = newsData;

      const sql = `
        INSERT INTO news (title, content, summary, image_url, author, category, status, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const publishedAt = published_at || new Date().toISOString();

      db.run(sql, [title, content, summary, image_url, author, category, status, publishedAt], function(err) {
        if (err) {
          console.error('Error creating news:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, ...newsData });
        }
      });
    });
  }

  static async update(id, newsData) {
    return new Promise((resolve, reject) => {
      const {
        title,
        content,
        summary,
        image_url,
        author,
        category,
        status,
        published_at
      } = newsData;

      const updates = [];
      const params = [];

      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (content !== undefined) {
        updates.push('content = ?');
        params.push(content);
      }
      if (summary !== undefined) {
        updates.push('summary = ?');
        params.push(summary);
      }
      if (image_url !== undefined) {
        updates.push('image_url = ?');
        params.push(image_url);
      }
      if (author !== undefined) {
        updates.push('author = ?');
        params.push(author);
      }
      if (category !== undefined) {
        updates.push('category = ?');
        params.push(category);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (published_at !== undefined) {
        updates.push('published_at = ?');
        params.push(published_at);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE news SET ${updates.join(', ')} WHERE id = ?`;

      db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating news:', err);
          reject(err);
        } else {
          resolve({ id, ...newsData });
        }
      });
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM news WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting news:', err);
          reject(err);
        } else {
          resolve({ id });
        }
      });
    });
  }

  static async incrementViews(id) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE news SET views = views + 1 WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('Error incrementing views:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = News;

