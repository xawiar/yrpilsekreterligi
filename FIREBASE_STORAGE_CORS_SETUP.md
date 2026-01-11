# Firebase Storage CORS Ayarları

Firebase Storage'dan görüntü çekerken CORS hatası alıyorsanız, aşağıdaki adımları izleyin.

## Yöntem 1: Backend Proxy (Önerilen - Zaten Eklenmiş)

Backend'de proxy endpoint eklenmiştir: `/api/election-results/proxy-image`

Bu endpoint Firebase Storage'dan görüntüyü çekip base64'e çevirir. CORS sorunu olmaz.

**Avantajları:**
- ✅ CORS sorunu yok
- ✅ Güvenli (sadece Firebase Storage URL'lerine izin verir)
- ✅ Kontrol edilebilir

## Yöntem 2: Firebase Storage CORS Ayarları

Eğer backend proxy kullanmak istemiyorsanız, Firebase Storage CORS ayarlarını yapılandırabilirsiniz.

### Adımlar:

1. **Google Cloud Console'a gidin:**
   - https://console.cloud.google.com/
   - Projenizi seçin

2. **Cloud Storage'a gidin:**
   - Sol menüden "Cloud Storage" > "Buckets" seçin
   - Firebase Storage bucket'ınızı bulun (genellikle `[project-id].appspot.com` veya `[project-id].firebasestorage.app`)

3. **CORS Yapılandırması:**
   - Bucket'ı seçin
   - "Permissions" (İzinler) sekmesine gidin
   - "CORS" sekmesine tıklayın
   - "Add CORS configuration" butonuna tıklayın

4. **CORS Yapılandırmasını Ekleyin:**

```json
[
  {
    "origin": ["https://yrpilsekreterligi.onrender.com", "http://localhost:5173", "http://localhost:3000"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
```

**Önemli:**
- `origin`: Uygulamanızın çalıştığı domain'leri ekleyin
- `method`: Sadece GET ve HEAD yeterli (görüntü okuma için)
- `maxAgeSeconds`: Cache süresi (3600 = 1 saat)

5. **Kaydedin ve Bekleyin:**
   - CORS ayarlarının aktif olması birkaç dakika sürebilir

### Alternatif: gsutil ile CORS Ayarlama

Terminal'den de yapabilirsiniz:

```bash
# gsutil kurulumu (eğer yoksa)
# macOS: brew install gsutil
# Linux: pip install gsutil

# CORS yapılandırma dosyası oluşturun (cors.json)
cat > cors.json << EOF
[
  {
    "origin": ["https://yrpilsekreterligi.onrender.com", "http://localhost:5173"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

# CORS ayarlarını uygulayın
gsutil cors set cors.json gs://[BUCKET-NAME]

# Örnek:
# gsutil cors set cors.json gs://spilsekreterligi.firebasestorage.app
```

## Yöntem 3: Firebase Storage Rules (Güvenlik)

CORS ayarlarının yanında, Firebase Storage Rules'ı da kontrol edin:

1. **Firebase Console'a gidin:**
   - https://console.firebase.google.com/
   - Projenizi seçin

2. **Storage > Rules'a gidin:**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Election results - public read (for OCR)
    match /election_results/{allPaths=**} {
      allow read: if true; // Public read for OCR
      allow write: if request.auth != null; // Only authenticated users can write
    }
    
    // Diğer dosyalar için mevcut kurallarınız
  }
}
```

**Not:** Public read, sadece OCR için gerekli. Eğer güvenlik endişeniz varsa, backend proxy kullanın.

## Test

CORS ayarlarını test etmek için:

```bash
curl -H "Origin: https://yrpilsekreterligi.onrender.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     "https://firebasestorage.googleapis.com/v0/b/[BUCKET]/o/[FILE]?alt=media&token=[TOKEN]"
```

Başarılı olursa `Access-Control-Allow-Origin` header'ı döner.

## Öneri

**Backend proxy kullanın** (Yöntem 1). Daha güvenli ve kontrollü. CORS ayarları tüm domain'lere açık olabilir ve güvenlik riski oluşturabilir.

