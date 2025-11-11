const db = require('../config/database');
const Poll = require('../models/Poll');
const PushSubscription = require('../models/PushSubscription');
const PushNotificationService = require('../services/pushNotificationService');
const Notification = require('../models/Notification');

class PollController {
  // Get all polls
  static async getAll(req, res) {
    try {
      const status = req.query.status; // 'active', 'ended', 'all'
      let sql, params;
      
      if (status && status !== 'all') {
        sql = 'SELECT * FROM polls WHERE status = ? ORDER BY created_at DESC';
        params = [status];
      } else {
        sql = 'SELECT * FROM polls ORDER BY created_at DESC';
        params = [];
      }
      
      const polls = await db.all(sql, params);
      
      // Parse options JSON
      const processedPolls = polls.map(poll => ({
        ...poll,
        options: poll.options ? JSON.parse(poll.options) : [],
        endDate: poll.end_date,
        createdBy: poll.created_by,
        createdAt: poll.created_at,
        updatedAt: poll.updated_at
      }));
      
      res.json(processedPolls);
    } catch (error) {
      console.error('Error getting polls:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Get active polls (for member dashboard)
  static async getActive(req, res) {
    try {
      const now = new Date().toISOString();
      const sql = `SELECT * FROM polls 
                   WHERE status = 'active' AND end_date > ? 
                   ORDER BY created_at DESC`;
      const params = [now];
      
      const polls = await db.all(sql, params);
      
      // Parse options JSON
      const processedPolls = polls.map(poll => ({
        ...poll,
        options: poll.options ? JSON.parse(poll.options) : [],
        endDate: poll.end_date,
        createdBy: poll.created_by,
        createdAt: poll.created_at,
        updatedAt: poll.updated_at
      }));
      
      res.json(processedPolls);
    } catch (error) {
      console.error('Error getting active polls:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Get poll by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const poll = await db.get('SELECT * FROM polls WHERE id = ?', [parseInt(id)]);
      
      if (!poll) {
        return res.status(404).json({ message: 'Anket bulunamadı' });
      }
      
      // Parse options JSON
      const processedPoll = {
        ...poll,
        options: poll.options ? JSON.parse(poll.options) : [],
        endDate: poll.end_date,
        createdBy: poll.created_by,
        createdAt: poll.created_at,
        updatedAt: poll.updated_at
      };
      
      res.json(processedPoll);
    } catch (error) {
      console.error('Error getting poll by ID:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Create new poll
  static async create(req, res) {
    try {
      const pollData = req.body;
      const errors = Poll.validate(pollData);
      
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }
      
      const sql = `INSERT INTO polls (title, description, type, options, end_date, status, created_by) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        pollData.title,
        pollData.description || null,
        pollData.type || 'poll',
        JSON.stringify(pollData.options || []),
        pollData.endDate,
        'active',
        req.user?.id || null
      ];
      
      const result = await db.run(sql, params);
      const newPoll = await db.get('SELECT * FROM polls WHERE id = ?', [result.lastID]);
      
      // Parse JSON fields
      const processedPoll = {
        ...newPoll,
        options: pollData.options || [],
        endDate: newPoll.end_date,
        createdBy: newPoll.created_by,
        createdAt: newPoll.created_at,
        updatedAt: newPoll.updated_at
      };
      
      // Send push notifications to all subscribed users
      try {
        const allSubscriptions = await PushSubscription.getAll();
        if (allSubscriptions.length > 0) {
          const payload = PushNotificationService.createPayload(
            'Yeni Anket/Oylama Oluşturuldu',
            `${pollData.title} - Katılımınızı bekliyoruz!`,
            '/icon-192x192.png',
            '/badge-72x72.png',
            { 
              type: 'poll', 
              pollId: result.lastID,
              action: 'view'
            },
            null
          );
          
          // Send to all subscribers
          const subscriptions = allSubscriptions.map(sub => ({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          }));
          
          await PushNotificationService.sendToMultipleUsers(subscriptions, payload);
          
          // Save notification to database for all members
          const Member = require('../models/Member');
          const allMembers = await db.all('SELECT id FROM members WHERE archived = 0');
          
          for (const member of allMembers) {
            await Notification.create({
              memberId: member.id,
              title: 'Yeni Anket/Oylama',
              body: `${pollData.title} - Katılımınızı bekliyoruz!`,
              type: 'poll',
              data: JSON.stringify({ pollId: result.lastID }),
              expiresAt: new Date(pollData.endDate).toISOString()
            });
          }
          
          // Update badge count (use first member as reference)
          if (allMembers.length > 0) {
            const unreadCount = await Notification.getUnreadCount(allMembers[0].id);
            if (unreadCount > 0) {
              payload.data.badgeCount = unreadCount;
            }
          }
        }
      } catch (error) {
        console.error('Error sending poll creation notification:', error);
        // Don't fail the request if notification fails
      }
      
      res.status(201).json(processedPoll);
    } catch (error) {
      console.error('Error creating poll:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Vote on poll
  static async vote(req, res) {
    try {
      const { id } = req.params;
      const { optionIndex, memberId } = req.body;
      
      if (optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ message: 'Seçenek indeksi gerekli' });
      }
      
      if (!memberId) {
        return res.status(400).json({ message: 'Üye ID gerekli' });
      }
      
      // Check if poll exists and is active
      const poll = await db.get('SELECT * FROM polls WHERE id = ?', [parseInt(id)]);
      if (!poll) {
        return res.status(404).json({ message: 'Anket bulunamadı' });
      }
      
      // Check if poll is still active
      const endDate = new Date(poll.end_date);
      const now = new Date();
      if (endDate <= now || poll.status !== 'active') {
        return res.status(400).json({ message: 'Bu anket artık aktif değil' });
      }
      
      // Check if options are valid
      const options = JSON.parse(poll.options);
      if (optionIndex < 0 || optionIndex >= options.length) {
        return res.status(400).json({ message: 'Geçersiz seçenek' });
      }
      
      // Check if member already voted
      const existingVote = await db.get(
        'SELECT * FROM poll_votes WHERE poll_id = ? AND member_id = ?',
        [parseInt(id), parseInt(memberId)]
      );
      
      if (existingVote) {
        // Update existing vote
        const updateSql = 'UPDATE poll_votes SET option_index = ? WHERE poll_id = ? AND member_id = ?';
        await db.run(updateSql, [optionIndex, parseInt(id), parseInt(memberId)]);
      } else {
        // Insert new vote
        const insertSql = 'INSERT INTO poll_votes (poll_id, member_id, option_index) VALUES (?, ?, ?)';
        await db.run(insertSql, [parseInt(id), parseInt(memberId), optionIndex]);
      }
      
      // Send push notification to poll creator (if different from voter)
      try {
        const poll = await db.get('SELECT * FROM polls WHERE id = ?', [parseInt(id)]);
        if (poll && poll.created_by && poll.created_by !== parseInt(memberId)) {
          const creatorSubscriptions = await PushSubscription.getByUserId(poll.created_by.toString());
          
          if (creatorSubscriptions.length > 0) {
            const options = JSON.parse(poll.options);
            const selectedOption = options[optionIndex] || 'Bir seçenek';
            
            const payload = PushNotificationService.createPayload(
              'Yeni Oylama Yapıldı',
              `${poll.title} anketine yeni bir oy verildi: "${selectedOption}"`,
              '/icon-192x192.png',
              '/badge-72x72.png',
              { 
                type: 'poll_vote', 
                pollId: parseInt(id),
                action: 'view'
              },
              null
            );
            
            const subscriptions = creatorSubscriptions.map(sub => ({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            }));
            
            await PushNotificationService.sendToMultipleUsers(subscriptions, payload);
          }
        }
      } catch (error) {
        console.error('Error sending vote notification:', error);
        // Don't fail the request if notification fails
      }
      
      res.json({ message: 'Oyunuz kaydedildi' });
    } catch (error) {
      console.error('Error voting on poll:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Get poll results
  static async getResults(req, res) {
    try {
      const { id } = req.params;
      
      // Get poll
      const poll = await db.get('SELECT * FROM polls WHERE id = ?', [parseInt(id)]);
      if (!poll) {
        return res.status(404).json({ message: 'Anket bulunamadı' });
      }
      
      // Get all votes
      const votes = await db.all(
        'SELECT * FROM poll_votes WHERE poll_id = ?',
        [parseInt(id)]
      );
      
      // Parse options
      const options = JSON.parse(poll.options);
      
      // Count votes per option
      const results = options.map((option, index) => {
        const voteCount = votes.filter(v => v.option_index === index).length;
        return {
          option,
          index,
          voteCount,
          percentage: votes.length > 0 ? Math.round((voteCount / votes.length) * 100) : 0
        };
      });
      
      res.json({
        poll: {
          ...poll,
          options,
          endDate: poll.end_date,
          createdBy: poll.created_by,
          createdAt: poll.created_at,
          updatedAt: poll.updated_at
        },
        totalVotes: votes.length,
        results
      });
    } catch (error) {
      console.error('Error getting poll results:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // End poll manually
  static async endPoll(req, res) {
    try {
      const { id } = req.params;
      
      const poll = await db.get('SELECT * FROM polls WHERE id = ?', [parseInt(id)]);
      if (!poll) {
        return res.status(404).json({ message: 'Anket bulunamadı' });
      }
      
      const updateSql = 'UPDATE polls SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await db.run(updateSql, ['ended', parseInt(id)]);
      
      res.json({ message: 'Anket sonlandırıldı' });
    } catch (error) {
      console.error('Error ending poll:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Delete poll
  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Check if poll exists
      const poll = await db.get('SELECT * FROM polls WHERE id = ?', [parseInt(id)]);
      if (!poll) {
        return res.status(404).json({ message: 'Anket bulunamadı' });
      }
      
      // Delete votes first (CASCADE should handle this, but let's be explicit)
      await db.run('DELETE FROM poll_votes WHERE poll_id = ?', [parseInt(id)]);
      
      // Delete poll
      await db.run('DELETE FROM polls WHERE id = ?', [parseInt(id)]);
      
      res.json({ message: 'Anket silindi' });
    } catch (error) {
      console.error('Error deleting poll:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Check and end expired polls (background job)
  static async checkAndEndExpiredPolls() {
    try {
      const now = new Date().toISOString();
      const sql = `UPDATE polls 
                   SET status = 'ended', updated_at = CURRENT_TIMESTAMP 
                   WHERE status = 'active' AND end_date <= ?`;
      await db.run(sql, [now]);
    } catch (error) {
      console.error('Error checking expired polls:', error);
    }
  }
}

module.exports = PollController;

