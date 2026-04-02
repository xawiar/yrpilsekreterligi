const express = require('express');
const router = express.Router();
const db = require('../config/database');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { decryptField } = require('../utils/crypto');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all data from SQLite for Firebase sync
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📤 SQLite verileri Firebase sync için hazırlanıyor...');
    
    const data = {
      regions: [],
      positions: [],
      districts: [],
      towns: [],
      members: [],
      meetings: [],
      events: [],
      neighborhoods: [],
      villages: [],
      stks: [],
      mosques: [],
      event_categories: [],
      district_officials: [],
      town_officials: [],
      ballot_boxes: [],
      member_users: [],
      member_registrations: [],
      groups: [],
      tasks: [],
      neighborhood_representatives: [],
      village_representatives: [],
      polls: [],
      member_dashboard_analytics: []
    };

    // Get all regions
    try {
      data.regions = await db.all('SELECT * FROM regions ORDER BY name');
      console.log(`✅ ${data.regions.length} region bulundu`);
    } catch (err) {
      console.warn('⚠️ Regions okunamadı:', err.message);
    }

    // Get all positions
    try {
      data.positions = await db.all('SELECT * FROM positions ORDER BY name');
      console.log(`✅ ${data.positions.length} position bulundu`);
    } catch (err) {
      console.warn('⚠️ Positions okunamadı:', err.message);
    }

    // Get all districts
    try {
      data.districts = await db.all('SELECT * FROM districts ORDER BY name');
      console.log(`✅ ${data.districts.length} district bulundu`);
    } catch (err) {
      console.warn('⚠️ Districts okunamadı:', err.message);
    }

    // Get all towns
    try {
      data.towns = await db.all('SELECT * FROM towns ORDER BY name');
      console.log(`✅ ${data.towns.length} town bulundu`);
    } catch (err) {
      console.warn('⚠️ Towns okunamadı:', err.message);
    }

    // Get all members (not archived)
    try {
      data.members = await db.all('SELECT * FROM members WHERE archived = 0 OR archived IS NULL ORDER BY name');
      console.log(`✅ ${data.members.length} member bulundu`);
    } catch (err) {
      console.warn('⚠️ Members okunamadı:', err.message);
    }

    // Get all meetings (not archived)
    try {
      const meetings = await db.all('SELECT * FROM meetings WHERE archived = 0 OR archived IS NULL ORDER BY date DESC');
      // Parse JSON fields
      data.meetings = meetings.map(meeting => ({
        ...meeting,
        regions: meeting.regions ? JSON.parse(meeting.regions) : [],
        attendees: meeting.attendees ? JSON.parse(meeting.attendees) : []
      }));
      console.log(`✅ ${data.meetings.length} meeting bulundu`);
    } catch (err) {
      console.warn('⚠️ Meetings okunamadı:', err.message);
    }

    // Get all events (not archived)
    try {
      const events = await db.all('SELECT * FROM events WHERE archived = 0 OR archived IS NULL ORDER BY date DESC');
      // Parse JSON fields
      data.events = events.map(event => ({
        ...event,
        attendees: event.attendees ? JSON.parse(event.attendees) : []
      }));
      console.log(`✅ ${data.events.length} event bulundu`);
    } catch (err) {
      console.warn('⚠️ Events okunamadı:', err.message);
    }

    // Get all neighborhoods
    try {
      data.neighborhoods = await db.all('SELECT * FROM neighborhoods ORDER BY name');
      console.log(`✅ ${data.neighborhoods.length} neighborhood bulundu`);
    } catch (err) {
      console.warn('⚠️ Neighborhoods okunamadı:', err.message);
    }

    // Get all villages
    try {
      data.villages = await db.all('SELECT * FROM villages ORDER BY name');
      console.log(`✅ ${data.villages.length} village bulundu`);
    } catch (err) {
      console.warn('⚠️ Villages okunamadı:', err.message);
    }

    // Get all STKs
    try {
      data.stks = await db.all('SELECT * FROM stks ORDER BY name');
      console.log(`✅ ${data.stks.length} stk bulundu`);
    } catch (err) {
      console.warn('⚠️ STKs okunamadı:', err.message);
    }

    // Get all mosques
    try {
      data.mosques = await db.all('SELECT * FROM mosques ORDER BY name');
      console.log(`✅ ${data.mosques.length} mosque bulundu`);
    } catch (err) {
      console.warn('⚠️ Mosques okunamadı:', err.message);
    }

    // Get all event categories
    try {
      data.event_categories = await db.all('SELECT * FROM event_categories ORDER BY name');
      console.log(`✅ ${data.event_categories.length} event_category bulundu`);
    } catch (err) {
      console.warn('⚠️ Event categories okunamadı:', err.message);
    }

    // Get all district officials
    try {
      data.district_officials = await db.all('SELECT * FROM district_officials ORDER BY name');
      console.log(`✅ ${data.district_officials.length} district_official bulundu`);
    } catch (err) {
      console.warn('⚠️ District officials okunamadı:', err.message);
    }

    // Get all town officials
    try {
      data.town_officials = await db.all('SELECT * FROM town_officials ORDER BY name');
      console.log(`✅ ${data.town_officials.length} town_official bulundu`);
    } catch (err) {
      console.warn('⚠️ Town officials okunamadı:', err.message);
    }

    // Get all ballot boxes
    try {
      data.ballot_boxes = await db.all('SELECT * FROM ballot_boxes ORDER BY created_at DESC');
      console.log(`✅ ${data.ballot_boxes.length} ballot_box bulundu`);
    } catch (err) {
      console.warn('⚠️ Ballot boxes okunamadı:', err.message);
    }

    // Get all member users
    try {
      // Tüm member_users'ları al (is_active kontrolü ile)
      const memberUsers = await db.all(`
        SELECT mu.*, 
               m.name as member_name, 
               m.region as member_region, 
               m.position as member_position,
               d.name as district_name, 
               t.name as town_name
        FROM member_users mu
        LEFT JOIN members m ON mu.member_id = m.id
        LEFT JOIN districts d ON mu.district_id = d.id
        LEFT JOIN towns t ON mu.town_id = t.id
        WHERE mu.is_active = 1 OR mu.is_active IS NULL
        ORDER BY mu.username
      `);
      
      // is_active değerini normalize et ve memberId alanını ekle
      data.member_users = memberUsers.map(user => ({
        ...user,
        memberId: user.member_id ? String(user.member_id) : null, // member_id'yi memberId olarak ekle
        userType: user.user_type || user.userType || 'member', // user_type'ı userType olarak ekle
        is_active: user.is_active !== null ? user.is_active : 1,
        isActive: user.is_active !== null ? user.is_active : 1
      }));
      
      console.log(`✅ ${data.member_users.length} member_user bulundu`);
    } catch (err) {
      console.warn('⚠️ Member users okunamadı:', err.message);
      // Alternatif: Basit sorgu dene
      try {
        data.member_users = await db.all('SELECT * FROM member_users WHERE is_active = 1 OR is_active IS NULL ORDER BY username');
        console.log(`✅ ${data.member_users.length} member_user bulundu (basit sorgu)`);
      } catch (err2) {
        console.warn('⚠️ Member users basit sorgu da başarısız:', err2.message);
        data.member_users = [];
      }
    }

    // Get all member registrations
    try {
      data.member_registrations = await db.all('SELECT * FROM member_registrations ORDER BY created_at DESC');
      console.log(`✅ ${data.member_registrations.length} member_registration bulundu`);
    } catch (err) {
      console.warn('⚠️ Member registrations okunamadı:', err.message);
    }

    // Get all groups
    try {
      data.groups = await db.all('SELECT * FROM groups ORDER BY name');
      console.log(`✅ ${data.groups.length} group bulundu`);
    } catch (err) {
      console.warn('⚠️ Groups okunamadı:', err.message);
    }

    // Get all tasks
    try {
      data.tasks = await db.all('SELECT * FROM tasks ORDER BY created_at DESC');
      console.log(`✅ ${data.tasks.length} task bulundu`);
    } catch (err) {
      console.warn('⚠️ Tasks okunamadı:', err.message);
    }

    // Get all neighborhood representatives
    try {
      const neighborhoodReps = await db.all(`
        SELECT nr.*, 
               n.name as neighborhood_name,
               d.name as district_name,
               t.name as town_name
        FROM neighborhood_representatives nr
        LEFT JOIN neighborhoods n ON nr.neighborhood_id = n.id
        LEFT JOIN districts d ON n.district_id = d.id
        LEFT JOIN towns t ON n.town_id = t.id
        ORDER BY nr.name
      `);
      data.neighborhood_representatives = neighborhoodReps;
      console.log(`✅ ${data.neighborhood_representatives.length} neighborhood_representative bulundu`);
    } catch (err) {
      console.warn('⚠️ Neighborhood representatives okunamadı:', err.message);
      try {
        data.neighborhood_representatives = await db.all('SELECT * FROM neighborhood_representatives ORDER BY name');
        console.log(`✅ ${data.neighborhood_representatives.length} neighborhood_representative bulundu (basit sorgu)`);
      } catch (err2) {
        console.warn('⚠️ Neighborhood representatives basit sorgu da başarısız:', err2.message);
        data.neighborhood_representatives = [];
      }
    }

    // Get all village representatives
    try {
      const villageReps = await db.all(`
        SELECT vr.*, 
               v.name as village_name,
               d.name as district_name,
               t.name as town_name
        FROM village_representatives vr
        LEFT JOIN villages v ON vr.village_id = v.id
        LEFT JOIN districts d ON v.district_id = d.id
        LEFT JOIN towns t ON v.town_id = t.id
        ORDER BY vr.name
      `);
      data.village_representatives = villageReps;
      console.log(`✅ ${data.village_representatives.length} village_representative bulundu`);
    } catch (err) {
      console.warn('⚠️ Village representatives okunamadı:', err.message);
      try {
        data.village_representatives = await db.all('SELECT * FROM village_representatives ORDER BY name');
        console.log(`✅ ${data.village_representatives.length} village_representative bulundu (basit sorgu)`);
      } catch (err2) {
        console.warn('⚠️ Village representatives basit sorgu da başarısız:', err2.message);
        data.village_representatives = [];
      }
    }

    // Get all polls
    try {
      const polls = await db.all('SELECT * FROM polls ORDER BY created_at DESC');
      // Parse JSON fields
      data.polls = polls.map(poll => ({
        ...poll,
        options: poll.options ? JSON.parse(poll.options) : [],
        endDate: poll.end_date,
        createdBy: poll.created_by,
        createdAt: poll.created_at,
        updatedAt: poll.updated_at
      }));
      console.log(`✅ ${data.polls.length} poll bulundu`);
    } catch (err) {
      console.warn('⚠️ Polls okunamadı:', err.message);
      data.polls = [];
    }

    // Get all member_dashboard_analytics
    try {
      data.member_dashboard_analytics = await db.all('SELECT * FROM member_dashboard_analytics ORDER BY session_start DESC');
      console.log(`✅ ${data.member_dashboard_analytics.length} analytics kaydı bulundu`);
    } catch (err) {
      console.warn('⚠️ Member dashboard analytics okunamadı:', err.message);
      data.member_dashboard_analytics = [];
    }

    // Summary
    const total = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`\n📊 Toplam ${total} kayıt hazırlandı`);

    res.json({
      success: true,
      data,
      summary: {
        regions: data.regions.length,
        positions: data.positions.length,
        districts: data.districts.length,
        towns: data.towns.length,
        members: data.members.length,
        meetings: data.meetings.length,
        events: data.events.length,
        neighborhoods: data.neighborhoods.length,
        villages: data.villages.length,
        stks: data.stks.length,
        mosques: data.mosques.length,
        event_categories: data.event_categories.length,
        district_officials: data.district_officials.length,
        town_officials: data.town_officials.length,
        ballot_boxes: data.ballot_boxes.length,
        member_users: data.member_users.length,
        member_registrations: data.member_registrations.length,
        groups: data.groups.length,
        tasks: data.tasks.length,
        neighborhood_representatives: data.neighborhood_representatives.length,
        village_representatives: data.village_representatives.length,
        polls: data.polls.length,
        member_dashboard_analytics: data.member_dashboard_analytics.length,
        total
      }
    });
  } catch (error) {
    console.error('❌ Sync data error:', error);
    res.status(500).json({
      success: false,
      message: 'Veriler hazırlanırken hata oluştu',
      error: error.message
    });
  }
});

