# YAPILACAKLAR — Kalan Geliştirmeler + Yeni Özellikler

**Son güncelleme:** 4 Nisan 2026
**Mevcut puan:** ~9.5/10
**Hedef:** 10/10 + yeni özellikler

---

## KALAN BUGLAR & EKSİKLER

- [x] ~~BUG: Veri silme talepleri Firebase entegrasyonu~~ (Dalga 3'te düzeltildi)
- [x] ~~Storage rules MIME type kontrolü~~ (2057983)
- [x] ~~BUG: Firestore composite index eksik~~ (2057983)
- [x] ~~BUG: EmptyDocumentsState DOM nesting hatası~~ (2057983)
- [x] ~~PERFORMANS: Aşırı Firestore okuma — in-memory cache eklendi~~ (2057983)

---

## YENİ ÖZELLİKLER — HEMFİKİR OLUNAN PLAN

### Özellik 1: Bildirim Sistemi Genişletme (Maliişler Referanslı)
**Efor: ~3 gün | Referans: maliisler/YRP_Project/src/lib/notificationService.ts**

Maliişler'deki fan-out pattern + drawer UI + manuel bildirim sistemi sekreterliğe uyarlanacak:

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

### Özellik 4: Yoklama Pratik Çözüm (Araştırılacak)
**Durum: Henüz ideal çözüm bulunmadı**

Mevcut: "Tümü Katıldı" + istisnaları çıkar (toplu yoklama butonu eklendi)
Araştırılacak alternatifler:
- [ ] QR kod: Dinamik (30sn yenileme), üye telefondan okutup "katıldım" der
- [ ] Bluetooth proximity: Toplantı mekanında beacon
- [ ] NFC: Giriş kapısında NFC okuyucu
- [ ] Başka fikirler?

---

## GELECEKTEKİ BÜYÜK ÖZELLİKLER (Backlog)

### Multi-Tenant Mimari (Hafızada detaylı plan var)
- İl/ilçe/belde/kollar çok birimli yapı
- Her birim kendi üye/toplantı/etkinlik yönetimi
- Ortak toplantı/etkinlik desteği
- Genel merkez paneli

### Satış Öncesi
- Demo ortamı (örnek verili)
- Tanıtım sayfası
- Fiyatlandırma paketi

---

## NOTLAR

- Yapılan madde YAPILACAKLAR'dan silinip YAPILANLAR'a taşınacak
- Yeni özellikler hemfikir olunan öncelik sırasına göre
- Multi-tenant mimari ayrı fazda planlanacak
