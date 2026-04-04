# Demo Ortami Kurulum Rehberi

Bu belge, uygulama icin ayri bir demo ortami olusturma adimlarini aciklar. Demo ortami, canli veritabanindan bagimsiz, anonimize verilerle calisir.

## 1. Ayri Firebase Projesi Olusturma

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin.
2. "Add project" (Proje ekle) secenegine tiklayin.
3. Proje adini `sekreterlik-demo` olarak belirleyin.
4. Analytics'i istege bagli olarak aktif edin.
5. Proje olusturulduktan sonra:
   - **Authentication** > Sign-in method bolumine gidin.
   - Email/Password yontemini aktif edin.
   - **Firestore Database** > Create Database secenegine tiklayin.
   - Production mode secin, konum olarak `europe-west1` tercih edin.
6. Project Settings > General > Web uygulamasi ekleyin.
7. Olusturulan config bilgilerini `.env.demo` dosyasina kaydedin.

## 2. Firestore Kurallari

Demo projesi icin `firestore.rules` dosyasini canli projeden kopyalayin:

```
firebase deploy --only firestore:rules --project sekreterlik-demo
```

## 3. Ornek Veri Import

### Anonimize Veri Olusturma

Canli veritabanindan veri cekmek ve anonimize etmek icin:

```bash
# 1. Canli projeden veri export edin
npx -p firebase-tools firebase firestore:export ./backup --project CANLI_PROJE_ID

# 2. Anonimize script'i calistirin
node scripts/anonymize-data.js ./backup ./demo-data

# 3. Demo projesine import edin
npx -p firebase-tools firebase firestore:import ./demo-data --project sekreterlik-demo
```

### Anonimize Script Ornegi (scripts/anonymize-data.js)

Asagidaki alanlar otomatik degistirilmeli:
- `name`: Rastgele Turkce isimlerle degistirilir
- `phone`: `05XX XXX XX XX` formatinda rastgele numaralar
- `tc_no`: Rastgele 11 haneli numara (gecerli TC algoritmasi ile)
- `email`: `demo-user-{N}@example.com` formatinda
- `address`: Genel adreslerle degistirilir
- Diger kisisel bilgiler: Maskelenir veya kaldirilir

## 4. Demo Kullanicilari

Demo ortamina asagidaki kullanicilari ekleyin:

| Rol | Email | Sifre |
|-----|-------|-------|
| Admin | admin@demo.sekreterlik.com | DemoAdmin2024! |
| Ilce Baskani | ilce@demo.sekreterlik.com | DemoIlce2024! |
| Belde Baskani | belde@demo.sekreterlik.com | DemoBelde2024! |
| Uye | uye@demo.sekreterlik.com | DemoUye2024! |
| Koordinator | koordinator@demo.sekreterlik.com | DemoKoord2024! |
| Bas Musahit | musahit@demo.sekreterlik.com | DemoMusahit2024! |

## 5. .env.demo Dosyasi Sablonu

```env
# Firebase Demo Config
VITE_USE_FIREBASE=true
VITE_FIREBASE_API_KEY=demo_api_key_buraya
VITE_FIREBASE_AUTH_DOMAIN=sekreterlik-demo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sekreterlik-demo
VITE_FIREBASE_STORAGE_BUCKET=sekreterlik-demo.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:demo_app_id

# API (demo ortam icin backend kullaniliyorsa)
VITE_API_BASE_URL=https://sekreterlik-demo-backend.onrender.com/api
VITE_API_URL=https://sekreterlik-demo-backend.onrender.com

# AI Features (isteğe bagli)
VITE_GROQ_API_KEY=demo_groq_key

# Demo modu gostergesi
VITE_DEMO_MODE=true
```

## 6. Demo Ortamini Calistirma

```bash
# .env.demo dosyasini .env olarak kopyalayin
cp .env.demo client/.env

# Bagimliliklari yukleyin
cd client && npm install

# Gelistirme sunucusunu baslatin
npm run dev
```

## 7. Dikkat Edilecekler

- Demo verilerini duzenli olarak sifirlayin (haftada bir)
- Demo ortaminda SMS/bildirim gonderimini devre disi birakin
- Demo URL'sini dis paylasimlar icin kullanin, canli URL'yi asla paylasmayın
- Demo ortaminin Firestore kurallari canli ortamla ayni olmali
- Demo ortaminda Storage kurallari daha kısıtlayıcı olabilir (dosya boyutu limiti vb.)
