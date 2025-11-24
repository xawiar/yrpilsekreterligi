/**
 * Arşivlenmiş Üyeleri Kontrol Script'i
 * 
 * ⚠️ PASİFİZE EDİLDİ: Organization_id desteği kaldırıldı
 */

// dotenv yükle (eğer varsa)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv yoksa devam et
}

const { getAdmin } = require('../config/firebaseAdmin');
const firebaseAdmin = getAdmin();

if (!firebaseAdmin) {
  console.error('❌ Firebase Admin SDK initialize edilemedi.');
  process.exit(1);
}

const firestore = firebaseAdmin.firestore();

const CryptoJS = require('crypto-js');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  'ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security';

function decryptData(encryptedData) {
  if (!encryptedData || !encryptedData.toString().startsWith('U2FsdGVkX1')) {
    return encryptedData;
  }
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData.toString(), ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    return encryptedData;
  }
}

async function checkArchivedMembers() {
  const TARGET_TC = '45645645645';
  const TARGET_PHONE = '05465695942';
  
  console.log(`\n🔍 Arşivlenmiş üyeler kontrol ediliyor...\n`);
  
  try {
    // Tüm üyeleri al
    const membersSnapshot = await firestore.collection('members').get();
    
    const normalizedPhone = TARGET_PHONE.replace(/\D/g, '');
    
    for (const doc of membersSnapshot.docs) {
      const member = { id: doc.id, ...doc.data() };
      
      // Sadece arşivlenmiş üyeleri kontrol et
      if (!member.archived && member.archived !== true) {
        continue;
      }
      
      let decryptedTc = member.tc;
      if (decryptedTc && decryptedTc.toString().startsWith('U2FsdGVkX1')) {
        decryptedTc = decryptData(decryptedTc);
      }
      
      let decryptedPhone = member.phone;
      if (decryptedPhone && decryptedPhone.toString().startsWith('U2FsdGVkX1')) {
        decryptedPhone = decryptData(decryptedPhone);
      }
      const normalizedDecryptedPhone = decryptedPhone ? decryptedPhone.replace(/\D/g, '') : '';
      
      const tcMatch = decryptedTc === TARGET_TC;
      const phoneMatch = normalizedDecryptedPhone === normalizedPhone;
      
      if (tcMatch || phoneMatch) {
        console.log(`✅ Arşivlenmiş üye bulundu:`);
        console.log(`   ID: ${member.id}`);
        console.log(`   TC: ${decryptedTc || member.tc}`);
        console.log(`   Telefon: ${decryptedPhone || member.phone}`);
        console.log(`   İsim: ${member.name} ${member.surname}`);
        console.log(`   Organization ID: ${member.organization_id || 'YOK'}`);
        
        // Üyeyi kalıcı olarak sil
        console.log(`\n🗑️  Üye kalıcı olarak siliniyor...`);
        
        // member_users'ı sil
        const memberUsersSnapshot = await firestore.collection('member_users')
          .where('memberId', '==', member.id)
          .get();
        
        for (const userDoc of memberUsersSnapshot.docs) {
          const userData = userDoc.data();
          if (userData.authUid) {
            try {
              await firebaseAdmin.auth().deleteUser(userData.authUid);
            } catch (e) {}
          }
          await firestore.collection('member_users').doc(userDoc.id).delete();
        }
        
        await firestore.collection('members').doc(member.id).delete();
        console.log(`✅ Üye kalıcı olarak silindi: ${member.id}`);
        return;
      }
    }
    
    console.log('❌ Arşivlenmiş üyeler arasında bulunamadı!');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  }
}

checkArchivedMembers()
  .then(() => {
    console.log('\n✅ İşlem tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ İşlem başarısız:', error);
    process.exit(1);
  });

