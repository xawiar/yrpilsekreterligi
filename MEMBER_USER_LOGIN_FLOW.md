# 🔐 Üye Kullanıcı Giriş Akışı (Login Flow)

## Soru
Üye kullanıcısı giriş yaptığında girdiği kullanıcı adı ve şifresi Firebase tarafında nereden kontrol ediliyor? Firebase Auth mı yoksa `member_users` collection'ı mı?

## Cevap: **İKİSİ DE KULLANILIYOR** (Hibrit Sistem)

### Giriş Akışı (Login Flow)

```
1. Kullanıcı username ve password girer
   ↓
2. Firebase Auth ile giriş yapmayı dene
   ├─ ✅ Başarılı → Giriş yapıldı
   └─ ❌ Başarısız (user-not-found veya invalid-credential)
      ↓
3. Firestore'daki `member_users` collection'ından kullanıcıyı bul
   ├─ Kullanıcı bulunamadı → "Kullanıcı bulunamadı" hatası
   └─ Kullanıcı bulundu
      ↓
4. Firestore'daki password ile karşılaştır
   ├─ Şifre yanlış → "Şifre hatalı" hatası
   └─ Şifre doğru
      ↓
5. Firebase Auth ile senkronize et
   ├─ authUid varsa → Mevcut Firebase Auth kullanıcısı ile giriş yap
   └─ authUid yoksa → Yeni Firebase Auth kullanıcısı oluştur
      ↓
6. Firestore'daki `member_users` kaydını güncelle (authUid ekle)
   ↓
7. Giriş başarılı ✅
```

## Detaylı Açıklama

### 1. Öncelik: Firebase Auth
- İlk olarak **Firebase Auth** ile giriş yapmayı dener
- Email formatı: `username@ilsekreterlik.local`
- Eğer Firebase Auth'da kullanıcı varsa ve şifre doğruysa, direkt giriş yapılır

### 2. Fallback: Firestore `member_users`
- Firebase Auth'da kullanıcı bulunamazsa veya şifre hatalıysa
- **Firestore'daki `member_users` collection'ından** kullanıcıyı arar
- `username` field'ına göre arama yapar
- Bulunan kullanıcının `password` field'ını kontrol eder

### 3. Password Karşılaştırması
- Firestore'daki password şifrelenmiş olabilir (`U2FsdGVkX1` ile başlıyorsa)
- Şifrelenmişse decrypt edilir
- Normalize edilir (sadece rakamlar)
- Kullanıcının girdiği şifre ile karşılaştırılır

### 4. Senkronizasyon
- Şifre doğruysa, Firebase Auth ile senkronize edilir:
  - Eğer `authUid` varsa → Mevcut Firebase Auth kullanıcısı ile giriş yapılır
  - Eğer `authUid` yoksa → Yeni Firebase Auth kullanıcısı oluşturulur
- Firestore'daki `member_users` kaydı güncellenir (`authUid` eklenir)

## Önemli Notlar

### ✅ Avantajlar
1. **Esneklik**: Firebase Auth'da olmayan kullanıcılar da giriş yapabilir
2. **Otomatik Senkronizasyon**: İlk girişte Firebase Auth'a otomatik kaydedilir
3. **Güvenlik**: Password'lar Firestore'da şifrelenmiş olarak saklanabilir

### ⚠️ Dikkat Edilmesi Gerekenler
1. **Password Normalizasyonu**: Hem Firestore'daki hem de kullanıcı girdisi normalize edilir (sadece rakamlar)
2. **Şifreleme**: Firestore'daki password şifrelenmişse decrypt edilir
3. **authUid**: Firebase Auth ile senkronize edildikten sonra `authUid` Firestore'a kaydedilir

## Kod Konumu

- **Dosya**: `sekreterlik-app/client/src/utils/FirebaseApiService.js`
- **Fonksiyon**: `static async login(username, password)`
- **Satır**: 65-431

## Eşleşme Gereksinimi

### ❌ HAYIR - Eşleşme Zorunlu Değil

**Firebase Auth ve `member_users` eşleşmesi zorunlu değildir.** Sistem esnek çalışır:

### Senaryo 1: Firebase Auth'da Kullanıcı Var
- ✅ **Giriş yapılabilir** (şifre doğruysa)
- ⚠️ `member_users` kontrolü yapılmaz
- ⚠️ Eğer `member_users`'da yoksa, member bilgileri alınamaz

