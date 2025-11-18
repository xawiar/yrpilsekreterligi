# Browser Console Script - AuthUid Temizleme

## Adımlar

### 1. Site'i açın ve login olun

```
https://yrpilsekreterligi.onrender.com/login
```

Admin olarak giriş yapın (veya herhangi bir kullanıcı ile).

### 2. Browser Console'u açın

- **Chrome/Edge**: `F12` veya `Ctrl+Shift+J` (Mac: `Cmd+Option+J`)
- **Firefox**: `F12` veya `Ctrl+Shift+K` (Mac: `Cmd+Option+K`)
- **Safari**: `Cmd+Option+C`

### 3. Aşağıdaki script'i kopyalayın ve console'a yapıştırın

```javascript
(async function clearAllAuthUids() {
  try {
    console.log('🔄 AuthUid temizleme başlıyor...');
    
    // Firebase modüllerini import et
    const { getFirestore, collection, getDocs, updateDoc, doc, deleteField } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { initializeApp, getApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    
    // Mevcut Firebase app'i kullan
    let app;
    try {
      app = getApp();
    } catch (e) {
      console.error('❌ Firebase app bulunamadı. Lütfen önce giriş yapın.');
      return;
    }
    
    // Firestore instance
    const db = getFirestore(app, 'yrpilsekreterligi');
    
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
    
    alert(`✅ ${clearedCount} authUid temizlendi!\n\nŞimdi "Firebase Auth'a Senkronize Et" butonuna tıklayın.`);
    
  } catch (error) {
    console.error('❌ Script hatası:', error);
    alert('❌ Hata: ' + error.message);
  }
})();
```

### 4. Enter tuşuna basın

Script çalışacak ve her kullanıcı için:
```
✅ 1/5 - Temizlendi: 12345678901
✅ 2/5 - Temizlendi: 98765432109
...
```

### 5. Tamamlandığında alert görünecek

```
✅ X authUid temizlendi!

Şimdi "Firebase Auth'a Senkronize Et" butonuna tıklayın.
```

### 6. "Firebase Auth'a Senkronize Et" butonuna tıklayın

Settings → Üye Kullanıcıları → "Firebase Auth'a Senkronize Et"

### 7. Sonuç kontrol

Firebase Console → Authentication → Users

Kullanıcılar `...@ilsekreterlik.local` email'leri ile görünmeli.

## Sorun Yaşarsanız

Eğer script çalışmazsa:
- `Console` sekmesinde olduğunuzdan emin olun
- Tam olarak kopyalayıp yapıştırdığınızdan emin olun
- Hata mesajını paylaşın

## Not

Bu script sadece Firestore'daki `authUid` field'larını temizler. Firebase Auth'da işlem yapmaz. Güvenlidir.

