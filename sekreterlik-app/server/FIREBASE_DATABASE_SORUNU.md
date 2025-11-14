# Firebase Database Sorunu ve Çözümü

## Sorun

Firebase Admin SDK'da "NOT_FOUND" (kod 5) hatası alınıyor. Bu hatanın nedeni:

1. **Frontend** `yrpilsekreterligi` database'ini kullanıyor (`firebase.js` dosyasında `FIRESTORE_DATABASE_NAME = 'yrpilsekreterligi'`)
2. **Backend (Firebase Admin SDK)** varsayılan `(default)` database'ini kullanıyor
3. Bu iki database farklı olduğu için backend frontend'in kullandığı database'e erişemiyor

## Çözüm Seçenekleri

### Seçenek 1: Firebase Console'da Database Ayarları (Önerilen)

1. Firebase Console'a gidin: https://console.firebase.google.com/
2. Projenizi seçin: `spilsekreterligi`
3. **Firestore Database** > **Databases** sekmesine gidin
4. `yrpilsekreterligi` database'ini bulun
5. Database'in yanındaki **⋮** (üç nokta) menüsüne tıklayın
6. **Set as default database** seçeneğini seçin

Bu işlemden sonra Firebase Admin SDK varsayılan database olarak `yrpilsekreterligi` database'ini kullanacak ve sorun çözülecek.

### Seçenek 2: Frontend'i Varsayılan Database Kullanacak Şekilde Güncelleme (Önerilmez)

Frontend'deki `firebase.js` dosyasında `FIRESTORE_DATABASE_NAME` değişkenini kaldırıp varsayılan database kullanılmasını sağlayabilirsiniz, ancak bu mevcut verilerinizi etkileyebilir.

### Seçenek 3: Firebase Admin SDK'yı Güncelleme

Firebase Admin SDK v11+ sürümünde database adını belirtmek için API mevcut olabilir. Kontrol edin:

```javascript
const db = admin.firestore().database('yrpilsekreterligi');
```

Ancak bu API henüz mevcut olmayabilir.

## Test Etme

Çözümü uyguladıktan sonra test edin:

```bash
cd sekreterlik-app/server
node -e "require('dotenv').config(); const { initFirebaseAdmin } = require('./config/firebaseAdmin'); const admin = initFirebaseAdmin(); const db = admin.firestore(); db.collection('districts').limit(1).get().then(snap => { console.log('✅ Başarılı! Districts collection erişilebilir'); process.exit(0); }).catch(err => { console.error('❌ Hata:', err.message); process.exit(1); });"
```

Başarılı olursa "✅ Başarılı!" mesajını göreceksiniz.

