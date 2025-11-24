/**
 * Üye 174'ü Silme Script'i
 */

require('dotenv').config();
const { getAdmin } = require('../config/firebaseAdmin');
const firebaseAdmin = getAdmin();

if (!firebaseAdmin) {
  console.error('Firebase Admin SDK initialize edilemedi');
  process.exit(1);
}

const firestore = firebaseAdmin.firestore();

(async () => {
  const memberId = '174';
  
  console.log(`\n🗑️  Üye siliniyor: ${memberId}\n`);
  
  try {
    // Member users'ı bul ve sil
    const usersSnapshot = await firestore.collection('member_users')
      .where('memberId', '==', memberId)
      .get();
    
    console.log(`   ${usersSnapshot.size} member_user kaydı bulundu`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      console.log(`   - Member user siliniyor: ${userDoc.id} (username: ${userData.username})`);
      
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
    await firestore.collection('members').doc(memberId).delete();
    console.log(`\n✅ Üye başarıyla silindi: ${memberId}`);
    
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
  
  process.exit(0);
})();

