# Backend Render.com Kurulum Rehberi

## Sorun

Backend servisi Render.com'da deploy ediliyor ancak şu hatalar oluşuyor:

1. **CORS hatası**: `No 'Access-Control-Allow-Origin' header is present`
2. **502 Bad Gateway**: Backend servisi çöküyor
3. **Database hatası**: `SQLITE_ERROR: no such table: main.member_users`

## Neden?

Backend servisi SQLite kullanmaya çalışıyor, ancak:
- Render.com'da SQLite için disk yazma izni yok
- `database.sqlite` dosyası her deploy'da sıfırlanıyor
- Backend Firebase kullanmalı, SQLite değil

## Çözüm

### 1. Firebase Service Account Key'i Render.com'a Ekleyin

Backend'in Firebase kullanması için `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable'ını Render.com'da ayarlamanız gerekiyor:

#### Adımlar:

1. **Firebase Console'a gidin**:
   - https://console.firebase.google.com
   - Project: `spilsekreterligi`
   - Project Settings → Service accounts

2. **Service Account Key oluşturun**:
   - "Generate new private key" butonuna tıklayın
   - Bir JSON dosyası indirilecek (örn: `spilsekreterligi-firebase-adminsdk-xxxxx.json`)

3. **JSON dosyasını açın ve içeriği kopyalayın**:
   ```json
   {
     "type": "service_account",
     "project_id": "spilsekreterligi",
     "private_key_id": "xxxxx...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@spilsekreterligi.iam.gserviceaccount.com",
     ...
   }
   ```

4. **Render.com Dashboard'a gidin**:
   - Services → `sekreterlik-backend`
   - Environment → Add Environment Variable
   - Key: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - Value: **Tüm JSON içeriğini buraya yapıştırın** (tek satır olarak)
   - "Save Changes"

5. **Backend'i yeniden deploy edin**:
   - "Manual Deploy" → "Clear Build Cache & Deploy"

### 2. Backend'in Firebase'i kullanıp kullanmadığını kontrol edin

Deploy tamamlandıktan sonra backend loglarında şu mesajı görmelisiniz:

```
✅ Firebase Admin SDK initialized successfully
```

Eğer bu mesajı görmezseniz:
- `FIREBASE_SERVICE_ACCOUNT_KEY` doğru set edilmedi
- JSON formatı hatalı
- Service account key geçersiz

### 3. CORS Hatası Çözümü

`FIREBASE_SERVICE_ACCOUNT_KEY` set edildikten sonra:
- Backend servisi çökmeyecek
- CORS middleware düzgün çalışacak
- Frontend'den backend'e request'ler başarılı olacak

## Alternatif: SQLite Kullanmaya Devam Edin

Eğer Firebase yerine SQLite kullanmaya devam etmek isterseniz:

1. Render.com'da "Persistent Disk" ekleyin:
   - Services → `sekreterlik-backend` → Environment
   - "Add Disk" → Mount Path: `/opt/render/project/src/sekreterlik-app/server`
   - Ancak bu ücretli bir özellik

2. Veya SQLite kullanımını tamamen bırakıp Firebase kullanın (önerilen)

## Sonuç

Backend'in düzgün çalışması için:
1. `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable'ını Render.com'da set edin
2. Backend'i yeniden deploy edin
3. "Tümünü Oluştur ve Senkronize Et" butonuna tıklayın
4. CORS hatası olmamalı ve Firebase Auth senkronizasyonu çalışmalı

## Test

Deploy tamamlandıktan sonra:
```bash
# Backend health check
curl https://sekreterlik-backend.onrender.com/api/health

# Expected response:
{
  "message": "Server is running!",
  "db": "ok",
  ...
}
```

Frontend'den "Tümünü Oluştur ve Senkronize Et" butonuna tıklayın.

