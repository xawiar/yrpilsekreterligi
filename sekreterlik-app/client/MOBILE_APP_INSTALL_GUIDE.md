# Mobil Uygulamayı Telefona Yükleme Rehberi

## 📱 Yükleme Yöntemleri

### Yöntem 1: Development Build (Test İçin) ⚡ HIZLI

#### Android (APK)

**Adımlar:**

1. **Android Studio'yu aç:**
   ```bash
   npm run cap:open:android
   ```

2. **Build APK:**
   - Android Studio'da: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - Veya terminal'de:
     ```bash
     cd android
     ./gradlew assembleDebug
     ```

3. **APK Dosyasını Bul:**
   - `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Telefona Yükle:**
   - APK'yı telefonunuza USB ile aktarın
   - Veya email/WhatsApp ile gönderin
   - Telefonda: `Ayarlar` → `Güvenlik` → `Bilinmeyen kaynaklardan uygulama yükleme` → **Aktif et**
   - APK dosyasına tıklayın ve yükleyin

#### iOS (IPA) - Mac + Xcode Gerektirir

**Adımlar:**

1. **Xcode'u aç:**
   ```bash
   npm run cap:open:ios
   ```

2. **Build ve Install:**
   - Xcode'da: `Product` → `Archive`
   - `Distribute App` → `Development` → iPhone'unuzu seçin
   - USB ile iPhone'unuza bağlayın ve yükleyin

---

### Yöntem 2: App Store / Play Store (Production) 🏪

#### Android (Play Store)

**Adımlar:**

1. **AAB (Android App Bundle) Oluştur:**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   - Dosya: `android/app/build/outputs/bundle/release/app-release.aab`

2. **Play Store Console'a Yükle:**
   - [Google Play Console](https://play.google.com/console) → Yeni uygulama oluştur
   - AAB dosyasını yükle
   - Store listing bilgilerini doldur
   - Review için gönder
   - Onay sonrası yayınlanır (1-7 gün)

**Gereksinimler:**
- Google Play Developer hesabı ($25 tek seferlik)
- Uygulama ikonu, ekran görüntüleri
- Privacy Policy URL

#### iOS (App Store)

**Adımlar:**

1. **Archive Oluştur:**
   - Xcode'da: `Product` → `Archive`
   - `Distribute App` → `App Store Connect`
   - Upload

2. **App Store Connect'te Yayınla:**
   - [App Store Connect](https://appstoreconnect.apple.com) → Yeni uygulama oluştur
   - Archive'i bekleyin (birkaç dakika)
   - Store listing bilgilerini doldur
   - Review için gönder
   - Onay sonrası yayınlanır (1-7 gün)

**Gereksinimler:**
- Apple Developer hesabı ($99/yıl)
- Uygulama ikonu, ekran görüntüleri
- Privacy Policy URL

---

## 🚀 Hızlı Test (Development)

### Android - En Hızlı Yöntem

```bash
# 1. Build et
npm run build

# 2. Sync et
npm run cap:sync

# 3. Android Studio'yu aç
npm run cap:open:android

# 4. Android Studio'da:
# - USB ile telefonu bağla
# - "Run" butonuna bas (yeşil play ikonu)
# - Uygulama otomatik yüklenir ve açılır
```

### iOS - En Hızlı Yöntem (Mac + Xcode)

```bash
# 1. Build et
npm run build

# 2. Sync et
npm run cap:sync

# 3. Xcode'u aç
npm run cap:open:ios

# 4. Xcode'da:
# - USB ile iPhone'u bağla
# - Device olarak iPhone'unuzu seçin
# - "Run" butonuna bas (play ikonu)
# - Uygulama otomatik yüklenir ve açılır
```

---

## 📋 Adım Adım: Android APK Oluşturma

### 1. Gereksinimler
- Android Studio kurulu olmalı
- Java JDK kurulu olmalı

### 2. Build Komutları

```bash
# Proje dizinine git
cd sekreterlik-app/client

# Web uygulamasını build et
npm run build

# Capacitor'a sync et
npm run cap:sync

# Android Studio'yu aç
npm run cap:open:android
```

### 3. Android Studio'da

1. **Gradle Sync:**
   - Android Studio açıldığında otomatik sync yapar
   - Hata varsa: `File` → `Sync Project with Gradle Files`

2. **APK Oluştur:**
   - Menü: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - Bekleyin (1-2 dakika)
   - Başarı mesajı: `APK(s) generated successfully`

3. **APK'yı Bul:**
   - Android Studio'da: `Build` → `Analyze APK...`
   - Veya dosya sisteminde: `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Telefona Aktar:**
   - USB ile telefonu bağla
   - APK'yı telefonun `Download` klasörüne kopyala
   - Telefonda APK'ya tıkla ve yükle

---

## 📋 Adım Adım: iOS IPA Oluşturma (Mac Gerektirir)

### 1. Gereksinimler
- Mac bilgisayar
- Xcode kurulu olmalı
- Apple Developer hesabı (test için ücretsiz, store için $99/yıl)

### 2. Build Komutları

```bash
# Proje dizinine git
cd sekreterlik-app/client

# Web uygulamasını build et
npm run build

# Capacitor'a sync et
npm run cap:sync

# Xcode'u aç
npm run cap:open:ios
```

### 3. Xcode'da

1. **Signing Ayarları:**
   - Proje seçili → `Signing & Capabilities`
   - `Team` seçin (Apple ID ile giriş yapın)
   - `Automatically manage signing` işaretli olsun

2. **Device Seç:**
   - Üstte device seçin (iPhone'unuz veya Simulator)

3. **Build ve Run:**
   - `Product` → `Run` (⌘R)
   - Veya play butonuna basın
   - Uygulama otomatik yüklenir

---

## 🔧 Sorun Giderme

### Android

**Sorun:** "Gradle sync failed"
```bash
cd android
./gradlew clean
./gradlew build
```

**Sorun:** "SDK not found"
- Android Studio → `Tools` → `SDK Manager`
- Android SDK kurulu olmalı

**Sorun:** "APK yüklenmiyor"
- Telefonda: `Ayarlar` → `Güvenlik` → `Bilinmeyen kaynaklardan uygulama yükleme` → Aktif et

### iOS

**Sorun:** "Signing failed"
- Xcode → `Preferences` → `Accounts` → Apple ID ekle
- `Signing & Capabilities` → Team seç

**Sorun:** "Device not found"
- iPhone'u USB ile bağla
- iPhone'da: `Ayarlar` → `Genel` → `VPN ve Cihaz Yönetimi` → Developer uygulamasına güven

---

## 📱 Alternatif: PWA (Progressive Web App)

Uygulama zaten PWA desteğine sahip! App Store'a gerek kalmadan yüklenebilir:

### Android Chrome:
1. Siteyi aç
2. Menü (3 nokta) → "Ana ekrana ekle"
3. Uygulama gibi çalışır

### iOS Safari:
1. Siteyi aç
2. Paylaş butonu → "Ana Ekrana Ekle"
3. Uygulama gibi çalışır

**Avantajlar:**
- ✅ App Store onayı gerekmez
- ✅ Anında güncelleme
- ✅ Offline çalışır
- ✅ Push bildirimleri

---

## 🎯 Öneri

**Test için:** PWA kullanın (en hızlı)
**Production için:** App Store/Play Store'a yükleyin

Hangi yöntemi tercih edersiniz?

