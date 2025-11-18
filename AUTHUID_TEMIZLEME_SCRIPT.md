# AuthUid Temizleme Script - Düzeltilmiş Versiyon

## Kullanım

### 1. Site'de herhangi bir sayfada olun (login olmanıza gerek yok)

```
https://yrpilsekreterligi.onrender.com
```

### 2. Browser Console'u açın

- **Chrome/Edge**: `F12` → Console sekmesi
- **Firefox**: `F12` → Console sekmesi

### 3. Aşağıdaki script'i kopyalayın ve yapıştırın:

```javascript
(async function clearAllAuthUids() {
  try {
    console.log('🔄 AuthUid temizleme başlıyor...');
    
    // Sitedeki Firebase instance'larını kullan
    const { db } = await import('/src/config/firebase.js');
    const { collection, getDocs, updateDoc, doc, deleteField } = await import('firebase/firestore');
    
    if (!db) {
      console.error('❌ Firestore instance bulunamadı');
      alert('❌ Firestore bulunamadı. Lütfen sayfayı yenileyin ve tekrar deneyin.');
      return;
    }
    
    console.log('📦 Firestore bağlantısı başarılı');
    
    // Tüm member_users'ları al
    const querySnapshot = await getDocs(collection(db, 'member_users'));
    
    console.log(`📊 Toplam ${querySnapshot.size} kullanıcı bulundu`);
    
    let clearedCount = 0;
    let skipCount = 0;
    const errors = [];
    
    // Her kullanıcı için authUid temizle
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data();
      const username = data.username || docSnapshot.id;
      
      if (data.authUid) {
        try {
          await updateDoc(doc(db, 'member_users', docSnapshot.id), {
            authUid: deleteField()
          });
          clearedCount++;
          console.log(`✅ ${clearedCount}/${querySnapshot.size} - Temizlendi: ${username}`);
        } catch (error) {
          errors.push(`${username}: ${error.message}`);
          console.error(`❌ Hata (${username}):`, error.message);
        }
      } else {
        skipCount++;
        console.log(`⏭️ Atlandı (zaten yok): ${username}`);
      }
    }
    
    // Sonuç
    console.log('\n========================================');
    console.log('✅ TAMAMLANDI!');
    console.log(`📊 Temizlenen: ${clearedCount} authUid`);
    console.log(`⏭️ Atlanan: ${skipCount} (zaten yoktu)`);
    if (errors.length > 0) {
      console.log(`❌ Hata: ${errors.length}`);
      console.log('Hatalar:', errors);
    }
    console.log('========================================\n');
    
    alert(`✅ ${clearedCount} authUid temizlendi!\n\nŞimdi Settings → Üye Kullanıcıları → "Firebase Auth'a Senkronize Et" butonuna tıklayın.`);
    
  } catch (error) {
    console.error('❌ Script hatası:', error);
    alert('❌ Hata: ' + error.message + '\n\nDetaylar console\'da.');
  }
})();
```

### 4. Enter tuşuna basın

Script çalışacak ve ilerleme console'da görünecek.

### 5. Alert çıkınca

Settings → Üye Kullanıcıları → "Firebase Auth'a Senkronize Et" butonuna tıklayın.

---

## Alternatif: Daha Basit Script (Eğer yukarıdaki çalışmazsa)

```javascript
(async function() {
  try {
    // Direkt window üzerinden Firestore'a eriş
    const db = window.__firestore_db__;
    
    if (!db) {
      alert('❌ Firestore bulunamadı. Lütfen Settings sayfasına gidin ve tekrar deneyin.');
      return;
    }
    
    // Firebase SDK fonksiyonlarını import et
    const firestoreModule = await import('firebase/firestore');
    const { collection, getDocs, updateDoc, doc, deleteField } = firestoreModule;
    
    const querySnapshot = await getDocs(collection(db, 'member_users'));
    console.log(`📊 ${querySnapshot.size} kullanıcı bulundu`);
    
    let count = 0;
    for (const docSnap of querySnapshot.docs) {
      if (docSnap.data().authUid) {
        await updateDoc(doc(db, 'member_users', docSnap.id), {
          authUid: deleteField()
        });
        count++;
        console.log(`✅ ${count} - ${docSnap.data().username}`);
      }
    }
    
    alert(`✅ ${count} authUid temizlendi!`);
  } catch (e) {
    console.error(e);
    alert('Hata: ' + e.message);
  }
})();
```

## En Basit Yöntem: Firebase Console'dan Manuel

Eğer script'ler çalışmazsa:

1. Firebase Console → Firestore → `member_users`
2. Her kullanıcıyı tek tek açın
3. `authUid` field'ını bulun ve **SİL**
4. Tüm kullanıcılar için tekrarlayın

Sonra "Firebase Auth'a Senkronize Et" butonuna tıklayın.

