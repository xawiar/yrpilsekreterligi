const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Source database (masaüstündeki dosya)
const sourceDbPath = path.join(require('os').homedir(), 'Desktop', 'ildatabase.sqlite');

// Target database (mevcut proje veritabanı)
const targetDbPath = path.join(__dirname, 'sekreterlik-app', 'server', 'database.sqlite');

console.log('📦 Veritabanı İçe Aktarma Başlatılıyor...');
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

// Import members
function importMembers() {
  return new Promise((resolve, reject) => {
    console.log('\n👥 Üyeler içe aktarılıyor...');
    
    sourceDb.all('SELECT * FROM members WHERE archived = 0 OR archived IS NULL', [], (err, sourceMembers) => {
      if (err) {
        console.error('❌ Üyeler okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceMembers.length} üye bulundu`);

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      if (sourceMembers.length === 0) {
        console.log('⚠️  İçe aktarılacak üye bulunamadı');
        return resolve();
      }

      let processed = 0;

      sourceMembers.forEach((member, index) => {
        // Check if member already exists by TC
        targetDb.get('SELECT id FROM members WHERE tc = ?', [member.tc], (err, existing) => {
          if (err) {
            console.error(`❌ Üye kontrolü hatası (${member.name}):`, err.message);
            errors++;
            processed++;
            if (processed === sourceMembers.length) {
              console.log(`\n✅ Üye içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          if (existing) {
            console.log(`⏭️  Üye atlandı (zaten var): ${member.name} (TC: ${member.tc})`);
            skipped++;
            processed++;
            if (processed === sourceMembers.length) {
              console.log(`\n✅ Üye içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          // Insert new member
          const insertQuery = `
            INSERT INTO members (
              tc, name, region, position, phone, email, 
              address, district, notes, archived, created_at, photo,
              totalAttendedMeetings, totalMeetings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const values = [
            member.tc || '',
            member.name || '',
            member.region || null,
            member.position || null,
            member.phone || null,
            member.email || null,
            member.address || null,
            member.district || null,
            member.notes || null,
            member.archived || 0,
            member.created_at || new Date().toISOString(),
            member.photo || null,
            member.totalAttendedMeetings || 0,
            member.totalMeetings || 0
          ];

          targetDb.run(insertQuery, values, function(err) {
            if (err) {
              console.error(`❌ Üye eklenemedi (${member.name}):`, err.message);
              errors++;
            } else {
              console.log(`✅ Üye eklendi: ${member.name} (TC: ${member.tc})`);
              imported++;
            }

            processed++;
            if (processed === sourceMembers.length) {
              console.log(`\n✅ Üye içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
          });
        });
      });
    });
  });
}

// Import meetings
function importMeetings() {
  return new Promise((resolve, reject) => {
    console.log('\n📅 Toplantılar içe aktarılıyor...');
    
    sourceDb.all('SELECT * FROM meetings WHERE archived = 0 OR archived IS NULL', [], (err, sourceMeetings) => {
      if (err) {
        console.error('❌ Toplantılar okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceMeetings.length} toplantı bulundu`);

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      if (sourceMeetings.length === 0) {
        console.log('⚠️  İçe aktarılacak toplantı bulunamadı');
        return resolve();
      }

      let processed = 0;

      sourceMeetings.forEach((meeting) => {
        // Check if meeting already exists by name and date
        targetDb.get(
          'SELECT id FROM meetings WHERE name = ? AND date = ?',
          [meeting.name, meeting.date],
          (err, existing) => {
            if (err) {
              console.error(`❌ Toplantı kontrolü hatası (${meeting.name}):`, err.message);
              errors++;
              processed++;
              if (processed === sourceMeetings.length) {
                console.log(`\n✅ Toplantı içe aktarma tamamlandı:`);
                console.log(`   - İçe aktarılan: ${imported}`);
                console.log(`   - Atlanan (zaten var): ${skipped}`);
                console.log(`   - Hatalar: ${errors}`);
                resolve();
              }
              return;
            }

            if (existing) {
              console.log(`⏭️  Toplantı atlandı (zaten var): ${meeting.name} (${meeting.date})`);
              skipped++;
              processed++;
              if (processed === sourceMeetings.length) {
                console.log(`\n✅ Toplantı içe aktarma tamamlandı:`);
                console.log(`   - İçe aktarılan: ${imported}`);
                console.log(`   - Atlanan (zaten var): ${skipped}`);
                console.log(`   - Hatalar: ${errors}`);
                resolve();
              }
              return;
            }

            // Insert new meeting
            const insertQuery = `
              INSERT INTO meetings (
                name, date, notes, archived, created_at, regions, attendees
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
              meeting.name || '',
              meeting.date || null,
              meeting.notes || null,
              meeting.archived || 0,
              meeting.created_at || new Date().toISOString(),
              meeting.regions || null,
              meeting.attendees || null
            ];

            targetDb.run(insertQuery, values, function(err) {
              if (err) {
                console.error(`❌ Toplantı eklenemedi (${meeting.name}):`, err.message);
                errors++;
              } else {
                console.log(`✅ Toplantı eklendi: ${meeting.name} (${meeting.date})`);
                imported++;
              }

              processed++;
              if (processed === sourceMeetings.length) {
                console.log(`\n✅ Toplantı içe aktarma tamamlandı:`);
                console.log(`   - İçe aktarılan: ${imported}`);
                console.log(`   - Atlanan (zaten var): ${skipped}`);
                console.log(`   - Hatalar: ${errors}`);
                resolve();
              }
            });
          }
        );
      });
    });
  });
}

// Main import function
async function main() {
  try {
    console.log('\n🚀 İçe aktarma işlemi başlatılıyor...\n');
    
    // Import members first
    await importMembers();
    
    // Then import meetings
    await importMeetings();
    
    console.log('\n✅ Tüm içe aktarma işlemleri tamamlandı!');
    
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

