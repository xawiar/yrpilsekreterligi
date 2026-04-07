# SEKRETERLIK4 — KIDEMLi MiMAR KOD DENETiM RAPORU

**Tarih:** 2026-04-07
**Denetci:** Kıdemli Yazılım Mimarı & Kod Denetçisi (AI)
**Proje:** YRP İl Sekreterliği Uygulaması
**Kapsam:** Mimari, kod kalitesi, güvenlik, performans, mantıksal doğruluk, teknik borç

---

## SAĞLIK SKORU: 4.5 / 10

| Boyut | Skor | Durum |
|-------|------|-------|
| Mimari & Yapı | 5/10 | ⚠️ Dikkat |
| Kod Kalitesi (DRY/SRP) | 3/10 | 🔴 Kritik |
| Hata & Risk | 3/10 | 🔴 Kritik |
| Güvenlik | 2/10 | 🔴 Kritik |
| Performans | 4/10 | ⚠️ Dikkat |
| Mantıksal Doğruluk | 4/10 | ⚠️ Dikkat |
| Teknik Borç | 5/10 | ⚠️ Dikkat |

---

# 1. MİMARİ & YAPI

## Durum: ⚠️ Dikkat

### Olumlu Bulgular
- Monorepo yapısı düzgün ayrıştırılmış (client/server/functions)
- Controller-Model-Route ayrımı genel olarak doğru
- Circular dependency YOK — import grafiği tek yönlü ✅
- 62 route lazy-loaded, chunk stratejisi mevcut ✅
- Offline-first PWA mimarisi iyi tasarlanmış ✅

### Sorunlar

#### MiMARi-01: `routes/auth.js` — 2100+ satır, 20+ sorumluluk 🔴
**Dosya:** `server/routes/auth.js` — tüm dosya
**Tespit:** Tek bir route dosyası içinde: login, koordinatör login, başmüşahit login, admin CRUD, member_user CRUD, şifre değiştirme, 2FA, Firebase Auth yönetimi, session yönetimi, sync işlemleri, ayarlar, push token yönetimi, koordinatör dashboard (260 satır iş mantığı) barındırılıyor.
**Kanıt:** Koordinatör dashboard handler'ı (satır 215-497) doğrudan `db.all()` çağırıyor, controller/model katmanını atlıyor, `ElectionResultController.getCoordinatorBallotBoxIds()` ile aynı mantığı tekrarlıyor.
**Öneri:** En az 6 ayrı dosyaya bölünmeli: `authRoutes.js`, `adminRoutes.js`, `memberUserRoutes.js`, `coordinatorRoutes.js`, `firebaseAuthRoutes.js`, `twoFactorRoutes.js`

#### MiMARi-02: `MemberUser.js` kendi SQLite bağlantısını açıyor 🔴
**Dosya:** `server/models/MemberUser.js:1-6`
**Tespit:** Diğer tüm modeller `config/database.js`'den ortak bağlantıyı kullanırken, MemberUser kendi `new sqlite3.Database(dbPath)` ile ayrı bağlantı açıyor.
**Kanıt:**
```js
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);
```
**Öneri:** `require('../config/database')` kullanılmalı. İki açık bağlantı `SQLITE_BUSY` hatalarına ve tutarsız veri okumalarına neden olabilir.

#### MiMARi-03: Veritabanı API tutarsızlığı — callback vs await 🔴
**Dosya:** `server/services/scheduledNotificationService.js:32-44` vs tüm controller'lar
**Tespit:** `scheduledNotificationService.js` callback-style `db.all()` kullanıyor, controller'lar `await db.all()` kullanıyor. Aynı `db` nesnesi için iki farklı çağrı deseni.
**Kanıt:**
```js
// scheduledNotificationService.js — callback style
const meetings = await new Promise((resolve, reject) => {
  db.all(`SELECT * FROM meetings ...`, [], (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});

// MemberController.js — await style
const members = await db.all('SELECT * FROM members ...');
```
**Öneri:** Tüm veritabanı çağrıları tek bir desene (promise-based) standardize edilmeli.

#### MiMARi-04: `App.jsx` — 591 satır, 80+ lazy import, inline bileşenler ⚠️
**Dosya:** `client/src/App.jsx`
**Tespit:** 80+ lazy-loaded bileşen tanımı, loading skeleton bileşeni inline, mobil menü/chatbot/quick action state yönetimi, 40+ route tanımı tek dosyada.
**Öneri:** Route tanımları `routes/` klasörüne, lazy import'lar `routes/lazy.js`'e taşınmalı.

---

# 2. KOD KALİTESİ (DRY / SRP)

## Durum: 🔴 Kritik

### DRY İhlalleri

#### DRY-01: Seçim sonucu JSON parse — 8 satırlık blok 6 yerde tekrarlanıyor 🔴
**Dosyalar:**
| Konum | Satırlar |
|-------|---------|
| `ElectionResultController.js` `getAll()` | 198-205 |
| `ElectionResultController.js` `getById()` | 232-239 |
| `ElectionResultController.js` `getByElectionAndBallotBox()` | 266-273 |
| `ElectionResultController.js` `getPending()` | 647-654 |
| `routes/auth.js` coordinator-dashboard | 463-470 |
| `routes/public.js` | 300-304 |

**Kanıt:**
```js
cb_votes: result.cb_votes ? JSON.parse(result.cb_votes) : {},
mv_votes: result.mv_votes ? JSON.parse(result.mv_votes) : {},
mayor_votes: result.mayor_votes ? JSON.parse(result.mayor_votes) : {},
provincial_assembly_votes: result.provincial_assembly_votes ? JSON.parse(result.provincial_assembly_votes) : {},
municipal_council_votes: result.municipal_council_votes ? JSON.parse(result.municipal_council_votes) : {},
referendum_votes: result.referendum_votes ? JSON.parse(result.referendum_votes) : {},
party_votes: result.party_votes ? JSON.parse(result.party_votes) : {},
candidate_votes: result.candidate_votes ? JSON.parse(result.candidate_votes) : {},
```
**Öneri:** `parseElectionResultVotes(result)` utility fonksiyonu oluşturulmalı.