### Senaryo 2: `member_users`'da Kullanıcı Var, Firebase Auth'da Yok
- ✅ **Giriş yapılabilir** (şifre doğruysa)
- ✅ Otomatik olarak Firebase Auth'a senkronize edilir
- ✅ `authUid` Firestore'a kaydedilir

### Senaryo 3: İkisinde de Kullanıcı Var
- ✅ **Giriş yapılabilir** (şifre doğruysa)
- ✅ Firebase Auth kullanılır (daha hızlı)
- ✅ `member_users` kontrolü yapılmaz

### Senaryo 4: İkisinde de Kullanıcı Yok
- ❌ **Giriş yapılamaz**
- ❌ "Kullanıcı bulunamadı" hatası

## Önerilen Durum

**İdeal durum**: Her iki yerde de kullanıcı olmalı ve eşleşmeli:
- Firebase Auth → Hızlı giriş için
- `member_users` → Member bilgileri için
- `authUid` → İkisini bağlamak için

## Şifre Uyumsuzluğu Senaryosu

### Soru: Firebase Auth şifresi ile `member_users` şifresi farklıysa ne olur?

### Senaryo 1: Firebase Auth'da Kullanıcı Var, Şifre Yanlış
```
1. Firebase Auth ile giriş yapmayı dene
   ↓
2. ❌ Şifre yanlış (auth/invalid-credential)
   ↓
3. Firestore'dan kullanıcıyı bul
   ↓
4. Firestore şifresi doğru mu?
   ├─ ✅ Doğru → Firebase Auth'a Firestore şifresi ile giriş yapmayı dene
   │   ├─ ✅ Başarılı → Giriş yapıldı (Firebase Auth şifresi değişmedi)
   │   └─ ❌ Başarısız (email-already-in-use ama şifre farklı)
   │       ↓
   │       authUid temizlenir
   │       ↓
   │       Hata mesajı: "Firebase Auth'daki kullanıcı şifresi Firestore'daki şifreyle eşleşmiyor"
   │       ↓
   │       Bir sonraki login denemesinde yeni Firebase Auth kullanıcısı oluşturulur
   └─ ❌ Yanlış → "Şifre hatalı" hatası
```

### Senaryo 2: Firebase Auth'da Kullanıcı Var, Şifre Doğru
```
1. Firebase Auth ile giriş yapmayı dene
   ↓
2. ✅ Şifre doğru → Giriş başarılı
   ↓
3. Firestore kontrolü yapılmaz
   ↓
4. ⚠️ Eğer Firestore şifresi farklıysa, bu fark edilmez
```

### Önemli Notlar

⚠️ **Sorun**: Firebase Auth şifresi ile Firestore şifresi farklıysa:
- İlk girişte Firebase Auth şifresi kullanılır (eğer doğruysa)
- Firestore şifresi kontrol edilmez
- Şifreler senkronize değilse sorun çıkar

✅ **Çözüm**: 
- "Tüm Kullanıcıları Güncelle" butonuna tıklayın
- Bu işlem Firebase Auth şifrelerini Firestore şifreleriyle senkronize eder
- Server-side Firebase Admin SDK ile şifre güncellemesi yapılır

### Şifre Güncelleme Mekanizması

1. **Manuel Güncelleme**: Üye telefon numarası değiştirildiğinde
   - Firestore'daki `member_users` password güncellenir
   - Eğer `authUid` varsa, server-side endpoint ile Firebase Auth şifresi güncellenir

2. **Toplu Güncelleme**: "Tüm Kullanıcıları Güncelle" butonu
   - Tüm üyelerin telefon numaraları kontrol edilir
   - Firestore'daki password'lar güncellenir
   - Firebase Auth şifreleri server-side güncellenir

## Sonuç

**Baz alınan yer**: Önce **Firebase Auth**, eğer yoksa **Firestore `member_users` collection'ı**

Bu hibrit sistem sayesinde:
- Firebase Auth'da olmayan kullanıcılar da giriş yapabilir
- İlk girişte otomatik olarak Firebase Auth'a kaydedilir
- Sonraki girişlerde Firebase Auth kullanılır (daha hızlı)
- **Eşleşme zorunlu değil, ama önerilir**

**Şifre Uyumsuzluğu**: 
- Firebase Auth şifresi yanlışsa → Firestore kontrol edilir
- Firestore şifresi doğruysa → Firebase Auth'a Firestore şifresi ile giriş yapılır
- Eğer Firebase Auth'da kullanıcı varsa ama şifre farklıysa → authUid temizlenir ve hata verilir
- **Önerilen**: "Tüm Kullanıcıları Güncelle" ile şifreleri senkronize edin

