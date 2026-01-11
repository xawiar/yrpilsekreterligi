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

// Excel Yükleme Endpoint'i
router.post('/upload', authenticateToken, isAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Dosya yüklenmedi' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'Dosya boş veya okunamadı' });
        }

        // Bulk operations hazırlığı
        const operations = data.map(row => {
            // Excel başlık eşleştirmesi (Esnek yapı)
            const tc = row['TC'] || row['tc'] || row['Tc'];
            const fullName = row['İsim Soyisim'] || row['isim soyisim'] || row['Ad Soyad'] || row['ad soyad'];
            const phone = row['Telefon'] || row['telefon'] || row['Tel'];
            const district = row['İlçe'] || row['ilçe'] || row['District'];
            const region = row['Bölge'] || row['bölge'] || row['Region'];
            const role = row['Görev'] || row['görev'] || row['Role'];

            if (!tc) return null; // TC'si olmayan satırı atla

            return {
                updateOne: {
                    filter: { tc: String(tc).trim() },
                    update: {
                        $set: {
                            fullName: String(fullName || '').trim(),
                            phone: String(phone || '').trim(),
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
            res.json({
                message: 'İşlem başarılı',
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount,
                totalProcessed: operations.length
            });
        } else {
            res.status(400).json({ message: 'Geçerli veri bulunamadı (TC sütunu zorunludur)' });
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