#### DRY-02: Push bildirim gönderim boilerplate — 4+ controller'da tekrarlı 🔴
**Dosyalar:** `EventController.js:118-156`, `MeetingController.js:107-146`, `PollController.js:133-157`, `ElectionResultController.js:435-450`
**Tespit:** Her controller'da aynı 15-20 satırlık subscription fetch → format → payload → send → notification create deseni.
**Öneri:** `PushNotificationService.broadcastNotification(title, body, type, data)` fonksiyonu tüm mantığı içermeli.

#### DRY-03: Village/Neighborhood controller'lar — yapısal olarak aynı ⚠️
**Dosyalar:** `NeighborhoodController.js` (223 satır) vs `VillageController.js` (223 satır)
**Tespit:** Entity adı dışında birebir aynı CRUD yapısı. Aynı durum `STKController.js` ve `PublicInstitutionController.js` için de geçerli.
**Öneri:** Generic `CrudController` factory: `createCrudController('villages', 'Koy', { parentKey: 'district_id' })`

#### DRY-04: `USE_FIREBASE` flag kontrolü — 10+ yerde tutarsız mantıkla ⚠️
**Dosyalar ve tutarsızlıklar:**
| Dosya | Kontrol Mantığı |
|-------|----------------|
| `ApiService.js:9-12` | `=== 'true' \|\| === true \|\| .toLowerCase() === 'true'` |
| `AuthContext.jsx:6-8` | Aynı 3'lü kontrol |
| `SmsService.js:31` | Sadece `=== 'true'` |
| `ProtocolOCRService.js:16` | Sadece `=== 'true'` |
| `GeminiService.js:28` | Sadece `=== 'true'` |
| `autoSyncToFirebase.js:9` | Ters mantık: `!== 'false'` |

**Öneri:** Tek bir `isFirebaseEnabled()` fonksiyonu oluşturulmalı.

#### DRY-05: `@ilsekreterlik.local` email domain — 30+ yerde hardcoded ⚠️
**Dosyalar:** `FirebaseApiService.js` (10+), `routes/auth.js` (8+), `MemberUsersSettings.jsx` (5+), `MemberController.js:249`
**Öneri:** `const EMAIL_DOMAIN = '@ilsekreterlik.local'` sabiti tanımlanmalı.

### SRP İhlalleri

#### SRP-01: `MemberController.create()` — 5 ayrı sorumluluk, 96 satır 🔴
**Dosya:** `server/controllers/MemberController.js:88-184`
**Tespit:** Tek metod içinde: (1) input validasyonu, (2) duplicate kontrol + DB insert, (3) member_user hesabı oluşturma + şifre üretimi, (4) Firebase sync, (5) admin bildirim broadcasting.
**Öneri:** Her sorumluluk ayrı metoda taşınmalı.

#### SRP-02: `MemberController.update()` — kendi API'sine HTTP isteği yapıyor 🔴
**Dosya:** `server/controllers/MemberController.js:241-295`
**Tespit:** `update()` metodu, Firebase Auth güncellemesi için kendi API endpoint'ine (`/api/auth/update-firebase-auth-user`) raw HTTP isteği yapıyor. Protokol algılama, stream handling, hata yakalama — hepsi inline.
**Kanıt:**
```js
const options = {
  hostname: url.hostname,
  port: url.port,
  path: '/api/auth/update-firebase-auth-user',
  method: 'POST',
  // ...
};
const httpModule = API_BASE_URL.startsWith('https') ? require('https') : require('http');
```
**Öneri:** Doğrudan fonksiyon çağrısı kullanılmalı, HTTP self-call kaldırılmalı.

#### SRP-03: `ElectionResultController.create()` — 10 sorumluluk, 176 satır 🔴
**Dosya:** `server/controllers/ElectionResultController.js:283-459`
**Tespit:** Input validasyonu, oy bütünlüğü doğrulama, seçim durumu kontrolü, tarih bazlı erişim kontrolü, müşahit atama kontrolü, duplicate kontrolü, köy sandık iş kuralı, AI onay workflow, 28 alanlı INSERT, audit log, admin bildirim — hepsi tek metotta.

#### SRP-04: `AuthContext.jsx` — Auth + Push Notification kurulumu ⚠️
**Dosya:** `client/src/contexts/AuthContext.jsx`
**Tespit:** `login()` fonksiyonu kimlik doğrulama yapıp hemen push notification subscription kuruyor. Push mantığı ayrı bir hook'a taşınmalı.

### Magic Number/String

#### MN-01: Rol string'leri enum olmadan 80+ yerde kullanılıyor 🔴
**Kanıt:** `'admin'`, `'member'`, `'district_president'`, `'town_president'`, `'chief_observer'`, `'provincial_coordinator'`, `'district_supervisor'`, `'region_supervisor'`, `'institution_supervisor'` — 15 dosyada 80+ kez.
**Öneri:** `const ROLES = { ADMIN: 'admin', MEMBER: 'member', ... }` sabiti.

