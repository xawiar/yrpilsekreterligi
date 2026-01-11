# Firebase OAuth Domain Ayarları

## 🔴 Konsol Uyarısı

Konsolda şu uyarı görünüyorsa:

```
Info: The current domain is not authorized for OAuth operations. 
This will prevent signInWithPopup, signInWithRedirect, linkWithPopup 
and linkWithRedirect from working. Add your domain (yrpilsekreterligi.onrender.com) 
to the OAuth redirect domains list in the Firebase console -> 
Authentication -> Settings -> Authorized domains tab.
```

## ✅ Çözüm

### Adım 1: Firebase Console'a Giriş Yapın

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. Projenizi seçin: **spilsekreterligi**

### Adım 2: Authentication Ayarlarına Gidin

1. Sol menüden **Authentication** seçeneğine tıklayın
2. **Settings** (Ayarlar) sekmesine tıklayın
3. **Authorized domains** (Yetkili Domainler) bölümüne scroll edin

### Adım 3: Domain Ekleyin

1. **Add domain** (Domain Ekle) butonuna tıklayın
2. Şu domain'i ekleyin:
   ```
   yrpilsekreterligi.onrender.com
   ```
3. **Add** (Ekle) butonuna tıklayın

### Adım 4: Doğrulama

1. Domain listesinde `yrpilsekreterligi.onrender.com` görünmeli
2. Tarayıcıyı yenileyin (hard refresh: Ctrl+Shift+R veya Cmd+Shift+R)
3. Konsol uyarısı kaybolmalı

## 📝 Notlar

- Bu ayar sadece OAuth işlemleri için gereklidir (Google, Facebook gibi provider'lar)
- Email/Password authentication bu ayar olmadan da çalışır
- Domain eklendikten sonra değişiklikler hemen etkili olur
- Localhost otomatik olarak yetkili domainler listesindedir

## 🔍 Kontrol

Domain eklendikten sonra konsolda uyarı görünmemeli. Eğer hala görünüyorsa:

1. Tarayıcı cache'ini temizleyin
2. Hard refresh yapın (Ctrl+Shift+R veya Cmd+Shift+R)
3. Firebase Console'da domain'in eklendiğini kontrol edin

