/**
 * Tüm Üyeleri Listele Script'i
 * 
 * ⚠️ PASİFİZE EDİLDİ: Organization_id desteği kaldırıldı
 * Bu script tüm üyeleri listeler ve belirli bir üyeyi bulur.
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
    console.error('Decryption error:', error);
    return encryptedData;
  }
}

async function listAllMembers() {
  console.log(`\n🔍 Tüm üyeler listeleniyor...\n`);
  
  try {
    // Tüm üyeleri al
    const membersSnapshot = await firestore.collection('members').get();
    console.log(`📊 Toplam ${membersSnapshot.size} üye bulundu\n`);
    
    // Aranan üye bilgileri
    const searchTerms = ['45645645645', '05465695942', 'diva', 'test'];
    
    console.log('🔍 Aranan terimler:', searchTerms.join(', '));
    console.log('\n📋 Tüm üyeler:\n');
    
    let foundMembers = [];
    
    for (const doc of membersSnapshot.docs) {
      const member = { id: doc.id, ...doc.data() };
      
      // TC'yi decrypt et
      let decryptedTc = member.tc;
      if (decryptedTc && decryptedTc.toString().startsWith('U2FsdGVkX1')) {
        decryptedTc = decryptData(decryptedTc);
      }
      
      // Telefon'u decrypt et
      let decryptedPhone = member.phone;
      if (decryptedPhone && decryptedPhone.toString().startsWith('U2FsdGVkX1')) {
        decryptedPhone = decryptData(decryptedPhone);
      }
      
      // Arama terimlerini kontrol et
      const memberString = `${decryptedTc} ${decryptedPhone} ${member.name} ${member.surname}`.toLowerCase();
      const matches = searchTerms.some(term => memberString.includes(term.toLowerCase()));
      
      if (matches) {
        foundMembers.push(member);
        console.log(`✅ BULUNDU:`);
        console.log(`   ID: ${member.id}`);
        console.log(`   TC: ${decryptedTc || member.tc}`);
        console.log(`   Telefon: ${decryptedPhone || member.phone}`);
        console.log(`   İsim: ${member.name} ${member.surname}`);
        console.log(`   Organization ID: ${member.organization_id || 'YOK'}`);
        console.log(`   Archived: ${member.archived ? 'Evet' : 'Hayır'}`);
        console.log('');
      } else {
        // Tüm üyeleri göster
        console.log(`   ${member.id}: ${member.name} ${member.surname} (TC: ${decryptedTc?.substring(0, 3)}***, Phone: ${decryptedPhone?.substring(0, 3)}***, Org: ${member.organization_id || 'YOK'})`);
      }
    }
    
    if (foundMembers.length === 0) {
      console.log('\n❌ Arama terimleriyle eşleşen üye bulunamadı!');
      console.log('\n💡 Tüm üyeleri görmek için script\'i güncelleyin.');
    } else {
      console.log(`\n📊 ${foundMembers.length} eşleşen üye bulundu.`);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  }
}

// Run
listAllMembers()
  .then(() => {
    console.log('\n✅ İşlem tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ İşlem başarısız:', error);
    process.exit(1);
  });

