# YAPILACAKLAR — Kalan Geliştirmeler (10/10 Hedef)

**Son güncelleme:** 3 Nisan 2026
**Güncel puan:** ~9.0/10
**Hedef:** 10/10
**Toplam kalan:** 91 madde | ~76 saat

---

## DALGA 1 — DÜŞÜK RİSK, YÜKSEK VERİM
**28 madde | ~20 saat | Risk: Düşük**

### 1A — Toplantılar (+0.5 puan, 30dk)

- [ ] Tarih aralığı filtresi (30dk)

### 1A-EK — Güvenlik Eksik (doğrulama sırasında tespit)

- [ ] Storage rules: /personal-documents ve /archive yollarına MIME type kontrolü ekle (sadece PDF ve image/* kabul et) (15dk)

### ACİL — KVKK Sayfaları Çalışmıyor (Canlı testte tespit)

- [ ] **BUG: Veri silme talepleri backend'e bağlanmıyor** — `ApiService.js:4099-4141` tüm DataDeletion istekleri `localhost:5000/api/data-deletion-requests`'e gidiyor. Firebase modunda `FirebaseApiService`'te bu metotlar YOK. Çözüm: FirebaseApiService'e DataDeletion CRUD metotları ekle (Firestore `data_deletion_requests` koleksiyonu) (1 saat)
- [ ] **BUG: Firestore composite index eksik** — `notifications` koleksiyonunda `memberId + createdAt` composite index yok. Hata: "The query requires an index". Firebase Console'dan link tıklanarak oluşturulmalı VEYA kod içinde index oluşturma (15dk)
- [ ] **BUG: EmptyDocumentsState DOM nesting hatası** — `<tr>` elementi `<div>` içinde. ArchivePage EmptyDocumentsState'te `<tr>` yerine `<tbody>` wrapper veya `<div>` kullanılmalı (10dk)
- [ ] **PERFORMANS: Aşırı Firestore okuma** — Sayfa yüklenirken aynı koleksiyonlar 4-8 kez okunuyor (members 8x, districts 8x, towns 10x). Cache mekanizması yok, her component kendi fetch'ini yapıyor. En azından kısa süreli in-memory cache ekle (2 saat)

### 1B — Dosya Export (+1.5 puan, 2.5 saat)

- [ ] PDF başlık + tarih + parti logosu + sayfa numarası — tüm PDF export'lara (2 saat)
- [ ] Dosya adlarına tutarlı tarih formatı YYYY-MM-DD (30dk)

### 1C — Login (+1.5 puan, 2 saat)

- [ ] Tab değişiminde useEffect dependency [] fix — gereksiz localStorage okuma (15dk)
- [ ] Başmüşahit TC localStorage → şifrele veya kaldır (30dk)
- [ ] Hata mesajları daha spesifik — network vs auth vs server ayrımı (30dk)
- [ ] Form autofocus — sayfa açılınca ilk alana focus (15dk)
- [ ] Caps Lock uyarısı şifre alanında (30dk)

### 1D — Dashboard (+0.5 puan, 1 saat)

- [ ] DashboardPage ölü kod sil — 326 satır (10dk)
- [ ] Yaklaşan etkinlik/toplantıya tıklama → ilgili sayfaya navigasyon (30dk)
- [ ] Dashboard yenile butonu (15dk)

### 1E — Üye Sistemi (+3 puan, 6 saat)

- [ ] Fotoğraf yükleme üye formuna ekle — MemberForm'a (1.5 saat)
- [ ] Toplu işlem UI — checkbox → toplu arşivle/bölge değiştir (2 saat)
- [ ] Bölge badge farklı renkler — hash bazlı (30dk)
- [ ] Etkinlik istatistikleri üye tablosunda göster — events kullanılmıyor fix (30dk)
- [ ] Arşivden geri alma UI — MembersPage'den erişim (30dk)
- [ ] Credential gösteriminde kopyalama butonu + manuel kapatma (30dk)
- [ ] Üye detayından toplantı/etkinliğe navigasyon linki (30dk)

### 1F — UX Loading (+2 puan, 4 saat)

- [ ] Tüm export butonlarına isExporting loading — kalan dosyalar (1 saat)
- [ ] Skeleton loader daha fazla sayfaya — Settings yüklenirken, Teşkilat yüklenirken (1.5 saat)
- [ ] Suspense lazy loading fallback → skeleton — spinner yerine (1 saat)
- [ ] API hata durumunda retry butonu — genel pattern (30dk)

### 1G — Ayarlar (+0.5 puan, 1.5 saat)

- [ ] Tab gruplama — 26 tab → 6 kategori: Coğrafi, Kurum, Kullanıcı, İçerik, Sistem, Görünüm (1.5 saat)

### 1H — KVKK Tamamlama (+1.5 puan, 3 saat)

- [ ] Veri işleme envanteri dokümantasyonu sayfası (1 saat)
- [ ] KVKK uyum raporu admin sayfası (1 saat)
- [ ] Veri ihlali bildirim prosedürü — admin'e 72 saat uyarı (30dk)
- [ ] Aydınlatma metni sayfasına avukat notu placeholder (15dk)
- [ ] VERBİS kayıt rehberi sayfası (15dk)

---

## DALGA 2 — DÜŞÜK-ORTA RİSK, İYİ VERİM
**18 madde | ~18 saat | Risk: Düşük-Orta**

### 2B — UX Bildirimler (+1 puan, 2 saat)

- [ ] Sayfalar arası akış düzeltme — temsilci ata inline modal, ilçe ekle inline (1.5 saat)
- [ ] Empty state tüm sayfalarda tutarlı — EmptyState component kullan (30dk)

### 2C — Mobil (+0.5 puan, 2.5 saat)

- [ ] Kamera ile fotoğraf çekme — Capacitor Camera API (2 saat)
- [ ] Mobilde üye fotoğraf yükleme (30dk)

### 2D — Performans Puanlama (+2.5 puan, 4 saat)

- [ ] Mükemmel ay bonusu dengeleme — +50 → +30 veya konfigüre edilebilir (30dk)
- [ ] Seviye ayrıcalıkları — Gold+ üyelere dashboard'da özel rozet/erişim (1.5 saat)
- [ ] Hafif üstel ilerleme eğrisi — doğrusal yerine (1 saat)
- [ ] Puan simülasyonu — ayar değiştirince örnek üyeyle önizleme (1 saat)
- [ ] Leaderboard sadece top %10 göster — Goodhart riski azaltma (15dk)

### 2E — Etkinlikler (+1.5 puan, 4 saat)

- [ ] Etkinlik Excel export — toplantılarda var, etkinliklerde yok (1 saat)
- [ ] Etkinlik güncelleme bildirimi — oluşturmada var, güncellemede yok (30dk)
- [ ] EventDetails katılmayan/mazeretli ayrı listesi (30dk)
- [ ] Yoklama tutarsızlığı: etkinlik oluşturmada 3 durum — toplantı gibi (1 saat)
- [ ] Etkinlik detayından düzenleme/yoklama butonları (30dk)

### 2F — Bildirim (+0.5 puan, 2 saat)

- [ ] Firebase modunda gerçek push — şu an lokal showNotification (2 saat)

### 2G — DevOps (+1.5 puan, 3 saat)

- [ ] Sentry DSN doğrula — zaten kod var, DSN aktif mi kontrol (30dk)
- [ ] Staging ortamı — ayrı Firebase projesi + .env.staging (2 saat)
- [ ] Firestore yedekleme doğrula — schedule aktif mi (30dk)

---

## DALGA 3 — ORTA RİSK, UZUN VADEDE DEĞERLİ
**45 madde | ~38 saat | Risk: Orta**

### 3A — Seçim Sistemi (+0.7 puan, 5 saat)

- [ ] Seçim karşılaştırmada bar chart grafik (1 saat)
- [ ] Canlı bildirim yeni sonuç girildiğinde — onSnapshot (2 saat)
- [ ] Seçmen-sandık eşleştirmesi (2 saat)

### 3B — Seçime Hazırlık (+0.3 puan, 2 saat)

- [ ] election_regions'a election_id kolonu (2 saat)

### 3C — AI Sistemi (+1 puan, 8 saat)

- [ ] Context akıllı yönetimi — 2 katmanlı: özet her zaman + detay on-demand (3 saat)
- [ ] OCR sonuç doğrulama — AI okuması vs form tanımları karşılaştırma (2 saat)
- [ ] Chatbot mobil slide-up panel — tam ekran modal yerine (2 saat)
- [ ] Yanıt kalite kontrolü — boş yanıt, uzun yanıt, format kontrol (1 saat)

### 3D — Güvenlik (+2 puan, 12 saat)

- [ ] Audit log sistemi — middleware olarak, controller'lara dokunmadan (4 saat)
- [ ] 2FA admin hesabı — TOTP veya SMS (3 saat)
- [ ] Oturum süresi ayarı — şu an 7 gün sabit → konfigüre edilebilir (30dk)
- [ ] TC tüm tablolarda maskeleme standardize (1 saat)
- [ ] CSP nonce-based — unsafe-inline kaldırma (3 saat)
- [ ] Rate limiting granüler — login:5/dk, API:100/dk, export:10/dk (30dk)

### 3E — Teşkilat (+2 puan, 9 saat)

- [ ] Kadın/Gençlik Kolları SQLite backend — model + controller + route (4 saat)
- [ ] KadınKolları + GençlikKolları → BranchPage birleştirme (2 saat)
- [ ] DistrictMembers + TownMembers → ManagementMembersPage birleştirme (2 saat)
- [ ] Bölge dışı başkan atama imkanı — dropdown'da tüm üyeler (1 saat)

### 3F — Yönetim (+2 puan, 10 saat)

- [ ] SMS gönderim tarihçesi DB tablosu + admin UI (3 saat)
- [ ] SMS planlanmış gönderim → backend scheduler — mevcut yanına paralel (4 saat)
- [ ] SMS mesaj şablonları — toplantı daveti, seçim hatırlatma, genel duyuru (1 saat)
- [ ] Arşivleme tarihi/nedeni kaydı (30dk)
- [ ] Yönetim Şeması hiyerarşik tree diagram görünümü (1.5 saat)

### 3G — Kod Kalitesi (+2.5 puan, 12 saat)

- [ ] 3 etkinlik formu → EventFormBase — ~1300 satır tasarruf (3 saat)
- [ ] ID tip tutarsızlığı kök çözüm — String vs Number tek standart (3 saat)
- [ ] Design system Tailwind config'e entegre et — custom renkler aktif kullan (2 saat)
- [ ] STK + PublicInstitution + Mosques → GenericInstitutionSettings (1 saat)
- [ ] Tüm console.log son temizlik — kalan ~20 satır (30dk)
- [ ] hasPermission fonksiyonu tek yere taşı — 3 yerde tekrar (1 saat)
- [ ] membersActions.js ölü dosya sil veya entegre et (30dk)
- [ ] Kullanılmayan component'ler temizle — SearchInput, RegionFilter, GridViewButton, TableViewButton (30dk)

### 3H — DevOps İleri (+1.5 puan, 16 saat)

- [ ] Otomatik testler: login akışı (2 saat)
- [ ] Otomatik testler: üye CRUD (2 saat)
- [ ] Otomatik testler: toplantı oluşturma + yoklama (2 saat)
- [ ] Otomatik testler: seçim sonucu girişi (2 saat)
- [ ] Otomatik testler: D'Hondt hesaplama — unit test (1 saat)
- [ ] Monitoring dashboard — uptime, response time (2 saat)
- [ ] Rollback mekanizması dokümantasyonu (30dk)
- [ ] Dependency audit otomatik — Dependabot veya CI'da npm audit (30dk)

### 3I — KVKK Metin İçerikleri (+0.5 puan, 4 saat)

- [ ] Aydınlatma metni tam içerik — AI ile oluştur, sayfaya yerleştir (1 saat)
- [ ] Açık rıza metni detaylandırma (30dk)
- [ ] Gizlilik politikası tam metin (1 saat)
- [ ] Çerez politikası tam metin (30dk)
- [ ] Veri işleme envanteri içeriği — hangi veri neden toplanıyor tablosu (30dk)
- [ ] VERBİS kayıt rehberi içeriği (15dk)

---

## DALGA ÖZETİ

| Dalga | Madde | Efor | Kümülatif Puan |
|-------|:-----:|:----:|:--------------:|
| Dalga 1 | 28 | ~20 saat | ~9.5 |
| Dalga 2 | 18 | ~18 saat | ~9.8 |
| Dalga 3 | 45 | ~38 saat | ~10/10 |
| **TOPLAM** | **91** | **~76 saat** | |

---

## NOTLAR

- Yapılan madde YAPILACAKLAR'dan silinip YAPILANLAR'a taşınacak
- Her dalga içinde sıralama: en az efor + en çok puan → önce
- Risk: Düşük maddeler önce, Orta maddeler sonra
- Dalga 1 bitince satışa hazır (~9.5)
- Dalga 2 bitince profesyonel ürün (~9.8)
- Dalga 3 bitince mükemmel (~10/10)
