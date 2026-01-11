# 🔓 Member Users Password Şifreleme Düzeltme Rehberi

## Sorun
Firestore'da `member_users` collection'ındaki `password` field'ları şifrelenmiş olarak görünüyor. Artık bu field'lar şifrelenmeyecek.

## Çözüm

### 1. Otomatik Düzeltme (Önerilen)

"Üye Kullanıcıları" sayfasından **"Tüm Kullanıcıları Güncelle"** butonuna tıklayın. Bu işlem:
- Tüm `member_users` kayıtlarını güncelleyecek
- Şifrelenmiş `password` field'larını decrypt edip tekrar kaydedecek
- Artık yeni kayıtlar şifrelenmeyecek

### 2. Manuel Düzeltme (Gerekirse)

Eğer otomatik düzeltme çalışmazsa, Firebase Console'dan manuel olarak:

1. Firebase Console → Firestore Database → Data
2. `member_users` collection'ını açın
3. Her doküman için:
   - `password` field'ını kontrol edin
   - Eğer `U2FsdGVkX1` ile başlıyorsa (şifrelenmiş), decrypt edin
   - Decrypt edilmiş değeri tekrar kaydedin

**Not:** Bu işlem çok sayıda kayıt varsa zaman alabilir.

## Teknik Detaylar

- Artık tüm `FirebaseService.create()` ve `FirebaseService.update()` çağrılarında `encrypt = false` kullanılıyor
- Yeni oluşturulan `member_users` kayıtları şifrelenmeyecek
- Mevcut şifrelenmiş kayıtlar "Tüm Kullanıcıları Güncelle" ile düzeltilecek

## Test

1. Firebase Console → Firestore Database → Data
2. `member_users` collection'ını açın
3. Bir doküman seçin
4. `password` field'ını kontrol edin
5. Artık normal telefon numarası (sadece rakamlar) görünmeli, şifrelenmiş string değil

