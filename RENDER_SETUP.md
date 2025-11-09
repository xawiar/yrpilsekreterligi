# Render.com Deployment Ayarları

## 📋 Render.com'da Yapılacak Ayarlar

### 1. Service Tipi
- **Type**: `Static Site`
- **Name**: `ilce-sekreterlik` (veya istediğiniz isim)

### 2. Git Repository Bağlantısı
- **Repository**: `https://github.com/xawiar/yrpilsekreterligi`
- **Branch**: `main`
- **Root Directory**: `sekreterlik-app/client`

### 3. Build Ayarları

#### Build Command:
```bash
rm -rf dist node_modules/.vite .cache && npm install && npm run build && node scripts/fix-spa-routing.js
```

#### Publish Directory:
```
dist
```

### 4. Environment Variables (ZORUNLU)

Render.com dashboard'da **Environment** sekmesine gidin ve şu değişkenleri ekleyin:

#### Firebase Configuration:
```
VITE_USE_FIREBASE = true
VITE_FIREBASE_API_KEY = AIzaSyA0wDM5fXHtm0uDlALRhkQzF7tpsZ-7BZI
VITE_FIREBASE_AUTH_DOMAIN = spilsekreterligi.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = spilsekreterligi
VITE_FIREBASE_STORAGE_BUCKET = spilsekreterligi.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 692841027309
VITE_FIREBASE_APP_ID = 1:692841027309:web:d702e7f55031de5eef5ee4
VITE_FIREBASE_MEASUREMENT_ID = G-0X605S84W1
```

#### Encryption Key:
```
VITE_ENCRYPTION_KEY = ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security-minimum-32-characters
```

#### API Base URL (Opsiyonel - Firebase kullanıyorsanız gerekmez):
```
VITE_API_BASE_URL = https://your-backend-url.onrender.com/api
```

### 5. Auto-Deploy Ayarları
- ✅ **Auto-Deploy**: `Yes` (Her push'ta otomatik deploy)
- ✅ **Pull Request Previews**: `Yes` (Opsiyonel)

## 🔧 Alternatif: render.yaml Kullanımı

Eğer `render.yaml` dosyasını kullanmak isterseniz:

1. Render.com dashboard'da **New** → **Blueprint** seçin
2. Repository'yi bağlayın
3. Render otomatik olarak `render.yaml` dosyasını okuyacak

## 📝 Adım Adım Kurulum

### Adım 1: Render.com'da Yeni Static Site Oluştur
1. Render.com dashboard'a giriş yapın
2. **New** → **Static Site** tıklayın
3. **Connect GitHub** ile repository'yi bağlayın
4. Repository: `xawiar/yrpilsekreterligi` seçin

### Adım 2: Temel Ayarlar
- **Name**: `ilce-sekreterlik`
- **Branch**: `main`
- **Root Directory**: `sekreterlik-app/client`
- **Build Command**: (Yukarıdaki build command'ı yapıştırın)
- **Publish Directory**: `dist`

### Adım 3: Environment Variables Ekle
**Environment** sekmesine gidin ve yukarıdaki tüm environment variables'ları ekleyin.

### Adım 4: Deploy
- **Create Static Site** tıklayın
- Build işlemi başlayacak (5-10 dakika sürebilir)
- Build tamamlandığında site canlıya geçecek

## ✅ Kontrol Listesi

- [ ] Repository bağlandı
- [ ] Branch: `main` seçildi
- [ ] Root Directory: `sekreterlik-app/client` ayarlandı
- [ ] Build Command eklendi
- [ ] Publish Directory: `dist` ayarlandı
- [ ] Tüm Environment Variables eklendi
- [ ] Auto-Deploy aktif
- [ ] Build başarılı
- [ ] Site canlıda çalışıyor

## 🐛 Sorun Giderme

### Build Hatası
- Node.js versiyonunu kontrol edin (18+ olmalı)
- `node_modules` cache'ini temizleyin
- Build loglarını kontrol edin

### Environment Variables Çalışmıyor
- Variable isimlerinin `VITE_` ile başladığından emin olun
- Deploy sonrası yeniden build yapın
- Browser console'da environment variables'ları kontrol edin

### SPA Routing Hatası
- `scripts/fix-spa-routing.js` script'inin çalıştığından emin olun
- `vercel.json` benzeri bir redirect kuralı eklenmiş olmalı

## 📞 Destek

Sorun yaşarsanız:
1. Build loglarını kontrol edin
2. Browser console'da hataları kontrol edin
3. Environment variables'ların doğru eklendiğinden emin olun

