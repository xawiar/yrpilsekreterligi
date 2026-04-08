const db = require('../config/database');
const Meeting = require('../models/Meeting');
const { syncAfterSqliteOperation } = require('../utils/autoSyncToFirebase');
const { broadcastNotification } = require('../utils/pushNotificationHelper');

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
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
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
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
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
      
      // Send push notification and save to database
      try {
        await broadcastNotification({
          title: 'Yeni Toplantı Oluşturuldu',
          body: `${meetingData.name} - ${meetingData.date || 'Tarih belirtilmemiş'}`,
          type: 'meeting',
          data: { id: result.lastID, action: 'view', meetingId: result.lastID, meetingName: meetingData.name, date: meetingData.date }
        });
      } catch (pushError) {
        console.warn('Push notification hatasi (meeting create):', pushError.message);
      }
      
      res.status(201).json(newMeeting);
    } catch (error) {
      console.error('Error creating meeting:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
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

      // Check if date changed — if so, reset notification flags so new date gets notifications
      if (meetingData.date) {
        const existingMeeting = await db.get('SELECT date FROM meetings WHERE id = ?', [parseInt(id)]);
        if (existingMeeting && meetingData.date !== existingMeeting.date) {
          await db.run(
            'UPDATE meetings SET notification_status = ? WHERE id = ?',
            [JSON.stringify({ oneDayBefore: false, oneHourBefore: false, started: false }), parseInt(id)]
          );
        }
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
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
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
      
      // Update in database with archived_at and archived_reason
      const archivedAt = new Date().toISOString();
      const archivedReason = req.body?.reason || null;
      const result = await db.run(
        'UPDATE meetings SET archived = 1, archived_at = ?, archived_reason = ? WHERE id = ?',
        [archivedAt, archivedReason, parseInt(id)]
      );

      if (result.changes === 0) {
        return res.status(404).json({ message: 'Toplantı bulunamadı' });
      }

      const archivedMeeting = { ...meeting, archived: 1, archived_at: archivedAt, archived_reason: archivedReason };
      res.json({ message: 'Toplantı arşivlendi', meeting: archivedMeeting });
    } catch (error) {
      console.error('Error archiving meeting:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
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
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
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
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
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
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }
}

module.exports = MeetingController;