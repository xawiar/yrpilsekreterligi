// Firebase kullanıcılarını oluşturmak için utility fonksiyonları
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import FirebaseService from '../services/FirebaseService';
import { decryptData } from './crypto';

/**
 * Admin kullanıcısını Firebase Auth'a kaydet
 */
export async function createAdminUser() {
  try {
    const adminUsername = 'admin';
    const adminPassword = '1491aaa1491';
    const adminEmail = `${adminUsername}@sekreterlikapp.com`;

    console.log('🔐 Admin kullanıcısı oluşturuluyor...');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);

    let userCredential;

    try {
      // Firebase Auth'da kullanıcı oluştur
      userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      console.log('✅ Firebase Authentication kullanıcısı oluşturuldu:', userCredential.user.uid);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        // Kullanıcı zaten varsa giriş yap
        console.log('ℹ️ Kullanıcı zaten mevcut, giriş yapılıyor...');
        userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        console.log('✅ Giriş yapıldı:', userCredential.user.uid);
      } else {
        throw error;
      }
    }

    // Firestore'da admin bilgilerini kaydet
    const adminDocRef = doc(db, 'admin', 'main');

    await setDoc(adminDocRef, {
      username: adminUsername,
      email: adminEmail,
      uid: userCredential.user.uid,
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log('✅ Admin bilgileri Firestore\'a kaydedildi!');

    // Bağlantıyı test et
    const testDoc = await getDoc(adminDocRef);
    if (testDoc.exists()) {
      console.log('✅ Admin dokümanı başarıyla okundu:', testDoc.data());
      return {
        success: true,
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        uid: userCredential.user.uid
      };
    }

    return { success: false, message: 'Admin dokümanı okunamadı' };
  } catch (error) {
    console.error('❌ Admin kullanıcısı oluşturulurken hata:', error);
    return {
      success: false,
      message: error.message,
      code: error.code
    };
  }
}

/**
 * Tüm üye kullanıcılarını Firebase Auth'a kaydet
 */
export async function syncMemberUsersToFirebaseAuth() {
  try {
    console.log('🔄 Üye kullanıcıları Firebase Auth\'a aktarılıyor...');

    // Mevcut admin kullanıcısını koru
    const currentUser = auth.currentUser;
    const currentUserEmail = currentUser ? currentUser.email : null;
    const currentUserUid = currentUser ? currentUser.uid : null;

    // Admin bilgilerini al
    let adminEmail = 'admin@sekreterlikapp.com';
    let adminPassword = '1491aaa1491';
    try {
      const adminDoc = await FirebaseService.getById('admin', 'main');
      if (adminDoc && adminDoc.email) {
        adminEmail = adminDoc.email;
      }
    } catch (error) {
      console.warn('Admin bilgileri alınamadı, varsayılan kullanılıyor');
    }

    // Tüm üye kullanıcılarını al
    const memberUsers = await FirebaseService.getAll('member_users');
    const activeUsers = memberUsers.filter(user => user.isActive !== false);

    console.log(`📊 ${activeUsers.length} aktif üye kullanıcısı bulundu`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < activeUsers.length; i++) {
      const user = activeUsers[i];
      console.log(`[${i + 1}/${activeUsers.length}] İşleniyor: ${user.username}`);

      try {
        // Şifreyi decrypt et
        let password = user.password || '';
        if (password && typeof password === 'string' && password.startsWith('U2FsdGVkX1')) {
          password = decryptData(password);
        }

        if (!password) {
          errors.push(`${user.username}: Şifre bulunamadı`);
          errorCount++;
          continue;
        }

        // Email formatına çevir
        const email = user.username.includes('@') ? user.username : `${user.username}@sekreterlikapp.com`;

        // Eğer zaten authUid varsa, kullanıcı zaten Firebase Auth'da var
        if (user.authUid) {
          console.log(`ℹ️ User ${user.username} already has authUid: ${user.authUid}`);
          successCount++;
          continue;
        }

        // Firebase Auth'da kullanıcı oluştur
        try {
          const authUser = await createUserWithEmailAndPassword(auth, email, password);
          console.log(`✅ Firebase Auth user created: ${user.username} -> ${authUser.user.uid}`);

          // Firestore'da authUid'yi güncelle
          await FirebaseService.update('member_users', user.id, {
            authUid: authUser.user.uid
          }, true);

          successCount++;

          // Admin kullanıcısını geri yükle (eğer farklıysa)
          if (currentUserUid && currentUserUid !== authUser.user.uid && currentUserEmail === adminEmail) {
            try {
              await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
              console.log('✅ Admin user re-authenticated');
            } catch (signInError) {
              console.warn(`⚠️ Admin user re-authentication failed: ${signInError.message}`);
            }
          }
        } catch (authError) {
          if (authError.code === 'auth/email-already-in-use') {
            console.warn(`⚠️ Email already in use: ${email}`);
            successCount++;
          } else {
            errors.push(`${user.username}: ${authError.message}`);
            errorCount++;
            console.error(`❌ Error creating Firebase Auth user for ${user.username}:`, authError);
          }
        }
      } catch (error) {
        errors.push(`${user.username}: ${error.message}`);
        errorCount++;
        console.error(`❌ Error processing user ${user.username}:`, error);
      }
    }

    // Tüm kullanıcılar oluşturulduktan sonra admin kullanıcısını tekrar sign-in et
    if (currentUserEmail === adminEmail) {
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        console.log('✅ Admin user re-authenticated after all users created');
      } catch (signInError) {
        console.warn(`⚠️ Admin user re-authentication failed: ${signInError.message}`);
      }
    }

    console.log(`\n✅ Firebase Auth'a aktarım tamamlandı!`);
    console.log(`   • Başarılı: ${successCount} kullanıcı`);
    console.log(`   • Hata: ${errorCount} kullanıcı`);

    return {
      success: true,
      successCount,
      errorCount,
      errors
    };
  } catch (error) {
    console.error('❌ Firebase Auth\'a aktarım hatası:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

