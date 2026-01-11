/**
 * TC veya Telefon ile Üye Bulma Script'i
 * 
 * ⚠️ PASİFİZE EDİLDİ: Organization_id desteği kaldırıldı
 * Bu script tüm üyelerde arar (organization_id filtresi yok).
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

// TC'yi decrypt et
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

// TC'yi encrypt et (karşılaştırma için)
function encryptData(data) {
  if (!data) return null;
  try {
    const dataString = typeof data === 'string' ? data : String(data);
    return CryptoJS.AES.encrypt(dataString, ENCRYPTION_KEY).toString();
  } catch (error) {
    return data;
  }
}

async function findMember() {
  const TARGET_TC = '45645645645';
  const TARGET_PHONE = '05465695942';
  const TARGET_NAME = 'diva';
  const TARGET_SURNAME = 'test';
  
  console.log(`\n🔍 Üye aranıyor (tüm organization_id'lerde)...\n`);
  console.log(`   TC: ${TARGET_TC}`);
  console.log(`   Telefon: ${TARGET_PHONE}`);
  console.log(`   İsim: ${TARGET_NAME} ${TARGET_SURNAME}\n`);
  
  try {
    // Tüm üyeleri al (organization_id filtresi olmadan)
    const membersSnapshot = await firestore.collection('members').get();
    console.log(`📊 Toplam ${membersSnapshot.size} üye bulundu\n`);
    
    // TC'yi encrypt et (karşılaştırma için)
    const encryptedTc = encryptData(TARGET_TC);
    const normalizedPhone = TARGET_PHONE.replace(/\D/g, '');
    
    let foundMember = null;
    
    // Üyeyi bul
    for (const doc of membersSnapshot.docs) {
      const member = { id: doc.id, ...doc.data() };
      
      // TC'yi decrypt et
      let decryptedTc = member.tc;
      if (decryptedTc && decryptedTc.toString().startsWith('U2FsdGVkX1')) {
        decryptedTc = decryptData(decryptedTc);
      }
      
      // Telefon'u decrypt et ve normalize et
      let decryptedPhone = member.phone;
      if (decryptedPhone && decryptedPhone.toString().startsWith('U2FsdGVkX1')) {
        decryptedPhone = decryptData(decryptedPhone);
      }
      const normalizedDecryptedPhone = decryptedPhone ? decryptedPhone.replace(/\D/g, '') : '';
      
      // İsim kontrolü
      const nameMatch = member.name && member.name.toLowerCase().includes(TARGET_NAME.toLowerCase());
      const surnameMatch = member.surname && member.surname.toLowerCase().includes(TARGET_SURNAME.toLowerCase());
      
      // TC, telefon veya isim eşleşmesi kontrol et
      const tcMatch = decryptedTc === TARGET_TC || member.tc === TARGET_TC || member.tc === encryptedTc;
      const phoneMatch = normalizedDecryptedPhone === normalizedPhone || 
                        (member.phone && member.phone.replace(/\D/g, '') === normalizedPhone);
      
      if (tcMatch || phoneMatch || (nameMatch && surnameMatch)) {
        foundMember = member;
        console.log(`✅ Üye bulundu:`);
        console.log(`   ID: ${member.id}`);
        console.log(`   TC: ${decryptedTc || member.tc}`);
        console.log(`   Telefon: ${decryptedPhone || member.phone}`);
        console.log(`   İsim: ${member.name} ${member.surname}`);
        console.log(`   Organization ID: ${member.organization_id || 'YOK'}`);
        console.log(`   Archived: ${member.archived ? 'Evet' : 'Hayır'}`);
        
        // Üyeyi sil
        console.log(`\n🗑️  Üye siliniyor...`);
        
        // Önce member_users'da bu üyeye ait kullanıcıları bul ve sil
        const memberUsersSnapshot = await firestore.collection('member_users')
          .where('memberId', '==', foundMember.id)
          .get();
        
        console.log(`   ${memberUsersSnapshot.size} member_user kaydı bulundu`);
        
        for (const userDoc of memberUsersSnapshot.docs) {
          const userData = userDoc.data();
          console.log(`   - Member user siliniyor: ${userDoc.id} (username: ${userData.username})`);
          
          // Firebase Auth'dan da sil (eğer authUid varsa)
          if (userData.authUid) {
            try {
              await firebaseAdmin.auth().deleteUser(userData.authUid);
              console.log(`     ✅ Firebase Auth kullanıcısı silindi: ${userData.authUid}`);
            } catch (authError) {
              if (authError.code !== 'auth/user-not-found') {
                console.warn(`     ⚠️ Firebase Auth kullanıcısı silinemedi: ${authError.message}`);
              }
            }
          }
          
          await firestore.collection('member_users').doc(userDoc.id).delete();
          console.log(`     ✅ Member user silindi: ${userDoc.id}`);
        }
        
        // Üyeyi sil
        await firestore.collection('members').doc(foundMember.id).delete();
        console.log(`\n✅ Üye başarıyla silindi: ${foundMember.id}`);
        
        console.log(`\n📋 ÖZET:`);
        console.log(`   ✅ Üye silindi: ${foundMember.id}`);
        console.log(`   ✅ ${memberUsersSnapshot.size} member_user kaydı silindi`);
        
        break;
      }
    }
    
    if (!foundMember) {
      console.log('❌ Üye bulunamadı!');
      console.log('\n💡 Üye farklı bir organization_id\'ye ait olabilir veya zaten silinmiş olabilir.');
    }
    
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  }
}

// Run
findMember()
  .then(() => {
    console.log('\n✅ İşlem tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ İşlem başarısız:', error);
    process.exit(1);
  });

