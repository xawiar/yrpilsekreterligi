# 🔐 Firestore Security Rules Deploy Rehberi

## Sorun
Firestore Console'da `member_users` collection'ında "Error loading documents" hatası görünüyorsa, bu genellikle Security Rules'ların deploy edilmemiş olmasından kaynaklanır.

## Çözüm: Firestore Rules'ları Deploy Etme

### Yöntem 1: Firebase Console'dan (Önerilen)

1. Firebase Console'a gidin: https://console.firebase.google.com
2. Projenizi seçin (`spilsekreterligi`)
3. Sol menüden **Firestore Database** → **Rules** sekmesine gidin
4. `sekreterlik-app/firestore.rules` dosyasının içeriğini kopyalayın
5. Firebase Console'daki Rules editörüne yapıştırın
6. **Publish** butonuna tıklayın

### Yöntem 2: Firebase CLI ile

```bash
# Firebase CLI kurulumu (eğer yoksa)
npm install -g firebase-tools

# Firebase'e login olun
firebase login

# Projeyi initialize edin (eğer yapılmadıysa)
cd sekreterlik-app
firebase init firestore

# Rules'ları deploy edin
firebase deploy --only firestore:rules
```

## Rules Dosyası Konumu

Rules dosyası: `sekreterlik-app/firestore.rules`

## Önemli Notlar

⚠️ **Rules deploy edilmeden önce:**
- Tüm collection'lar için kurallar tanımlı olmalı
- `member_users` collection'ı için `isAuthenticated()` kontrolü var
- Authenticated kullanıcılar okuyabilir ve yazabilir

✅ **Deploy sonrası:**
- Firestore Console'da "Error loading documents" hatası kaybolmalı
- Authenticated kullanıcılar `member_users` collection'ını görebilmeli

## Test

1. Firebase Console → Firestore Database → Data
2. `member_users` collection'ını açın
3. Artık "Error loading documents" hatası görünmemeli
4. Dokümanlar listelenebilmeli

