const db = require('../config/database');
const Meeting = require('../models/Meeting');
const { syncAfterSqliteOperation } = require('../utils/autoSyncToFirebase');
const PushSubscription = require('../models/PushSubscription');
const PushNotificationService = require('../services/pushNotificationService');

class MeetingController {
  // Get all meetings
  static async getAll(req, res) {
    try {
      const showArchived = req.query.archived === 'true';
      let sql, params;
      
      const page = Math.max(parseInt(req.query.page || '1'), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '50'), 1), 200);
      const offset = (page - 1) * limit;

      if (showArchived) {
        sql = 'SELECT * FROM meetings ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
        params = [limit, offset];
      } else {
        sql = 'SELECT * FROM meetings WHERE archived = 0 ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
        params = [limit, offset];
      }
      
      const meetings = await db.all(sql, params);
      
      // Parse regions and attendees
      const processedMeetings = meetings.map(meeting => ({
        ...meeting,
        regions: meeting.regions ? JSON.parse(meeting.regions) : [],
        attendees: meeting.attendees ? JSON.parse(meeting.attendees) : []
      }));
      
      res.json(processedMeetings);
    } catch (error) {
      console.error('Error getting meetings:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Get meeting by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', [parseInt(id)]);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Toplantı bulunamadı' });
      }
      
      // Parse regions and attendees
      const processedMeeting = {
        ...meeting,
        regions: meeting.regions ? JSON.parse(meeting.regions) : [],
        attendees: meeting.attendees ? JSON.parse(meeting.attendees) : []
      };
      
      res.json(processedMeeting);
    } catch (error) {
      console.error('Error getting meeting by ID:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Create new meeting
  static async create(req, res) {
    try {
      const meetingData = req.body;
      const errors = Meeting.validate(meetingData);
      
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }
      
      const sql = `INSERT INTO meetings (name, date, notes, archived, regions, attendees) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
      const params = [
        meetingData.name,
        meetingData.date,
        meetingData.notes || null,
        0, // archived = false
        JSON.stringify(meetingData.regions || []),
        JSON.stringify(meetingData.attendees || [])
      ];
      
      const result = await db.run(sql, params);
      const newMeeting = await db.get('SELECT * FROM meetings WHERE id = ?', [result.lastID]);
      
      // Parse JSON fields for Firebase
      const meetingForFirebase = {
        ...newMeeting,
        regions: meetingData.regions || [],
        attendees: (meetingData.attendees || []).map(attendee => ({
          ...attendee,
          memberId: String(attendee.memberId || attendee.member_id || '')
        }))
      };
      
      // Otomatik Firebase sync
      try {
        await syncAfterSqliteOperation('meetings', result.lastID, meetingForFirebase, 'create');
      } catch (syncError) {
        console.warn('⚠️ Firebase sync hatası (meeting create):', syncError.message);
      }
      
      // Send push notification to all subscribed users and save to database
      try {
        const subscriptions = await PushSubscription.getAll();
        if (subscriptions.length > 0) {
          // Get unread count for badge
          const Notification = require('../models/Notification');
          const unreadCount = await Notification.getUnreadCount(null);
          
          const payload = PushNotificationService.createPayload(
            'Yeni Toplantı Oluşturuldu',
            `${meetingData.name} - ${meetingData.date || 'Tarih belirtilmemiş'}`,
            '/icon-192x192.png',
            '/badge-72x72.png',
            { type: 'meeting', id: result.lastID, action: 'view' },
            unreadCount + 1
          );
          await PushNotificationService.sendToMultipleUsers(subscriptions, payload);
          console.log(`✅ Push notification gönderildi: ${subscriptions.length} kullanıcı`);
        }
        
        // Save notification to database for all members (or specific members if regions specified)
        const Notification = require('../models/Notification');
        await Notification.create({
          memberId: null, // null = all members
          title: 'Yeni Toplantı Oluşturuldu',
          body: `${meetingData.name} - ${meetingData.date || 'Tarih belirtilmemiş'}`,
          type: 'meeting',
          data: { meetingId: result.lastID, meetingName: meetingData.name, date: meetingData.date }
        });
      } catch (pushError) {
        console.warn('⚠️ Push notification hatası (meeting create):', pushError.message);
      }
      
      res.status(201).json(newMeeting);
    } catch (error) {
      console.error('Error creating meeting:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Update meeting
  static async update(req, res) {
    try {
      const { id } = req.params;
      const meetingData = req.body;
      const errors = Meeting.validate(meetingData);
      
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }
      
      const sql = `UPDATE meetings SET name = ?, date = ?, notes = ?, regions = ? WHERE id = ?`;
      const params = [
        meetingData.name,
        meetingData.date,
        meetingData.notes || null,
        JSON.stringify(meetingData.regions || []),
        parseInt(id)
      ];
      
      const result = await db.run(sql, params);
      if (result.changes === 0) {
        return res.status(404).json({ message: 'Toplantı bulunamadı' });
      }
      
      const updatedMeeting = await db.get('SELECT * FROM meetings WHERE id = ?', [parseInt(id)]);
      
      // Parse JSON fields for Firebase
      const meetingForFirebase = {
        ...updatedMeeting,
        regions: meetingData.regions || [],
        attendees: (meetingData.attendees || []).map(attendee => ({
          ...attendee,
          memberId: String(attendee.memberId || attendee.member_id || '')
        }))
      };
      
      // Otomatik Firebase sync
      try {
        await syncAfterSqliteOperation('meetings', parseInt(id), meetingForFirebase, 'update');
      } catch (syncError) {
        console.warn('⚠️ Firebase sync hatası (meeting update):', syncError.message);
      }
      
      res.json(updatedMeeting);
    } catch (error) {
      console.error('Error updating meeting:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Archive meeting
  static async archive(req, res) {
    try {
      const { id } = req.params;
      const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', [parseInt(id)]);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Toplantı bulunamadı' });
      }
      
      // Update in database
      const result = await db.run('UPDATE meetings SET archived = 1 WHERE id = ?', [parseInt(id)]);
      
      if (result.changes === 0) {
        return res.status(404).json({ message: 'Toplantı bulunamadı' });
      }
      
      const archivedMeeting = { ...meeting, archived: 1 };
      res.json({ message: 'Toplantı arşivlendi', meeting: archivedMeeting });
    } catch (error) {
      console.error('Error archiving meeting:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Update attendance
  static updateAttendance(req, res) {
    try {
      const { id } = req.params;
      const { memberId, attended } = req.body;
      
      const meeting = db.findById('meetings', parseInt(id));
      if (!meeting) {
        return res.status(404).json({ message: 'Toplantı bulunamadı' });
      }
      
      // When updating attendance, remove any existing excuse
      meeting.addAttendee(memberId, attended, { hasExcuse: false, reason: '' });
      db.update('meetings', parseInt(id), { attendees: meeting.attendees });
      
      res.json({ message: 'Yoklama güncellendi', meeting });
    } catch (error) {
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Update excuse information
  static updateExcuse(req, res) {
    try {
      const { id } = req.params;
      const { memberId, hasExcuse, reason } = req.body;
      
      const meeting = db.findById('meetings', parseInt(id));
      if (!meeting) {
        return res.status(404).json({ message: 'Toplantı bulunamadı' });
      }
      
      meeting.updateExcuse(memberId, hasExcuse, reason);
      db.update('meetings', parseInt(id), { attendees: meeting.attendees });
      
      res.json({ message: 'Mazeret bilgisi güncellendi', meeting });
    } catch (error) {
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  // Delete all meetings
  static archiveAll(req, res) {
    try {
      // Get all meetings
      const meetings = db.get('meetings');
      
      // Move each meeting to archivedMeetings
      meetings.forEach(meeting => {
        const archivedMeeting = { ...meeting, archived: true };
        db.add('archivedMeetings', archivedMeeting);
      });
      
      // Clear all active meetings
      db.deleteAll('meetings');
      
      res.json({ message: 'Tüm toplantılar arşivlendi' });
    } catch (error) {
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = MeetingController;