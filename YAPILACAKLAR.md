# YAPILACAKLAR — Kalan Isler

**Son guncelleme:** 4 Nisan 2026

---

## TEMA OZELLESTIRME (Yeni Ozellik)

- [ ] Renk temasi secimi — Admin panelden primary renk secimi (2 saat)
- [ ] Tema sablonlari — "YRP Yesil", "AKP Turuncu", "CHP Kirmizi" hazir temalar (1 saat)
- [ ] Login sayfasi ozellestirme — Parti logosu, arka plan rengi, slogan (1 saat)
- [ ] Sidebar renk temasi (1 saat)
- [ ] Favicon degistirme (30dk)
- [ ] Footer ozellestirme — Copyright metni, firma adi (30dk)
- [ ] Public sayfa ozellestirme — Secim sonuclari parti logosu ve renkleri (30dk)
- [ ] Logo Firebase Storage'a tasi — Base64 yerine Storage URL (1.5 saat)
- [ ] PWA manifest guncelleme (1 saat)
- [ ] Canli onizleme (2 saat)

---

## GELECEKTEKI BUYUK OZELLIKLER (Backlog)

### Multi-Tenant Mimari
- Il/ilce/belde/kollar cok birimli yapi
- Her birim kendi uye/toplanti/etkinlik yonetimi
- Genel merkez paneli

## BİLDİRİM İKONU PROFESYONELLEŞTİRME

- [ ] **icon-192x192.png değiştir** — Parti logosu, yuvarlak maskelenmiş, yeşil arka plan (YRP için). Bildirim geldiğinde Instagram/Facebook gibi renkli yuvarlak ikon görünsün. Mevcut generic ikon kaldır (15dk — grafik hazırla + dosya değiştir)
- [ ] **badge-72x72.png değiştir** — Tek renk beyaz silüet, şeffaf arka plan. Android üst çubuğundaki küçük ikon bu. Monochrome olmalı (15dk)
- [ ] **icon-512x512.png değiştir** — Büyük parti logosu, PWA yükleme ekranı ve app store görünümü için (15dk)
- [ ] **SW badge alanı fix** — sw.js'de badge'e sayı string yazılıyor (`badgeCount.toString()`), bu yanlış. Badge her zaman ikon URL olmalı: `/badge-72x72.png`. Badge count ayrı `data` alanında taşınmalı (10dk)
- [ ] **Manifest icons maskable** — manifest.json'daki ikonlara `"purpose": "any maskable"` ekle. Android'de ikon otomatik yuvarlak/kare maskelenir (5dk)

## FOOTER TASARIMI — ÇOK KÖTÜ GÖRÜNÜYOR

- [ ] **Footer minimal olmalı** — Şu an py-6 padding + 2 satır metin + max-w-7xl çok şişkin, "emanet gibi" duruyor. Tek satır, küçük, sayfanın alt kenarına yapışık olmalı. Örnek: `© 2026 DAT Dijital` tek satır, py-2, text-xs, ortalanmış. "Teknik destek ve iletişim için" cümlesi kaldırılmalı. Footer sayfa içeriğinin parçası gibi görünmeli, ayrı büyük bir blok gibi değil. (15dk)
