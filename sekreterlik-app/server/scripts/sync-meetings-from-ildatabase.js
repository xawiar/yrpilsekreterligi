const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Source database (masaüstündeki dosya)
const sourceDbPath = path.join(os.homedir(), 'Desktop', 'ildatabase.sqlite');

// Target database (mevcut proje veritabanı)
const targetDbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('📦 Toplantı Verileri İçe Aktarma Başlatılıyor...');
console.log('Kaynak:', sourceDbPath);
console.log('Hedef:', targetDbPath);

// Source database connection
const sourceDb = new sqlite3.Database(sourceDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Kaynak veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  }
  console.log('✅ Kaynak veritabanına bağlandı');
});

// Target database connection
const targetDb = new sqlite3.Database(targetDbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Hedef veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  }
  console.log('✅ Hedef veritabanına bağlandı');
});

// Import meetings with attendees
function importMeetings() {
  return new Promise((resolve, reject) => {
    console.log('\n📅 Toplantılar içe aktarılıyor...');
    
    sourceDb.all('SELECT * FROM meetings WHERE archived = 0 OR archived IS NULL ORDER BY date DESC', [], (err, sourceMeetings) => {
      if (err) {
        console.error('❌ Toplantılar okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceMeetings.length} toplantı bulundu`);

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      if (sourceMeetings.length === 0) {
        console.log('⚠️  İçe aktarılacak toplantı bulunamadı');
        return resolve();
      }

      let processed = 0;

      sourceMeetings.forEach((meeting) => {
        // Parse JSON fields
        let regions = [];
        let attendees = [];
        
        try {
          if (meeting.regions) {
            regions = typeof meeting.regions === 'string' ? JSON.parse(meeting.regions) : meeting.regions;
          }
        } catch (e) {
          console.warn(`⚠️  Toplantı ${meeting.id} regions parse hatası:`, e.message);
        }
        
        try {
          if (meeting.attendees) {
            attendees = typeof meeting.attendees === 'string' ? JSON.parse(meeting.attendees) : meeting.attendees;
            
            // Convert memberId from number to string for consistency
            attendees = attendees.map(attendee => ({
              ...attendee,
              memberId: String(attendee.memberId || attendee.member_id || ''),
              member_id: String(attendee.memberId || attendee.member_id || '')
            }));
          }
        } catch (e) {
          console.warn(`⚠️  Toplantı ${meeting.id} attendees parse hatası:`, e.message);
        }

        // Check if meeting already exists
        targetDb.get('SELECT * FROM meetings WHERE id = ?', [meeting.id], (err, existing) => {
          if (err) {
            console.error(`❌ Toplantı ${meeting.id} kontrol hatası:`, err.message);
            errors++;
            processed++;
            if (processed === sourceMeetings.length) {
              console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
              resolve();
            }
            return;
          }

          if (existing) {
            // Update existing meeting
            targetDb.run(
              `UPDATE meetings SET 
                name = ?, 
                date = ?, 
                notes = ?, 
                archived = ?,
                regions = ?,
                attendees = ?,
                created_at = COALESCE(?, created_at)
              WHERE id = ?`,
              [
                meeting.name,
                meeting.date,
                meeting.notes || null,
                meeting.archived || 0,
                JSON.stringify(regions),
                JSON.stringify(attendees),
                meeting.created_at,
                meeting.id
              ],
              function(updateErr) {
                if (updateErr) {
                  console.error(`❌ Toplantı ${meeting.id} güncellenemedi:`, updateErr.message);
                  errors++;
                } else {
                  updated++;
                  console.log(`🔄 Toplantı güncellendi: ${meeting.name} (ID: ${meeting.id}, ${attendees.length} katılımcı)`);
                }
                processed++;
                if (processed === sourceMeetings.length) {
                  console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
                  resolve();
                }
              }
            );
          } else {
            // Insert new meeting
            targetDb.run(
              `INSERT INTO meetings (id, name, date, notes, archived, regions, attendees, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                meeting.id,
                meeting.name,
                meeting.date,
                meeting.notes || null,
                meeting.archived || 0,
                JSON.stringify(regions),
                JSON.stringify(attendees),
                meeting.created_at || new Date().toISOString()
              ],
              function(insertErr) {
                if (insertErr) {
                  console.error(`❌ Toplantı ${meeting.id} eklenemedi:`, insertErr.message);
                  errors++;
                } else {
                  imported++;
                  console.log(`✅ Toplantı eklendi: ${meeting.name} (ID: ${meeting.id}, ${attendees.length} katılımcı)`);
                }
                processed++;
                if (processed === sourceMeetings.length) {
                  console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
                  resolve();
                }
              }
            );
          }
        });
      });
    });
  });
}

// Main import function
async function main() {
  try {
    console.log('\n🚀 Toplantı içe aktarma işlemi başlatılıyor...\n');
    
    // Import meetings
    await importMeetings();
    
    console.log('\n✅ Toplantı içe aktarma işlemi tamamlandı!');
    
  } catch (error) {
    console.error('\n❌ İçe aktarma hatası:', error);
  } finally {
    // Close database connections
    sourceDb.close((err) => {
      if (err) console.error('Kaynak veritabanı kapatılırken hata:', err.message);
    });
    
    targetDb.close((err) => {
      if (err) console.error('Hedef veritabanı kapatılırken hata:', err.message);
      else {
        console.log('\n📦 Veritabanı bağlantıları kapatıldı');
        process.exit(0);
      }
    });
  }
}

// Run import
main();

