const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Source database (masaüstündeki dosya)
const sourceDbPath = path.join(require('os').homedir(), 'Desktop', 'ildatabase.sqlite');

// Target database (mevcut proje veritabanı)
const targetDbPath = path.join(__dirname, 'database.sqlite');

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

// Import regions
function importRegions() {
  return new Promise((resolve, reject) => {
    console.log('\n🌍 Bölgeler içe aktarılıyor...');
    
    sourceDb.all('SELECT * FROM regions', [], (err, sourceRegions) => {
      if (err) {
        console.error('❌ Bölgeler okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceRegions.length} bölge bulundu`);

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      if (sourceRegions.length === 0) {
        console.log('⚠️  İçe aktarılacak bölge bulunamadı');
        return resolve();
      }

      let processed = 0;

      sourceRegions.forEach((region) => {
        // Check if region already exists by name
        targetDb.get('SELECT id FROM regions WHERE name = ?', [region.name], (err, existing) => {
          if (err) {
            console.error(`❌ Bölge kontrolü hatası (${region.name}):`, err.message);
            errors++;
            processed++;
            if (processed === sourceRegions.length) {
              console.log(`\n✅ Bölge içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          if (existing) {
            console.log(`⏭️  Bölge atlandı (zaten var): ${region.name}`);
            skipped++;
            processed++;
            if (processed === sourceRegions.length) {
              console.log(`\n✅ Bölge içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          // Insert new region
          targetDb.run('INSERT INTO regions (name) VALUES (?)', [region.name], function(err) {
            if (err) {
              console.error(`❌ Bölge eklenemedi (${region.name}):`, err.message);
              errors++;
            } else {
              console.log(`✅ Bölge eklendi: ${region.name}`);
              imported++;
            }

            processed++;
            if (processed === sourceRegions.length) {
              console.log(`\n✅ Bölge içe aktarma tamamlandı:`);
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

// Import positions
function importPositions() {
  return new Promise((resolve, reject) => {
    console.log('\n💼 Görevler içe aktarılıyor...');
    
    sourceDb.all('SELECT * FROM positions', [], (err, sourcePositions) => {
      if (err) {
        console.error('❌ Görevler okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourcePositions.length} görev bulundu`);

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      if (sourcePositions.length === 0) {
        console.log('⚠️  İçe aktarılacak görev bulunamadı');
        return resolve();
      }

      let processed = 0;

      sourcePositions.forEach((position) => {
        // Check if position already exists by name
        targetDb.get('SELECT id FROM positions WHERE name = ?', [position.name], (err, existing) => {
          if (err) {
            console.error(`❌ Görev kontrolü hatası (${position.name}):`, err.message);
            errors++;
            processed++;
            if (processed === sourcePositions.length) {
              console.log(`\n✅ Görev içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          if (existing) {
            console.log(`⏭️  Görev atlandı (zaten var): ${position.name}`);
            skipped++;
            processed++;
            if (processed === sourcePositions.length) {
              console.log(`\n✅ Görev içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          // Insert new position
          targetDb.run('INSERT INTO positions (name) VALUES (?)', [position.name], function(err) {
            if (err) {
              console.error(`❌ Görev eklenemedi (${position.name}):`, err.message);
              errors++;
            } else {
              console.log(`✅ Görev eklendi: ${position.name}`);
              imported++;
            }

            processed++;
            if (processed === sourcePositions.length) {
              console.log(`\n✅ Görev içe aktarma tamamlandı:`);
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

// Import districts
function importDistricts() {
  return new Promise((resolve, reject) => {
    console.log('\n🏛️  İlçeler içe aktarılıyor...');
    
    sourceDb.all('SELECT * FROM districts', [], (err, sourceDistricts) => {
      if (err) {
        console.error('❌ İlçeler okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceDistricts.length} ilçe bulundu`);

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      if (sourceDistricts.length === 0) {
        console.log('⚠️  İçe aktarılacak ilçe bulunamadı');
        return resolve();
      }

      let processed = 0;

      sourceDistricts.forEach((district) => {
        // Check if district already exists by name
        targetDb.get('SELECT id FROM districts WHERE name = ?', [district.name], (err, existing) => {
          if (err) {
            console.error(`❌ İlçe kontrolü hatası (${district.name}):`, err.message);
            errors++;
            processed++;
            if (processed === sourceDistricts.length) {
              console.log(`\n✅ İlçe içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          if (existing) {
            console.log(`⏭️  İlçe atlandı (zaten var): ${district.name}`);
            skipped++;
            processed++;
            if (processed === sourceDistricts.length) {
              console.log(`\n✅ İlçe içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          // Insert new district
          targetDb.run('INSERT INTO districts (name, created_at) VALUES (?, ?)', 
            [district.name, district.created_at || new Date().toISOString()], 
            function(err) {
              if (err) {
                console.error(`❌ İlçe eklenemedi (${district.name}):`, err.message);
                errors++;
              } else {
                console.log(`✅ İlçe eklendi: ${district.name}`);
                imported++;
              }

              processed++;
              if (processed === sourceDistricts.length) {
                console.log(`\n✅ İlçe içe aktarma tamamlandı:`);
                console.log(`   - İçe aktarılan: ${imported}`);
                console.log(`   - Atlanan (zaten var): ${skipped}`);
                console.log(`   - Hatalar: ${errors}`);
                resolve();
              }
            }
          );
        });
      });
    });
  });
}

// Import towns (beldeler)
function importTowns() {
  return new Promise((resolve, reject) => {
    console.log('\n🏘️  Beldeler içe aktarılıyor...');
    
    sourceDb.all('SELECT t.*, d.name as district_name FROM towns t LEFT JOIN districts d ON t.district_id = d.id', [], (err, sourceTowns) => {
      if (err) {
        console.error('❌ Beldeler okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceTowns.length} belde bulundu`);

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      if (sourceTowns.length === 0) {
        console.log('⚠️  İçe aktarılacak belde bulunamadı');
        return resolve();
      }

      let processed = 0;

      sourceTowns.forEach((town) => {
        // First, find the district ID in target database by name
        targetDb.get('SELECT id FROM districts WHERE name = ?', [town.district_name], (err, district) => {
          if (err || !district) {
            console.error(`❌ İlçe bulunamadı (${town.district_name}):`, err?.message || 'İlçe bulunamadı');
            errors++;
            processed++;
            if (processed === sourceTowns.length) {
              console.log(`\n✅ Belde içe aktarma tamamlandı:`);
              console.log(`   - İçe aktarılan: ${imported}`);
              console.log(`   - Atlanan (zaten var): ${skipped}`);
              console.log(`   - Hatalar: ${errors}`);
              resolve();
            }
            return;
          }

          // Check if town already exists by name and district_id
          targetDb.get('SELECT id FROM towns WHERE name = ? AND district_id = ?', 
            [town.name, district.id], 
            (err, existing) => {
              if (err) {
                console.error(`❌ Belde kontrolü hatası (${town.name}):`, err.message);
                errors++;
                processed++;
                if (processed === sourceTowns.length) {
                  console.log(`\n✅ Belde içe aktarma tamamlandı:`);
                  console.log(`   - İçe aktarılan: ${imported}`);
                  console.log(`   - Atlanan (zaten var): ${skipped}`);
                  console.log(`   - Hatalar: ${errors}`);
                  resolve();
                }
                return;
              }

              if (existing) {
                console.log(`⏭️  Belde atlandı (zaten var): ${town.name} (${town.district_name})`);
                skipped++;
                processed++;
                if (processed === sourceTowns.length) {
                  console.log(`\n✅ Belde içe aktarma tamamlandı:`);
                  console.log(`   - İçe aktarılan: ${imported}`);
                  console.log(`   - Atlanan (zaten var): ${skipped}`);
                  console.log(`   - Hatalar: ${errors}`);
                  resolve();
                }
                return;
              }

              // Insert new town
              targetDb.run('INSERT INTO towns (name, district_id, created_at) VALUES (?, ?, ?)', 
                [town.name, district.id, town.created_at || new Date().toISOString()], 
                function(err) {
                  if (err) {
                    console.error(`❌ Belde eklenemedi (${town.name}):`, err.message);
                    errors++;
                  } else {
                    console.log(`✅ Belde eklendi: ${town.name} (${town.district_name})`);
                    imported++;
                  }

                  processed++;
                  if (processed === sourceTowns.length) {
                    console.log(`\n✅ Belde içe aktarma tamamlandı:`);
                    console.log(`   - İçe aktarılan: ${imported}`);
                    console.log(`   - Atlanan (zaten var): ${skipped}`);
                    console.log(`   - Hatalar: ${errors}`);
                    resolve();
                  }
                }
              );
            }
          );
        });
      });
    });
  });
}

// Main import function
async function main() {
  try {
    console.log('\n🚀 İçe aktarma işlemi başlatılıyor...\n');
    
    // Import regions first
    await importRegions();
    
    // Import positions
    await importPositions();
    
    // Import districts
    await importDistricts();
    
    // Import towns (beldeler)
    await importTowns();
    
    // Import members
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

