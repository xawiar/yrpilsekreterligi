const express = require('express');
const router = express.Router();

/**
 * Mali İşler Sitesi Entegrasyonu
 * 
 * Bu route, mali işler sitesindeki üye mali kayıtlarını bu siteye entegre etmek için kullanılır.
 * 
 * Kullanım Senaryoları:
 * 1. API üzerinden: Mali işler sitesi API'si varsa, bu endpoint'ler üzerinden veri çekilir
 * 2. Database üzerinden: Mali işler sitesi database'ine direkt erişim varsa, buradan okunur
 * 3. Dosya import: SQLite database dosyası import edilir
 */

/**
 * Get member financial records by TC
 * TC kimlik numarası ile üye mali kayıtlarını getirir
 */
router.get('/member/:tc/financial', (req, res) => {
  const { tc } = req.params;
  // Placeholder - daha sonra implement edilecek
  res.json({
    message: `Financial data for member TC: ${tc} (placeholder)`,
    tc: tc,
    financialRecords: [
      { id: 1, date: '2023-01-15', type: 'Aidat', amount: 100, status: 'Paid' },
      { id: 2, date: '2023-02-15', type: 'Aidat', amount: 100, status: 'Due' },
    ],
    summary: {
      totalPaid: 100,
      totalDue: 100,
      balance: 0
    }
  });
});

module.exports = router;