#### MN-02: Diğer magic değerler ⚠️
| Değer | Konum | Açıklama |
|-------|-------|----------|
| `400` | `BallotBoxController.js:123,193` | Max seçmen/sandık |
| `7` | `ElectionResultController.js:316,497` | Seçim sonrası gün sayısı |
| `11` | `MemberController.js:526` | TC uzunluğu |
| `50`, `200` | `EventController.js:16` | Pagination limitleri |
| `5 * 1024 * 1024` | `routes/members.js:25,36` | Upload boyutu |
| `'5m'` | `routes/auth.js:37` | 2FA token süresi |
| `/icon-192x192.png` | 48+ konum | Bildirim ikonu |

---

# 3. HATA & RİSK ANALİZİ

## Durum: 🔴 Kritik

### Kritik Hatalar

#### BUG-01: Excel import TC/telefon'u şifrelenmeden kaydediyor 🔴
**Dosya:** `server/controllers/MemberController.js:548-551`
**Tespit:** `importFromExcel()` TC ve telefonu plaintext kaydediyor. Normal `create()` ise `encryptField()` kullanıyor.
**Kanıt:**
```js
// importFromExcel — PLAINTEXT
const result = await db.run(
  'INSERT INTO members (tc, name, phone, position, region) VALUES (?, ?, ?, ?, ?)',
  [tc, name, phone, position, region]  // <-- şifrelenmemiş!
);

// create — ŞİFRELİ
const encTc = encryptField(memberData.tc);
const encPhone = encryptField(memberData.phone);
```
**Sonuç:** (1) Kişisel veri sızıntısı (2) Duplicate TC kontrolü çalışmaz (plaintext vs encrypted karşılaştırma) (3) `getAll()` decryptField çağrısı plaintext kayıtlarda bozuk veri döndürür.

#### BUG-02: `|| null` sıfır oyları NULL yapıyor 🔴
**Dosya:** `server/controllers/ElectionResultController.js:400-403`
**Kanıt:**
```js
resultData.total_voters || null,   // 0 || null = null!
resultData.used_votes || null,     // 0 || null = null!
resultData.invalid_votes || null,  // 0 || null = null!
```
**Tespit:** JavaScript'te `0 || null` = `null`. Meşru sıfır değerli oy verileri NULL olarak kaydediliyor.
**Öneri:** `?? null` (nullish coalescing) kullanılmalı.

#### BUG-03: In-memory cache sınırsız büyüyor 🔴
**Dosya:** `server/middleware/cache.js:4`
**Kanıt:**
```js
const store = new Map();
```
**Tespit:** Cache Map'i asla temizlenmiyor. Her benzersiz URL (pagination, filtre, arama terimleri) sonsuza kadar kalıyor. LRU yok, max boyut yok, periyodik temizlik yok.
**Öneri:** Max boyut + LRU eviction ekle veya `lru-cache` kütüphanesi kullan.

#### BUG-04: `MongoMessageController` senderId hardcoded `4` 🔴
**Dosya:** `server/controllers/MongoMessageController.js:9`
**Kanıt:**
```js
const senderId = 4; // Use a real user ID from member_users table
```
**Tespit:** Tüm MongoDB mesajları debug değeri olan kullanıcı ID 4'ten geliyor görünüyor.

#### BUG-05: `archiveAll()` çalışmayan API kullanıyor 🔴
**Dosya:** `server/controllers/MemberController.js:651-668`
**Kanıt:**
```js
const members = db.get('members');  // raw sqlite3 — SQL değil collection erişimi
for (const member of members) {     // undefined üzerinde iterasyon — CRASH
```
**Tespit:** `db.get('members')` SQLite'da geçersiz SQL. Aynı sorun `MeetingController.archiveAll()` (satır 281) için de geçerli.

#### BUG-06: `setManualStars()` Firebase sync'e yanlış argüman gönderiyor ⚠️
**Dosya:** `server/controllers/MemberController.js:389`
**Kanıt:**
```js
await syncAfterSqliteOperation('members', updatedMember.id, 'update');
// Doğrusu: syncAfterSqliteOperation(tableName, id, data, operation)
// 'update' string'i data yerine geçiyor
```

#### BUG-07: `FirebaseApiService.js` duplicate key 🔴
**Dosya:** `client/src/utils/FirebaseApiService.js:67,85`
**Kanıt:**
```js
ELECTIONS: 'elections',           // satır 67
ELECTION_RESULTS: 'election_results', // satır 68
// ... 17 satır sonra ...
ELECTIONS: 'elections',           // satır 85 — DUPLICATE!
ELECTION_RESULTS: 'election_results'  // satır 86 — DUPLICATE!
```

### Race Condition'lar

#### RACE-01: TC benzersizlik kontrolünde TOCTOU ⚠️
**Dosya:** `server/controllers/MemberController.js:99-103`
**Tespit:** SELECT ile kontrol → zaman boşluğu → INSERT. Eşzamanlı iki istek aynı TC'yi geçirebilir. DB UNIQUE constraint yakalasa da hata mesajı generic 500 olur.

#### RACE-02: `PollController.vote()` çift oy riski ⚠️
**Dosya:** `server/controllers/PollController.js:228-241`
**Tespit:** Aynı üye aynı anda iki oy gönderirse, her ikisi de `!existingVote` kontrolünü geçer.

#### RACE-03: `VisitController.incrementVisit()` read-modify-write ⚠️
**Dosya:** `server/controllers/VisitController.js:8-66`
**Tespit:** SQL atomic ama in-memory collection güncellemesi atomic değil.

### Null/Undefined Güvensizliği

#### NULL-01: `PushSubscriptionController.subscribe()` — keys null kontrolü yok ⚠️
**Dosya:** `server/controllers/PushSubscriptionController.js:20-21`
**Kanıt:**
```js
p256dh: subscription.keys.p256dh,  // subscription.keys undefined olabilir
auth: subscription.keys.auth,
```

