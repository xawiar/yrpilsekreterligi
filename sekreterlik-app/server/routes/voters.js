const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Voter = require('../models/Voter');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Klasör yoksa oluştur (Her ihtimale karşı)
const uploadDir = path.join(__dirname, '../uploads/voters');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer conf - belleğe değil diske kaydet
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        // Dosya ismini tarihle benzersiz yapalım (Türkçe karakterleri temizleyerek)
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB olsun
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
router.post('/upload', authenticateToken, requireAdmin, upload.array('files'), async (req, res) => {
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
                let data;
                let usedEncoding = 'UTF-8';

                // 1. İlk Deneme: UTF-8 (codepage: 65001)
                if (isCsv) {
                    workbook = XLSX.readFile(file.path, { type: 'file', codepage: 65001, raw: true });
                } else {
                    workbook = XLSX.readFile(file.path, { type: 'file', cellDates: true });
                }

                let sheetName = workbook.SheetNames[0];
                let sheet = workbook.Sheets[sheetName];
                data = XLSX.utils.sheet_to_json(sheet);

                // 2. Kontrol ve İkinci Deneme: Windows-1254 (Turkish)
                // Eğer data boşsa veya başlıklar bozuksa ( karakteri varsa) veya TC bulunamazsa
                if (isCsv && data && data.length > 0) {
                    const firstRowKeys = Object.keys(data[0]).join('');
                    const hasReplacementChar = firstRowKeys.includes('') || firstRowKeys.includes('');

                    // Basit bir kontrol: TC sütununu UTF-8 ile bulamıyorsak
                    const tempFirstRow = data[0];
                    const tempTcFound = findKey(tempFirstRow, ['TC', 'T.C.', 'TC NO', 'TC KİMLİK', 'TCKİMLİK', 'KİMLİK NO', 'TCNO']);

                    if (hasReplacementChar || !tempTcFound) {
                        console.log(`[Encoding] ${file.originalname} dosyasında UTF-8 sorunu algılandı, Windows-1254 deneniyor...`);
                        workbook = XLSX.readFile(file.path, { type: 'file', codepage: 1254, raw: true });
                        sheetName = workbook.SheetNames[0];
                        sheet = workbook.Sheets[sheetName];
                        data = XLSX.utils.sheet_to_json(sheet);
                        usedEncoding = 'Windows-1254';
                    }
                }

                if (!data || data.length === 0) {
                    report.message = 'Dosya boş veya veri okunamadı';
                    fileReports.push(report);
                    continue;
                }

                report.totalRows = data.length;

                // Sütun Eşleştirme Tanımları
                const mappings = {
                    tc: ['TC', 'T.C.', 'TC NO', 'TC KİMLİK', 'TCKİMLİK', 'KİMLİK NO', 'TCNO', 'KIMLIK NO', 'KIMLIKNO'],
                    fullName: ['İsim Soyisim', 'Ad Soyad', 'Adı Soyadı', 'Ad Soyadı', 'Isim Soyisim', 'Tam Ad', 'ADI SOYADI', 'AD SOYAD'],
                    firstName: ['Ad', 'İsim', 'Adi', 'Isim', 'AD', 'ISIM'],
                    lastName: ['Soyad', 'Soyisim', 'Soyadı', 'Soyadi', 'SOYAD', 'SOYISIM'],
                    phone: ['Telefon', 'Cep Tel', 'Cep Telefonu', 'Tel', 'Gsm', 'Mobil', 'TELEFON', 'CEP'],
                    district: ['İlçe', 'İlcesi', 'Semt', 'ILCE', 'İLÇE'],
                    province: ['İl', 'Sehir', 'Vilayet', 'Kent', 'IL', 'SEHIR'],
                    village: ['Köy', 'Koy', 'Köyü', 'Koyu', 'KOY', 'KOYU'],
                    neighborhood: ['Mahalle', 'Mah', 'Mahallesi', 'MAHALLE', 'MAH'],
                    birthDate: ['Doğum Tarihi', 'D.Tarihi', 'DTarihi', 'DogumTarihi', 'DOGUM TARIHI', 'DOGUMTARIHI'],
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

                    // İsim Soyisim Birleştirme Mantığı
                    let fullName = colMap.fullName ? row[colMap.fullName] : '';
                    if (!fullName && colMap.firstName && colMap.lastName) {
                        const first = row[colMap.firstName] || '';
                        const last = row[colMap.lastName] || '';
                        fullName = `${first} ${last}`.trim();
                    }

                    const phone = colMap.phone ? row[colMap.phone] : '';
                    const district = colMap.district ? row[colMap.district] : '';
                    const province = colMap.province ? row[colMap.province] : '';
                    const village = colMap.village ? row[colMap.village] : '';
                    const neighborhood = colMap.neighborhood ? row[colMap.neighborhood] : '';
                    const birthDate = colMap.birthDate ? row[colMap.birthDate] : '';
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
                                    province: String(province || '').trim(),
                                    village: String(village || '').trim(),
                                    neighborhood: String(neighborhood || '').trim(),
                                    birthDate: String(birthDate || '').trim(),
                                    region: String(region || '').trim(),
                                    role: String(role || '').trim(),
                                    sourceFile: file.originalname, // DB'de orijinal ismini tutuyoruz
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
                    report.message = `${validOperations.length} kayıt işlendi. (Dosya kaydedildi: ${file.filename})`;
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
