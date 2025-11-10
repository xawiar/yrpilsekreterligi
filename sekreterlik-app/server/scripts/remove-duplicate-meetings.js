const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('📦 Çift Toplantıları Temizleme Başlatılıyor...');
console.log('Veritabanı:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  }
  console.log('✅ Veritabanına bağlandı');
});

async function removeDuplicateMeetings() {
  try {
    console.log('\n🔍 Çift toplantılar aranıyor...');
    
    // Tüm toplantıları al
    const meetings = await new Promise((resolve, reject) => {
      db.all('SELECT id, name, date, archived FROM meetings WHERE archived = 0 OR archived IS NULL ORDER BY date DESC, name', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`📊 ${meetings.length} toplantı bulundu`);

    // Tarih ve adı aynı olan toplantıları bul
    const duplicates = [];
    const seen = new Map(); // key: "name|date"

    meetings.forEach(meeting => {
      const key = `${meeting.name}|${meeting.date}`;
      
      if (seen.has(key)) {
        // Duplicate bulundu
        const existing = seen.get(key);
        duplicates.push({
          key: key,
          original: existing,
          duplicate: meeting
        });
      } else {
        seen.set(key, meeting);
      }
    });

    console.log(`\n🔍 ${duplicates.length} çift toplantı bulundu`);

    if (duplicates.length === 0) {
      console.log('✅ Çift toplantı bulunamadı!');
      return;
    }

    // Duplicate'leri göster
    console.log('\n📋 Çift Toplantılar:');
    duplicates.forEach((dup, index) => {
      console.log(`\n${index + 1}. Toplantı: "${dup.original.name}" - Tarih: ${dup.original.date}`);
      console.log(`   Orijinal ID: ${dup.original.id}`);
      console.log(`   Çift ID: ${dup.duplicate.id}`);
    });

    // Duplicate'lerden birini sil (ID'si daha büyük olanı sil - daha yeni eklenmiş olabilir)
    let deleted = 0;
    let errors = 0;

    for (const dup of duplicates) {
      try {
        // ID'si daha büyük olanı sil (daha yeni eklenmiş olabilir)
        const toDelete = dup.duplicate.id > dup.original.id ? dup.duplicate : dup.original;
        const toKeep = dup.duplicate.id > dup.original.id ? dup.original : dup.duplicate;

        await new Promise((resolve, reject) => {
          db.run('DELETE FROM meetings WHERE id = ?', [toDelete.id], function(err) {
            if (err) reject(err);
            else resolve();
          });
        });

        deleted++;
        console.log(`✅ Silindi: ID ${toDelete.id} (Korunan: ID ${toKeep.id}) - "${toDelete.name}" - ${toDelete.date}`);
      } catch (error) {
        errors++;
        console.error(`❌ Silme hatası (ID: ${dup.duplicate.id}):`, error.message);
      }
    }

    console.log(`\n📊 Özet: ${deleted} toplantı silindi, ${errors} hata`);
    console.log('\n✅ İşlem tamamlandı!');
  } catch (error) {
    console.error('\n❌ İşlem hatası:', error);
  } finally {
    db.close((err) => {
      if (err) console.error('Veritabanı kapatılırken hata:', err.message);
      else {
        console.log('\n📦 Veritabanı bağlantısı kapatıldı');
        process.exit(0);
      }
    });
  }
}

removeDuplicateMeetings();

