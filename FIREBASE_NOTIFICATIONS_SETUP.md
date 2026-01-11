# 🔔 Firebase Bildirimler (Notifications) Kurulum Kılavuzu

## ✅ Mevcut Durum

Bildirimler **ŞU ANDA ÇALIŞIYOR** olmalı! Çünkü:

1. ✅ **Firestore Rules:** Genel kural var (`match /{document=**}`) - Authenticated kullanıcılar tüm collection'lara erişebilir
2. ✅ **Kod:** `FirebaseApiService.js`'de notification metodları mevcut
3. ✅ **UI:** Member Dashboard'da notification gösterimi var

---

## 🔧 Firebase Console'da Yapılması Gerekenler

### 1. Firestore Rules Güncelleme (ÖNERİLİR)

Firebase Console → Firestore Database → Rules sekmesine gidin ve şu kuralları ekleyin:

```javascript
// Notifications Collection
match /notifications/{notificationId} {
  allow read: if isAuthenticated() && (
    resource.data.memberId == request.auth.uid ||
    resource.data.memberId == null ||
    !resource.data.memberId
  );
  allow create: if isAuthenticated();
  allow update: if isAuthenticated() && (
    resource.data.memberId == request.auth.uid ||
    resource.data.memberId == null ||
    !resource.data.memberId
  );
  allow delete: if isAuthenticated() && (
    resource.data.memberId == request.auth.uid ||
    resource.data.memberId == null ||
    !resource.data.memberId
  );
}
```

**VEYA** `firestore.rules` dosyasını Firebase'e deploy edin:

```bash
firebase deploy --only firestore:rules
```

---

### 2. Collection'ın Otomatik Oluşturulması

**Hiçbir şey yapmanıza gerek yok!** Firestore collection'ları otomatik oluşturulur. İlk notification oluşturulduğunda `notifications` collection'ı otomatik oluşacak.

---

## 🧪 Test Etme

### 1. Admin Olarak Test

1. Admin panelinde yeni bir **Poll**, **Meeting** veya **Event** oluşturun
2. Console'da şu mesajı görmelisiniz:
   ```
   ✅ In-app notification created for X members
   ```

### 2. Üye Olarak Test

1. Üye dashboard'una giriş yapın
2. Sağ üstteki bildirim ikonuna tıklayın
3. Yeni bildirimleri görmelisiniz:
   - "Yeni Anket/Oylama Oluşturuldu"
   - "Yeni Toplantı Oluşturuldu"
   - "Yeni Etkinlik Oluşturuldu"

### 3. Firebase Console'da Kontrol

1. Firebase Console → Firestore Database
2. `notifications` collection'ını kontrol edin
3. Bildirimlerin oluşturulduğunu görmelisiniz

---

## 📋 Bildirim Özellikleri

### Otomatik Oluşturma

- ✅ **Poll oluşturulduğunda:** Tüm aktif üyelere bildirim
- ✅ **Meeting oluşturulduğunda:** Tüm aktif üyelere bildirim
- ✅ **Event oluşturulduğunda:** Tüm aktif üyelere bildirim

### Bildirim Özellikleri

- **Title:** Bildirim başlığı
- **Body:** Bildirim içeriği
- **Type:** `poll`, `meeting`, `event`
- **Data:** JSON formatında ek bilgiler (pollId, meetingId, eventId)
- **Read:** Okundu/okunmadı durumu
- **ExpiresAt:** Otomatik silinme tarihi
  - Meeting/Event: 7 gün sonra
  - Poll: End date'de

---

## ⚠️ Sorun Giderme

### Bildirimler Görünmüyor

1. **Firebase Console'da kontrol edin:**
   - Firestore Database → `notifications` collection
   - Bildirimler var mı?

2. **Console'da hata var mı?**
   - Browser console'u açın (F12)
   - Hata mesajları var mı?

3. **Firestore Rules kontrolü:**
   - Firebase Console → Firestore Database → Rules
   - `notifications` collection için kural var mı?

### Bildirim Oluşturulmuyor

1. **Console'da hata mesajı var mı?**
   - `Error creating in-app notification` mesajı görünüyor mu?

2. **Üye sayısı kontrolü:**
   - Aktif üye var mı? (`archived = false`)

3. **Firebase Authentication:**
   - Kullanıcı giriş yapmış mı?

---

## ✅ Özet

- **Çalışıyor mu?** ✅ Evet, genel Firestore rules sayesinde çalışıyor
- **Ekstra ayar gerekli mi?** ⚠️ Önerilir (daha güvenli rules)
- **Collection oluşturma:** ✅ Otomatik (ilk notification'da oluşur)
- **Test:** Admin olarak poll/meeting/event oluşturun, üye dashboard'da kontrol edin

---

## 🚀 Hızlı Test

1. Admin olarak giriş yapın
2. Yeni bir Poll oluşturun
3. Üye dashboard'una giriş yapın
4. Bildirim ikonuna tıklayın
5. "Yeni Anket/Oylama Oluşturuldu" bildirimini görmelisiniz!

