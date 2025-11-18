// Note: We don't actually use these controllers, we access database/Firebase directly
// Keeping imports commented out to avoid module resolution issues
// const MemberController = require('./MemberController');
// const MeetingController = require('./MeetingController');
// const EventController = require('./EventController');
// const NeighborhoodRepresentativeController = require('./NeighborhoodRepresentativeController');
// const VillageRepresentativeController = require('./VillageRepresentativeController');

// Check if Firebase is being used
const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';

class DashboardController {
  /**
   * Get dashboard summary data
   * Aggregates data from multiple sources and calculates statistics
   */
  static async getDashboard(req, res) {
    try {
      // Fetch all data in parallel
      const [membersResult, meetingsResult, eventsResult, memberRegistrationsResult, neighborhoodRepresentativesResult, villageRepresentativesResult] = await Promise.all([
        this._getMembers(),
        this._getMeetings(),
        this._getEvents(),
        this._getMemberRegistrations(),
        this._getNeighborhoodRepresentatives(),
        this._getVillageRepresentatives()
      ]);

      const members = membersResult || [];
      const meetings = meetingsResult || [];
      const events = eventsResult || [];
      const memberRegistrations = memberRegistrationsResult || [];
      const neighborhoodRepresentatives = neighborhoodRepresentativesResult || [];
      const villageRepresentatives = villageRepresentativesResult || [];

      // Calculate statistics
      const stats = {
        totalMembers: members.length,
        totalMeetings: meetings.length,
        totalEvents: events.length,
        totalNeighborhoodRepresentatives: neighborhoodRepresentatives.length,
        totalVillageRepresentatives: villageRepresentatives.length,
        avgAttendanceRate: this._calculateAverageAttendanceRate(meetings)
      };

      // Calculate top registrars
      const topRegistrars = this._calculateTopRegistrars(members, memberRegistrations);

      // Calculate top attendees
      const topAttendees = this._calculateTopAttendees(members, meetings);

      // Get upcoming events and meetings
      const upcomingEvents = this._getUpcomingEvents(events);
      const upcomingMeetings = this._getUpcomingMeetings(meetings);

      res.json({
        success: true,
        stats,
        topRegistrars,
        topAttendees,
        upcomingEvents,
        upcomingMeetings
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Dashboard verileri alınırken hata oluştu',
        error: error.message
      });
    }
  }

