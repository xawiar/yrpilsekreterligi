# YRP İl Sekreterliği Yönetim Sistemi

İl sekreterliği için geliştirilmiş kapsamlı yönetim sistemi. Üye yönetimi, toplantı takibi, etkinlik organizasyonu, seçim hazırlığı ve Firebase entegrasyonu içerir.

## 🚀 Özellikler

- 👥 **Üye Yönetimi**: Üye kayıt, güncelleme, arşivleme
- 📅 **Toplantı Yönetimi**: Toplantı oluşturma, katılım takibi
- 🎉 **Etkinlik Yönetimi**: Etkinlik organizasyonu ve katılım takibi
- 🗺️ **Bölge ve Görev Yönetimi**: Bölge ve görev tanımları
- 🏛️ **İlçe ve Belde Yönetimi**: İlçe ve belde bilgileri
- 🏘️ **Mahalle ve Köy Yönetimi**: Mahalle ve köy temsilcileri
- 📊 **Dashboard**: İstatistikler ve özet bilgiler
- 🔐 **Firebase Entegrasyonu**: Firebase Authentication ve Firestore
- 📱 **Seçim Hazırlığı**: Sandık, müşahit ve temsilci yönetimi

## 📋 Gereksinimler

- Node.js 18+ 
- npm veya yarn
- SQLite3
- Firebase hesabı (opsiyonel)

## 🛠️ Kurulum

### 1. Repository'yi klonlayın

```bash
git clone git@github.com:xawiar/yrpilsekreterligi.git
cd yrpilsekreterligi
```

### 2. Bağımlılıkları yükleyin

```bash
# Tüm bağımlılıkları yükle
npm run install:all

# Veya manuel olarak
cd sekreterlik-app/client && npm install
cd ../server && npm install
```

### 3. Environment Variables Ayarları

#### Client (.env)
`sekreterlik-app/client/.env` dosyası oluşturun:

```env
VITE_USE_FIREBASE=true
VITE_API_BASE_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_ENCRYPTION_KEY=your-encryption-key-minimum-32-characters
```

#### Server (.env)
`sekreterlik-app/server/.env` dosyası oluşturun:

```env
PORT=5000
NODE_ENV=development
VITE_USE_FIREBASE=true
VITE_ENCRYPTION_KEY=your-encryption-key-minimum-32-characters
```

### 4. Veritabanı Kurulumu

Veritabanı otomatik olarak oluşturulacaktır. Eğer mevcut bir veritabanı import etmek isterseniz:

```bash
cd sekreterlik-app/server
node import-from-ildatabase.js
```

### 5. Uygulamayı Çalıştırın

#### Development Modu

```bash
# Terminal 1: Server
npm run dev:server

# Terminal 2: Client
npm run dev:client
```

#### Production Build

```bash
# Build
npm run build

# Server'ı başlat
cd sekreterlik-app/server
npm start
```

## 🌐 Erişim

- **Client**: http://localhost:5180
- **Server API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## 📁 Proje Yapısı

```
yrpilsekreterligi/
├── sekreterlik-app/
│   ├── client/          # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── utils/
│   │   │   └── config/
│   │   └── package.json
│   └── server/          # Express backend
│       ├── routes/
│       ├── controllers/
│       ├── models/
│       ├── scripts/
│       └── package.json
├── render.yaml          # Render deployment config
└── package.json         # Root package.json
```

## 🔥 Firebase Kurulumu

1. Firebase Console'da yeni proje oluşturun
2. Firestore Database oluşturun (database adı: `yrpilsekreterligi`)
3. Authentication'da Email/Password provider'ı etkinleştirin
4. Firebase config bilgilerini `.env` dosyasına ekleyin
5. Admin kullanıcısını oluşturmak için `/create-admin` sayfasını ziyaret edin

## 🚢 Deployment

### Render.com

`render.yaml` dosyası zaten yapılandırılmıştır. Render dashboard'dan repository'yi bağlayın.

## 📝 Scripts

- `npm run install:all` - Tüm bağımlılıkları yükle
- `npm run build` - Production build
- `npm run dev:client` - Client development server
- `npm run dev:server` - Server development server

## 🔒 Güvenlik

- `.env` dosyaları Git'e commit edilmez
- Hassas bilgiler şifrelenir (TC, telefon vb.)
- Firebase Security Rules yapılandırılmalıdır

## 📄 Lisans

Bu proje özel kullanım içindir.

## 👥 Katkıda Bulunanlar

- xawiar

## 📞 İletişim

Sorularınız için GitHub Issues kullanabilirsiniz.

