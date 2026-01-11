const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Voter = require('../models/Voter');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Multer conf - bellekte tut
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Yardımcı fonksiyon: Sütun adını normalize et ve eşleşen anahtarı bul
const findKey = (row, possibleKeys) => {
    const rowKeys = Object.keys(row);
    return rowKeys.find(key => {
        const normalizedKey = key.toLowerCase().replace(/\./g, '').replace(/\s+/g, '').trim();
        return possibleKeys.some(pK => normalizedKey === pK.toLowerCase().replace(/\./g, '').replace(/\s+/g, '').trim()) || possibleKeys.includes(key);
    });
};

// Excel Yükleme Endpoint'i
router.post('/upload', authenticateToken, isAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Dosya yüklenmedi' });
        }

        console.log('Dosya yükleniyor:', req.file.originalname, 'Boyut:', req.file.size);

        // Dosya türüne göre okuma ayarları
        let readOpts = { type: 'buffer', cellDates: true };

        // CSV ise delimiter tahmin etmeye çalışabiliriz ama xlsx genelde iyi iş çıkarır.
        // Gerekirse raw: true ile okuyup kendimiz parse edebiliriz ama şimdilik standart okuma.

        const workbook = XLSX.read(req.file.buffer, readOpts);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Header'ı temizlemek için range ayarı yapılabilir ama default bırakalım
        const data = XLSX.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'Dosya boş veya veri okunamadı' });
        }

        console.log('Okunan satır sayısı:', data.length);
        if (data.length > 0) {
            console.log('İlk satır örneği (Header tespiti için):', JSON.stringify(data[0]));
        }

        // Sütun Eşleştirme Tanımları (Genişletilmiş)
        const mappings = {
            tc: ['TC', 'T.C.', 'TC NO', 'TC KİMLİK', 'TCKİMLİK', 'KİMLİK NO', 'TCNO'],
            fullName: ['İsim Soyisim', 'Ad Soyad', 'Adı Soyadı', 'Ad', 'İsim', 'Tam Ad'],
            phone: ['Telefon', 'Cep Tel', 'Cep Telefonu', 'Tel', 'Gsm', 'Mobil'],
            district: ['İlçe', 'İlcesi', 'Semt'],
            region: ['Bölge', 'Bolge', 'Seçim Bölgesi'],
            role: ['Görev', 'Gorev', 'Ünvan', 'Unvan', 'Pozisyon']
        };

        // İlk veri satırından hangi key'in hangisine denk geldiğini bulalım
        // (Her satırda keyler değişmez ama yine de sağlam olsun diye ilk satıra bakıp map çıkarıyoruz)
        const firstRow = data[0];
        const colMap = {};

        // Her hedef alan için (tc, fullName vs.) dosyadaki karşılığını bul
        for (const [targetField, possibleHeaders] of Object.entries(mappings)) {
            const foundKey = findKey(firstRow, possibleHeaders);
            if (foundKey) {
                colMap[targetField] = foundKey;
            }
        }

        console.log('Sütun Eşleştirmesi:', colMap);

        if (!colMap.tc) {
            const foundHeaders = Object.keys(firstRow).join(', ');
            return res.status(400).json({
                message: `Zorunlu 'TC' sütunu bulunamadı.`,
                details: `Dosyadaki başlıklar: ${foundHeaders}. Lütfen sütun adını 'TC', 'T.C.' veya 'TC NO' olarak düzeltin.`
            });
        }

        // Bulk operations hazırlığı
        const operations = data.map((row, index) => {
            // Map kullanarak değerleri al
            const tc = row[colMap.tc]; // TC zorunlu

            // TC yoksa bu satırı atla
            if (!tc) return null;

            // Diğer alanları al (varsa)
            const fullName = colMap.fullName ? row[colMap.fullName] : '';
            const phone = colMap.phone ? row[colMap.phone] : '';
            const district = colMap.district ? row[colMap.district] : '';
            const region = colMap.region ? row[colMap.region] : '';
            const role = colMap.role ? row[colMap.role] : '';

            // TC temizle (sadece rakam kalsın)
            const cleanTC = String(tc).replace(/\D/g, '');

            if (cleanTC.length < 10) return null; // Geçersiz TC

            return {
                updateOne: {
                    filter: { tc: cleanTC },
                    update: {
                        $set: {
                            fullName: String(fullName || '').trim(),
                            phone: String(phone || '').replace(/\s+/g, '').trim(), // Telefonu temizle
                            district: String(district || '').trim(),
                            region: String(region || '').trim(),
                            role: String(role || '').trim(),
                            sourceFile: req.file.originalname,
                            updatedAt: new Date()
                        }
                    },
                    upsert: true
                }
            };
        }).filter(op => op !== null);

        if (operations.length > 0) {
            const result = await Voter.bulkWrite(operations);
            console.log('BulkWrite Sonucu:', result);

            res.json({
                message: 'İşlem başarılı',
                // Mongoose bulkWrite result yapısı
                matchedCount: result.matchedCount || 0,
                modifiedCount: result.modifiedCount || 0,
                upsertedCount: result.upsertedCount || 0,
                totalProcessed: operations.length
            });
        } else {
            res.status(400).json({ message: 'İşlenecek geçerli veri bulunamadı. TC sütunlarını kontrol edin.' });
        }

    } catch (error) {
        console.error('Excel upload error:', error);
        res.status(500).json({ message: 'Dosya işlenirken hata oluştu', error: error.message });
    }
});

// Arama Endpoint'i
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const searchRegex = new RegExp(q, 'i');

        // Hem TC, hem İsim, hem Telefon araması
        const voters = await Voter.find({
            $or: [
                { tc: searchRegex },
                { fullName: searchRegex },
                { phone: searchRegex }
            ]
        }).limit(50);

        res.json(voters);

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Arama sırasında hata oluştu' });
    }
});

module.exports = router;
