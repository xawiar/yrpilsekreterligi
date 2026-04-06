# Admin Kullanıcısını Yeniden Oluşturma

Firebase Auth'daki admin kullanıcısı silinmişse, yeniden oluşturmanız gerekiyor.

## Yöntem 1: Firebase Console'dan Manuel Oluşturma (Önerilen)

1. **Firebase Console'a gidin**:
   - https://console.firebase.google.com
   - Project: `spilsekreterligi`
   - Authentication → Users

2. **Add User**:
   - Email: `admin@ilsekreterlik.local`
   - Password: `admin123` (veya istediğiniz şifre)
   - "Add User"

3. **UID'yi kopyalayın**:
   - Oluşturulan kullanıcının UID'sini kopyalayın

4. **Firestore'da admin oluşturun**:
   - Firestore Database → `admin` collection → `main` document
   - Fields:
     ```
     email: "admin@ilsekreterlik.local"
     password: "admin123"
     uid: "YUKARIDA_KOPYALADIGINIZ_UID"
     username: "admin"
     ```

## Yöntem 2: CreateAdminPage Kullanma

Eğer frontend'e erişebiliyorsanız:

1. Browser'da direkt şu URL'e gidin:
   ```
   https://yrpilsekreterligi.onrender.com/create-admin
   ```

2. Admin bilgilerini girin:
   - Email: `admin@ilsekreterlik.local`
   - Password: `admin123`
   - "Admin Oluştur"

3. Login sayfasından giriş yapın

## Yöntem 3: Console'dan Script Çalıştırma (Gelişmiş)

Firebase Functions veya local'de script çalıştırarak:

```javascript
// Firebase Admin SDK kullanarak
const admin = require('firebase-admin');

async function createAdmin() {
  // Admin kullanıcısı oluştur
  const authUser = await admin.auth().createUser({
    email: 'admin@ilsekreterlik.local',
    password: 'admin123',
    displayName: 'Admin'
  });
  
  // Firestore'da admin oluştur
  await admin.firestore().collection('admin').doc('main').set({
    email: 'admin@ilsekreterlik.local',
    password: 'admin123', // Şifrelenmiş olarak saklanmalı
    uid: authUser.uid,
    username: 'admin'
  });
  
  console.log('✅ Admin created:', authUser.uid);
}

createAdmin();
```

## Önemli Notlar

- **Default admin bilgileri**:
  - Email: `admin@ilsekreterlik.local`
  - Password: `admin123`

- **Güvenlik**: Admin şifresini oluşturduktan sonra Settings sayfasından değiştirin

- **Firebase Auth + Firestore**: Admin kullanıcısı hem Firebase Auth'da hem Firestore'da olmalı

## Sonraki Adımlar

Admin oluşturduktan sonra:
1. Login sayfasından giriş yapın
2. Settings → Üye Kullanıcıları → "Tüm Kullanıcıları Oluştur" butonuna tıklayın
3. Gerekirse "Firebase Auth'a Senkronize Et" butonuna tıklayın
4. **"Gereksiz Auth Kullanıcılarını Temizle" butonuna TIKLAMAYIN** (bu admin'i de silebilir)

