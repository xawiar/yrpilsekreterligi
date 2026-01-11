const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { decryptField } = require('../utils/crypto');

// Database path
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper function to normalize phone number (remove non-digits)
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.toString().replace(/\D/g, '');
}

// Helper function to normalize TC (remove non-digits)
function normalizeTC(tc) {
  if (!tc) return '';
  return tc.toString().replace(/\D/g, '');
}

// Create member user for a member
function createMemberUser(member) {
  return new Promise((resolve, reject) => {
    const memberId = member.id;
    const tc = decryptField(member.tc) || member.tc || '';
    const phone = decryptField(member.phone) || member.phone || '';
    
    if (!tc || !phone) {
      return resolve({ skipped: true, reason: 'TC veya telefon numarası yok' });
    }
    
    const username = normalizeTC(tc);
    const password = normalizePhone(phone);
    
    if (!username || !password) {
      return resolve({ skipped: true, reason: 'TC veya telefon numarası geçersiz' });
    }
    
    // Check if user already exists
    db.get(
      'SELECT * FROM member_users WHERE member_id = ? OR username = ?',
      [memberId, username],
      (err, existing) => {
        if (err) {
          return reject(err);
        }
        
        if (existing) {
          // Update existing user
          db.run(
            'UPDATE member_users SET username = ?, password = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [username, password, existing.id],
            function(updateErr) {
              if (updateErr) {
                return reject(updateErr);
              }
              resolve({ updated: true, id: existing.id, username, memberId });
            }
          );
        } else {
          // Create new user
          db.run(
            'INSERT INTO member_users (member_id, username, password, user_type, is_active) VALUES (?, ?, ?, ?, ?)',
            [memberId, username, password, 'member', 1],
            function(insertErr) {
              if (insertErr) {
                return reject(insertErr);
              }
              resolve({ created: true, id: this.lastID, username, memberId });
            }
          );
        }
      }
    );
  });
}

// Create member user for district president
function createDistrictPresidentUser(districtOfficial) {
  return new Promise((resolve, reject) => {
    const districtId = districtOfficial.district_id;
    const chairmanMemberId = districtOfficial.chairman_member_id;
    
    if (!chairmanMemberId) {
      return resolve({ skipped: true, reason: 'İlçe başkanı member_id yok' });
    }
    
    // Get member info (TC and phone)
    db.get('SELECT tc, phone FROM members WHERE id = ?', [chairmanMemberId], (err, member) => {
      if (err) {
        return reject(err);
      }
      
      if (!member) {
        return resolve({ skipped: true, reason: 'İlçe başkanı member bulunamadı' });
      }
      
      const tc = decryptField(member.tc) || member.tc || '';
      const phone = decryptField(member.phone) || member.phone || '';
      
      if (!tc || !phone) {
        return resolve({ skipped: true, reason: 'TC veya telefon numarası yok' });
      }
      
      const username = normalizeTC(tc);
      const password = normalizePhone(phone);
      
      if (!username || !password) {
        return resolve({ skipped: true, reason: 'TC veya telefon numarası geçersiz' });
      }
      
      // Check if user already exists
      db.get(
        'SELECT * FROM member_users WHERE (district_id = ? AND user_type = ?) OR username = ?',
        [districtId, 'district_president', username],
        (err, existing) => {
          if (err) {
            return reject(err);
          }
          
          if (existing) {
            // Update existing user
            db.run(
              'UPDATE member_users SET username = ?, password = ?, district_id = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [username, password, districtId, existing.id],
              function(updateErr) {
                if (updateErr) {
                  return reject(updateErr);
                }
                resolve({ updated: true, id: existing.id, username, districtId });
              }
            );
          } else {
            // Create new user
            db.run(
              'INSERT INTO member_users (district_id, username, password, user_type, is_active) VALUES (?, ?, ?, ?, ?)',
              [districtId, username, password, 'district_president', 1],
              function(insertErr) {
                if (insertErr) {
                  return reject(insertErr);
                }
                resolve({ created: true, id: this.lastID, username, districtId });
              }
            );
          }
        }
      );
    });
  });
}

// Create member user for town president
function createTownPresidentUser(townOfficial) {
  return new Promise((resolve, reject) => {
    const townId = townOfficial.town_id;
    const chairmanPhone = decryptField(townOfficial.chairman_phone) || townOfficial.chairman_phone || '';
    
    if (!chairmanPhone) {
      return resolve({ skipped: true, reason: 'Belde başkanı telefon numarası yok' });
    }
    
    // Get town name
    db.get('SELECT name FROM towns WHERE id = ?', [townId], (err, town) => {
      if (err) {
        return reject(err);
      }
      
      if (!town) {
        return resolve({ skipped: true, reason: 'Belde bulunamadı' });
      }
      
      const townName = town.name;
      
      if (!townName) {
        return resolve({ skipped: true, reason: 'Belde adı yok' });
      }
      
      const username = townName.toLowerCase().replace(/\s+/g, ''); // Belde adı (küçük harf, boşluksuz)
      const password = normalizePhone(chairmanPhone);
      
      if (!username || !password) {
        return resolve({ skipped: true, reason: 'Belde adı veya telefon numarası geçersiz' });
      }
      
      // Check if user already exists
      db.get(
        'SELECT * FROM member_users WHERE (town_id = ? AND user_type = ?) OR username = ?',
        [townId, 'town_president', username],
        (err, existing) => {
          if (err) {
            return reject(err);
          }
          
          if (existing) {
            // Update existing user
            db.run(
              'UPDATE member_users SET username = ?, password = ?, town_id = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [username, password, townId, existing.id],
              function(updateErr) {
                if (updateErr) {
                  return reject(updateErr);
                }
                resolve({ updated: true, id: existing.id, username, townId });
              }
            );
          } else {
            // Create new user
            db.run(
              'INSERT INTO member_users (town_id, username, password, user_type, is_active) VALUES (?, ?, ?, ?, ?)',
              [townId, username, password, 'town_president', 1],
              function(insertErr) {
                if (insertErr) {
                  return reject(insertErr);
                }
                resolve({ created: true, id: this.lastID, username, townId });
              }
            );
          }
        }
      );
    });
  });
}

