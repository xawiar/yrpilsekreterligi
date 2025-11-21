# Capacitor Mobil Uygulama Kurulumu

## ✅ Kurulum Tamamlandı

Capacitor başarıyla kuruldu ve Android projesi eklendi.

## 📱 Mevcut Durum

- ✅ Capacitor Core kuruldu
- ✅ Capacitor CLI kuruldu
- ✅ Android projesi eklendi
- ⚠️ iOS projesi eklendi (Xcode gerektirir - isteğe bağlı)

## 🚀 Kullanım

### Build ve Sync

```bash
# 1. Web uygulamasını build et
npm run build

# 2. Capacitor'a sync et
npm run cap:sync
```

### Android

```bash
# Android Studio'da aç
npm run cap:open:android

# Veya manuel
npx cap open android
```

### iOS (Mac ve Xcode gerektirir)

```bash
# Xcode'da aç
npm run cap:open:ios

# Veya manuel
npx cap open ios
```

## 📝 Script'ler

- `npm run cap:sync` - Build ve sync
- `npm run cap:open:ios` - iOS projesini aç
- `npm run cap:open:android` - Android projesini aç
- `npm run cap:copy` - Web assets'leri kopyala
- `npm run cap:update` - Capacitor'ı güncelle

## 🔧 Yapılandırma

Capacitor config: `capacitor.config.js`

- **appId:** `com.ilsekreterlik.app`
- **appName:** `İl Sekreterlik`
- **webDir:** `dist`

## 📱 Mobil Tasarım

Mobil tasarım iyileştirmeleri uygulandı:

- ✅ DashboardPage mobil optimizasyonu
- ✅ DashboardStatsCards mobil optimizasyonu
- ✅ Responsive breakpoint'ler
- ✅ Touch-friendly boyutlar
- ✅ Mobil için özel spacing ve typography

## 📱 Telefona Yükleme

### Hızlı Yöntem (Development)

**Android:**
```bash
npm run build
npm run cap:sync
npm run cap:open:android
# Android Studio'da "Run" butonuna bas (USB ile telefon bağlı olmalı)
```

**iOS (Mac + Xcode):**
```bash
npm run build
npm run cap:sync
npm run cap:open:ios
# Xcode'da "Run" butonuna bas (USB ile iPhone bağlı olmalı)
```

### APK Oluşturma (Android)

1. Android Studio'da: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. APK dosyası: `android/app/build/outputs/apk/debug/app-debug.apk`
3. APK'yı telefona aktar ve yükle

**Detaylı rehber:** `MOBILE_APP_INSTALL_GUIDE.md` dosyasına bakın.

### Alternatif: PWA (Önerilen - Hızlı)

Uygulama zaten PWA! App Store'a gerek yok:

**Android Chrome:**
- Siteyi aç → Menü → "Ana ekrana ekle"

**iOS Safari:**
- Siteyi aç → Paylaş → "Ana Ekrana Ekle"

## 🎯 Sonraki Adımlar

1. **Android Build:**
   - Android Studio'yu aç
   - Gradle sync yap
   - APK veya AAB build et

2. **iOS Build (Mac + Xcode gerektirir):**
   - Xcode'u aç
   - Signing ayarlarını yap
   - Archive ve App Store'a yükle

3. **Native Özellikler (İsteğe Bağlı):**
   - Kamera: `@capacitor/camera`
   - Dosya Sistemi: `@capacitor/filesystem`
   - Push Bildirimleri: `@capacitor/push-notifications`

## 📚 Dokümantasyon

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Setup](https://capacitorjs.com/docs/android)
- [iOS Setup](https://capacitorjs.com/docs/ios)