#### NULL-02: JSON.parse try/catch olmadan — 5+ controller ⚠️
**Dosyalar:** `EventController.js:31`, `MeetingController.js`, `ElectionController.js`, `PollController.js`, `scheduledNotificationService.js:57-58`
**Kanıt:**
```js
attendees: event.attendees ? JSON.parse(event.attendees) : []
// Malformed JSON → tüm istek 500 hatasıyla çöker
```

#### NULL-03: `DashboardController` tip karşılaştırma hatası ⚠️
**Dosya:** `server/controllers/DashboardController.js:354-358`
**Kanıt:**
```js
idStr === memberIdNum  // string === number → HER ZAMAN false
```

### Memory Leak Potansiyeli

#### LEAK-01: 6+ `setInterval` asla temizlenmiyor ⚠️
**Dosya:** `server/index.js:283-301, 602-619` + `smsScheduler.js:169`
**Tespit:** Notification temizliği (24 saat), scheduled notification (5 dk), VACUUM (7 gün), backup (24 saat), expired polls (1 saat), SMS scheduler (1 dk) — hiçbiri değişkene atanmıyor, hiçbiri clearInterval ile temizlenmiyor. Vercel serverless'ta sorun yaratır.

#### LEAK-02: Rate limiter Map'leri yoğun IP trafiğinde şişer ⚠️
**Dosya:** `server/middleware/rateLimit.js:7-8`, `server/middleware/security.js:26-62`
**Tespit:** Her `createRateLimiter()` çağrısı yeni Map + yeni setInterval oluşturuyor. `security.js`'deki cleanup her request'te O(n) çalışıyor.

---

# 4. GÜVENLİK

## Durum: 🔴 Kritik

### P0 — Acil Müdahale Gereken

#### VULN-01: Auth route'ları authentication OLMADAN erişilebilir 🔴
**Dosya:** `server/routes/auth.js` — satır 509-2016
**Tespit:** Auth router `index.js:428-439`'da `authenticateToken` OLMADAN mount ediliyor. Router içinde sadece 2FA endpoint'leri (satır 2017+) auth gerektiriyor. Aradaki TÜM endpoint'ler korumasız.
**Kanıt — korumasız endpoint'ler:**
```
GET  /api/auth/admin                          → Admin bilgilerini oku
PUT  /api/auth/admin                          → Admin şifresini değiştir!
GET  /api/auth/member-users                   → TÜM kullanıcıları listele
POST /api/auth/member-users                   → Kullanıcı oluştur
PUT  /api/auth/member-users/:id               → Kimlik bilgilerini değiştir
DELETE /api/auth/member-users/:id             → Kullanıcı sil
POST /api/auth/update-all-credentials         → TOPLU kimlik güncelle!
DELETE /api/auth/firebase-auth-user/:authUid  → Firebase Auth kullanıcısı sil!
GET  /api/auth/coordinator-dashboard/:id      → Koordinatör verilerini oku
```
**Exploit:** Herhangi biri `PUT /api/auth/admin` ile admin şifresini değiştirebilir. `GET /api/auth/member-users` ile tüm kullanıcıları listeleyebilir. `POST /api/auth/update-all-credentials` ile tüm kimlik bilgilerini güncelleyebilir.
**Öneri:** Tüm yönetim endpoint'lerine `authenticateToken` + `requireAdmin` middleware ekle.

#### VULN-02: JWT secret, commit'lenmiş encryption key'e fallback yapıyor 🔴
**Dosya:** `server/routes/auth.js:33` vs `middleware/auth.js:3`
**Kanıt:**
```js
// auth.js (2FA token oluşturma):
const JWT_SECRET = process.env.JWT_SECRET || process.env.VITE_ENCRYPTION_KEY;

// middleware/auth.js (token doğrulama):
const JWT_SECRET = process.env.JWT_SECRET;  // fallback YOK
```
**Tespit:** `VITE_ENCRYPTION_KEY` client `.env` dosyasında plaintext:
```
VITE_ENCRYPTION_KEY=ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security-minimum-32-characters
```
Vite `VITE_*` değişkenlerini build edilmiş JavaScript'e gömer — bu key kamuya açık. JWT_SECRET bu key'e fallback ediyorsa, herkes token forge edebilir.
**Öneri:** Fallback kaldır. JWT_SECRET yoksa sunucu başlamasın. Güçlü, rastgele bir secret kullan.

#### VULN-03: Hardcoded admin şifresi commit'lenmiş dosyada 🔴
**Dosya:** `client/create-admin-user.js:36`
**Kanıt:**
```js
const adminPassword = 'admin123'; // Güçlü bir şifre kullanın!
```
**Öneri:** Bu dosyayı sil. Firebase admin şifresini rotate et.

#### VULN-04: Firestore — herhangi bir authenticated kullanıcı admin olabilir 🔴
**Dosya:** `firestore.rules:18-22`
**Kanıt:**
```
match /admin/{document} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();     // HERKESe açık!
  allow update, delete: if isAdmin();
}
```
**Tespit:** `admin/main` dokümanı silinirse veya hiç oluşturulmamışsa, herhangi bir authenticated kullanıcı kendi UID'si ile oluşturup tam admin erişimi elde edebilir.
**Öneri:** `allow create: if false;` veya Cloud Function ile initial admin setup.

#### VULN-05: Firestore catch-all — authenticated herkes subcollection'lara yazabilir 🔴
**Dosya:** `firestore.rules:194-197`
**Kanıt:**
```
match /{collection}/{docId}/{sub=**} {
  allow read: if isAuthenticated();
  allow write: if isAuthenticated();  // HER subcollection'a yazma izni!
}
```
**Tespit:** Bu kural üstteki daha kısıtlayıcı kuralları subcollection'lar için geçersiz kılıyor. Bir üye, admin dokümanlarının, seçim sonuçlarının veya başka herhangi bir collection'ın subcollection'larına yazabilir.

