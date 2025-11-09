const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// This script will output the meetings data in a format that can be used for Firebase sync
// The actual Firebase sync should be done from the client side via SyncToFirebasePage

async function getMeetingsForFirebase() {
  return new Promise((resolve, reject) => {
    console.log('\n📅 Toplantılar Firebase için hazırlanıyor...\n');
    
    db.all('SELECT * FROM meetings WHERE archived = 0 OR archived IS NULL ORDER BY date DESC', [], (err, meetings) => {
      if (err) {
        console.error('❌ Toplantılar okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${meetings.length} toplantı bulundu\n`);

      const processedMeetings = meetings.map(meeting => {
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
            attendees = attendees.map(attendee => {
              const memberId = attendee.memberId || attendee.member_id;
              return {
                ...attendee,
                memberId: String(memberId || ''),
                member_id: String(memberId || '')
              };
            });
          }
        } catch (e) {
          console.warn(`⚠️  Toplantı ${meeting.id} attendees parse hatası:`, e.message);
        }

        return {
          ...meeting,
          id: String(meeting.id),
          regions: regions,
          attendees: attendees
        };
      });

      // Check member IDs
      console.log('🔍 Üye ID kontrolü yapılıyor...\n');
      
      db.all('SELECT id FROM members WHERE archived = 0 OR archived IS NULL', [], (err, members) => {
        if (err) {
          console.warn('⚠️  Üyeler okunamadı:', err.message);
        } else {
          const memberIds = new Set(members.map(m => String(m.id)));
          
          let totalAttendees = 0;
          let matchedAttendees = 0;
          let unmatchedAttendees = 0;
          
          processedMeetings.forEach(meeting => {
            if (meeting.attendees && Array.isArray(meeting.attendees)) {
              meeting.attendees.forEach(attendee => {
                totalAttendees++;
                const memberId = String(attendee.memberId || '');
                if (memberId && memberIds.has(memberId)) {
                  matchedAttendees++;
                } else {
                  unmatchedAttendees++;
                  if (unmatchedAttendees <= 5) {
                    console.log(`⚠️  Eşleşmeyen üye ID: ${memberId} (Toplantı: ${meeting.name})`);
                  }
                }
              });
            }
          });
          
          console.log(`\n📊 Üye ID Eşleştirme Sonuçları:`);
          console.log(`   Toplam katılımcı: ${totalAttendees}`);
          console.log(`   Eşleşen: ${matchedAttendees}`);
          console.log(`   Eşleşmeyen: ${unmatchedAttendees}`);
          if (unmatchedAttendees > 5) {
            console.log(`   ... ve ${unmatchedAttendees - 5} eşleşmeyen daha`);
          }
        }
        
        console.log(`\n✅ ${processedMeetings.length} toplantı Firebase için hazırlandı`);
        console.log('\n💡 Şimdi /sync-to-firebase sayfasından Firebase\'e aktarabilirsiniz.\n');
        
        resolve(processedMeetings);
      });
    });
  });
}

// Main function
async function main() {
  try {
    const meetings = await getMeetingsForFirebase();
    
    // Output sample meeting data
    if (meetings.length > 0) {
      console.log('\n📋 Örnek Toplantı Verisi:');
      const sample = meetings[0];
      console.log(`   ID: ${sample.id}`);
      console.log(`   Adı: ${sample.name}`);
      console.log(`   Tarih: ${sample.date}`);
      console.log(`   Bölgeler: ${sample.regions ? sample.regions.length : 0}`);
      console.log(`   Katılımcılar: ${sample.attendees ? sample.attendees.length : 0}`);
      if (sample.attendees && sample.attendees.length > 0) {
        console.log(`   İlk katılımcı memberId: ${sample.attendees[0].memberId} (tip: ${typeof sample.attendees[0].memberId})`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Hata:', error);
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

