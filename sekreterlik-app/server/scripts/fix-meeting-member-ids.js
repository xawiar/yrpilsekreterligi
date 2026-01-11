const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Source database (masaüstündeki dosya)
const sourceDbPath = path.join(os.homedir(), 'Desktop', 'ildatabase.sqlite');

// Target database (mevcut proje veritabanı)
const targetDbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('📦 Toplantı Üye ID\'leri Düzeltiliyor...');
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

// Create member ID mapping (old ID -> new ID based on TC)
function createMemberIdMapping() {
  return new Promise((resolve, reject) => {
    console.log('\n🔍 Üye ID eşleştirmesi oluşturuluyor...\n');
    
    // Get all members from source database with their TC
    sourceDb.all('SELECT id, tc FROM members WHERE archived = 0 OR archived IS NULL', [], (err, sourceMembers) => {
      if (err) {
        console.error('❌ Kaynak üyeler okunamadı:', err.message);
        return reject(err);
      }
      
      // Get all members from target database with their TC
      targetDb.all('SELECT id, tc FROM members WHERE archived = 0 OR archived IS NULL', [], (err, targetMembers) => {
        if (err) {
          console.error('❌ Hedef üyeler okunamadı:', err.message);
          return reject(err);
        }
        
        // Create mapping: old ID -> new ID based on TC
        const idMapping = {};
        const tcToNewId = {};
        
        // Create TC to new ID mapping
        targetMembers.forEach(member => {
          if (member.tc) {
            tcToNewId[member.tc] = member.id;
          }
        });
        
        // Map old IDs to new IDs
        sourceMembers.forEach(member => {
          if (member.tc && tcToNewId[member.tc]) {
            idMapping[member.id] = tcToNewId[member.tc];
          }
        });
        
        console.log(`📊 ${Object.keys(idMapping).length} üye ID eşleştirmesi bulundu`);
        console.log(`   Kaynak üyeler: ${sourceMembers.length}`);
        console.log(`   Hedef üyeler: ${targetMembers.length}`);
        
        resolve(idMapping);
      });
    });
  });
}

// Fix meeting attendees member IDs
function fixMeetingAttendees(idMapping) {
  return new Promise((resolve, reject) => {
    console.log('\n📅 Toplantı katılımcı ID\'leri düzeltiliyor...\n');
    
    targetDb.all('SELECT * FROM meetings WHERE archived = 0 OR archived IS NULL', [], (err, meetings) => {
      if (err) {
        console.error('❌ Toplantılar okunamadı:', err.message);
        return reject(err);
      }
      
      console.log(`📊 ${meetings.length} toplantı bulundu\n`);
      
      let fixed = 0;
      let totalFixed = 0;
      let processed = 0;
      
      meetings.forEach(meeting => {
        try {
          if (!meeting.attendees) {
            processed++;
            if (processed === meetings.length) {
              console.log(`\n📊 Özet: ${fixed} toplantı düzeltildi, ${totalFixed} katılımcı ID'si güncellendi`);
              resolve();
            }
            return;
          }
          
          let attendees = typeof meeting.attendees === 'string' 
            ? JSON.parse(meeting.attendees) 
            : meeting.attendees;
          
          if (!Array.isArray(attendees)) {
            processed++;
            if (processed === meetings.length) {
              console.log(`\n📊 Özet: ${fixed} toplantı düzeltildi, ${totalFixed} katılımcı ID'si güncellendi`);
              resolve();
            }
            return;
          }
          
          let hasChanges = false;
          const fixedAttendees = attendees.map(attendee => {
            const oldMemberId = attendee.memberId || attendee.member_id;
            const oldIdNum = Number(oldMemberId);
            const oldIdStr = String(oldMemberId);
            
            // Check if we have a mapping for this ID
            const newId = idMapping[oldIdNum] || idMapping[oldIdStr];
            
            if (newId && newId !== oldMemberId) {
              hasChanges = true;
              totalFixed++;
              return {
                ...attendee,
                memberId: String(newId),
                member_id: String(newId)
              };
            }
            
            // If no mapping found, keep original but ensure it's a string
            return {
              ...attendee,
              memberId: String(oldMemberId || ''),
              member_id: String(oldMemberId || '')
            };
          });
          
          if (hasChanges) {
            fixed++;
            targetDb.run(
              'UPDATE meetings SET attendees = ? WHERE id = ?',
              [JSON.stringify(fixedAttendees), meeting.id],
              (updateErr) => {
                if (updateErr) {
                  console.error(`❌ Toplantı ${meeting.id} güncellenemedi:`, updateErr.message);
                } else {
                  console.log(`✅ Toplantı düzeltildi: ${meeting.name} (ID: ${meeting.id})`);
                }
                processed++;
                if (processed === meetings.length) {
                  console.log(`\n📊 Özet: ${fixed} toplantı düzeltildi, ${totalFixed} katılımcı ID'si güncellendi`);
                  resolve();
                }
              }
            );
          } else {
            processed++;
            if (processed === meetings.length) {
              console.log(`\n📊 Özet: ${fixed} toplantı düzeltildi, ${totalFixed} katılımcı ID'si güncellendi`);
              resolve();
            }
          }
        } catch (error) {
          console.error(`❌ Toplantı ${meeting.id} işlenirken hata:`, error.message);
          processed++;
          if (processed === meetings.length) {
            console.log(`\n📊 Özet: ${fixed} toplantı düzeltildi, ${totalFixed} katılımcı ID'si güncellendi`);
            resolve();
          }
        }
      });
    });
  });
}

// Main function
async function main() {
  try {
    console.log('\n🚀 Toplantı üye ID düzeltme işlemi başlatılıyor...\n');
    
    // Create member ID mapping
    const idMapping = await createMemberIdMapping();
    
    // Fix meeting attendees
    await fixMeetingAttendees(idMapping);
    
    console.log('\n✅ Toplantı üye ID düzeltme işlemi tamamlandı!');
    
  } catch (error) {
    console.error('\n❌ Hata:', error);
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

// Run
main();

