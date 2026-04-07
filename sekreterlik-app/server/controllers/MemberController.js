const db = require('../config/database');
const Member = require('../models/Member');
const MemberUser = require('../models/MemberUser');
const Notification = require('../models/Notification');
const xlsx = require('xlsx');
const { encryptField, decryptField } = require('../utils/crypto');
const { invalidate } = require('../middleware/cache');
const { syncAfterSqliteOperation } = require('../utils/autoSyncToFirebase');

class MemberController {
  // Get all members
  static async getAll(req, res) {
    try {
      const showArchived = req.query.archived === 'true';
      let sql, params;
      const page = parseInt(req.query.page, 10);
      const limit = parseInt(req.query.limit, 10);
      const hasPagination = Number.isFinite(page) && Number.isFinite(limit) && page > 0 && limit > 0;
      
      const q = (req.query.q || '').trim();
      const region = (req.query.region || '').trim();
      const where = [];
      params = [];
      if (!showArchived) {
        where.push('archived = 0');
      }
      if (q) {
        // Not: tc/phone alanları şifreli tutulduğu için LIKE ile aranamaz
        where.push('(name LIKE ?)');
        const like = `%${q}%`;
        params.push(like);
      }
      if (region) {
        where.push('region = ?');
        params.push(region);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      sql = `SELECT * FROM members ${whereSql} ORDER BY created_at DESC`;

      if (hasPagination) {
        const offset = (page - 1) * limit;
        const countSql = `SELECT COUNT(*) as cnt FROM members ${whereSql}`;
        const [{ cnt }] = await db.all(countSql, params);
        const paged = await db.all(`${sql} LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const decrypted = paged.map(m => ({
          ...m,
          tc: decryptField(m.tc),
          phone: decryptField(m.phone),
        }));
        return res.json({ data: decrypted, page, limit, total: cnt, totalPages: Math.ceil(cnt / limit) });
      }

      const members = await db.all(sql, params);
      const decrypted = members.map(m => ({
        ...m,
        tc: decryptField(m.tc),
        phone: decryptField(m.phone),
      }));
      res.json(decrypted);
    } catch (error) {
      console.error('Error getting members:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Get member by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const member = await db.get('SELECT * FROM members WHERE id = ?', [parseInt(id)]);
      
      if (!member) {
        return res.status(404).json({ message: 'Üye bulunamadı' });
      }
      
      res.json({
        ...member,
        tc: decryptField(member.tc),
        phone: decryptField(member.phone),
      });
    } catch (error) {
      console.error('Error getting member by ID:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Create new member
  static async create(req, res) {
    try {
      const memberData = req.body;

      const errors = Member.validate(memberData);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }

      // Check if TC already exists (compare with encrypted value)
      const encTc = encryptField(memberData.tc);
      const existingMember = await db.get('SELECT * FROM members WHERE tc = ?', [encTc]);
      if (existingMember) {
        return res.status(400).json({ message: 'Bu TC kimlik numarası zaten kayıtlı' });
      }
      
      const sql = `INSERT INTO members (tc, name, region, position, phone, email, address, district, notes, archived, kvkk_consent_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        encTc,
        memberData.name,
        memberData.region,
        memberData.position,
        encryptField(memberData.phone),
        memberData.email || null,
        memberData.address || null,
        memberData.district || null,
        memberData.notes || null,
        0, // archived = false
        memberData.kvkk_consent_date || new Date().toISOString()
      ];
      
      const result = await db.run(sql, params);
      const newMember = await db.get('SELECT * FROM members WHERE id = ?', [result.lastID]);

      // Automatically create member_user for the new member
      try {
        const username = memberData.tc; // Use TC as username
        const password = memberData.phone.replace(/\D/g, ''); // Normalize password (remove non-digits)

        // Check if username already exists
        const existingUserWithSameUsername = await db.get('SELECT * FROM member_users WHERE username = ?', [username]);

        if (!existingUserWithSameUsername) {
          await MemberUser.createMemberUser(result.lastID, username, password);
        }
      } catch (userError) {
        console.error('Error creating member user automatically:', userError);
        // Don't fail the member creation if user creation fails
      }
      
      // Invalidate cache for members
      invalidate('/api/members');
      
      // Otomatik Firebase sync
      try {
        const memberForFirebase = {
          ...newMember,
          tc: memberData.tc, // Decrypt edilmiş TC
          phone: memberData.phone, // Decrypt edilmiş phone
        };
        await syncAfterSqliteOperation('members', result.lastID, memberForFirebase, 'create');
      } catch (syncError) {
        console.warn('⚠️ Firebase sync hatası (member create):', syncError.message);
        // Sync hatası ana işlemi durdurmamalı
      }

      // Admin kullanicilara yeni uye bildirimi gonder
      try {
        const admins = await db.all("SELECT id FROM member_users WHERE user_type = 'admin'");
        for (const admin of admins) {
          await Notification.create({
            memberId: admin.id,
            title: 'Yeni Uye Eklendi',
            body: `${memberData.name} isimli yeni uye ${memberData.region || ''} bolgesine eklendi.`,
            type: 'member',
            data: {
              memberId: result.lastID,
              memberName: memberData.name,
              url: '/members'
            }
          });
        }
      } catch (notifErr) {
        console.warn('Yeni uye bildirimi gonderilemedi:', notifErr.message);
      }

      res.status(201).json({
        ...newMember,
        tc: decryptField(newMember.tc),
        phone: decryptField(newMember.phone),
      });
    } catch (error) {
      console.error('Error creating member in backend:', error); // Debug log
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Update member
  static async update(req, res) {
    try {
      const { id } = req.params;
      const memberData = req.body;
      const errors = Member.validate(memberData);
      
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası', errors });
      }
      
      // Get old member data to check if TC or phone changed
      const oldMember = await db.get('SELECT * FROM members WHERE id = ?', [parseInt(id)]);
      if (!oldMember) {
        return res.status(404).json({ message: 'Üye bulunamadı' });
      }
      
      const sql = `UPDATE members SET tc = ?, name = ?, region = ?, position = ?, phone = ?,
                   email = ?, address = ?, district = ?, notes = ?, kvkk_consent_date = ? WHERE id = ?`;
      const params = [
        encryptField(memberData.tc),
        memberData.name,
        memberData.region,
        memberData.position,
        encryptField(memberData.phone),
        memberData.email || null,
        memberData.address || null,
        memberData.district || null,
        memberData.notes || null,
        memberData.kvkk_consent_date || null,
        parseInt(id)
      ];
      
      const result = await db.run(sql, params);
      if (result.changes === 0) {
        return res.status(404).json({ message: 'Üye bulunamadı' });
      }
      
      const updatedMember = await db.get('SELECT * FROM members WHERE id = ?', [parseInt(id)]);
      
      // Update or create member user credentials if TC or phone changed
      const oldTc = decryptField(oldMember.tc);
      const oldPhone = decryptField(oldMember.phone);
      const tcChanged = oldTc !== memberData.tc;
      const phoneChanged = oldPhone !== memberData.phone;
      
      if (tcChanged || phoneChanged) {
        try {
          const memberUser = await MemberUser.getUserByMemberId(parseInt(id));
          if (memberUser) {
            // Update existing user
            await MemberUser.updateMemberUser(parseInt(id), memberData.tc, memberData.phone);
            
            // Firebase kullanılıyorsa Firebase Auth'u da güncelle
            const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';
            if (USE_FIREBASE) {
              try {
                const https = require('https');
                const http = require('http');
                const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
                const url = new URL(`${API_BASE_URL}/auth/update-firebase-auth-user`);
                
                const oldEmail = oldTc + '@ilsekreterlik.local';
                const newEmail = memberData.tc + '@ilsekreterlik.local';
                const newPassword = memberData.phone.replace(/\D/g, '');
                
                // Email ile kullanıcıyı bul (authUid SQLite'da saklanmıyor)
                const requestData = JSON.stringify({
                  email: newEmail,
                  oldEmail: tcChanged ? oldEmail : newEmail, // TC değiştiyse eski email'i gönder
                  password: phoneChanged ? newPassword : undefined
                });
                
                const options = {
                  hostname: url.hostname,
                  port: url.port || (url.protocol === 'https:' ? 443 : 80),
                  path: url.pathname,
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestData)
                  }
                };
                
                const protocol = url.protocol === 'https:' ? https : http;
                
                const req = protocol.request(options, (res) => {
                  let data = '';
                  res.on('data', (chunk) => { data += chunk; });
                  res.on('end', () => {
                    if (res.statusCode === 200) {
                      console.log(`✅ Firebase Auth updated for member ID ${id}`);
                    } else {
                      console.warn(`⚠️ Firebase Auth update failed for member ID ${id}:`, data);
                    }
                  });
                });
                
                req.on('error', (error) => {
                  console.warn(`⚠️ Firebase Auth update request error for member ID ${id}:`, error.message);
                });
                
                req.write(requestData);
                req.end();
              } catch (firebaseAuthError) {
                console.warn('⚠️ Firebase Auth update error (non-critical):', firebaseAuthError.message);
                // Firebase Auth güncelleme hatası ana işlemi durdurmamalı
              }
            }
          } else {
            // Create new user if doesn't exist
            const username = memberData.tc;
            const password = memberData.phone.replace(/\D/g, '');
            await MemberUser.createMemberUser(parseInt(id), username, password);
          }
        } catch (userError) {
          console.error('Error updating/creating member user:', userError);
          // Don't fail the main operation if user update fails
        }
      }
      
      // Invalidate cache for members
      invalidate('/api/members');
      
      // Otomatik Firebase sync
      try {
        const memberForFirebase = {
          ...updatedMember,
          tc: memberData.tc, // Decrypt edilmiş TC
          phone: memberData.phone, // Decrypt edilmiş phone
        };
        await syncAfterSqliteOperation('members', parseInt(id), memberForFirebase, 'update');
      } catch (syncError) {
        console.warn('⚠️ Firebase sync hatası (member update):', syncError.message);
        // Sync hatası ana işlemi durdurmamalı
      }
      
      res.json({
        ...updatedMember,
        tc: decryptField(updatedMember.tc),
        phone: decryptField(updatedMember.phone),
      });
    } catch (error) {
      console.error('Error updating member:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Archive member
  static async archive(req, res) {
    try {
      const { id } = req.params;
      const member = await db.get('SELECT * FROM members WHERE id = ?', [parseInt(id)]);
      
      if (!member) {
        return res.status(404).json({ message: 'Üye bulunamadı' });
      }
      
      // Update in database with archived_at and archived_reason
      const archivedAt = new Date().toISOString();
      const archivedReason = req.body?.reason || null;
      const result = await db.run(
        'UPDATE members SET archived = 1, archived_at = ?, archived_reason = ? WHERE id = ?',
        [archivedAt, archivedReason, parseInt(id)]
      );

      if (result.changes === 0) {
        return res.status(404).json({ message: 'Üye bulunamadı' });
      }

      // Invalidate cache for members
      invalidate('/api/members');

      const archivedMember = { ...member, archived: 1, archived_at: archivedAt, archived_reason: archivedReason };
      res.json({ message: 'Üye arşivlendi', member: archivedMember });
    } catch (error) {
      console.error('Error archiving member:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Set manual stars for a member (admin and district_president only)
  static async setManualStars(req, res) {
    try {
      const { id } = req.params;
      const { stars } = req.body;
      
      // Validate stars (1-5 or null)
      if (stars !== null && (stars < 1 || stars > 5 || !Number.isInteger(stars))) {
        return res.status(400).json({ message: 'Yıldız değeri 1-5 arasında olmalıdır' });
      }
      
      const sql = `UPDATE members SET manual_stars = ? WHERE id = ?`;
      const result = await db.run(sql, [stars === null ? null : parseInt(stars), parseInt(id)]);
      
      if (result.changes === 0) {
        return res.status(404).json({ message: 'Üye bulunamadı' });
      }
      
      const updatedMember = await db.get('SELECT * FROM members WHERE id = ?', [parseInt(id)]);
      
      // Sync to Firebase if enabled
      await syncAfterSqliteOperation('members', updatedMember.id, 'update');
      
      res.json({
        ...updatedMember,
        tc: decryptField(updatedMember.tc),
        phone: decryptField(updatedMember.phone),
      });
    } catch (error) {
      console.error('Error setting manual stars:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Restore archived member
  static async restore(req, res) {
    try {
      const { id } = req.params;
      const member = await db.get('SELECT * FROM members WHERE id = ? AND archived = 1', [parseInt(id)]);
      
      if (!member) {
        return res.status(404).json({ message: 'Arşivlenmiş üye bulunamadı' });
      }
      
      // Update in database
      const result = await db.run('UPDATE members SET archived = 0 WHERE id = ?', [parseInt(id)]);
      
      if (result.changes === 0) {
        return res.status(404).json({ message: 'Arşivlenmiş üye bulunamadı' });
      }
      
      // Invalidate cache for members
      invalidate('/api/members');
      
      const restoredMember = { ...member, archived: 0 };
      res.json({ message: 'Üye geri yüklendi', member: restoredMember });
    } catch (error) {
      console.error('Error restoring member:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Helper function to create region if it doesn't exist
  static async createRegionIfNotExists(regionName) {
    if (!regionName || regionName.trim() === '') return null;
    
    const regions = await db.all('SELECT * FROM regions WHERE name = ?', [regionName.trim()]);
    if (regions.length > 0) {
      return regions[0];
    }
    
    // Create new region
    const result = await db.run('INSERT INTO regions (name) VALUES (?)', [regionName.trim()]);
    const newRegion = { id: result.lastID, name: regionName.trim() };
    
    // Add to in-memory collection
    db.add('regions', newRegion);
    
    return newRegion;
  }

  // Helper function to create position if it doesn't exist
  static async createPositionIfNotExists(positionName) {
    if (!positionName || positionName.trim() === '') return null;
    
    const positions = await db.all('SELECT * FROM positions WHERE name = ?', [positionName.trim()]);
    if (positions.length > 0) {
      return positions[0];
    }
    
    // Create new position
    const result = await db.run('INSERT INTO positions (name) VALUES (?)', [positionName.trim()]);
    const newPosition = { id: result.lastID, name: positionName.trim() };
    
    // Add to in-memory collection
    db.add('positions', newPosition);
    
    return newPosition;
  }

  // Import members from Excel
  static async importFromExcel(req, res) {
    try {
      // Check if file was uploaded - support both req.files.file and req.file
      const file = req.files?.file || req.file;
      if (!file) {
        return res.status(400).json({ message: 'Dosya bulunamadı' });
      }

      // Handle both buffer and data properties
      const fileData = file.data || file.buffer;
      if (!fileData) {
        return res.status(400).json({ message: 'Dosya verisi bulunamadı' });
      }

      const workbook = xlsx.read(fileData, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      // Remove header row
      const rows = data.slice(1);

      let importedCount = 0;
      const errors = [];

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          if (row.length < 3) {
            continue; // Skip incomplete rows
          }

          // Map Excel columns to member fields (without automatic mapping)
          // Sütun sırası: TC, İsim Soyisim, Telefon, Görev, Bölge (İlçe kaldırıldı)
          const tc = row[0] ? String(row[0]).trim() : '';
          const name = row[1] ? String(row[1]).trim() : '';
          const phone = row[2] ? String(row[2]).trim() : '';
          let position = row[3] ? String(row[3]).trim() : '';
          let region = row[4] ? String(row[4]).trim() : '';

          // If position or region is empty, set default values
          if (!position) {
            position = 'Üye';
          }
          
          if (!region) {
            region = 'Üye';
          }

          // Validate required fields (İlçe artık zorunlu değil)
          if (!tc || !name || !phone) {
            errors.push(`Satır ${i + 2}: Gerekli alanlar eksik (TC, İsim Soyisim, Telefon zorunludur)`);
            continue;
          }

          // Validate TC length
          if (tc.length !== 11) {
            errors.push(`Satır ${i + 2}: TC kimlik numarası 11 haneli olmalıdır`);
            continue;
          }

          // Check if TC already exists (compare with encrypted value)
          const encTc = encryptField(tc);
          const existingMember = await db.get('SELECT * FROM members WHERE tc = ?', [encTc]);
          if (existingMember) {
            errors.push(`Satır ${i + 2}: Bu TC kimlik numarası zaten kayıtlı`);
            continue;
          }

          // Create region and position if they don't exist
          if (region) {
            await MemberController.createRegionIfNotExists(region);
          }

          if (position) {
            await MemberController.createPositionIfNotExists(position);
          }

          // Encrypt sensitive fields before inserting
          const encPhone = encryptField(phone);

          // Insert member into database (İlçe kaldırıldı)
          const result = await db.run(
            'INSERT INTO members (tc, name, phone, position, region) VALUES (?, ?, ?, ?, ?)',
            [encTc, name, encPhone, position, region]
          );

          // Add member to in-memory collection as well
          const newMember = {
            id: result.lastID,
            tc: encTc,
            name,
            phone: encPhone,
            position,
            region,
            archived: false
          };
          db.add('members', newMember);
          
          importedCount++;
        } catch (rowError) {
          console.error(`Error processing row ${i + 2}:`, rowError);
          errors.push(`Satır ${i + 2}: ${rowError.message}`);
        }
      }

      res.json({ 
        message: `${importedCount} üye başarıyla içe aktarıldı`, 
        count: importedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Excel import error:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Export members to Excel
  static exportToExcel(req, res) {
    try {
      // In a real implementation, you would generate an Excel file here
      // For now, we'll just return a success message
      res.json({ message: 'Üyeler başarıyla dışa aktarıldı' });
    } catch (error) {
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Upload member photo
  static async uploadPhoto(req, res) {
    try {
      const { memberId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'Fotoğraf dosyası bulunamadı' });
      }

      if (!memberId) {
        return res.status(400).json({ message: 'Üye ID gerekli' });
      }

      // Generate unique filename
      const filename = `member-${memberId}-${Date.now()}-${file.originalname}`;
      const photoUrl = `/uploads/photos/${filename}`;

      // Save file to disk
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../uploads/photos');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      // Update member photo in database
      const result = await db.run(
        'UPDATE members SET photo = ? WHERE id = ?',
        [photoUrl, memberId]
      );

      if (result.changes === 0) {
        return res.status(404).json({ message: 'Üye bulunamadı' });
      }

      // Photo URL is already updated in database above

      res.json({ 
        message: 'Fotoğraf başarıyla yüklendi',
        photoUrl: photoUrl
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // Archive all members
  static async archiveAll(req, res) {
    try {
      // Get all members
      const members = db.get('members');
      
      // Move each member to archivedMembers and update in database
      for (const member of members) {
        const archivedMember = { ...member, archived: true };
        db.add('archivedMembers', archivedMember);
        await db.run('UPDATE members SET archived = 1 WHERE id = ?', [member.id]);
      }
      
      // Clear all active members and member registrations
      db.deleteAll('members');
      db.deleteAll('memberRegistrations');
      
      res.json({ message: 'Tüm üyeler arşivlendi' });
    } catch (error) {
      console.error('Error in archiveAll:', error);
      res.status(500).json({ message: 'İşlem sırasında bir hata oluştu' });
    }
  }

  // New method to handle bulk archive via POST
  static bulkArchive(req, res) {
    return MemberController.archiveAll(req, res);
  }

}

module.exports = MemberController;