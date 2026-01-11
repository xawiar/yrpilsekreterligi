const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { decryptField } = require('../utils/crypto');

// Desktop database path
const desktopDbPath = path.join(require('os').homedir(), 'Desktop', 'ildatabase.sqlite');

console.log('📦 Firebase Üye Verileri Güncelleme Başlatılıyor...');
console.log('Kaynak:', desktopDbPath);

const desktopDb = new sqlite3.Database(desktopDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Desktop veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  }
  console.log('✅ Desktop veritabanına bağlandı');
});

async function getMembersFromDesktop() {
  return new Promise((resolve, reject) => {
    desktopDb.all('SELECT id, tc, phone, name FROM members WHERE archived = 0 OR archived IS NULL', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function updateFirebaseMember(memberId, tc, phone) {
  try {
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
    const response = await fetch(`${API_BASE_URL}/api/members/${memberId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tc: tc,
        phone: phone
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Firebase update error for member ${memberId}:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('\n🚀 Üye verileri güncelleme işlemi başlatılıyor...\n');
    
    // Desktop database'den üyeleri al
    const desktopMembers = await getMembersFromDesktop();
    console.log(`📊 ${desktopMembers.length} üye bulundu`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const member of desktopMembers) {
      try {
        // TC ve telefon decrypt et
        const tc = decryptField(member.tc) || member.tc || '';
        const phone = decryptField(member.phone) || member.phone || '';
        
        if (!tc || !phone) {
          console.warn(`⚠️ Üye atlandı (ID: ${member.id}, Name: ${member.name}): TC veya telefon yok`);
          skipped++;
          continue;
        }
        
        // Firebase'deki üyeyi güncelle
        await updateFirebaseMember(member.id, tc, phone);
        updated++;
        console.log(`✅ Üye güncellendi: ${member.name} (ID: ${member.id}, TC: ${tc})`);
      } catch (error) {
        errors++;
        console.error(`❌ Üye güncelleme hatası (ID: ${member.id}):`, error.message);
      }
    }
    
    console.log(`\n📊 Özet: ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
    console.log('\n✅ İşlem tamamlandı!');
  } catch (error) {
    console.error('\n❌ İşlem hatası:', error);
  } finally {
    desktopDb.close((err) => {
      if (err) console.error('Veritabanı kapatılırken hata:', err.message);
      else {
        console.log('\n📦 Veritabanı bağlantısı kapatıldı');
        process.exit(0);
      }
    });
  }
}

main();

