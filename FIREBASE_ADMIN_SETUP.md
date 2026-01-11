# 🔐 Firebase Admin SDK Kurulum Rehberi

## Render.com'da Environment Variable Ayarlama

Firebase Admin SDK'nın çalışması için Render.com'da `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable'ını ayarlamanız gerekiyor.

### Adım 1: Service Account Key'i Base64'e Çevir

Service account key JSON dosyanızı base64 formatına çevirin:

**Mac/Linux:**
```bash
cat spilsekreterligi-firebase-adminsdk-fbsvc-a8b5d2a72a.json | base64 | tr -d '\n'
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("spilsekreterligi-firebase-adminsdk-fbsvc-a8b5d2a72a.json"))
```

### Adım 2: Render.com'da Environment Variable Ekle

1. Render.com dashboard'a gidin
2. Projenizi seçin
3. **Environment** sekmesine gidin
4. **Add Environment Variable** butonuna tıklayın
5. Şu bilgileri girin:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value:** Base64 encode edilmiş JSON içeriği (Adım 1'den aldığınız değer)
6. **Save Changes** butonuna tıklayın

### Adım 3: Deploy

Environment variable eklendikten sonra Render.com otomatik olarak yeniden deploy edecek. Deploy tamamlandıktan sonra Firebase Auth şifre güncellemeleri çalışacak.

## Test Etme

1. Üye Kullanıcıları sayfasına gidin
2. Bir üyenin telefon numarasını değiştirin
3. "Tüm Kullanıcıları Güncelle" butonuna tıklayın
4. Console'da şu mesajları görmelisiniz:
   - `✅ Firebase Auth password updated for member ID X (authUid: ...)`
   - `✅ Firebase credentials update completed!`
   - `   - Firebase Auth passwords: X updated`

## Sorun Giderme

### Firebase Admin SDK initialize edilemedi hatası

Eğer `Firebase Admin SDK initialize edilemedi` hatası alıyorsanız:

1. `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable'ının doğru ayarlandığından emin olun
2. Base64 decode edilmiş JSON'un geçerli olduğunu kontrol edin:
   ```bash
   echo "BASE64_STRING" | base64 -d | jq .
   ```
3. Render.com'da environment variable'ın **Secret** olarak işaretlendiğinden emin olun (güvenlik için)

### Şifre güncellenmiyor

1. Console loglarını kontrol edin
2. `firebaseAuthUpdated` sayısının 0'dan büyük olduğundan emin olun
3. Kullanıcının `authUid`'sinin Firestore'da mevcut olduğundan emin olun

## Güvenlik Notları

⚠️ **ÖNEMLİ:** Service account key çok hassas bir bilgidir. Asla:
- Git repository'ye commit etmeyin
- Public olarak paylaşmayın
- Client-side kodda kullanmayın

✅ **Güvenli Kullanım:**
- Sadece server-side'da kullanın
- Environment variable olarak saklayın
- Render.com'da Secret olarak işaretleyin

