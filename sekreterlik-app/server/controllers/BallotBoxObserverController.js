const { collections } = require('../config/database');
const db = require('../config/database');
const MemberUser = require('../models/MemberUser');
const { decryptField } = require('../utils/crypto');

class BallotBoxObserverController {
  static async getAll(req, res) {
    try {
      const observers = await db.all(`
        SELECT bbo.*, 
               bb.ballot_number,
               bb.institution_name,
               d.name as district_name,
               t.name as town_name,
               n.name as neighborhood_name,
               v.name as village_name,
               bbo.district_id as observer_district_id,
               bbo.town_id as observer_town_id,
               bbo.neighborhood_id as observer_neighborhood_id,
               bbo.village_id as observer_village_id
        FROM ballot_box_observers bbo
        LEFT JOIN ballot_boxes bb ON bbo.ballot_box_id = bb.id
        LEFT JOIN districts d ON bbo.district_id = d.id
        LEFT JOIN towns t ON bbo.town_id = t.id
        LEFT JOIN neighborhoods n ON bbo.neighborhood_id = n.id
        LEFT JOIN villages v ON bbo.village_id = v.id
        ORDER BY bb.ballot_number, bbo.is_chief_observer DESC, bbo.name
      `);
      res.json(observers);
    } catch (error) {
      console.error('Error fetching ballot box observers:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getByBallotBox(req, res) {
    try {
      const { ballotBoxId } = req.params;
      const observers = await db.all(`
        SELECT bbo.*, 
               bb.ballot_number,
               bb.institution_name
        FROM ballot_box_observers bbo
        LEFT JOIN ballot_boxes bb ON bbo.ballot_box_id = bb.id
        WHERE bbo.ballot_box_id = ?
        ORDER BY bbo.is_chief_observer DESC, bbo.name
      `, [ballotBoxId]);
      res.json(observers);
    } catch (error) {
      console.error('Error fetching observers by ballot box:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const observer = await db.get(`
        SELECT bbo.*, 
               bb.ballot_number,
               bb.institution_name,
               d.name as district_name,
               t.name as town_name,
               n.name as neighborhood_name,
               v.name as village_name
        FROM ballot_box_observers bbo
        LEFT JOIN ballot_boxes bb ON bbo.ballot_box_id = bb.id
        LEFT JOIN districts d ON bb.district_id = d.id
        LEFT JOIN towns t ON bb.town_id = t.id
        LEFT JOIN neighborhoods n ON bb.neighborhood_id = n.id
        LEFT JOIN villages v ON bb.village_id = v.id
        WHERE bbo.id = ?
      `, [id]);
      
      if (!observer) {
        return res.status(404).json({ message: 'Müşahit bulunamadı' });
      }
      
      res.json(observer);
    } catch (error) {
      console.error('Error fetching ballot box observer:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const { ballot_box_id, tc, name, phone, is_chief_observer, region_name, district_id, town_id, neighborhood_id, village_id } = req.body;

      // Validation
      const errors = [];
      if (!tc) errors.push('TC kimlik numarası zorunludur');
      if (!name) errors.push('Ad soyad zorunludur');
      if (!phone) errors.push('Telefon numarası zorunludur');
      
      if (tc && tc.length !== 11) {
        errors.push('TC kimlik numarası 11 haneli olmalıdır');
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası: ' + errors.join(', '), errors });
      }

      // Check if TC already exists
      const existingObserver = await db.get('SELECT * FROM ballot_box_observers WHERE tc = ?', [tc]);
      if (existingObserver) {
        return res.status(400).json({ message: 'Bu TC kimlik numarası zaten kayıtlı' });
      }

      // Check if there's already a chief observer for this ballot box
      if (is_chief_observer && ballot_box_id) {
        const existingChiefObserver = await db.get('SELECT * FROM ballot_box_observers WHERE ballot_box_id = ? AND is_chief_observer = 1', [ballot_box_id]);
        if (existingChiefObserver) {
          return res.status(400).json({ message: 'Bu sandıkta zaten bir başmüşahit bulunmaktadır' });
        }
      }

      const sql = `INSERT INTO ballot_box_observers 
                   (ballot_box_id, tc, name, phone, is_chief_observer, region_name, district_id, town_id, neighborhood_id, village_id) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      const result = await db.run(sql, [ballot_box_id, tc, name, phone, is_chief_observer ? 1 : 0, region_name || null, district_id || null, town_id || null, neighborhood_id || null, village_id || null]);
      
      // Update in-memory collection
      const newObserver = {
        id: result.lastID,
        ballot_box_id,
        tc,
        name,
        phone,
        is_chief_observer: is_chief_observer ? 1 : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      collections.ballot_box_observers.push(newObserver);
      
      // Başmüşahit eklenirken otomatik kullanıcı oluştur
      if (is_chief_observer) {
        try {
          // TC ile üye bul
          const members = await db.all('SELECT * FROM members WHERE archived = 0');
          const member = members.find(m => {
            const memberTc = decryptField(m.tc) || m.tc;
            return memberTc === tc;
          });

          if (member && member.id) {
            // Sandık numarasını kontrol et
            let username, password;
            if (ballot_box_id) {
              const ballotBox = await db.get('SELECT * FROM ballot_boxes WHERE id = ?', [ballot_box_id]);
              if (ballotBox && ballotBox.ballot_number) {
                // Sandık numarası var - Kullanıcı adı: sandık numarası, Şifre: TC
                username = String(ballotBox.ballot_number);
                password = tc;
              } else {
                // Sandık numarası yok - Kullanıcı adı: TC, Şifre: TC
                username = tc;
                password = tc;
              }
            } else {
              // Sandık numarası yok - Kullanıcı adı: TC, Şifre: TC
              username = tc;
              password = tc;
            }

            // Kullanıcı zaten var mı kontrol et
            const existingUser = await db.get('SELECT * FROM member_users WHERE member_id = ?', [member.id]);
            
            if (!existingUser) {
              // Kullanıcı yoksa oluştur
              await MemberUser.createMemberUser(member.id, username, password);
              console.log(`✅ Başmüşahit kullanıcısı oluşturuldu: Member ID: ${member.id}, Username: ${username}`);
            } else if (existingUser.username !== username) {
              // Kullanıcı varsa ama kullanıcı adı farklıysa güncelle
              await db.run('UPDATE member_users SET username = ?, password = ? WHERE id = ?', [username, password, existingUser.id]);
              console.log(`✅ Başmüşahit kullanıcı adı güncellendi: ${existingUser.username} -> ${username}`);
            }
          } else {
            console.warn(`⚠️ Başmüşahit için üye bulunamadı (TC: ${tc}), kullanıcı oluşturulmadı`);
          }
        } catch (userError) {
          console.error('❌ Başmüşahit kullanıcısı oluşturulurken hata:', userError);
          // Kullanıcı oluşturma hatası ana işlemi durdurmamalı
        }
      }
      
      res.status(201).json({ message: 'Müşahit başarıyla eklendi', observer: newObserver });
    } catch (error) {
      console.error('Error creating ballot box observer:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { ballot_box_id, tc, name, phone, is_chief_observer, region_name, district_id, town_id, neighborhood_id, village_id } = req.body;

      // Validation
      const errors = [];
      if (!tc) errors.push('TC kimlik numarası zorunludur');
      if (!name) errors.push('Ad soyad zorunludur');
      if (!phone) errors.push('Telefon numarası zorunludur');
      
      if (tc && tc.length !== 11) {
        errors.push('TC kimlik numarası 11 haneli olmalıdır');
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Doğrulama hatası: ' + errors.join(', '), errors });
      }

      // Get current observer to check ballot_box_id
      const currentObserver = await db.get('SELECT * FROM ballot_box_observers WHERE id = ?', [id]);
      if (!currentObserver) {
        return res.status(404).json({ message: 'Müşahit bulunamadı' });
      }

      // ballot_box_id değiştiyse yeni değeri kullan, değilse mevcut değeri koru
      const finalBallotBoxId = ballot_box_id !== undefined ? ballot_box_id : currentObserver.ballot_box_id;

      // Check if TC already exists for another observer in the same ballot box
      const existingObserver = await db.get('SELECT * FROM ballot_box_observers WHERE ballot_box_id = ? AND tc = ? AND id != ?', [finalBallotBoxId, tc, id]);
      if (existingObserver) {
        return res.status(400).json({ message: 'Bu TC kimlik numarası bu sandıkta başka bir müşahitte kayıtlı' });
      }

      // Check if there's already a chief observer for this ballot box (if changing to chief observer)
      if (is_chief_observer && !currentObserver.is_chief_observer) {
        const existingChiefObserver = await db.get('SELECT * FROM ballot_box_observers WHERE ballot_box_id = ? AND is_chief_observer = 1 AND id != ?', [finalBallotBoxId, id]);
        if (existingChiefObserver) {
          return res.status(400).json({ message: 'Bu sandıkta zaten bir başmüşahit bulunmaktadır' });
        }
      }

      const sql = `UPDATE ballot_box_observers 
                   SET ballot_box_id = ?, tc = ?, name = ?, phone = ?, is_chief_observer = ?, region_name = ?, district_id = ?, town_id = ?, neighborhood_id = ?, village_id = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
      
      await db.run(sql, [finalBallotBoxId, tc, name, phone, is_chief_observer ? 1 : 0, region_name || null, district_id || null, town_id || null, neighborhood_id || null, village_id || null, id]);
      
      // Update in-memory collection
      const observerIndex = collections.ballot_box_observers.findIndex(obs => obs.id === parseInt(id));
      if (observerIndex !== -1) {
        collections.ballot_box_observers[observerIndex] = {
          ...collections.ballot_box_observers[observerIndex],
          ballot_box_id: finalBallotBoxId,
          tc,
          name,
          phone,
          is_chief_observer: is_chief_observer ? 1 : 0,
          region_name: region_name || null,
          district_id: district_id || null,
          town_id: town_id || null,
          neighborhood_id: neighborhood_id || null,
          village_id: village_id || null,
          updated_at: new Date().toISOString()
        };
      }
      
      // Başmüşahit güncellenirken kullanıcı adını güncelle
      if (is_chief_observer) {
        try {
          // TC ile üye bul
          const members = await db.all('SELECT * FROM members WHERE archived = 0');
          const member = members.find(m => {
            const memberTc = decryptField(m.tc) || m.tc;
            return memberTc === tc;
          });

          if (member && member.id) {
            // Sandık numarasını kontrol et
            let username, password;
            if (finalBallotBoxId) {
              const ballotBox = await db.get('SELECT * FROM ballot_boxes WHERE id = ?', [finalBallotBoxId]);
              if (ballotBox && ballotBox.ballot_number) {
                // Sandık numarası var - Kullanıcı adı: sandık numarası, Şifre: TC
                username = String(ballotBox.ballot_number);
                password = tc;
              } else {
                // Sandık numarası yok - Kullanıcı adı: TC, Şifre: TC
                username = tc;
                password = tc;
              }
            } else {
              // Sandık numarası yok - Kullanıcı adı: TC, Şifre: TC
              username = tc;
              password = tc;
            }

            // Mevcut kullanıcıyı bul
            const existingUser = await db.get('SELECT * FROM member_users WHERE member_id = ?', [member.id]);
            
            if (!existingUser) {
              // Kullanıcı yoksa oluştur
              await MemberUser.createMemberUser(member.id, username, password);
              console.log(`✅ Başmüşahit kullanıcısı oluşturuldu: Member ID: ${member.id}, Username: ${username}`);
            } else if (existingUser.username !== username) {
              // Kullanıcı varsa ama kullanıcı adı farklıysa güncelle
              await db.run('UPDATE member_users SET username = ?, password = ? WHERE id = ?', [username, password, existingUser.id]);
              console.log(`✅ Başmüşahit kullanıcı adı güncellendi: ${existingUser.username} -> ${username}`);
            }
          } else {
            console.warn(`⚠️ Başmüşahit için üye bulunamadı (TC: ${tc}), kullanıcı oluşturulmadı`);
          }
        } catch (userError) {
          console.error('❌ Başmüşahit kullanıcısı güncellenirken hata:', userError);
          // Kullanıcı güncelleme hatası ana işlemi durdurmamalı
        }
      }
      
      res.json({ message: 'Müşahit başarıyla güncellendi' });
    } catch (error) {
      console.error('Error updating ballot box observer:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Önce müşahit bilgilerini al (Firebase Auth kullanıcısını silmek için)
      const observer = await db.get('SELECT * FROM ballot_box_observers WHERE id = ?', [id]);
      
      if (!observer) {
        return res.status(404).json({ message: 'Müşahit bulunamadı' });
      }
      
      // Müşahite ait member_user kayıtlarını bul ve sil (userType='musahit' ve observerId ile)
      // SQLite'da observerId kolonu yok, bu yüzden username ile eşleştirme yapacağız
      try {
        // TC'yi decrypt et
        const tc = decryptField(observer.tc) || observer.tc;
        
        // Sandık numarasını bul (username olarak kullanılıyor)
        let username = tc; // Varsayılan olarak TC
        if (observer.ballot_box_id) {
          const ballotBox = await db.get('SELECT * FROM ballot_boxes WHERE id = ?', [observer.ballot_box_id]);
          if (ballotBox && ballotBox.ballot_number) {
            username = String(ballotBox.ballot_number);
          }
        }
        
        // Username ile eşleşen member_user kayıtlarını bul
        const usersByUsername = await new Promise((resolve, reject) => {
          db.all('SELECT * FROM member_users WHERE username = ?', [username], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        // Her kullanıcı için Firebase Auth kullanıcısını sil ve member_user'ı sil
        for (const user of usersByUsername) {
          try {
            // Firebase Auth kullanıcısını sil (eğer varsa)
            if (user.auth_uid || user.authUid) {
              const authUid = user.auth_uid || user.authUid;
              try {
                const { getAdmin } = require('../config/firebaseAdmin');
                const firebaseAdmin = getAdmin();
                if (firebaseAdmin) {
                  await firebaseAdmin.auth().deleteUser(authUid);
                  console.log(`✅ Firebase Auth user deleted for observer ID ${id} (authUid: ${authUid})`);
                }
              } catch (authError) {
                if (authError.code !== 'auth/user-not-found') {
                  console.error(`⚠️ Error deleting Firebase Auth user for observer ID ${id}:`, authError.message);
                } else {
                  console.log(`ℹ️ Firebase Auth user already deleted for observer ID ${id}`);
                }
              }
            }
            
            // member_user'ı sil
            await MemberUser.deleteUser(user.id);
            console.log(`✅ Member user deleted for observer ID ${id} (user ID: ${user.id}, username: ${username})`);
          } catch (userError) {
            console.error(`❌ Error deleting member user ${user.id} for observer ID ${id}:`, userError);
            // Devam et, diğer kullanıcıları da silmeyi dene
          }
        }
      } catch (userError) {
        console.error(`❌ Error deleting member users for observer ID ${id}:`, userError);
        // Devam et, müşahit silme işlemini tamamla
      }
      
      // Müşahiti sil
      const sql = 'DELETE FROM ballot_box_observers WHERE id = ?';
      await db.run(sql, [id]);
      
      // Update in-memory collection
      const observerIndex = collections.ballot_box_observers.findIndex(obs => obs.id === parseInt(id));
      if (observerIndex !== -1) {
        collections.ballot_box_observers.splice(observerIndex, 1);
      }
      
      res.json({ message: 'Müşahit başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting ballot box observer:', error);
      res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
  }
}

module.exports = BallotBoxObserverController;
