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

        let globalStats = {
            totalProcessed: 0,
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 0,
            skippedRows: 0
        };

        const fileReports = [];

        // Dosya döngüsü
        for (const file of req.files) {
            const report = {
                fileName: file.originalname,
                status: 'error', // success, error, warning
                message: '',
                detectedColumns: {},
                totalRows: 0,
                validRows: 0,
                skippedRows: 0,
                sampleIgnoredReason: null
            };

            try {
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
                    report.message = 'Dosya boş veya veri okunamadı';
                    fileReports.push(report);
                    continue;
                }

                report.totalRows = data.length;

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

                report.detectedColumns = colMap;

                if (!colMap.tc) {
                    report.message = `TC sütunu bulunamadı. (Mevcut başlıklar: ${Object.keys(firstRow).join(', ')})`;
                    fileReports.push(report);
                    continue;
                }

                // Bulk operations
                const operations = data.map((row, index) => {
                    const tc = row[colMap.tc];

                    // TC var mı kontrol et
                    if (!tc) {
                        return { error: `Satır ${index + 1}: TC değeri boş` };
                    }

                    // TC temizle
                    const cleanTC = String(tc).replace(/\D/g, '');
                    if (cleanTC.length < 10) {
                        return { error: `Satır ${index + 1}: TC geçersiz (${tc} -> ${cleanTC})` };
                    }

                    const fullName = colMap.fullName ? row[colMap.fullName] : '';
                    const phone = colMap.phone ? row[colMap.phone] : '';
                    const district = colMap.district ? row[colMap.district] : '';
                    const region = colMap.region ? row[colMap.region] : '';
                    const role = colMap.role ? row[colMap.role] : '';

                    return {
                        updateOne: {
                            filter: { tc: cleanTC },
                            // Var olan kaydı güncellemek için
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
                });

                // Hatalı ve geçerli kayıtları ayır
                const validOperations = operations.filter(op => !op.error);
                const errors = operations.filter(op => op.error);

                report.validRows = validOperations.length;
                report.skippedRows = errors.length;
                if (errors.length > 0) {
                    report.sampleIgnoredReason = errors[0].error;
                }

                globalStats.skippedRows += report.skippedRows;

                if (validOperations.length > 0) {
                    const result = await Voter.bulkWrite(validOperations);

                    globalStats.totalProcessed += validOperations.length;
                    globalStats.matchedCount += result.matchedCount || 0;
                    globalStats.modifiedCount += result.modifiedCount || 0;
                    globalStats.upsertedCount += result.upsertedCount || 0;

                    report.status = 'success';
                    report.message = `${validOperations.length} kayıt işlendi.`;
                } else {
                    report.status = 'warning';
                    report.message = 'Hiçbir geçerli kayıt bulunamadı (TC hatalı veya filtreye takıldı).';
                }

            } catch (fileErr) {
                console.error(`Dosya hatası (${file.originalname}):`, fileErr);
                report.message = `Hata: ${fileErr.message}`;
            }

            fileReports.push(report);
        }

        res.json({
            message: 'İşlem tamamlandı',
            globalStats,
            fileReports
        });

    } catch (error) {
        console.error('General upload error:', error);
        res.status(500).json({ message: 'Yükleme sırasında genel hata oluştu', error: error.message });
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