### P1 — Yüksek Öncelik

#### VULN-06: Üye import/export/toplu-arşiv'de rol kontrolü yok 🔴
**Dosya:** `server/routes/members.js:57-109`
**Tespit:** `authenticateToken` mount seviyesinde uygulanıyor ama `requireAdmin` yok. Herhangi bir authenticated üye (role: `member`) bile:
- Excel'den üye import edebilir
- TÜM üye verilerini (TC, telefon dahil) export edebilir
- Toplu arşivleme yapabilir

#### VULN-07: SSRF — image proxy'de bypass edilebilir domain kontrolü 🔴
**Dosya:** `server/controllers/ElectionResultController.js:786-816`
**Kanıt:**
```js
if (!imageUrl.includes('firebasestorage.googleapis.com')) {
    return res.status(400).json({ message: 'Invalid URL' });
}
```
**Exploit:** `https://evil.com/?firebasestorage.googleapis.com` veya `https://firebasestorage.googleapis.com.evil.com/path`
**Öneri:** `new URL(imageUrl).hostname === 'firebasestorage.googleapis.com'` kullan.

#### VULN-08: IDOR — herhangi bir üye başka üyenin bildirimlerini okuyabilir ⚠️
**Dosya:** `server/controllers/NotificationController.js:5-14`
**Kanıt:**
```js
static async getByMemberId(req, res) {
    const { memberId } = req.params;  // URL'den, token'dan değil!
    const notifications = await Notification.getByMemberId(memberId, ...);
}
```
**Öneri:** `req.params.memberId === req.user.memberId` veya admin kontrolü ekle.

#### VULN-09: Arşiv dosya yükleme — dosya tipi filtresi yok ⚠️
**Dosya:** `server/controllers/ArchiveController.js:25-30`
**Kanıt:**
```js
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
  // fileFilter YOK — .exe, .html, .php kabul edilir
});
```
**Tespit:** Yüklenen dosyalar `express.static` ile `/uploads` altında doğrudan serve ediliyor. Kötü niyetli `.html` dosyası XSS saldırısı yapabilir.

#### VULN-10: CSRF koruması Origin header olmadan bypass edilir ⚠️
**Dosya:** `server/index.js:242-256`
**Kanıt:**
```js
const isAllowed = !origin || csrfAllowedOrigins.some(o => origin.startsWith(o));
// !origin (boş string) → true → BYPASS
```
**Tespit:** `curl` gibi araçlar Origin header göndermez → CSRF koruması devre dışı.

#### VULN-11: CORS ve CSRF origin listeleri birbirinden farklı ⚠️
**Dosya:** `server/index.js:195-203` vs `index.js:245-249`
**Tespit:** CORS `yrpilsekreterligi.onrender.com` izin veriyor, CSRF ise `spilsekreterligi.web.app`. Birinden gelen istek diğerinde bloklanıyor. Meşru production istekleri başarısız olabilir.

#### VULN-12: Başmüşahit şifresi = TC numarası ⚠️
**Dosya:** `server/controllers/BallotBoxObserverController.js:156,160,165`
**Kanıt:**
```js
password = tc;  // TC hem kullanıcı adı hem şifre!
```

#### VULN-13: Seçim sonucu girişinde sandık sahiplik kontrolü yok ⚠️
**Dosya:** `server/controllers/ElectionResultController.js:283-460`
**Tespit:** `create` ve `update` metodları authenticated kullanıcının ilgili sandığa atanmış olup olmadığını kontrol etmiyor. Sandık 1'in başmüşahiti sandık 2'nin sonuçlarını girebilir.
**Kanıt:** `approve` metodu (satır 684-691) bu kontrolü doğru yapıyor ama `create` ve `update` yapmıyor.

#### VULN-14: Güvenlik middleware'i meşru içeriği engelliyor ⚠️
**Dosya:** `server/middleware/security.js:67`
**Kanıt:**
```js
const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|TRUNCATE|GRANT|REVOKE)\b)|(--|;|\/\*|\*\/)/i;
```
**Tespit:** "Update the website", "Sekreter adaylarının UNION toplantısı", "Toplantı açıklaması; devamı..." gibi meşru metinler reddediliyor. Noktalı virgül `;` Türkçe metinlerde yaygın.

#### VULN-15: XSS — public route'ta error.message HTML'e basılıyor ⚠️
**Dosya:** `server/routes/public.js:343`
**Kanıt:**
```js
res.status(500).send(`<pre>${error.message}</pre>`);
```
**Tespit:** `error.message` escape edilmeden HTML'e interpolate ediliyor.

#### VULN-16: Firestore — herhangi bir authenticated kullanıcı anket güncelleyebilir ⚠️
**Dosya:** `firestore.rules:127`
**Kanıt:**
```
match /polls/{pollId} {
  allow update: if isAuthenticated();  // Admin değil, HERKESe açık
}
```

---

# 5. PERFORMANS

## Durum: ⚠️ Dikkat

### N+1 Sorgu Desenleri

#### PERF-01: Excel import — satır başına 4 sequential sorgu 🔴
**Dosya:** `server/controllers/MemberController.js:495-563`
**Tespit:** 500 satırlık import = ~2000+ sequential DB sorgusu. Batch transaction yok.
**Kanıt:**
```js
for (const row of validRows) {
  const existingMember = await db.get('SELECT * FROM members WHERE tc = ?', [tc]);  // 1
  await MemberController.createRegionIfNotExists(region);                           // 2
  await MemberController.createPositionIfNotExists(position);                       // 3
  const result = await db.run('INSERT INTO members ...', [...]);                    // 4
}
```
**Öneri:** Transaction ile sarmalama + batch insert.

