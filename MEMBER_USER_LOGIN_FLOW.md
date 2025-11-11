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

## Sonuç

**Baz alınan yer**: Önce **Firebase Auth**, eğer yoksa **Firestore `member_users` collection'ı**

Bu hibrit sistem sayesinde:
- Firebase Auth'da olmayan kullanıcılar da giriş yapabilir
- İlk girişte otomatik olarak Firebase Auth'a kaydedilir
- Sonraki girişlerde Firebase Auth kullanılır (daha hızlı)
- **Eşleşme zorunlu değil, ama önerilir**

