const path = require('path');
const bcrypt = require('bcryptjs');

// Use the shared promisified database connection
const db = require('../config/database');

class MemberUser {
  // Initialize member_users table
  static async init() {
    await db.run(`
      CREATE TABLE IF NOT EXISTS member_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        user_type TEXT DEFAULT 'member',
        district_id INTEGER,
        town_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
        FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE,
        FOREIGN KEY (town_id) REFERENCES towns (id) ON DELETE CASCADE
      )
    `);
    // Add new columns if they don't exist (ignore errors if column already exists)
    try { await db.run(`ALTER TABLE member_users ADD COLUMN user_type TEXT DEFAULT 'member'`); } catch (_) {}
    try { await db.run(`ALTER TABLE member_users ADD COLUMN district_id INTEGER`); } catch (_) {}
    try { await db.run(`ALTER TABLE member_users ADD COLUMN town_id INTEGER`); } catch (_) {}
    try { await db.run(`ALTER TABLE member_users ADD COLUMN chairman_name TEXT`); } catch (_) {}
    try { await db.run(`ALTER TABLE member_users ADD COLUMN auth_uid TEXT`); } catch (_) {}
    // Backfill NULL is_active values to 1 to ensure active logins
    try { await db.run(`UPDATE member_users SET is_active = 1 WHERE is_active IS NULL`); } catch (_) {}
  }

