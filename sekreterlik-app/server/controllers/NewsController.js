const News = require('../models/News');
const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';

class NewsController {
  static async getAll(req, res) {
    try {
      const { status, category, limit } = req.query;
      
      let news = [];
      
      if (USE_FIREBASE) {
        // Firebase implementation using Admin SDK
        const { getAdmin } = require('../config/firebaseAdmin');
        const admin = getAdmin();
        if (!admin) {
          throw new Error('Firebase Admin SDK not initialized');
        }
        const firestore = admin.firestore();
        let query = firestore.collection('news').orderBy('published_at', 'desc').orderBy('created_at', 'desc');
        
        if (status) {
          query = query.where('status', '==', status);
        }
        
        if (category) {
          query = query.where('category', '==', category);
        }
        
        if (limit) {
          query = query.limit(parseInt(limit));
        }
        
        const snapshot = await query.get();
        news = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        // SQLite implementation
        news = await News.getAll({ status, category, limit: limit ? parseInt(limit) : undefined });
      }

      res.json(news);
    } catch (error) {
      console.error('Error fetching news:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      
      let news = null;
      
      if (USE_FIREBASE) {
        // Firebase implementation using Admin SDK
        const { getAdmin } = require('../config/firebaseAdmin');
        const admin = getAdmin();
        if (!admin) {
          throw new Error('Firebase Admin SDK not initialized');
        }
        const firestore = admin.firestore();
        const doc = await firestore.collection('news').doc(id).get();
        if (doc.exists) {
          news = { id: doc.id, ...doc.data() };
          // Increment views
          await firestore.collection('news').doc(id).update({
            views: (news.views || 0) + 1
          });
          news.views = (news.views || 0) + 1;
        }
      } else {
        news = await News.getById(id);
        if (news) {
          await News.incrementViews(id);
          news.views = (news.views || 0) + 1;
        }
      }

      if (!news) {
        return res.status(404).json({ message: 'Haber bulunamadı' });
      }

      res.json(news);
    } catch (error) {
      console.error('Error fetching news by id:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const newsData = req.body;
      const userId = req.user?.id || null;

      // Validation
      if (!newsData.title || !newsData.content) {
        return res.status(400).json({ message: 'Başlık ve içerik zorunludur' });
      }

      let news = null;
      
      if (USE_FIREBASE) {
        // Firebase implementation using Admin SDK
        const { getAdmin } = require('../config/firebaseAdmin');
        const admin = getAdmin();
        if (!admin) {
          throw new Error('Firebase Admin SDK not initialized');
        }
        const firestore = admin.firestore();
        const newsDoc = {
          title: newsData.title,
          content: newsData.content,
          summary: newsData.summary || null,
          image_url: newsData.image_url || null,
          author: newsData.author || req.user?.name || 'Admin',
          category: newsData.category || 'general',
          status: newsData.status || 'published',
          published_at: newsData.published_at || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          views: 0
        };
        
        const docRef = await firestore.collection('news').add(newsDoc);
        news = { id: docRef.id, ...newsDoc };
      } else {
        news = await News.create(newsData);
      }

      res.status(201).json({ message: 'Haber başarıyla oluşturuldu', news });
    } catch (error) {
      console.error('Error creating news:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const newsData = req.body;

      let news = null;
      
      if (USE_FIREBASE) {
        // Firebase implementation using Admin SDK
        const { getAdmin } = require('../config/firebaseAdmin');
        const admin = getAdmin();
        if (!admin) {
          throw new Error('Firebase Admin SDK not initialized');
        }
        const firestore = admin.firestore();
        const newsDoc = {
          ...newsData,
          updated_at: new Date().toISOString()
        };
        
        await firestore.collection('news').doc(id).update(newsDoc);
        const doc = await firestore.collection('news').doc(id).get();
        news = { id: doc.id, ...doc.data() };
      } else {
        news = await News.update(id, newsData);
      }

      res.json({ message: 'Haber başarıyla güncellendi', news });
    } catch (error) {
      console.error('Error updating news:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      if (USE_FIREBASE) {
        // Firebase implementation using Admin SDK
        const { getAdmin } = require('../config/firebaseAdmin');
        const admin = getAdmin();
        if (!admin) {
          throw new Error('Firebase Admin SDK not initialized');
        }
        const firestore = admin.firestore();
        await firestore.collection('news').doc(id).delete();
      } else {
        await News.delete(id);
      }

      res.json({ message: 'Haber başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting news:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = NewsController;

