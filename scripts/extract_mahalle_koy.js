#!/usr/bin/env node
/**
 * YSK seçmen CSV'lerinden ilçe bazında unique mahalle+köy listesi çıkar.
 *
 * Mantık:
 * - ADRES MUHTARLIK ADI alanına bak
 * - "MAH." veya "MAHALLESİ" suffix varsa → mahalle
 * - Değilse → köy
 *
 * Sistemde zaten kayıtlı olan MERKEZ mahalle/köy'leri hariç tutar
 * (mahalleler_2026-04-23.xlsx, koyler_2026-04-23.xlsx referans alınır).
 *
 * Çıktı:
 *   ~/Downloads/mahalle_ekleme_YSK.xlsx   (mahalle_ekleme_sablonu ile aynı şema)
 *   ~/Downloads/koy_ekleme_YSK.xlsx       (koy_ekleme_sablonu ile aynı şema)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require(path.join(
  __dirname,
  '..',
  'sekreterlik-app',
  'client',
  'node_modules',
  'xlsx'
));

const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const MAH_OUT = path.join(DOWNLOADS, 'mahalle_ekleme_YSK.xlsx');
const KOY_OUT = path.join(DOWNLOADS, 'koy_ekleme_YSK.xlsx');
const REPORT_OUT = path.join(DOWNLOADS, 'mahalle_koy_rapor.xlsx');

// ---- ISO-8859-9 decode (voters_to_ballot_excel.js ile aynı) ----
const ISO88599_MAP = (() => {
  const map = {};
  for (let i = 0; i < 0x80; i++) map[i] = String.fromCharCode(i);
  for (let i = 0x80; i <= 0xFF; i++) map[i] = String.fromCharCode(i);
  map[0xD0] = '\u011E'; map[0xDD] = '\u0130'; map[0xDE] = '\u015E';
  map[0xF0] = '\u011F'; map[0xFD] = '\u0131'; map[0xFE] = '\u015F';
  return map;
})();
function decodeIso88599(buf) {
  let s = '';
  for (let i = 0; i < buf.length; i++) s += ISO88599_MAP[buf[i]];
  return s;
}

// ---- Normalize helpers ----
// Tüm karşılaştırmalar için: türkçe lowercase + sadece harf/rakam
function normKey(s) {
  return (s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-zçğıöşü0-9]+/gi, '')
    .trim();
}

// YSK ilçe adı → sistemdeki ilçe adı
// YSK "ELAZIĞ MERKEZ" der, sistemde sadece "MERKEZ" kayıtlı.
const DISTRICT_MAP = {
  'ELAZIĞ MERKEZ': 'MERKEZ',
};
function mapDistrict(ilceRaw) {
  const up = (ilceRaw || '').trim().toLocaleUpperCase('tr-TR');
  return DISTRICT_MAP[up] || up;
}

// YSK belde adı → sistemdeki belde adı (harf varyasyonu düzeltmesi)
const TOWN_MAP = {
  'BÜKARDI': 'BÜKARDİ', // YSK: I, sistem: İ
};
function mapTown(beldeRaw) {
  const up = (beldeRaw || '').trim().toLocaleUpperCase('tr-TR');
  return TOWN_MAP[up] || up;
}

// "AKPINAR MAH." → "AKPINAR"   /   "AKÇAKALE KÖYÜ" → "AKÇAKALE"
function stripSuffix(raw) {
  return (raw || '')
    .replace(/\s*(MAHALLESİ|MAH\.|MAHALLESI|MAHALLE)\s*$/i, '')
    .replace(/\s*(KÖYÜ|KÖY|KOYU)\s*$/i, '')
    .trim();
}

// "MAH." içeriyor mu? → mahalle mi köy mü belirler
function isMahalle(raw) {
  return /\s*(MAH\.|MAHALLESİ|MAHALLESI|MAHALLE)\s*$/i.test((raw || '').trim());
}

// ---- Mevcut sistem verisini yükle (dublike engelleme) ----
function loadExisting() {
  const set = new Set();
  const files = [
    { f: 'mahalleler_2026-04-23.xlsx', nameCol: 'Mahalle Adı' },
    { f: 'koyler_2026-04-23.xlsx', nameCol: 'Köy Adı' },
  ];
  for (const { f, nameCol } of files) {
    const full = path.join(DOWNLOADS, f);
    if (!fs.existsSync(full)) {
      console.warn(`  (uyarı) ${f} yok, dublike kontrolü atlanıyor`);
      continue;
    }
    const wb = XLSX.readFile(full);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    for (const r of rows) {
      const ilce = normKey(r['İlçe']);
      const ad = normKey(stripSuffix(r[nameCol]));
      if (ilce && ad) set.add(`${ilce}|${ad}`);
    }
  }
  return set;
}

function main() {
  const files = fs.readdirSync(DOWNLOADS)
    .filter(f => /^ELAZIG_.*_\.csv$/i.test(f))
    .map(f => path.join(DOWNLOADS, f))
    .sort();

  if (files.length === 0) {
    console.error('YSK CSV bulunamadı');
    process.exit(1);
  }

  const existing = loadExisting();
  console.log(`[+] Sistemde kayıtlı ${existing.size} mahalle/köy (dublike engelleme)`);

  // key = "ILCE|AD" → { ilce, ad, tur:'mahalle'|'koy', belde?, count }
  const items = new Map();

  for (const file of files) {
    const buf = fs.readFileSync(file);
    const text = decodeIso88599(buf);
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(';').map(s => s.trim());
    const iIlce = header.findIndex(h => h === 'ADRES ILCE ADI');
    const iBelde = header.findIndex(h => h === 'ADRES BELDE ADI');
    const iMuh = header.findIndex(h => h === 'ADRES MUHTARLIK ADI');

    if (iIlce < 0 || iMuh < 0) {
      console.warn(`  ${path.basename(file)}: başlık eşleşmedi, atlanıyor`);
      continue;
    }

    for (let i = 1; i < lines.length; i++) {
      const r = lines[i].split(';');
      const ilceRaw = (r[iIlce] || '').trim();
      const beldeRaw = (r[iBelde] || '').trim();
      const muhRaw = (r[iMuh] || '').trim();
      if (!ilceRaw || !muhRaw) continue;

      const tur = isMahalle(muhRaw) ? 'mahalle' : 'koy';
      const ad = stripSuffix(muhRaw).toLocaleUpperCase('tr-TR');
      if (!ad) continue;

      // Sistem formatı: İlçe hep büyük; "ELAZIĞ MERKEZ" → "MERKEZ"
      const ilce = mapDistrict(ilceRaw);
      const belde = mapTown(beldeRaw);

      // Key: ilçe + belde + ad (farklı beldede aynı isimli mahalle olabilir)
      const key = `${normKey(ilce)}|${normKey(belde)}|${normKey(ad)}`;
      if (items.has(key)) {
        items.get(key).count += 1;
      } else {
        items.set(key, {
          ilce,
          belde,
          ad,
          tur,
          count: 1,
          key,
        });
      }
    }
  }

  // Listeleri ayır + sisteme dublike olanları hariç tut
  const allItems = [...items.values()];
  const newMahalle = [];
  const newKoy = [];
  const skipped = [];

  for (const it of allItems) {
    // Existing set ilce|ad formatında; belde olmadan kontrol et
    const existingKey = `${normKey(it.ilce)}|${normKey(it.ad)}`;
    if (existing.has(existingKey)) {
      skipped.push(it);
      continue;
    }
    if (it.tur === 'mahalle') newMahalle.push(it);
    else newKoy.push(it);
  }

  // Sırala: ilce → ad
  const trSort = (a, b) => {
    const c = a.ilce.localeCompare(b.ilce, 'tr');
    if (c !== 0) return c;
    return a.ad.localeCompare(b.ad, 'tr');
  };
  newMahalle.sort(trSort);
  newKoy.sort(trSort);

  // ---- Mahalle Excel ----
  const mahHeader = [
    'İlçe Adı', 'Belde Adı (opsiyonel)', 'Mahalle Adı',
    'Mahalle Temsilcisi Adı', 'Mahalle Temsilcisi TC', 'Mahalle Temsilcisi Telefon'
  ];
  const mahAoa = [mahHeader];
  for (const it of newMahalle) {
    mahAoa.push([it.ilce, it.belde, it.ad, '', '', '']);
  }
  const wbM = XLSX.utils.book_new();
  const wsM = XLSX.utils.aoa_to_sheet(mahAoa);
  wsM['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 32 }, { wch: 24 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wbM, wsM, 'Mahalle Listesi');
  XLSX.writeFile(wbM, MAH_OUT);

  // ---- Köy Excel ----
  const koyHeader = [
    'İlçe Adı', 'Belde Adı (opsiyonel)', 'Köy Adı',
    'Köy Temsilcisi Adı', 'Köy Temsilcisi Telefon', 'Köy Temsilcisi TC'
  ];
  const koyAoa = [koyHeader];
  for (const it of newKoy) {
    koyAoa.push([it.ilce, it.belde, it.ad, '', '', '']);
  }
  const wbK = XLSX.utils.book_new();
  const wsK = XLSX.utils.aoa_to_sheet(koyAoa);
  wsK['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 32 }, { wch: 24 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wbK, wsK, 'Köy Listesi');
  XLSX.writeFile(wbK, KOY_OUT);

  // ---- Rapor: eksik/özet ----
  const byDistrict = {};
  for (const it of allItems) {
    const d = byDistrict[it.ilce] = byDistrict[it.ilce] || { toplam: 0, mah: 0, koy: 0, yeniMah: 0, yeniKoy: 0 };
    d.toplam += 1;
    if (it.tur === 'mahalle') d.mah += 1;
    else d.koy += 1;
    if (!existing.has(it.key)) {
      if (it.tur === 'mahalle') d.yeniMah += 1;
      else d.yeniKoy += 1;
    }
  }
  const reportAoa = [[
    'İlçe', 'Toplam (YSK)', 'Mahalle', 'Köy',
    'Yeni Mahalle (eklenecek)', 'Yeni Köy (eklenecek)'
  ]];
  for (const [ilce, d] of Object.entries(byDistrict).sort()) {
    reportAoa.push([ilce, d.toplam, d.mah, d.koy, d.yeniMah, d.yeniKoy]);
  }
  const wbR = XLSX.utils.book_new();
  const wsR = XLSX.utils.aoa_to_sheet(reportAoa);
  wsR['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wbR, wsR, 'Özet');

  // Dublike atlananlar sheet'i
  if (skipped.length > 0) {
    const skipAoa = [['İlçe', 'Ad', 'Türü', 'YSK Seçmen Sayısı']];
    for (const it of skipped.sort(trSort)) {
      skipAoa.push([it.ilce, it.ad, it.tur === 'mahalle' ? 'Mahalle' : 'Köy', it.count]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(skipAoa);
    ws2['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wbR, ws2, 'Zaten Kayıtlı');
  }
  XLSX.writeFile(wbR, REPORT_OUT);

  console.log('\n[✓] Çıktılar:');
  console.log(`    ${MAH_OUT}`);
  console.log(`    ${KOY_OUT}`);
  console.log(`    ${REPORT_OUT}`);
  console.log(`\n[✓] Yeni eklenecek: ${newMahalle.length} mahalle, ${newKoy.length} köy`);
  console.log(`[✓] Zaten kayıtlı (atlandı): ${skipped.length}`);
  console.log('\n[✓] İlçe bazında yeni eklenecekler:');
  for (const [ilce, d] of Object.entries(byDistrict).sort()) {
    if (d.yeniMah + d.yeniKoy === 0) continue;
    console.log(`    ${ilce.padEnd(14)} mahalle: ${String(d.yeniMah).padStart(3)}  köy: ${String(d.yeniKoy).padStart(4)}`);
  }
}

main();
