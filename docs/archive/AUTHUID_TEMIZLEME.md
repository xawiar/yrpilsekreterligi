# AuthUid Temizleme - Firebase Auth Kullanıcılarını Yeniden Oluşturma

## Sorun

Firestore'daki `member_users` collection'ında kullanıcıların `authUid` field'ı var, ancak Firebase Auth'da bu UID'lere sahip kullanıcılar yok.

Bu durumda "Firebase Auth'a Senkronize Et" butonu şu mesajı gösteriyor:
```
ℹ️ User ... already has authUid: ...
```

Ve kullanıcıyı Firebase Auth'da oluşturmuyor (zaten var sanıyor).

## Çözüm

Firestore'daki tüm `authUid` field'larını temizleyin, sonra yeniden senkronize edin.

### Yöntem 1: Firebase Console'dan Manuel Temizleme

1. **Firebase Console → Firestore**:
   - https://console.firebase.google.com/project/spilsekreterligi/firestore
   - Database: `yrpilsekreterligi`
   - Collection: `member_users`

2. **Her kullanıcı için**:
   - Kullanıcı dokümanını açın
   - `authUid` field'ını bulun
   - `authUid` field'ını **SİLİN** (Delete field)
   - Save

3. **Tüm kullanıcılar için tekrarlayın**

4. **Sonra frontend'den**:
   - "Firebase Auth'a Senkronize Et" butonuna tıklayın
   - Artık kullanıcılar Firebase Auth'da oluşacak

### Yöntem 2: Firestore Rules ile Toplu Güncelleme (Hızlı)

Firebase Console → Firestore → Rules sekmesine gidin ve geçici olarak write izni verin:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // GEÇİCİ - Sonra kaldırılmalı
    }
  }
}
```

Sonra browser console'da şu script'i çalıştırın:

```javascript
// Firestore import
const { getFirestore, collection, getDocs, updateDoc, doc, deleteField } = await import('firebase/firestore');
const { db } = await import('./src/config/firebase');

// Tüm member_users'ları al
const querySnapshot = await getDocs(collection(db, 'member_users'));

let count = 0;
for (const docSnapshot of querySnapshot.docs) {
  const data = docSnapshot.data();
  if (data.authUid) {
    await updateDoc(doc(db, 'member_users', docSnapshot.id), {
      authUid: deleteField()
    });
    count++;
    console.log(`✅ Cleared authUid for: ${data.username || docSnapshot.id}`);
  }
}

console.log(`✅ Cleared ${count} authUid fields`);
```

### Yöntem 3: Backend Script (En Hızlı)

Backend'de bir script oluşturup çalıştırın:

```javascript
// scripts/clear-auth-uids.js
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // veya environment variable'dan

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function clearAuthUids() {
  const snapshot = await firestore.collection('member_users').get();
  
  let count = 0;
  const batch = firestore.batch();
  
  snapshot.forEach(doc => {
    if (doc.data().authUid) {
      batch.update(doc.ref, { authUid: admin.firestore.FieldValue.delete() });
      count++;
    }
  });
  
  await batch.commit();
  console.log(`✅ Cleared ${count} authUid fields`);
  process.exit(0);
}

clearAuthUids();
```

Çalıştırın:
```bash
cd sekreterlik-app/server
node scripts/clear-auth-uids.js
```

## Sonraki Adımlar

AuthUid'leri temizledikten sonra:

1. **Admin kullanıcısını oluşturun** (Firebase Console'dan):
   - Email: `admin@ilsekreterlik.local`
   - Password: `admin123`
   - Firestore'da `admin` collection → `main` document'e UID ekleyin

2. **Frontend'den login yapın**

3. **"Firebase Auth'a Senkronize Et" butonuna tıklayın**:
   - Artık authUid'ler temiz olduğu için kullanıcıları oluşturacak

## Test

Senkronizasyon tamamlandıktan sonra:
- Firebase Console → Authentication → Users
- Kullanıcılar görünmeli (`...@ilsekreterlik.local` email'leri ile)

