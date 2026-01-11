const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const sourceDbPath = path.join(require('os').homedir(), 'Desktop', 'ildatabase.sqlite');
const targetDbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('📦 Temsilci Verileri İçe Aktarma Başlatılıyor...');
console.log('Kaynak:', sourceDbPath);
console.log('Hedef:', targetDbPath);

const sourceDb = new sqlite3.Database(sourceDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Kaynak veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  }
  console.log('✅ Kaynak veritabanına bağlandı');
});

const targetDb = new sqlite3.Database(targetDbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Hedef veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  }
  console.log('✅ Hedef veritabanına bağlandı');
});

// Import neighborhood representatives
function importNeighborhoodRepresentatives() {
  return new Promise((resolve, reject) => {
    console.log('\n🏘️  Mahalle Temsilcileri içe aktarılıyor...');

    sourceDb.all('SELECT * FROM neighborhood_representatives', [], async (err, sourceReps) => {
      if (err) {
        console.error('❌ Mahalle temsilcileri okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceReps.length} mahalle temsilcisi bulundu`);

      if (sourceReps.length === 0) {
        console.log('⚠️  İçe aktarılacak mahalle temsilcisi bulunamadı');
        return resolve();
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      let processed = 0;

      for (const rep of sourceReps) {
        try {
          // Check if neighborhood exists in target database
          let targetNeighborhoodId = null;
          if (rep.neighborhood_id) {
            // First, get neighborhood name from source database
            const sourceNeighborhood = await new Promise((res, rej) => {
              sourceDb.get('SELECT name FROM neighborhoods WHERE id = ?', [rep.neighborhood_id], (err, row) => {
                if (err) rej(err);
                else res(row);
              });
            });

            if (sourceNeighborhood) {
              // Find matching neighborhood in target database by name
              const targetNeighborhood = await new Promise((res, rej) => {
                targetDb.get('SELECT id FROM neighborhoods WHERE name = ?', [sourceNeighborhood.name], (err, row) => {
                  if (err) rej(err);
                  else res(row);
                });
              });

              if (targetNeighborhood) {
                targetNeighborhoodId = targetNeighborhood.id;
              } else {
                console.warn(`⚠️  Mahalle bulunamadı: ${sourceNeighborhood.name} (Temsilci: ${rep.name})`);
                skipped++;
                processed++;
                if (processed === sourceReps.length) {
                  console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
                  resolve();
                }
                continue;
              }
            }
          }

          if (!targetNeighborhoodId) {
            console.warn(`⚠️  Mahalle ID bulunamadı (Temsilci: ${rep.name})`);
            skipped++;
            processed++;
            if (processed === sourceReps.length) {
              console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
              resolve();
            }
            continue;
          }

          // Check if representative already exists by TC
          const existing = await new Promise((res, rej) => {
            targetDb.get('SELECT id FROM neighborhood_representatives WHERE tc = ?', [rep.tc], (err, row) => {
              if (err) rej(err);
              else res(row);
            });
          });

          if (existing) {
            // Update existing representative
            await new Promise((res, rej) => {
              targetDb.run(
                'UPDATE neighborhood_representatives SET name = ?, phone = ?, neighborhood_id = ?, member_id = ? WHERE id = ?',
                [rep.name, rep.phone || null, targetNeighborhoodId, rep.member_id || null, existing.id],
                function(updateErr) {
                  if (updateErr) rej(updateErr);
                  else res();
                }
              );
            });
            updated++;
            console.log(`🔄 Mahalle temsilcisi güncellendi: ${rep.name} (TC: ${rep.tc})`);
          } else {
            // Insert new representative
            await new Promise((res, rej) => {
              targetDb.run(
                'INSERT INTO neighborhood_representatives (name, tc, phone, neighborhood_id, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [rep.name, rep.tc, rep.phone || null, targetNeighborhoodId, rep.member_id || null, rep.created_at || new Date().toISOString()],
                function(insertErr) {
                  if (insertErr) rej(insertErr);
                  else res();
                }
              );
            });
            imported++;
            console.log(`✅ Mahalle temsilcisi eklendi: ${rep.name} (TC: ${rep.tc})`);
          }
        } catch (itemError) {
          errors++;
          console.error(`❌ Mahalle temsilcisi içe aktarma hatası (${rep.name}):`, itemError.message);
        }

        processed++;
        if (processed === sourceReps.length) {
          console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
          resolve();
        }
      }
    });
  });
}

// Import village representatives
function importVillageRepresentatives() {
  return new Promise((resolve, reject) => {
    console.log('\n🏡 Köy Temsilcileri içe aktarılıyor...');

    sourceDb.all('SELECT * FROM village_representatives', [], async (err, sourceReps) => {
      if (err) {
        console.error('❌ Köy temsilcileri okunamadı:', err.message);
        return reject(err);
      }

      console.log(`📊 ${sourceReps.length} köy temsilcisi bulundu`);

      if (sourceReps.length === 0) {
        console.log('⚠️  İçe aktarılacak köy temsilcisi bulunamadı');
        return resolve();
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      let processed = 0;

      for (const rep of sourceReps) {
        try {
          // Check if village exists in target database
          let targetVillageId = null;
          if (rep.village_id) {
            // First, get village name from source database
            const sourceVillage = await new Promise((res, rej) => {
              sourceDb.get('SELECT name FROM villages WHERE id = ?', [rep.village_id], (err, row) => {
                if (err) rej(err);
                else res(row);
              });
            });

            if (sourceVillage) {
              // Find matching village in target database by name
              const targetVillage = await new Promise((res, rej) => {
                targetDb.get('SELECT id FROM villages WHERE name = ?', [sourceVillage.name], (err, row) => {
                  if (err) rej(err);
                  else res(row);
                });
              });

              if (targetVillage) {
                targetVillageId = targetVillage.id;
              } else {
                console.warn(`⚠️  Köy bulunamadı: ${sourceVillage.name} (Temsilci: ${rep.name})`);
                skipped++;
                processed++;
                if (processed === sourceReps.length) {
                  console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
                  resolve();
                }
                continue;
              }
            }
          }

          if (!targetVillageId) {
            console.warn(`⚠️  Köy ID bulunamadı (Temsilci: ${rep.name})`);
            skipped++;
            processed++;
            if (processed === sourceReps.length) {
              console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
              resolve();
            }
            continue;
          }

          // Check if representative already exists by TC
          const existing = await new Promise((res, rej) => {
            targetDb.get('SELECT id FROM village_representatives WHERE tc = ?', [rep.tc], (err, row) => {
              if (err) rej(err);
              else res(row);
            });
          });

          if (existing) {
            // Update existing representative
            await new Promise((res, rej) => {
              targetDb.run(
                'UPDATE village_representatives SET name = ?, phone = ?, village_id = ?, member_id = ? WHERE id = ?',
                [rep.name, rep.phone || null, targetVillageId, rep.member_id || null, existing.id],
                function(updateErr) {
                  if (updateErr) rej(updateErr);
                  else res();
                }
              );
            });
            updated++;
            console.log(`🔄 Köy temsilcisi güncellendi: ${rep.name} (TC: ${rep.tc})`);
          } else {
            // Insert new representative
            await new Promise((res, rej) => {
              targetDb.run(
                'INSERT INTO village_representatives (name, tc, phone, village_id, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [rep.name, rep.tc, rep.phone || null, targetVillageId, rep.member_id || null, rep.created_at || new Date().toISOString()],
                function(insertErr) {
                  if (insertErr) rej(insertErr);
                  else res();
                }
              );
            });
            imported++;
            console.log(`✅ Köy temsilcisi eklendi: ${rep.name} (TC: ${rep.tc})`);
          }
        } catch (itemError) {
          errors++;
          console.error(`❌ Köy temsilcisi içe aktarma hatası (${rep.name}):`, itemError.message);
        }

        processed++;
        if (processed === sourceReps.length) {
          console.log(`\n📊 Özet: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errors} hata`);
          resolve();
        }
      }
    });
  });
}

async function main() {
  try {
    console.log('\n🚀 Temsilci içe aktarma işlemi başlatılıyor...\n');
    
    await importNeighborhoodRepresentatives();
    await importVillageRepresentatives();
    
    console.log('\n✅ Temsilci içe aktarma işlemi tamamlandı!');
  } catch (error) {
    console.error('\n❌ Temsilci içe aktarma hatası:', error);
  } finally {
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

main();

