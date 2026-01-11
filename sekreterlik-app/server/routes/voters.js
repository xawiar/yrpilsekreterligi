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

// Excel ve CSV Yükleme Endpoint'i (Çoklu Dosya)
router.post('/upload', authenticateToken, isAdmin, upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Hiçbir dosya yüklenmedi' });
        }

        console.log(`Toplam ${req.files.length} dosya yüklendi.`);

        let totalProcessed = 0;
        let totalMatched = 0;
        let totalModified = 0;
        let totalUpserted = 0;
        const errors = [];
        const processedFiles = [];

        // Dosya döngüsü
        for (const file of req.files) {
            try {
                console.log(`Dosya işleniyor: ${file.originalname} (${file.size} bytes)`);

                // Dosya uzantısı kontrolü
                const isCsv = file.originalname.toLowerCase().endsWith('.csv');

                let workbook;
                // CSV için özel okuma denemesi
                if (isCsv) {
                    workbook = XLSX.read(file.buffer, { type: 'buffer', codepage: 65001, raw: true });
                } else {
                    workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
                }

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet);

                if (!data || data.length === 0) {
                    errors.push(`${file.originalname}: Dosya boş veya veri okunamadı`);
                    continue;
                }

                console.log(`${file.originalname}: ${data.length} satır okundu`);

                // Sütun Eşleştirme Tanımları
                const mappings = {
                    tc: ['TC', 'T.C.', 'TC NO', 'TC KİMLİK', 'TCKİMLİK', 'KİMLİK NO', 'TCNO', 'KIMLIK NO', 'KIMLIKNO'],
                    fullName: ['İsim Soyisim', 'Ad Soyad', 'Adı Soyadı', 'Ad', 'İsim', 'Tam Ad', 'ADI SOYADI', 'AD'],
                    phone: ['Telefon', 'Cep Tel', 'Cep Telefonu', 'Tel', 'Gsm', 'Mobil', 'TELEFON', 'CEP'],
                    district: ['İlçe', 'İlcesi', 'Semt', 'ILCE', 'İLÇE'],
                    region: ['Bölge', 'Bolge', 'Seçim Bölgesi', 'BOLGE', 'BÖLGE'],
                    role: ['Görev', 'Gorev', 'Ünvan', 'Unvan', 'Pozisyon', 'GÖREV', 'Sorumluluk']
                };

                const firstRow = data[0];
                const colMap = {};
                for (const [targetField, possibleHeaders] of Object.entries(mappings)) {
                    const foundKey = findKey(firstRow, possibleHeaders);
                    if (foundKey) colMap[targetField] = foundKey;
                }

                if (!colMap.tc) {
                    errors.push(`${file.originalname}: TC sütunu bulunamadı. (Mevcut başlıklar: ${Object.keys(firstRow).join(', ')})`);
                    continue;
                }

                // Bulk operations
                const operations = data.map(row => {
                    const tc = row[colMap.tc];
                    if (!tc) return null;

                    const cleanTC = String(tc).replace(/\D/g, '');
                    if (cleanTC.length < 10) return null;

                    const fullName = colMap.fullName ? row[colMap.fullName] : '';
                    const phone = colMap.phone ? row[colMap.phone] : '';
                    const district = colMap.district ? row[colMap.district] : '';
                    const region = colMap.region ? row[colMap.region] : '';
                    const role = colMap.role ? row[colMap.role] : '';

                    return {
                        updateOne: {
                            filter: { tc: cleanTC },
                            update: {
                                $set: {
                                    fullName: String(fullName || '').trim(),
                                    phone: String(phone || '').replace(/\s+/g, '').trim(),
                                    district: String(district || '').trim(),
                                    region: String(region || '').trim(),
                                    role: String(role || '').trim(),
                                    sourceFile: file.originalname,
                                    updatedAt: new Date()
                                }
                            },
                            upsert: true
                        }
                    };
                }).filter(op => op !== null);

                if (operations.length > 0) {
                    const result = await Voter.bulkWrite(operations);
                    totalProcessed += operations.length;
                    totalMatched += result.matchedCount || 0;
                    totalModified += result.modifiedCount || 0;
                    totalUpserted += result.upsertedCount || 0;
                    processedFiles.push(file.originalname);
                } else {
                    errors.push(`${file.originalname}: Geçerli veri satırı bulunamadı`);
                }

            } catch (fileErr) {
                console.error(`Dosya hatası (${file.originalname}):`, fileErr);
                errors.push(`${file.originalname}: Hata (${fileErr.message})`);
            }
        }

        res.json({
            message: processedFiles.length > 0 ? `${processedFiles.length} dosya işlendi` : 'Hiçbir dosya başarıyla işlenemedi',
            details: {
                processedFiles,
                errors
            },
            stats: {
                matchedCount: totalMatched,
                modifiedCount: totalModified,
                upsertedCount: totalUpserted,
                totalProcessed
            }
        });

    } catch (error) {
        console.error('General upload error:', error);
        res.status(500).json({ message: 'Yükleme sırasında hata oluştu', error: error.message });
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
