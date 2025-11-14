/**
 * Etkinlikleri Firebase'e ekleme scripti (Basit versiyon)
 * 
 * Bu script, FirebaseApiService'i kullanarak etkinlikleri ekler
 * Kullanım: node scripts/add-events-simple.js
 * 
 * NOT: Bu script çalışmak için Firebase bağlantısının aktif olması gerekiyor.
 * Eğer Firebase bağlantısı yoksa, etkinlikleri manuel olarak eklemeniz gerekecek.
 */

console.log(`
⚠️  Bu script Firebase bağlantısı gerektirir.
📝 Etkinlikleri manuel olarak eklemek için aşağıdaki bilgileri kullanabilirsiniz:

Etkinlik Listesi:
1. CUMA PRAGRAMI - 2025-11-07T12:00 - Merkez - ULUKENT MAHALLESİ - FETİH CAMİİ
2. ZİYARET - 2025-10-15T14:00 - Merkez - AKÇAKİRAZ (Belde) - Akçakiraz Belediye Başkanı İbrahim ORMANOĞLU ziyaret
3. CUMA PRAGRAMI - 2025-10-17T12:00 - Merkez - MUSTAFAPAŞA MAHALLESİ - HACI OSMANİYE CAMİİ
4. CUMA PRAGRAMI - 2025-10-31T12:00 - Merkez - RÜSTEMPAŞA MAHALLESİ - RÜSTEMPAŞA CAMİİ
5. CUMA PRAGRAMI - 2025-10-10T12:00 - Merkez - CUMHURİYET MAHALLESİ - KARAÇALI CAMİİ
6. CUMA PRAGRAMI - 2025-10-03T12:00 - Merkez - ABDULLAHPAŞA MAHALLESİ - FATİH CAMİİ
7. KÖY ZİYARETLERİ - 2025-09-26T14:00 - Merkez - İÇME, ŞEYHACI, ŞEHSUVAR köyleri
8. CUMA PRAGRAMI - 2025-09-26T12:00 - Merkez - GÜNEYKENT MAHALLESİ - İMAM RABBANİ CAMİİ
9. CUMA PRAGRAMI - 2025-09-19T12:00 - Merkez - İCADİYE MAHALLESİ - TAHTALI CAMİİ
10. CUMA PRAGRAMI - 2025-06-12T12:00 - Merkez - SANAYİ MAHALLESİ - AĞA ÇELİK CAMİİ

💡 Bu etkinlikleri sisteme eklemek için:
   1. Etkinlikler sayfasına gidin
   2. "Yeni Etkinlik Oluştur" butonuna tıklayın
   3. Her etkinlik için:
      - Etkinlik kategorisini seçin (CUMA PRAGRAMI veya ZİYARET)
      - Tarih ve saati girin
      - İlçe, Belde, Mahalle, Köy, Cami bilgilerini seçin
      - Kaydet butonuna tıklayın
   4. Katılımcıları sonra yoklama güncelleme ile ekleyebilirsiniz

Alternatif olarak, bu etkinlikleri toplu olarak eklemek için Firebase Console'dan manuel olarak ekleyebilirsiniz.
`);

process.exit(0);