// Main function
async function main() {
  console.log('\n🚀 Üye Kullanıcıları Oluşturuluyor...\n');
  
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const errors = [];
  
  try {
    // 1. Tüm üyeler için kullanıcı oluştur
    console.log('👥 Üyeler için kullanıcı oluşturuluyor...');
    const members = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM members WHERE archived = 0 OR archived IS NULL', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`📊 ${members.length} üye bulundu`);
    
    for (const member of members) {
      try {
        const result = await createMemberUser(member);
        if (result.created) {
          totalCreated++;
          console.log(`✅ Üye kullanıcısı oluşturuldu: ${result.username} (Member ID: ${result.memberId})`);
        } else if (result.updated) {
          totalUpdated++;
          console.log(`🔄 Üye kullanıcısı güncellendi: ${result.username} (Member ID: ${result.memberId})`);
        } else if (result.skipped) {
          totalSkipped++;
          console.log(`⏭️  Üye atlandı (ID: ${member.id}): ${result.reason}`);
        }
      } catch (error) {
        errors.push(`Üye ID ${member.id}: ${error.message}`);
        console.error(`❌ Üye kullanıcısı oluşturma hatası (ID: ${member.id}):`, error.message);
      }
    }
    
    // 2. İlçe başkanları için kullanıcı oluştur
    console.log('\n🏛️  İlçe başkanları için kullanıcı oluşturuluyor...');
    const districtOfficials = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM district_officials 
        WHERE chairman_member_id IS NOT NULL
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`📊 ${districtOfficials.length} ilçe başkanı bulundu`);
    
    for (const official of districtOfficials) {
      try {
        const result = await createDistrictPresidentUser(official);
        if (result.created) {
          totalCreated++;
          console.log(`✅ İlçe başkanı kullanıcısı oluşturuldu: ${result.username} (District ID: ${result.districtId})`);
        } else if (result.updated) {
          totalUpdated++;
          console.log(`🔄 İlçe başkanı kullanıcısı güncellendi: ${result.username} (District ID: ${result.districtId})`);
        } else if (result.skipped) {
          totalSkipped++;
          console.log(`⏭️  İlçe başkanı atlandı (ID: ${official.id}): ${result.reason}`);
        }
      } catch (error) {
        errors.push(`İlçe Başkanı ID ${official.id}: ${error.message}`);
        console.error(`❌ İlçe başkanı kullanıcısı oluşturma hatası (ID: ${official.id}):`, error.message);
      }
    }
    
    // 3. Belde başkanları için kullanıcı oluştur
    console.log('\n🏘️  Belde başkanları için kullanıcı oluşturuluyor...');
    const townOfficials = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM town_officials 
        WHERE chairman_phone IS NOT NULL AND chairman_phone != ''
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`📊 ${townOfficials.length} belde başkanı bulundu`);
    
    for (const official of townOfficials) {
      try {
        const result = await createTownPresidentUser(official);
        if (result.created) {
          totalCreated++;
          console.log(`✅ Belde başkanı kullanıcısı oluşturuldu: ${result.username} (Town ID: ${result.townId})`);
        } else if (result.updated) {
          totalUpdated++;
          console.log(`🔄 Belde başkanı kullanıcısı güncellendi: ${result.username} (Town ID: ${result.townId})`);
        } else if (result.skipped) {
          totalSkipped++;
          console.log(`⏭️  Belde başkanı atlandı (ID: ${official.id}): ${result.reason}`);
        }
      } catch (error) {
        errors.push(`Belde Başkanı ID ${official.id}: ${error.message}`);
        console.error(`❌ Belde başkanı kullanıcısı oluşturma hatası (ID: ${official.id}):`, error.message);
      }
    }
    
    // Summary
    console.log('\n📊 Özet:');
    console.log('='.repeat(50));
    console.log(`✅ Oluşturulan: ${totalCreated}`);
    console.log(`🔄 Güncellenen: ${totalUpdated}`);
    console.log(`⏭️  Atlanan: ${totalSkipped}`);
    console.log(`❌ Hatalar: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Hatalar:');
      errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (errors.length > 10) {
        console.log(`  ... ve ${errors.length - 10} hata daha`);
      }
    }
    
    console.log('='.repeat(50));
    console.log('\n✅ İşlem tamamlandı!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Database kapatılırken hata:', err);
        process.exit(1);
      } else {
        console.log('\n📦 Database kapatıldı');
        process.exit(0);
      }
    });
  }
}

// Run
main();