#### PERF-02: Müşahit TC araması — TÜM üyeleri çekip JavaScript'te decrypt 🔴
**Dosya:** `server/controllers/BallotBoxObserverController.js:142-146` (+ satır 267'de tekrar)
**Kanıt:**
```js
const members = await db.all('SELECT * FROM members WHERE archived = 0');
const member = members.find(m => {
    const memberTc = decryptField(m.tc) || m.tc;
    return memberTc === tc;
});
```
**Tespit:** Tek bir üye bulmak için 5000 üyenin hepsinin TC'si decrypt ediliyor. TC encrypted olduğu için index kullanılamıyor.
**Öneri:** Arama TC'sini önce encrypt edip `WHERE tc = ?` ile sorgulamak.

#### PERF-03: Bildirim gönderimi — admin başına sequential INSERT ⚠️
**Dosyalar:** `MemberController.js:158-173`, `ElectionResultController.js:435-450`
**Kanıt:**
```js
for (const admin of admins) {
    await Notification.create({ memberId: admin.id, ... });
}
```
**Öneri:** Batch INSERT kullan.

### Frontend Performans

#### PERF-04: `getFilteredResults()` — memoize edilmeden 9 kez çağrılıyor 🔴
**Dosya:** `client/src/pages/ElectionResultsPage.jsx` — satır 419, 452, 767, 773, 787, 1047, 1338, 1416, 1533
**Tespit:** Her çağrıda results, ballotBoxes, districts, towns, neighborhoods, villages üzerinde tam filtre zinciri çalışıyor. İçinde O(n*m) `.find()` lookup'ları var (1000 sandık x 50 ilçe = 4000+ dizi taraması, x9 = 36000+).
**Öneri:** `useMemo` ile sarmalama + `.find()` yerine Map/dictionary kullanma.

#### PERF-05: html2canvas + jsPDF statik import — 33+ MB ⚠️
**Dosya:** `client/src/pages/ElectionResultsPage.jsx:8-9`
**Kanıt:**
```js
import html2canvas from 'html2canvas';  // 4.4 MB
import jsPDF from 'jspdf';             // 29 MB
```
**Tespit:** Sadece "PDF Export" butonuna tıklandığında kullanılıyor ama her sayfa yüklemesinde bundle'a dahil.
**Öneri:** `const { default: html2canvas } = await import('html2canvas')` ile dynamic import.

#### PERF-06: Ölü bağımlılıklar — package.json'da kullanılmayan kütüphaneler ⚠️
**Dosya:** `client/package.json`
| Kütüphane | Boyut | Kullanım |
|-----------|-------|----------|
| `leaflet` + `react-leaflet` | 3.8 MB | 0 import |
| `csv-stringify` | — | 0 import |
| `@babel/traverse` | — | hem deps hem devDeps'te |

### Veritabanı Performans

#### PERF-07: Eksik indeksler 🔴
**Dosya:** `server/config/database.js`
**Tespit:** Sık sorgulanan sütunlarda indeks yok:
- `election_results(election_id)` — her sonuç sorgusu full table scan
- `election_results(ballot_box_id)` — aynı
- `election_results(approval_status)` — pending filtresi
- `notifications(member_id)` — üye bildirimleri
- `notifications(read)` — okunmamış sayısı
- `audit_logs(entity_type, entity_id)` — denetim sorguları
- `audit_logs(created_at)` — tarih filtresi

#### PERF-08: In-memory koleksiyonlar bayatlıyor ⚠️
**Dosya:** `server/config/database.js:927-1112`
**Tespit:** Tüm veritabanı başlangıçta belleğe yükleniyor. Yazma SQLite'a gidiyor ama in-memory koleksiyonlar tutarsız güncelleniyor. `BallotBoxController.create` (satır 167) `collections.ballot_boxes`'a ekliyor ama `MemberController.update` `collections.members`'ı asla güncellemiyor.

#### PERF-09: Dashboard tüm üyelerin TC/telefonunu gereksiz decrypt ediyor ⚠️
**Dosya:** `server/controllers/DashboardController.js:100-104`
**Tespit:** Dashboard sadece isim ve sayı gösteriyor ama tüm kayıtların TC ve telefon alanlarını decrypt ediyor. Gereksiz CPU kullanımı.

### Firebase Optimizasyon

#### PERF-10: Push bildirimde TÜM push_tokens + TÜM member_users okunuyor 🔴
**Dosya:** `client/src/services/NotificationService.js:106, 174, 189`
**Kanıt:**
```js
const tokenSnap = await getDocs(collection(db, 'push_tokens'));    // TÜM koleksiyon
var muSnap = await getDocs(collection(db, 'member_users'));        // TÜM koleksiyon
```
**Tespit:** 500 üye + 500 token = her bildirimde 1000 Firestore doküman okuma. Firestore faturası şişer.
**Öneri:** `where()` ile hedefli sorgu kullan.

#### PERF-11: Seçim sonuçları — Firestore listener + API çift fetch ⚠️
**Dosya:** `client/src/pages/ElectionResultsPage.jsx:168-206`
**Tespit:** `onSnapshot` listener HER değişiklikte `fetchData()` çağırıyor. `fetchData()` 8 koleksiyonu `Promise.all` ile baştan çekiyor. Tek bir sonuç değişikliğinde 8 API çağrısı tetikleniyor.
**Öneri:** Snapshot'tan gelen değişikliği incremental olarak uygula.

---

# 6. MANTIKSAL DOĞRULUK

## Durum: ⚠️ Dikkat

### Seçim Mantığı

#### LOGIC-01: D'Hondt — client ve server implementasyonları FARKLI 🔴
**Dosyalar:** `server/utils/dhondt.js` vs `client/src/utils/dhondt.js`
**Farklar:**
| Özellik | Server | Client |
|---------|--------|--------|
| Baraj parametresi | YOK (2 parametre) | VAR (3. parametre) |
| Bağımsız aday ayrımı | YOK — normal parti gibi | VAR — önce 1 koltuk ayırma |
| İttifak D'Hondt'u | YOK | `calculateDHondtWithAlliances()` |
| Belediye meclisi kontenjan | YOK | `calculateMunicipalCouncilSeats()` |

**Sonuç:** Aynı veriyle server ve client FARKLI koltuk dağılımı üretir.
**Öneri:** Server implementasyonunu client ile eşitle.

#### LOGIC-02: D'Hondt beraberlik — `Math.random()` kullanılıyor 🔴
**Dosyalar:** `server/utils/dhondt.js:62`, `client/src/utils/dhondt.js:114`
**Kanıt:**
```js
return Math.random() - 0.5;
```
**Tespit:** (1) Aynı veri iki kez çalıştırılırsa farklı sonuç (reproducibility yok) (2) `.sort()` ile random comparator V8'de tanımsız davranış (transitivity ihlali) (3) Kura audit izi yok.
**Öneri:** Deterministic tie-breaking (örn: alfabetik sıra veya parti ID).

#### LOGIC-03: Baraj (threshold) — server `thresholdPercent=0` ile bypass edilebilir ⚠️
**Dosya:** `server/utils/dhondt.js:125-128` vs `client/src/utils/dhondt.js:455-462`
**Tespit:** Server `thresholdPercent` validasyonu yapmıyor. `0` geçilirse tüm partiler barajı geçer. Client doğru şekilde 0 ve 100+ değerlerini reddediyor.

#### LOGIC-04: Excel import — üye oluşturur ama member_user oluşturmaz ⚠️
**Dosya:** `server/controllers/MemberController.js:469-581`
**Tespit:** `importFromExcel` üyeleri kaydediyor ama `member_users` tablosuna kayıt oluşturmuyor. Import edilen üyeler giriş yapamaz. Normal `create()` bunu otomatik yapıyor (satır 124-137).

#### LOGIC-05: Arşivlenen üyenin TC'si yeni kayıtları engelliyor ⚠️
**Dosya:** `server/controllers/MemberController.js:99-103`
**Tespit:** TC uniqueness kontrolü arşivlenmiş üyeleri de kapsıyor. Arşivlenen TC ile yeni kayıt yapılamıyor. "Bu TC arşivde, geri yüklemek ister misiniz?" seçeneği yok.

#### LOGIC-06: Yeniden planlanan toplantılarda bildirim sıfırlanmıyor 🔴
**Dosya:** `server/services/scheduledNotificationService.js:56-116`
**Tespit:** `notification_status` JSON'unda `{ oneDayBefore: true, oneHourBefore: true }` flag'leri toplantı tarihi değiştirildiğinde sıfırlanmıyor. Yeni tarih için bildirim asla gelmez.

#### LOGIC-07: Arşivlenmiş koordinatör hâlâ giriş yapabiliyor ⚠️
**Dosya:** `server/models/MemberUser.js:327-375`
**Tespit:** Login sorgusu `is_active = 1` kontrolü yapıyor ama ilişkili `members` kaydının `archived = 1` olup olmadığını kontrol etmiyor.

### Veri Tutarlılığı

#### LOGIC-08: SQLite → Firestore tek yönlü sync, çakışma çözümü yok 🔴
**Dosya:** `server/utils/autoSyncToFirebase.js`
**Tespit:** (1) Sync sadece SQLite → Firestore yönünde (2) Firebase client SDK üzerinden yapılan değişiklikler SQLite'a asla yansımıyor (3) `{ merge: true }` her zaman SQLite verisini kazandırıyor (4) `_syncedFromServer: true` flag'i hiçbir yerde kontrol edilmiyor — ölü metadata.

#### LOGIC-09: Sync hataları sessizce yutulup tekrar denenmior ⚠️
**Dosya:** `server/controllers/MemberController.js:143-154` (ve tüm controller'lar)
**Kanıt:**
```js
try {
  await syncAfterSqliteOperation('members', result.lastID, memberForFirebase, 'create');
} catch (syncError) {
  console.warn('Firebase sync hatasi:', syncError.message);
  // Ana işlemi durdurmuyor — veri kalıcı olarak uyumsuz
}
```
**Tespit:** Retry queue yok, dead letter queue yok, reconciliation mekanizması yok.

#### LOGIC-10: Arşiv/geri yükleme işlemlerinde Firebase sync yapılmıyor ⚠️
**Dosyalar:** `MemberController.js:336-366` (archive), `MemberController.js:403-427` (restore)
**Tespit:** `create` ve `update` `syncAfterSqliteOperation()` çağırıyor ama `archive` ve `restore` çağırmıyor. Firestore'da üye aktif görünmeye devam eder.

### Test Coverage

#### TEST-01: Kritik iş mantığı test edilmemiş 🔴
**Test edilen:** D'Hondt temel algoritma (24 test), baraj, ittifak, belediye meclisi, 2. tur, izinler, auth reddedilme, sağlık endpoint'i.
**Test EDİLMEYEN:**
| Alan | Durum |
|------|-------|
| `validateVoteData()` — en kritik iş kuralı | ❌ Sıfır test |
| Server-side D'Hondt | ❌ Sıfır test (client'tan farklı!) |
| Üye CRUD (create/update/archive/restore) | ❌ Sıfır test |
| Excel import | ❌ Sıfır test |
| Başarılı login akışı | ❌ Sıfır test |
| 2FA akışı | ❌ Sıfır test |
| Eşzamanlı erişim (concurrent access) | ❌ Sıfır test |
| Bildirim zamanlama mantığı | ❌ Sıfır test |
| Firebase sync | ❌ Sıfır test |
| Negatif/float oy değerleri reddi | ❌ Sıfır test |

---

# 7. TEKNİK BORÇ

## Durum: ⚠️ Dikkat

### TODO/FIXME Yorumları (4 adet)
| Dosya | İçerik |
|-------|--------|
| `FirebaseService.js:291` | `// TODO: Daha gelismis pagination icin document snapshot kullan` |
| `FirebaseApiService.js:982` | `// TODO: Race condition mitigation` |
| `FirebaseApiService.js:1472` | `// TODO: District presidents ve town presidents icin de benzer guncelleme` |
| `ApiService.js:846` | `// TODO: Firebase Storage ile document download implementasyonu` |

### Production'da console.log (380+ adet)
**Tespit:** 45 controller dosyasında toplam 380+ `console.log/warn/error/info`. Birçoğu emoji içeren debug mesajları:
- `BallotBoxObserverController.js:174,178,299,303,366,372,379` — 7 adet emoji'li console.log
- `cache.js:61` — her cache invalidation'da console.log

### Ölü Kod
| Dosya | Açıklama |
|-------|----------|
| `CoordinatorsPage.jsx` | App.jsx'te import edilmiyor |
| `HomePage.jsx` | Hiçbir yerde kullanılmıyor |
| `LocationsPage.jsx` | Route'larda yok |
| `PollsPage.jsx` | Tanımlı ama import edilmemiş |
| `DashboardController.js:1-7` | Yorum satırında kullanılmayan controller import'ları |
| `create-admin-user.js` | Hardcoded şifreli debug script |
| `_syncedFromServer: true` flag | Hiçbir yerde kontrol edilmiyor |

### Deprecated / Riskli Pratikler
- Plaintext şifre geriye uyumluluğu hâlâ aktif (`MemberUser.js:86`)
- `commandInjectionPattern` tanımlı ama asla kullanılmıyor (`security.js:76`)
- `chunkSizeWarningLimit: 2000` — gerçek sorunu gizlemek için yükseltilmiş (`vite.config.js:163`)

---

# ÖZET: ÖNCELİKLENDİRİLMİŞ AKSİYON PLANI

## P0 — Derhal Düzeltilmeli (Güvenlik Açıkları)

| # | Sorun | Dosya | Etki |
|---|-------|-------|------|
| 1 | Auth route'larına authenticateToken + requireAdmin ekle | `routes/auth.js`, `index.js` | Tam hesap ele geçirme engellenir |
| 2 | JWT_SECRET fallback'i kaldır, yoksa sunucu başlamasın | `routes/auth.js:33`, `middleware/auth.js:3` | Token sahteciliği engellenir |
| 3 | Firestore admin create kuralını `false` yap | `firestore.rules:20` | Admin yetki yükseltme engellenir |
| 4 | Firestore catch-all subcollection write'ı kısıtla | `firestore.rules:196` | Veri manipülasyonu engellenir |
| 5 | `create-admin-user.js` dosyasını sil | `client/create-admin-user.js` | Hardcoded şifre kaldırılır |

## P1 — Bu Hafta Düzeltilmeli (Veri Bütünlüğü)

| # | Sorun | Dosya |
|---|-------|-------|
| 6 | Excel import'ta encryptField() kullan | `MemberController.js:548` |
| 7 | `\|\| null` → `?? null` değiştir (sıfır oy sorunu) | `ElectionResultController.js:400-403` |
| 8 | Üye import/export'a requireAdmin ekle | `routes/members.js:57-109` |
| 9 | Image proxy'de URL hostname kontrolü | `ElectionResultController.js:786` |
| 10 | Arşiv dosya yüklemesine fileFilter ekle | `ArchiveController.js:25-30` |
| 11 | D'Hondt server implementasyonunu client ile eşitle | `server/utils/dhondt.js` |

## P2 — Bu Ay Düzeltilmeli (Performans & Kalite)

| # | Sorun | Dosya |
|---|-------|-------|
| 12 | Veritabanı indeksleri ekle | `config/database.js` |
| 13 | Cache'e max boyut + LRU ekle | `middleware/cache.js` |
| 14 | `getFilteredResults()` memoize et | `ElectionResultsPage.jsx` |
| 15 | html2canvas/jsPDF dynamic import | `ElectionResultsPage.jsx:8-9` |
| 16 | Ölü bağımlılıkları kaldır (leaflet, csv-stringify) | `package.json` |
| 17 | Müşahit TC aramasını optimize et | `BallotBoxObserverController.js:142` |
| 18 | NotificationService'te hedefli Firestore sorgusu | `NotificationService.js:106` |
| 19 | MemberUser.js'i ortak DB bağlantısına geçir | `models/MemberUser.js:1-6` |

## P3 — Teknik Borç Temizliği

| # | Sorun |
|---|-------|
| 20 | auth.js'i 6 dosyaya böl |
| 21 | Election result JSON parse utility oluştur |
| 22 | Push notification boilerplate'i service'e taşı |
| 23 | Rol string'leri enum'a çevir |
| 24 | USE_FIREBASE kontrolünü tek fonksiyona topla |
| 25 | Ölü sayfaları sil (5 adet) |
| 26 | 380+ console.log temizle |
| 27 | Toplantı reschedule'da notification_status sıfırla |
| 28 | Test coverage: validateVoteData, server D'Hondt, auth flow |

---

*Bu rapor projenin her dosyası okunarak, her import kontrol edilerek, her fonksiyon mantıksal olarak sınanarak hazırlanmıştır. Tüm bulgular dosya:satır referansları ile desteklenmiştir.*