  /**
   * Get members (from database or Firebase)
   */
  static async _getMembers() {
    if (USE_FIREBASE) {
      // Use Firebase Admin SDK
      const { getAdmin } = require('../config/firebaseAdmin');
      const admin = getAdmin();
      if (!admin) {
        console.warn('Firebase Admin SDK not initialized');
        return [];
      }
      const firestore = admin.firestore();
      const snapshot = await firestore.collection('members').get();
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => !m.archived || m.archived === false || m.archived === 0);
    } else {
      // Use SQLite directly
      const db = require('../config/database');
      const { decryptField } = require('../utils/crypto');
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM members WHERE archived = 0 ORDER BY created_at DESC', [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const decrypted = (rows || []).map(m => ({
              ...m,
              tc: decryptField(m.tc),
              phone: decryptField(m.phone),
            }));
            resolve(decrypted);
          }
        });
      });
    }
  }

  /**
   * Get meetings (from database or Firebase)
   */
  static async _getMeetings() {
    if (USE_FIREBASE) {
      // Use Firebase Admin SDK
      const { getAdmin } = require('../config/firebaseAdmin');
      const admin = getAdmin();
      if (!admin) {
        console.warn('Firebase Admin SDK not initialized');
        return [];
      }
      const firestore = admin.firestore();
      const snapshot = await firestore.collection('meetings').get();
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => !m.archived || m.archived === false || m.archived === 0);
    } else {
      // Use SQLite directly
      const db = require('../config/database');
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM meetings WHERE archived = 0 ORDER BY created_at DESC', [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    }
  }

  /**
   * Get events (from database or Firebase)
   */
  static async _getEvents() {
    if (USE_FIREBASE) {
      // Use Firebase Admin SDK
      const { getAdmin } = require('../config/firebaseAdmin');
      const admin = getAdmin();
      if (!admin) {
        console.warn('Firebase Admin SDK not initialized');
        return [];
      }
      const firestore = admin.firestore();
      const snapshot = await firestore.collection('events').get();
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => !e.archived || e.archived === false || e.archived === 0);
    } else {
      // Use SQLite directly
      const db = require('../config/database');
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM events WHERE archived = 0 ORDER BY created_at DESC', [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    }
  }

  /**
   * Get member registrations
   */
  static async _getMemberRegistrations() {
    if (USE_FIREBASE) {
      // Use Firebase Admin SDK
      const { getAdmin } = require('../config/firebaseAdmin');
      const admin = getAdmin();
      if (!admin) {
        console.warn('Firebase Admin SDK not initialized');
        return [];
      }
      const firestore = admin.firestore();
      const snapshot = await firestore.collection('member_registrations').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // Use in-memory collections
      const { collections } = require('../config/database');
      return collections.memberRegistrations || [];
    }
  }

  /**
   * Get neighborhood representatives
   */
  static async _getNeighborhoodRepresentatives() {
    if (USE_FIREBASE) {
      // Use Firebase Admin SDK
      const { getAdmin } = require('../config/firebaseAdmin');
      const admin = getAdmin();
      if (!admin) {
        console.warn('Firebase Admin SDK not initialized');
        return [];
      }
      const firestore = admin.firestore();
      const snapshot = await firestore.collection('neighborhood_representatives').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // Use SQLite directly
      const db = require('../config/database');
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM neighborhood_representatives ORDER BY created_at DESC', [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    }
  }

  /**
   * Get village representatives
   */
  static async _getVillageRepresentatives() {
    if (USE_FIREBASE) {
      // Use Firebase Admin SDK
      const { getAdmin } = require('../config/firebaseAdmin');
      const admin = getAdmin();
      if (!admin) {
        console.warn('Firebase Admin SDK not initialized');
        return [];
      }
      const firestore = admin.firestore();
      const snapshot = await firestore.collection('village_representatives').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // Use SQLite directly
      const db = require('../config/database');
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM village_representatives ORDER BY created_at DESC', [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    }
  }

  /**
   * Calculate average attendance rate from meetings
   */
  static _calculateAverageAttendanceRate(meetings) {
    if (!Array.isArray(meetings) || meetings.length === 0) {
      return 0;
    }

    let totalAttendanceRate = 0;
    let validMeetings = 0;

    meetings.forEach(meeting => {
      if (meeting.attendees && Array.isArray(meeting.attendees) && meeting.attendees.length > 0) {
        const totalExpected = meeting.attendees.length;
        const attendedCount = meeting.attendees.filter(a => a.attended === true || a.attended === 1).length;
        const attendanceRate = (attendedCount / totalExpected) * 100;
        totalAttendanceRate += attendanceRate;
        validMeetings++;
      }
    });

    return validMeetings > 0 ? Math.round(totalAttendanceRate / validMeetings) : 0;
  }

  /**
   * Calculate top 3 registrars (members with most registrations)
   */
  static _calculateTopRegistrars(members, memberRegistrations) {
    if (!Array.isArray(members) || !Array.isArray(memberRegistrations)) {
      return [];
    }

    const memberRegistrationCounts = {};
    
    // Initialize all members with 0 count
    members.forEach(member => {
      memberRegistrationCounts[member.id] = {
        member,
        count: 0
      };
    });

    // Count registrations
    memberRegistrations.forEach(reg => {
      const memberId = reg.memberId || reg.member_id;
      if (memberRegistrationCounts[memberId]) {
        memberRegistrationCounts[memberId].count += (reg.count || 1);
      }
    });

    // Sort and get top 3
    return Object.values(memberRegistrationCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter(item => item.count > 0);
  }

  /**
   * Calculate top 3 attendees (members with most meeting attendances)
   */
  static _calculateTopAttendees(members, meetings) {
    if (!Array.isArray(members) || !Array.isArray(meetings)) {
      return [];
    }

    const memberAttendanceCounts = {};
    
    // Initialize all members with 0 count
    members.forEach(member => {
      memberAttendanceCounts[member.id] = {
        member,
        count: 0
      };
    });

    // Count attendances
    meetings.forEach(meeting => {
      if (meeting.attendees && Array.isArray(meeting.attendees)) {
        meeting.attendees.forEach(attendee => {
          if (attendee.attended === true || attendee.attended === 1) {
            const attendeeMemberId = attendee.memberId || attendee.member_id;
            const memberIdStr = String(attendeeMemberId);
            const memberIdNum = Number(attendeeMemberId);
            
            // Find matching member by checking both string and number IDs
            const matchingMemberId = Object.keys(memberAttendanceCounts).find(id => {
              const idStr = String(id);
              const idNum = Number(id);
              return idStr === memberIdStr || idNum === memberIdNum || idStr === memberIdNum || idNum === memberIdStr;
            });
            
            if (matchingMemberId && memberAttendanceCounts[matchingMemberId]) {
              memberAttendanceCounts[matchingMemberId].count += 1;
            }
          }
        });
      }
    });

    // Sort and get top 3
    return Object.values(memberAttendanceCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter(item => item.count > 0);
  }

  /**
   * Get upcoming events (next 7 days)
   */
  static _getUpcomingEvents(events) {
    if (!Array.isArray(events)) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return events
      .filter(event => {
        if (!event.date) return false;
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today && eventDate <= nextWeek;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      })
      .slice(0, 5);
  }

  /**
   * Get upcoming meetings (next 7 days)
   */
  static _getUpcomingMeetings(meetings) {
    if (!Array.isArray(meetings)) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return meetings
      .filter(meeting => {
        if (!meeting.date) return false;
        const meetingDate = new Date(meeting.date);
        meetingDate.setHours(0, 0, 0, 0);
        return meetingDate >= today && meetingDate <= nextWeek;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      })
      .slice(0, 5);
  }
}

module.exports = DashboardController;

