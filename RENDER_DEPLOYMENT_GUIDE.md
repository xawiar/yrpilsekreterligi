# 🚀 Render.com Deployment Rehberi

## 📋 Gerekli Bilgiler ve Adımlar

### 1. Render.com Dashboard Ayarları

#### A. Repository Bağlantısı
- **Repository URL**: `https://github.com/xawiar/yrpilsekreterligi.git`
- **Branch**: `main`
- **Root Directory**: `sekreterlik-app/client`

#### B. Service Tipi
- **Type**: `Static Site`
- **Name**: `ilce-sekreterlik` (veya istediğiniz isim)

### 2. Build Ayarları

#### Build Command
```bash
rm -rf dist node_modules/.vite .cache && npm install && npm run build && node scripts/fix-spa-routing.js
```

#### Publish Directory
```
./dist
```

#### Root Directory
```
sekreterlik-app/client
```

### 3. Environment Variables (Render Dashboard'da Ayarlanacak)

Aşağıdaki environment variables'ları Render dashboard'da **Environment** sekmesinden ekleyin:

#### Firebase Configuration
```
VITE_USE_FIREBASE=true
VITE_API_BASE_URL=https://your-backend-url.onrender.com/api
```

#### Firebase Config (Firebase Console'dan alın)
```
VITE_FIREBASE_API_KEY=AIzaSyA0wDM5fXHtm0uDlALRhkQzF7tpsZ-7BZI
VITE_FIREBASE_AUTH_DOMAIN=spilsekreterligi.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=spilsekreterligi
VITE_FIREBASE_STORAGE_BUCKET=spilsekreterligi.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=692841027309
VITE_FIREBASE_APP_ID=1:692841027309:web:d702e7f55031de5eef5ee4
VITE_FIREBASE_MEASUREMENT_ID=G-0X605S84W1
```

#### Encryption Key
```
VITE_ENCRYPTION_KEY=ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security-minimum-32-characters
```

**NOT**: Gerçek encryption key'inizi kullanın (minimum 32 karakter)

### 4. Adım Adım Deployment

#### Adım 1: Render.com'a Giriş
1. https://render.com adresine gidin
2. GitHub hesabınızla giriş yapın
3. Dashboard'a gidin

#### Adım 2: Yeni Static Site Oluştur
1. **"New +"** butonuna tıklayın
2. **"Static Site"** seçin
3. **"Connect GitHub"** ile repository'yi bağlayın
4. Repository'yi seçin: `xawiar/yrpilsekreterligi`

#### Adım 3: Ayarları Yapılandır
1. **Name**: `ilce-sekreterlik`
2. **Branch**: `main`
3. **Root Directory**: `sekreterlik-app/client`
4. **Build Command**: 
   ```bash
   rm -rf dist node_modules/.vite .cache && npm install && npm run build && node scripts/fix-spa-routing.js
   ```
5. **Publish Directory**: `./dist`

#### Adım 4: Environment Variables Ekle
**Environment** sekmesine gidin ve yukarıdaki tüm environment variables'ları ekleyin.

#### Adım 5: Deploy
1. **"Create Static Site"** butonuna tıklayın
2. Build işlemi başlayacak (5-10 dakika sürebilir)
3. Build tamamlandığında site otomatik olarak yayınlanacak

### 5. render.yaml Kullanımı (Alternatif)

Eğer `render.yaml` dosyasını kullanmak isterseniz:

1. Render dashboard'da **"New +"** → **"Blueprint"** seçin
2. Repository'yi bağlayın
3. Render otomatik olarak `render.yaml` dosyasını okuyacak

**render.yaml** zaten yapılandırılmış durumda:
- Branch: `main`
- Root Directory: `sekreterlik-app/client`
- Build Command: Otomatik
- Environment Variables: Bazıları otomatik

### 6. Custom Domain (Opsiyonel)

1. Render dashboard'da service'inize gidin
2. **"Settings"** → **"Custom Domains"**
3. Domain'inizi ekleyin
4. DNS ayarlarını yapın (Render size talimat verecek)

### 7. Backend API URL Güncelleme

Frontend deploy edildikten sonra, backend URL'ini güncellemeniz gerekebilir:

1. Backend'i ayrı bir Web Service olarak deploy edin (Render'da)
2. Backend URL'ini alın (örn: `https://your-backend.onrender.com`)
3. Frontend'in `VITE_API_BASE_URL` environment variable'ını güncelleyin:
   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com/api
   ```

### 8. Troubleshooting

#### Build Hatası
- Node.js versiyonunu kontrol edin (18+ gerekli)
- `node_modules` cache'ini temizleyin
- Build loglarını kontrol edin

#### 404 Hatası (SPA Routing)
- `fix-spa-routing.js` script'inin çalıştığından emin olun
- Render'ın SPA desteğini kontrol edin

#### Environment Variables Çalışmıyor
- Variable isimlerinin `VITE_` ile başladığından emin olun
- Deploy sonrası rebuild yapın

### 9. Önemli Notlar

- ✅ `render.yaml` dosyası zaten yapılandırılmış
- ✅ Branch `main` olarak güncellendi
- ✅ Build command optimize edilmiş
- ⚠️ Environment variables'ları mutlaka ekleyin
- ⚠️ Encryption key'i gerçek değerinizle değiştirin
- ⚠️ Backend URL'ini production URL'inizle güncelleyin

### 10. Hızlı Kontrol Listesi

- [ ] Repository Render'a bağlandı
- [ ] Branch `main` seçildi
- [ ] Root Directory: `sekreterlik-app/client`
- [ ] Build Command doğru
- [ ] Publish Directory: `./dist`
- [ ] Tüm Environment Variables eklendi
- [ ] Encryption key güncellendi
- [ ] Backend URL güncellendi (eğer backend ayrı deploy edilecekse)
- [ ] Deploy başlatıldı
- [ ] Site çalışıyor

## 📞 Destek

Sorun yaşarsanız:
1. Render build loglarını kontrol edin
2. Environment variables'ları kontrol edin
3. GitHub repository'nin doğru branch'inde olduğunu kontrol edin