// Endpoint: Masaüstündeki database'den TC ve telefonları çekip Firebase için hazırla
router.get('/desktop-members', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📥 Masaüstü database\'den üye verileri alınıyor...');
    
    const desktopDbPath = path.join(require('os').homedir(), 'Desktop', 'ildatabase.sqlite');
    
    const desktopDb = new sqlite3.Database(desktopDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ Desktop veritabanına bağlanılamadı:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Desktop veritabanına bağlanılamadı',
          error: err.message
        });
      }
    });

    const desktopMembers = await new Promise((resolve, reject) => {
      desktopDb.all('SELECT id, tc, phone, name FROM members WHERE archived = 0 OR archived IS NULL', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`📊 ${desktopMembers.length} üye bulundu`);

    // TC ve telefon decrypt et
    const membersWithDecryptedData = desktopMembers.map(member => {
      const tc = decryptField(member.tc) || member.tc || '';
      const phone = decryptField(member.phone) || member.phone || '';
      
      return {
        id: member.id,
        name: member.name,
        tc: tc,
        phone: phone
      };
    });

    desktopDb.close((err) => {
      if (err) console.error('Desktop veritabanı kapatılırken hata:', err.message);
    });

    res.json({
      success: true,
      data: membersWithDecryptedData,
      count: membersWithDecryptedData.length
    });
  } catch (error) {
    console.error('❌ Desktop members sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Masaüstü database\'den veriler alınırken hata oluştu',
      error: error.message
    });
  }
});

module.exports = router;

