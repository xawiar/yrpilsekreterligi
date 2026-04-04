# YAPILACAKLAR — Gelecek Ozellikler

**Son guncelleme:** 3 Nisan 2026

---

## TEMİZLİK

- [ ] **VisitMap component'i ve elazigDistricts.json kaldır** — Harita özelliğinden vazgeçildi. Sahte GeoJSON (kare kutular), gerçek mahalle sınırı verisi yok. VisitMap.jsx + data/elazigDistricts.json sil, Dashboard'dan VisitMap referanslarını kaldır (15dk) *(kullanıcıya sorulacak)*

---

## OPSIYONEL MIMARI IYILESTIRME

- [ ] **View sistemi → React Router nested routes** — URL'ye yansiyan navigasyon, tarayici geri tusu calisir, lazy loading (3-4 saat)

---

## GELECEKTEKI OZELLIKLER

- [ ] **Gerçek push notification** — NotificationService.js:348-364 `_sendPushNotifications()` şu an sadece log basıyor. Backend'e web-push endpoint ekle (maliişler /api/send-push referansı). Uygulama kapalıyken bile telefon bildirim çubuğunda görünsün (2-3 saat)

---

## GELECEKTEKI BUYUK OZELLIKLER (Backlog)

### Multi-Tenant Mimari
- Il/ilce/belde/kollar cok birimli yapi
- Her birim kendi uye/toplanti/etkinlik yonetimi
- Genel merkez paneli

---

## ACİL — PUBLIC SEÇİM SONUÇLARI SAYFASI CANLI'DA ÇALIŞMIYOR

- [ ] **Tüm API istekleri localhost:5000'e gidiyor** — PublicElectionResultsPage veya ElectionResultsPage veri çekerken USE_FIREBASE kontrolü yapmadan doğrudan backend API'ye istek atıyor. Canlıda backend yok. Çözüm: Firebase modunda seçim verilerini Firestore'dan çek (FirebaseApiService veya doğrudan Firestore sorgusu). PublicApiService.js'teki tüm metodlara Firebase alternatifi ekle (2-3 saat)
- [ ] **Service Worker eski URL'leri cache'lemiş** — workbox localhost:5000 URL'lerini cache'e almış, canlıda ERR_FAILED döndürüyor. Çözüm: Deploy sonrası SW force update veya cache temizleme. vite.config.js'te workbox navigateFallback ve runtimeCaching ayarlarını kontrol et, localhost URL'lerini cache'den hariç tut (30dk)
