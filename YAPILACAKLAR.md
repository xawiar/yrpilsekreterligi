# YAPILACAKLAR — Gelecek Ozellikler

**Son guncelleme:** 4 Nisan 2026

---

## YENI OZELLIK: RSVP — Toplanti/Etkinlik Katilim Yaniti
**Efor: ~1 gun**

- [ ] Toplanti/etkinlik planlandiginda bildirimde RSVP butonlari: [Katilacagim] [Katilamayacagim] [Belirsiz]
- [ ] Uye yaniti Firestore'a kaydedilir (meeting_rsvp koleksiyonu)
- [ ] Admin toplanti detayinda RSVP ozeti: "45 katilacak, 12 katilamayacak, 8 belirsiz"
- [ ] Toplanti gunu: "Katilacagim" → varsayilan "Katildi", "Katilamayacagim" → "Mazeretli"
- [ ] Toplantidan 1 gun ve 1 saat once hatirlatma bildirimi

---

## YENI OZELLIK: PUBLIC BASVURU SAYFASI

- [ ] Public basvuru formu (/public/apply) — Ad Soyad, TC, Telefon, Ilce, Basvuru nedeni, KVKK onay (1 gun)
- [ ] Firestore membership_applications koleksiyonu + CRUD (yarim gun)
- [ ] Admin "Basvurular" sekmesi — liste + onayla/reddet/gorusmeye cagir (1 gun)
- [ ] Onay sonrasi otomatik uye olustur + hesap ac (yarim gun)
- [ ] Yeni basvuru gelince admin'e bildirim (15dk)
- [ ] Rate limiting — IP basina 3 basvuru/gun (15dk)

---

## OPSIYONEL MIMARI IYILESTIRME

- [ ] **View sistemi → React Router nested routes** — URL'ye yansiyan navigasyon, tarayici geri tusu calisir, lazy loading (3-4 saat)

---

## GELECEKTEKI BUYUK OZELLIKLER (Backlog)

### Multi-Tenant Mimari
- Il/ilce/belde/kollar cok birimli yapi
- Her birim kendi uye/toplanti/etkinlik yonetimi
- Genel merkez paneli

---

## NOTLAR
- Yapilan madde YAPILANLAR.md'ye tasinacak
- RSVP ozelligi kullanici onayi ile baslanacak
