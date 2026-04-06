# YAPILACAKLAR — Kalan Isler

**Son guncelleme:** 6 Nisan 2026

---

## TEMA OZELLESTIRME ✅ TAMAMLANDI

- [x] Renk temasi secimi — HSL tabanli palette olusturucu + hex input (tamamlandi)
- [x] Tema sablonlari — YRP, AKP, CHP, MHP, IYI, DEVA, varsayilan preset'ler (tamamlandi)
- [x] Login sayfasi ozellestirme — Parti logosu, arka plan, slogan (zaten primary-* kullaniyor)
- [x] Sidebar renk temasi — primary-* Tailwind class'lari ile otomatik (tamamlandi)
- [x] Favicon degistirme — Upload + dinamik guncelleme (tamamlandi)
- [x] Footer ozellestirme — Firestore'dan yukle, admin panelden duzenle (tamamlandi)
- [x] Public sayfa parti renkleri — 12 parti icin resmi renkler (tamamlandi)
- [x] Logo Firebase Storage'a tasi — base64 yerine Storage URL secenegi (tamamlandi)
- [x] PWA manifest guncelleme — Dinamik blob URL ile guncelleme (tamamlandi)
- [x] Canli onizleme — Kart, butonlar, metin, sidebar simulasyonu (tamamlandi)

---

## BILDIRIM IKONU PROFESYONELLESTIRME

- [x] **Manifest icons maskable** — purpose: "any maskable" eklendi (tamamlandi)
- [ ] **icon-192x192.png degistir** — Parti logosu, yuvarlak maskelenmis, yesil arka plan (grafik gerekli)
- [ ] **badge-72x72.png degistir** — Tek renk beyaz siluet, seffaf arka plan (grafik gerekli)
- [ ] **icon-512x512.png degistir** — Buyuk parti logosu, PWA yukleme ekrani icin (grafik gerekli)
- [x] **SW badge fix** — badgeCount degiskeni temizlendi, badge her zaman ikon URL (tamamlandi)

> **NOT:** Ikon dosyalari grafik tasarim gerektirir. Admin panelden AppBrandingSettings ile yuklenebilir.

---

## FOOTER TASARIMI ✅ TAMAMLANDI

- [x] Minimal tek satir — py-2, text-xs, ortalanmis (tamamlandi)
- [x] Firestore'dan ozellestirilebilir footer metni (tamamlandi)

---

## GELECEKTEKI BUYUK OZELLIKLER (Backlog)

### Multi-Tenant Mimari
- Il/ilce/belde/kollar cok birimli yapi
- Her birim kendi uye/toplanti/etkinlik yonetimi
- Genel merkez paneli

### Cloud Functions Deploy
- VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ENCRYPTION_KEY env var'lar ayarlanmali
- `firebase deploy --only functions` ile deploy edilmeli