  // Create user for a member
  static async createMemberUser(memberId, username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO member_users (member_id, username, password) VALUES (?, ?, ?)',
      [memberId, username, hashedPassword]
    );
    return { id: result.lastID, member_id: memberId, username, password: hashedPassword };
  }

  // Get user by username and password
  static async getUserByCredentials(username, password) {
    const user = await db.get(
      'SELECT mu.*, m.name, m.region, m.position FROM member_users mu JOIN members m ON mu.member_id = m.id WHERE mu.username = ? AND mu.is_active = 1',
      [username]
    );
    if (!user) return null;
    try {
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) return user;
      // Backward compatible migration
      if (password === user.password) {
        const hashed = await bcrypt.hash(password, 10);
        db.run('UPDATE member_users SET password = ? WHERE id = ?', [hashed, user.id]).catch(() => {});
        return user;
      }
      return null;
    } catch (compareErr) {
      // If bcrypt.compare throws (e.g. plaintext stored), fall back to direct comparison
      if (password === user.password) {
        db.run('UPDATE member_users SET password = ? WHERE id = ?', [await bcrypt.hash(password, 10), user.id]).catch(() => {});
        return user;
      }
      return null;
    }
  }

  // Get user by member ID
  static async getUserByMemberId(memberId) {
    const row = await db.get('SELECT * FROM member_users WHERE member_id = ?', [memberId]);
    return row || null;
  }

  // Get all member users with member info
  // Only show users for members that still exist (not deleted/archived)
  // or users without member_id (district/town presidents)
  static async getAllMemberUsers() {
    const rows = await db.all(
      `SELECT mu.*,
       COALESCE(m.name, mu.chairman_name) as name,
       COALESCE(m.region, mu.region) as region,
       COALESCE(m.position, mu.position) as position
       FROM member_users mu
       LEFT JOIN members m ON mu.member_id = m.id
       WHERE mu.member_id IS NULL
          OR (mu.member_id IS NOT NULL AND m.id IS NOT NULL AND m.archived = 0)
       ORDER BY mu.created_at DESC`
    );
    return (rows || []).map(row => ({
      ...row,
      is_active: row.is_active !== null ? row.is_active : 1
    }));
  }

  // Get all users (all types)
  static async getAll() {
    const rows = await db.all(`
      SELECT mu.*, m.name, m.region, m.position,
             d.name as district_name, t.name as town_name
      FROM member_users mu
      LEFT JOIN members m ON mu.member_id = m.id
      LEFT JOIN districts d ON mu.district_id = d.id
      LEFT JOIN towns t ON mu.town_id = t.id
      ORDER BY mu.created_at DESC
    `);
    return (rows || []).map(row => ({
      ...row,
      is_active: row.is_active !== null ? row.is_active : 1
    }));
  }

  // Update user credentials
  static async updateUserCredentials(userId, username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run(
      'UPDATE member_users SET username = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [username, hashedPassword, userId]
    );
    return { id: userId, username, password: hashedPassword };
  }

  // Toggle user active status
  static async toggleUserStatus(userId) {
    await db.run(
      'UPDATE member_users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
    return { id: userId };
  }

  // Delete user
  static async deleteUser(userId) {
    await db.run('DELETE FROM member_users WHERE id = ?', [userId]);
    return { id: userId };
  }

  // Generate username from TC (TC kimlik numarası)
  static generateUsername(tc) {
    return tc; // TC kimlik numarasını kullanıcı adı olarak kullan
  }

  // Generate password from phone number (telefon numarası)
  static generatePassword(phone) {
    // Telefon numarasından sadece rakamları al
    return phone.replace(/\D/g, '');
  }

  // Normalize username by converting to lowercase and replacing Turkish characters
  static normalizeUsername(name) {
    if (!name) return '';

    return name
      .toLowerCase()
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/İ/g, 'i')
      .replace(/Ç/g, 'c')
      .replace(/Ğ/g, 'g')
      .replace(/Ö/g, 'o')
      .replace(/Ş/g, 's')
      .replace(/Ü/g, 'u')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  // Create user for district president
  static async createDistrictPresidentUser(districtId, districtName, chairmanName, chairmanPhone) {
    const username = MemberUser.normalizeUsername(districtName);
    const password = chairmanPhone.replace(/\D/g, '');
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO member_users (username, password, user_type, district_id, chairman_name) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, 'district_president', districtId, chairmanName]
    );
    return {
      id: result.lastID,
      username,
      password: hashedPassword,
      user_type: 'district_president',
      district_id: districtId,
      chairman_name: chairmanName
    };
  }

  // Create user for town president
  static async createTownPresidentUser(townId, townName, chairmanName, chairmanPhone) {
    const username = MemberUser.normalizeUsername(townName);
    const password = chairmanPhone.replace(/\D/g, '');
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO member_users (username, password, user_type, town_id, chairman_name) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, 'town_president', townId, chairmanName]
    );
    return {
      id: result.lastID,
      username,
      password: hashedPassword,
      user_type: 'town_president',
      town_id: townId,
      chairman_name: chairmanName
    };
  }

  // Get user by credentials (updated to handle all user types)
  static async getUserByCredentialsUpdated(username, password) {
    const user = await db.get(`
      SELECT mu.*,
             m.name, m.region, m.position,
             d.name as district_name,
             t.name as town_name
      FROM member_users mu
      LEFT JOIN members m ON mu.member_id = m.id
      LEFT JOIN districts d ON mu.district_id = d.id
      LEFT JOIN towns t ON mu.town_id = t.id
      WHERE mu.username = ? AND mu.is_active = 1
    `, [username]);
    if (!user) return null;
    try {
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) return user;
      // Backward compatible migration
      if (password === user.password) {
        const hashed = await bcrypt.hash(password, 10);
        db.run('UPDATE member_users SET password = ? WHERE id = ?', [hashed, user.id]).catch(() => {});
        return user;
      }
      return null;
    } catch (compareErr) {
      if (password === user.password) {
        db.run('UPDATE member_users SET password = ? WHERE id = ?', [await bcrypt.hash(password, 10), user.id]).catch(() => {});
        return user;
      }
      return null;
    }
  }

  // Get coordinator user by credentials (TC and phone)
  static async getCoordinatorUserByCredentials(tc, phone) {
    const normalizedPhone = phone.replace(/\D/g, '');
    const row = await db.get(`
      SELECT mu.*,
             ec.name, ec.role, ec.parent_coordinator_id, ec.district_id, ec.institution_name
      FROM member_users mu
      INNER JOIN election_coordinators ec ON mu.coordinator_id = ec.id
      WHERE ec.tc = ? AND ec.phone = ? AND mu.is_active = 1
    `, [tc, normalizedPhone]);
    return row || null;
  }

  // Update district president user credentials when district info changes
  static async updateDistrictPresidentUser(districtId, districtName, chairmanName, chairmanPhone) {
    const newUsername = MemberUser.normalizeUsername(districtName);
    const newPassword = chairmanPhone.replace(/\D/g, '');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await db.run(
      'UPDATE member_users SET username = ?, password = ?, chairman_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_type = ? AND district_id = ?',
      [newUsername, hashedPassword, chairmanName, 'district_president', districtId]
    );
    return {
      id: result.lastID,
      username: newUsername,
      password: hashedPassword,
      user_type: 'district_president',
      district_id: districtId,
      chairman_name: chairmanName
    };
  }

  // Update town president user credentials when town info changes
  static async updateTownPresidentUser(townId, townName, chairmanName, chairmanPhone) {
    const newUsername = MemberUser.normalizeUsername(townName);
    const newPassword = chairmanPhone.replace(/\D/g, '');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await db.run(
      'UPDATE member_users SET username = ?, password = ?, chairman_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_type = ? AND town_id = ?',
      [newUsername, hashedPassword, chairmanName, 'town_president', townId]
    );
    return {
      id: result.lastID,
      username: newUsername,
      password: hashedPassword,
      user_type: 'town_president',
      town_id: townId,
      chairman_name: chairmanName
    };
  }

  // Update member user credentials when member info changes
  static async updateMemberUser(memberId, tc, phone) {
    const newUsername = tc;
    const newPassword = phone.replace(/\D/g, '');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await db.run(
      'UPDATE member_users SET username = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE member_id = ?',
      [newUsername, hashedPassword, memberId]
    );
    return {
      id: result.lastID,
      username: newUsername,
      password: hashedPassword,
      member_id: memberId
    };
  }

  // Get user by district ID
  static async getUserByDistrictId(districtId) {
    const row = await db.get(
      'SELECT * FROM member_users WHERE user_type = ? AND district_id = ?',
      ['district_president', districtId]
    );
    return row || null;
  }

  // Get user by town ID
  static async getUserByTownId(townId) {
    const row = await db.get(
      'SELECT * FROM member_users WHERE user_type = ? AND town_id = ?',
      ['town_president', townId]
    );
    return row || null;
  }
}

module.exports = MemberUser;
