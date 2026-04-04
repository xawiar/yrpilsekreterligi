# YAPILACAKLAR — Kalan İşler + Yeni Özellikler

**Son güncelleme:** 4 Nisan 2026
**Mevcut puan:** ~10/10 (tüm buglar ve eksikler kapatıldı)

---

## KALAN TEKNİK BORÇ (Opsiyonel)

### Crash Bug (Yeni tespit)
- [ ] **useAuth AuthProvider dışında çağrılıyor** — Public sayfa crash. `RouterContent` (App.jsx:148) `useAuth()` kullanıyor. Public sayfa `/public/election-results/` kontrolü `useAuth` çağrısından SONRA yapılıyor. Public sayfaya gelen kullanıcı login olmamış → AuthContext yok → crash. **Çözüm:** Public route kontrolünü `useAuth` çağrısından ÖNCE yap, veya `PublicElectionResultsWrapper`'ı `RouterContent` dışına taşı (15dk)
- [ ] **Visitor register localhost:5000 — Firebase modunda çalışmıyor** — PublicElectionResultsPage.jsx:92 `POST http://localhost:5000/api/public/visitors/register` → Firebase modunda backend yok → ERR_CONNECTION_REFUSED. **Çözüm:** Firebase modunda visitor tracking'i Firestore'a yaz veya devre dışı bırak (30dk)

### Kod Birleştirme (Faz 5A — Opsiyonel Refactor)
- [ ] 3 etkinlik formu → EventFormBase (~1300 satır tasarruf)
  - [ ] CreateEventForm + EventForm + PlanEventForm → EventFormBase generic component
  - [ ] CreateEventForm.jsx → 5 satırlık wrapper: `<EventFormBase mode="create" />`
  - [ ] EventForm.jsx → 5 satırlık wrapper: `<EventFormBase mode="edit" />`
  - [ ] PlanEventForm.jsx → 5 satırlık wrapper: `<EventFormBase mode="plan" />`

### Diğer
- [ ] ID tip tutarsızlığı kök çözüm (String vs Number)
- [ ] Design system tam entegrasyon
- [ ] Dependency audit otomatik (Dependabot)
- [ ] Demo ortamı (ayrı Firebase, örnek veri)

---

## YENİ ÖZELLİKLER — HEMFİKİR OLUNAN PLAN

### Özellik 1: Bildirim Sistemi Genişletme (Maliişler Referanslı)
**Efor: ~3 gün | Referans: maliisler/YRP_Project/src/lib/notificationService.ts**

#### 1A — Bildirim Altyapısı Yeniden Yapılandırma (1 gün)
- [ ] Fan-out pattern: notifications (master) + user_notifications/{userId}/items/ (per-user kopya)
- [ ] Bildirim tipleri: announcement (duyuru), meeting_invite, event_invite, poll_invite, election_update
- [ ] Hedefleme: all (herkese), region:{bölge} (bölge bazlı), role:{görev} (görev bazlı), single:{üye_id} (tek kişi)
- [ ] Okundu/okunmadı per-user (mevcut global sorun çözülür)
- [ ] Push notification entegrasyonu (bildirim oluşturulunca otomatik push)

#### 1B — Admin Duyuru/Bildirim Gönderme Paneli (1 gün)
- [ ] Bildirim oluşturma formu: başlık, mesaj, tip, hedef seçimi
- [ ] Hedef seçimi: tüm üyeler / belirli bölge / belirli görev / tek kişi dropdown
- [ ] Gönderim önizleme: "X kişiye gönderilecek" bilgisi
- [ ] Gönderim geçmişi tablosu (kim, kime, ne zaman, ne gönderdi)
- [ ] Zamanlı gönderim (tarih/saat seçip ileri tarihte gönder)

#### 1C — Üye Bildirim Drawer UI (1 gün)
- [ ] NotificationDrawer (Sidebar'dan açılan sağ panel — maliişler referansı)
- [ ] Zaman damgası: "5 dk önce", "2 gün önce" formatı
- [ ] Tip bazlı badge ve ikon (duyuru=megafon, toplantı=takvim, anket=soru)
- [ ] Okundu işaretle / tümünü okundu yap / sil
- [ ] Bildirime tıklayınca ilgili sayfaya git (toplantı daveti → toplantılar sayfası)

### Özellik 2: Bildirim ile Anket Entegrasyonu
**Efor: ~1 gün**

- [ ] Admin anket oluşturunca → tüm üyelere bildirim (poll_invite tipi)
- [ ] Üye bildirime tıklayınca → anket sayfasına yönlendir
- [ ] Anket sonuçları gerçek zamanlı güncelleme
- [ ] Anket kapatılınca → sonuç bildirimi gönder

### Özellik 3: Harita Üzerinde Ziyaret Takip
**Efor: ~2 hafta**

- [ ] Leaflet.js entegrasyonu (ücretsiz, açık kaynak harita kütüphanesi)
- [ ] Türkiye il/ilçe sınırları GeoJSON
- [ ] Mahalle bazlı renklendirme: yeşil=ziyaret edildi, kırmızı=edilmedi, sarı=kısmen
- [ ] Ziyaret oranı tooltip: mahalle üzerine gelince "%60 ziyaret edildi, son ziyaret: 15 Mart"
- [ ] Filtreler: ilçe, belde, tarih aralığı
- [ ] Dashboard'da mini harita widget

---

## GELECEKTEKİ BÜYÜK ÖZELLİKLER (Backlog)

### Multi-Tenant Mimari (Hafızada detaylı plan var)
- İl/ilçe/belde/kollar çok birimli yapı
- Her birim kendi üye/toplantı/etkinlik yönetimi
- Ortak toplantı/etkinlik desteği
- Genel merkez paneli
