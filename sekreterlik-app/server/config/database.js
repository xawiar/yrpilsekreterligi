const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Check if Firebase is being used
const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';

// Create or connect to SQLite database
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize database tables - Skip if using Firebase
if (!USE_FIREBASE) {
  console.log('📦 Initializing SQLite database tables...');
  db.serialize(() => {
  // Create members table with tc column
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tc TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    region TEXT,
    position TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    district TEXT,
    notes TEXT,
    archived BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add manual_stars column to members table if it doesn't exist
  db.run(`ALTER TABLE members ADD COLUMN manual_stars INTEGER DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding manual_stars column:', err);
    }
  });

  // Create meetings table
  db.run(`CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT,
    notes TEXT,
    archived BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add attendees column to meetings table if it doesn't exist
  db.run(`ALTER TABLE meetings ADD COLUMN attendees TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding attendees column:', err);
    }
  });

  // Add regions column to meetings table if it doesn't exist
  db.run(`ALTER TABLE meetings ADD COLUMN regions TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding regions column:', err);
    }
  });

  // Add is_planned column to meetings table if it doesn't exist
  db.run(`ALTER TABLE meetings ADD COLUMN is_planned BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding is_planned column:', err);
    }
  });

  // Add notification_status column to meetings table if it doesn't exist
  db.run(`ALTER TABLE meetings ADD COLUMN notification_status TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding notification_status column:', err);
    }
  });

  // Create events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT,
    location TEXT,
    description TEXT,
    archived BOOLEAN DEFAULT 0,
    attendees TEXT,
    selected_location_types TEXT,
    selected_locations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Add new columns if they don't exist
  db.run(`ALTER TABLE events ADD COLUMN selected_location_types TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding selected_location_types column:', err);
    }
  });
  
  db.run(`ALTER TABLE events ADD COLUMN selected_locations TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding selected_locations column:', err);
    }
  });

  // Add is_planned column to events table if it doesn't exist
  db.run(`ALTER TABLE events ADD COLUMN is_planned BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding is_planned column:', err);
    }
  });

  // Add notification_status column to events table if it doesn't exist
  db.run(`ALTER TABLE events ADD COLUMN notification_status TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding notification_status column:', err);
    }
  });

  // Create regions table
  db.run(`CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    deleted INTEGER DEFAULT 0
  )`);

  // Ensure deleted column exists on regions table
  db.run(`ALTER TABLE regions ADD COLUMN deleted INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding deleted column to regions:', err);
    }
  });

  // Create positions table
  db.run(`CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`);

  // Create districts table (ilçe)
  db.run(`CREATE TABLE IF NOT EXISTS districts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create towns table (belde)
  db.run(`CREATE TABLE IF NOT EXISTS towns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    district_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
    UNIQUE(name, district_id)
  )`);

  // Create neighborhoods table (mahalle)
  db.run(`CREATE TABLE IF NOT EXISTS neighborhoods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    district_id INTEGER NOT NULL,
    town_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE,
    UNIQUE(name, district_id, town_id)
  )`);

  // Create villages table (köy)
  db.run(`CREATE TABLE IF NOT EXISTS villages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    district_id INTEGER NOT NULL,
    town_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE,
    UNIQUE(name, district_id, town_id)
  )`);

  // Create STK table (Sivil Toplum Kuruluşu)
  db.run(`CREATE TABLE IF NOT EXISTS stks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create public_institutions table (Kamu Kurumu)
  db.run(`CREATE TABLE IF NOT EXISTS public_institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create mosques table (cami)
  db.run(`CREATE TABLE IF NOT EXISTS mosques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    district_id INTEGER NOT NULL,
    town_id INTEGER,
    neighborhood_id INTEGER,
    village_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE,
    FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods (id) ON DELETE CASCADE,
    FOREIGN KEY (village_id) REFERENCES villages (id) ON DELETE CASCADE,
    CHECK ((neighborhood_id IS NOT NULL AND village_id IS NULL) OR (neighborhood_id IS NULL AND village_id IS NOT NULL))
  )`);

  // Create event categories table (etkinlik kategorileri)
  db.run(`CREATE TABLE IF NOT EXISTS event_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create neighborhood representatives table (mahalle temsilcileri)
  db.run(`CREATE TABLE IF NOT EXISTS neighborhood_representatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tc TEXT NOT NULL UNIQUE,
    phone TEXT,
    neighborhood_id INTEGER NOT NULL,
    member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create village representatives table (köy temsilcileri)
  db.run(`CREATE TABLE IF NOT EXISTS village_representatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tc TEXT NOT NULL UNIQUE,
    phone TEXT,
    village_id INTEGER NOT NULL,
    member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (village_id) REFERENCES villages (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create neighborhood supervisors table (mahalle sorumluları)
  db.run(`CREATE TABLE IF NOT EXISTS neighborhood_supervisors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tc TEXT NOT NULL UNIQUE,
    phone TEXT,
    neighborhood_id INTEGER NOT NULL,
    member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create village supervisors table (köy sorumluları)
  db.run(`CREATE TABLE IF NOT EXISTS village_supervisors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tc TEXT NOT NULL UNIQUE,
    phone TEXT,
    village_id INTEGER NOT NULL,
    member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (village_id) REFERENCES villages (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create district officials table (ilçe yöneticileri)
  db.run(`CREATE TABLE IF NOT EXISTS district_officials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id INTEGER NOT NULL,
    chairman_name TEXT,
    chairman_phone TEXT,
    inspector_name TEXT,
    inspector_phone TEXT,
    chairman_member_id INTEGER,
    inspector_member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
    FOREIGN KEY (chairman_member_id) REFERENCES members (id) ON DELETE SET NULL,
    FOREIGN KEY (inspector_member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create district deputy inspectors table (ilçe müfettiş yardımcıları)
  db.run(`CREATE TABLE IF NOT EXISTS district_deputy_inspectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create town officials table (belde yöneticileri)
  db.run(`CREATE TABLE IF NOT EXISTS town_officials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    town_id INTEGER NOT NULL,
    chairman_name TEXT,
    chairman_phone TEXT,
    inspector_name TEXT,
    inspector_phone TEXT,
    chairman_member_id INTEGER,
    inspector_member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE,
    FOREIGN KEY (chairman_member_id) REFERENCES members (id) ON DELETE SET NULL,
    FOREIGN KEY (inspector_member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create district management members table (ilçe yönetim kurulu üyeleri)
  db.run(`CREATE TABLE IF NOT EXISTS district_management_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id INTEGER NOT NULL,
    tc TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    region TEXT,
    position TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE
  )`);

  // Create town management members table (belde yönetim kurulu üyeleri)
  db.run(`CREATE TABLE IF NOT EXISTS town_management_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    town_id INTEGER NOT NULL,
    tc TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    region TEXT,
    position TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE
  )`);

  // Create ballot boxes table (sandıklar)
  db.run(`CREATE TABLE IF NOT EXISTS ballot_boxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ballot_number TEXT NOT NULL UNIQUE,
    institution_name TEXT NOT NULL,
    neighborhood_id INTEGER,
    village_id INTEGER,
    district_id INTEGER,
    town_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods (id) ON DELETE CASCADE,
    FOREIGN KEY (village_id) REFERENCES villages (id) ON DELETE CASCADE,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE SET NULL
  )`);

  // Create ballot box observers table (sandık müşahitleri)
  db.run(`CREATE TABLE IF NOT EXISTS ballot_box_observers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ballot_box_id INTEGER NOT NULL,
    tc TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_chief_observer BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ballot_box_id) REFERENCES ballot_boxes (id) ON DELETE CASCADE,
    UNIQUE(ballot_box_id, tc)
  )`);

  // Create town deputy inspectors table (belde müfettiş yardımcıları)
  db.run(`CREATE TABLE IF NOT EXISTS town_deputy_inspectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    town_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create tasks table
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create polls table (anket/oylama)
  db.run(`CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'poll',
    options TEXT NOT NULL,
    end_date DATETIME NOT NULL,
    status TEXT DEFAULT 'active',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES members (id) ON DELETE SET NULL
  )`);

  // Create poll_votes table (oylar)
  db.run(`CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
    UNIQUE(poll_id, member_id)
  )`);

  // Create member_dashboard_analytics table (üye dashboard analytics)
  db.run(`CREATE TABLE IF NOT EXISTS member_dashboard_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    session_start DATETIME NOT NULL,
    session_end DATETIME,
    duration_seconds INTEGER,
    page_views INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
  )`);

  // Create notifications table (bildirimler)
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
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
  )`);

  // Create documents table for archive
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create member_registrations table
  db.run(`CREATE TABLE IF NOT EXISTS member_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    region TEXT,
    position TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create visit counts tables for tracking visits to locations
  db.run(`CREATE TABLE IF NOT EXISTS district_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS town_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    town_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS neighborhood_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    neighborhood_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS village_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (village_id) REFERENCES villages (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stk_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stk_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stk_id) REFERENCES stks (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS public_institution_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_institution_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (public_institution_id) REFERENCES public_institutions (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS mosque_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mosque_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mosque_id) REFERENCES mosques (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
  )`);

  // Remove default regions and positions - they will be added by the user
  // No default data will be inserted
  
  // Performance indexes (idempotent)
  db.run(`CREATE INDEX IF NOT EXISTS idx_members_region ON members(region)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_members_position ON members(position)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_members_archived ON members(archived)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_meetings_archived ON meetings(archived)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_archived ON events(archived)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ballot_boxes_district ON ballot_boxes(district_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ballot_boxes_town ON ballot_boxes(town_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ballot_boxes_neighborhood ON ballot_boxes(neighborhood_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ballot_boxes_village ON ballot_boxes(village_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ballot_box_observers_box ON ballot_box_observers(ballot_box_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_member_users_username ON member_users(username)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_member_users_is_active ON member_users(is_active)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ballot_boxes_assign ON ballot_boxes(district_id, town_id, neighborhood_id, village_id)`);
  
  // Add region_name column to ballot_boxes table if it doesn't exist
  db.run(`ALTER TABLE ballot_boxes ADD COLUMN region_name TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding region_name column to ballot_boxes:', err);
    }
  });

  // Add voter_count column to ballot_boxes table if it doesn't exist
  db.run(`ALTER TABLE ballot_boxes ADD COLUMN voter_count INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding voter_count column to ballot_boxes:', err);
    }
  });
  
  // Add region_name column to ballot_box_observers table if it doesn't exist
  db.run(`ALTER TABLE ballot_box_observers ADD COLUMN region_name TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding region_name column to ballot_box_observers:', err);
    }
  });
  
  // Add district_id, town_id, neighborhood_id, village_id columns to ballot_box_observers if they don't exist
  db.run(`ALTER TABLE ballot_box_observers ADD COLUMN district_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding district_id column to ballot_box_observers:', err);
    }
  });
  
  db.run(`ALTER TABLE ballot_box_observers ADD COLUMN town_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding town_id column to ballot_box_observers:', err);
    }
  });
  
  db.run(`ALTER TABLE ballot_box_observers ADD COLUMN neighborhood_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding neighborhood_id column to ballot_box_observers:', err);
    }
  });
  
  db.run(`ALTER TABLE ballot_box_observers ADD COLUMN village_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding village_id column to ballot_box_observers:', err);
    }
  });

  // Create elections table
  db.run(`CREATE TABLE IF NOT EXISTS elections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('genel', 'yerel', 'referandum')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed')),
    voter_count INTEGER,
    cb_candidates TEXT,
    parties TEXT,
    independent_cb_candidates TEXT,
    independent_mv_candidates TEXT,
    mayor_parties TEXT,
    mayor_candidates TEXT,
    provincial_assembly_parties TEXT,
    municipal_council_parties TEXT,
    baraj_percent REAL DEFAULT 7.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
  )`);

  // Add baraj_percent column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE elections ADD COLUMN baraj_percent REAL DEFAULT 7.0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding baraj_percent column:', err);
    }
  });

  // Create alliances table
  db.run(`CREATE TABLE IF NOT EXISTS alliances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    party_ids TEXT, -- JSON array: ["Parti1", "Parti2"] or [1, 2] if using IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
  )`);

  // Create election_results table
  db.run(`CREATE TABLE IF NOT EXISTS election_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    ballot_box_id INTEGER NOT NULL,
    ballot_number TEXT,
    region_name TEXT,
    district_name TEXT,
    town_name TEXT,
    neighborhood_name TEXT,
    village_name TEXT,
    total_voters INTEGER,
    used_votes INTEGER,
    invalid_votes INTEGER,
    valid_votes INTEGER,
    cb_votes TEXT,
    mv_votes TEXT,
    mayor_votes TEXT,
    provincial_assembly_votes TEXT,
    municipal_council_votes TEXT,
    referendum_votes TEXT,
    party_votes TEXT,
    candidate_votes TEXT,
    signed_protocol_photo TEXT,
    objection_protocol_photo TEXT,
    has_objection BOOLEAN DEFAULT 0,
    objection_reason TEXT,
    notes TEXT,
    created_by INTEGER,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE,
    FOREIGN KEY (ballot_box_id) REFERENCES ballot_boxes (id) ON DELETE CASCADE,
    UNIQUE(election_id, ballot_box_id)
  )`);

  // Create audit_logs table for security
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_type TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    old_data TEXT,
    new_data TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES members (id) ON DELETE SET NULL
  )`);
});

// In-memory collections for faster access
const collections = {
  members: [],
  archivedMembers: [],
  meetings: [],
  archivedMeetings: [],
  regions: [],
  positions: [],
  tasks: [],
  memberRegistrations: [],
  districts: [],
  towns: [],
  neighborhoods: [],
  villages: [],
  stks: [],
  public_institutions: [],
  mosques: [],
  event_categories: [],
  neighborhood_representatives: [],
  village_representatives: [],
  neighborhood_supervisors: [],
  village_supervisors: [],
  district_officials: [],
  town_officials: [],
  district_deputy_inspectors: [],
  town_deputy_inspectors: [],
  district_management_members: [],
  town_management_members: [],
  ballot_boxes: [],
  ballot_box_observers: [],
  district_visits: [],
  town_visits: [],
  neighborhood_visits: [],
  village_visits: [],
  stk_visits: [],
  mosque_visits: [],
  event_visits: []
};

// Load data from SQLite to in-memory collections - Skip if using Firebase
if (!USE_FIREBASE) {
  console.log('📦 Loading SQLite data into in-memory collections...');
  db.all('SELECT * FROM members WHERE archived = 0', [], (err, rows) => {
    if (!err) collections.members = rows;
  });

  db.all('SELECT * FROM members WHERE archived = 1', [], (err, rows) => {
  if (!err) collections.archivedMembers = rows;
});

db.all('SELECT * FROM meetings WHERE archived = 0', [], (err, rows) => {
  if (!err) collections.meetings = rows;
});

db.all('SELECT * FROM meetings WHERE archived = 1', [], (err, rows) => {
  if (!err) collections.archivedMeetings = rows;
});

db.all('SELECT * FROM regions', [], (err, rows) => {
  if (!err) collections.regions = rows;
});

db.all('SELECT * FROM positions', [], (err, rows) => {
  if (!err) collections.positions = rows;
});

db.all('SELECT * FROM tasks', [], (err, rows) => {
  if (!err) collections.tasks = rows;
});

db.all('SELECT * FROM member_registrations', [], (err, rows) => {
  if (!err) collections.memberRegistrations = rows;
});

db.all('SELECT * FROM districts', [], (err, rows) => {
  if (!err) collections.districts = rows;
});

db.all('SELECT * FROM towns', [], (err, rows) => {
  if (!err) collections.towns = rows;
});

db.all('SELECT * FROM neighborhoods', [], (err, rows) => {
  if (!err) collections.neighborhoods = rows;
});

db.all('SELECT * FROM villages', [], (err, rows) => {
  if (!err) collections.villages = rows;
});

db.all('SELECT * FROM stks', [], (err, rows) => {
  if (!err) collections.stks = rows;
});

db.all('SELECT * FROM public_institutions', [], (err, rows) => {
  if (!err) collections.public_institutions = rows;
});

db.all('SELECT * FROM mosques', [], (err, rows) => {
  if (!err) collections.mosques = rows;
});

db.all('SELECT * FROM event_categories', [], (err, rows) => {
  if (!err) collections.event_categories = rows;
});

db.all('SELECT * FROM neighborhood_representatives', [], (err, rows) => {
  if (!err) collections.neighborhood_representatives = rows;
});

db.all('SELECT * FROM village_representatives', [], (err, rows) => {
  if (!err) collections.village_representatives = rows;
});

db.all('SELECT * FROM neighborhood_supervisors', [], (err, rows) => {
  if (!err) collections.neighborhood_supervisors = rows;
});

db.all('SELECT * FROM village_supervisors', [], (err, rows) => {
  if (!err) collections.village_supervisors = rows;
});

db.all('SELECT * FROM district_officials', [], (err, rows) => {
  if (!err) collections.district_officials = rows;
});

db.all('SELECT * FROM town_officials', [], (err, rows) => {
  if (!err) collections.town_officials = rows;
});

db.all('SELECT * FROM district_deputy_inspectors', [], (err, rows) => {
  if (!err) collections.district_deputy_inspectors = rows;
});

db.all('SELECT * FROM town_deputy_inspectors', [], (err, rows) => {
  if (!err) collections.town_deputy_inspectors = rows;
});

db.all('SELECT * FROM district_management_members', [], (err, rows) => {
  if (!err) collections.district_management_members = rows;
});

db.all('SELECT * FROM town_management_members', [], (err, rows) => {
  if (!err) collections.town_management_members = rows;
});

db.all('SELECT * FROM ballot_boxes', [], (err, rows) => {
  if (!err) collections.ballot_boxes = rows;
});

db.all('SELECT * FROM ballot_box_observers', [], (err, rows) => {
  if (!err) collections.ballot_box_observers = rows;
});

db.all('SELECT * FROM district_visits', [], (err, rows) => {
  if (!err) collections.district_visits = rows;
});

db.all('SELECT * FROM town_visits', [], (err, rows) => {
  if (!err) collections.town_visits = rows;
});

db.all('SELECT * FROM neighborhood_visits', [], (err, rows) => {
  if (!err) collections.neighborhood_visits = rows;
});

db.all('SELECT * FROM village_visits', [], (err, rows) => {
  if (!err) collections.village_visits = rows;
});

db.all('SELECT * FROM stk_visits', [], (err, rows) => {
  if (!err) collections.stk_visits = rows;
});

db.all('SELECT * FROM public_institution_visits', [], (err, rows) => {
  if (!err) collections.public_institution_visits = rows;
});

db.all('SELECT * FROM mosque_visits', [], (err, rows) => {
  if (!err) collections.mosque_visits = rows;
});

db.all('SELECT * FROM event_visits', [], (err, rows) => {
  if (!err) collections.event_visits = rows;
});

// Promisify database methods for easier use
const { recordDbQuery } = require('../utils/metrics');

const dbMethods = {
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      db.all(sql, params, (err, rows) => {
        const dur = Date.now() - start;
        try { recordDbQuery(dur); } catch (_) {}
        if (err) {
          console.error('Database ALL error:', err, 'SQL:', sql, 'Params:', params);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },
  get: (sql, params = []) => {
    // If sql is a collection name, return the in-memory collection
    if (typeof sql === 'string' && collections.hasOwnProperty(sql)) {
      return collections[sql];
    }
    
    // Otherwise, execute as SQL query
    return new Promise((resolve, reject) => {
      const start = Date.now();
      db.get(sql, params, (err, row) => {
        const dur = Date.now() - start;
        try { recordDbQuery(dur); } catch (_) {}
        if (err) {
          console.error('Database GET error:', err, 'SQL:', sql, 'Params:', params);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      db.run(sql, params, function (err) {
        const dur = Date.now() - start;
        try { recordDbQuery(dur); } catch (_) {}
        if (err) {
          console.error('Database RUN error:', err, 'SQL:', sql, 'Params:', params);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  },
  // Add missing methods
  add: (collectionName, item) => {
    if (collections.hasOwnProperty(collectionName)) {
      collections[collectionName].push(item);
      return item;
    }
    throw new Error(`Collection ${collectionName} not found`);
  },
  update: (collectionName, id, updates) => {
    if (collections.hasOwnProperty(collectionName)) {
      const index = collections[collectionName].findIndex(item => item.id === id);
      if (index !== -1) {
        collections[collectionName][index] = { ...collections[collectionName][index], ...updates };
        return collections[collectionName][index];
      }
      return null;
    }
    throw new Error(`Collection ${collectionName} not found`);
  },
  delete: (collectionName, id) => {
    if (collections.hasOwnProperty(collectionName)) {
      const index = collections[collectionName].findIndex(item => item.id === id);
      if (index !== -1) {
        return collections[collectionName].splice(index, 1)[0];
      }
      return null;
    }
    throw new Error(`Collection ${collectionName} not found`);
  },
  deleteAll: (collectionName) => {
    if (collections.hasOwnProperty(collectionName)) {
      collections[collectionName] = [];
    }
  },
  findById: (collectionName, id) => {
    if (collections.hasOwnProperty(collectionName)) {
      return collections[collectionName].find(item => item.id === id) || null;
    }
    throw new Error(`Collection ${collectionName} not found`);
  }
};

module.exports = dbMethods;
module.exports.collections = collections;