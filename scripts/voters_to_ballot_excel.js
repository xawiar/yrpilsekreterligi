#!/usr/bin/env node
/**
 * YSK seçmen listesi CSV'lerinden sandık Excel'i üretir.
 *
 * Girdi: ~/Downloads/ELAZIG_*_.csv (ISO-8859-9, ';' separator)
 * Çıktı: ~/Downloads/Elazig_Sandik_Listesi.xlsx
 *
 * Şablon (BallotBoxesPage Excel import):
 *   İl | İlçe | Mahalle/Köy | Sandık Alanı | Sandık No | Seçmen Sayısı
 *
 * Mantık: Her sandık no için BİR satır (seçmenleri say, diğer alanları ilk
 * satırdan al). Belde varsa "Belde / Mahalle" formatı, yoksa sadece mahalle.
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
const OUTPUT = path.join(DOWNLOADS, 'Elazig_Sandik_Listesi.xlsx');

// ISO-8859-9 → UTF-8 dönüşüm tablosu (Türkçe karakterler)
const ISO88599_MAP = (() => {
  const map = {};
  // 0x00-0x7F ASCII aynı
  for (let i = 0; i < 0x80; i++) map[i] = String.fromCharCode(i);
  // 0x80-0xFF ISO-8859-9 bölgesi (Latin-5)
  const highChars = [
    // 0x80..0x9F: C1 kontrol (Latin-1 ile aynı kabul)
  ];
  // En basit yol: node zaten iso-8859-1 destekler, 8859-9 sadece 6 karakter
  // farklı: D0,DD,DE,F0,FD,FE — Türkçe Ğ,İ,Ş,ğ,ı,ş
  // Diğerleri Latin-1 ile aynı davranır.
  for (let i = 0x80; i <= 0xFF; i++) map[i] = String.fromCharCode(i);
  // Türkçe override'lar:
  map[0xD0] = '\u011E'; // Ğ
  map[0xDD] = '\u0130'; // İ
  map[0xDE] = '\u015E'; // Ş
  map[0xF0] = '\u011F'; // ğ
  map[0xFD] = '\u0131'; // ı
  map[0xFE] = '\u015F'; // ş
  return map;
})();

function decodeIso88599(buf) {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    s += ISO88599_MAP[buf[i]];
  }
  return s;
}

function parseCsvLine(line) {
  // YSK formatı basit: quote yok, ayraç ';'
  return line.split(';').map(c => c.trim());
}

// YSK ilçe → sistem ilçe map
const DISTRICT_MAP = { 'ELAZIĞ MERKEZ': 'MERKEZ' };
// YSK belde → sistem belde map (harf varyasyonu)
const TOWN_MAP = { 'BÜKARDI': 'BÜKARDİ' };
const mapDistrict = (s) => {
  const up = (s || '').trim().toLocaleUpperCase('tr-TR');
  return DISTRICT_MAP[up] || up;
};
const mapTown = (s) => {
  const up = (s || '').trim().toLocaleUpperCase('tr-TR');
  return TOWN_MAP[up] || up;
};
// MAH. ile bitiyor mu?
const isMahalleStr = (raw) =>
  /\s*(MAH\.|MAHALLESİ|MAHALLESI|MAHALLE)\s*$/i.test((raw || '').trim());
const stripLocSuffix = (raw) => (raw || '')
  .replace(/\s*(MAHALLESİ|MAH\.|MAHALLESI|MAHALLE)\s*$/i, '')
  .replace(/\s*(KÖYÜ|KÖY|KOYU)\s*$/i, '')
  .trim();

function parseCsv(text) {
  // BOM varsa at
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

function toTitleCase(s) {
  if (!s) return '';
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => (w.length > 0 ? w[0].toLocaleUpperCase('tr-TR') + w.slice(1) : w))
    .join(' ');
}

function normalizeMahalle(name) {
  if (!name) return '';
  // "AKPINAR MAH." → "Akpınar"
  return toTitleCase(
    name
      .replace(/\s*MAH\.?$/i, '')
      .replace(/\s*MAHALLESİ$/i, '')
      .replace(/\s*KÖYÜ$/i, '')
      .trim()
  );
}

function main() {
  const files = fs
    .readdirSync(DOWNLOADS)
    .filter(f => /^ELAZIG_.*_\.csv$/i.test(f))
    .map(f => path.join(DOWNLOADS, f))
    .sort();

  if (files.length === 0) {
    console.error('Girdi dosyası yok (~/Downloads/ELAZIG_*_.csv)');
    process.exit(1);
  }

  console.log(`[+] ${files.length} CSV bulundu`);

  // Tüm sandıklar — "ilce|sandik_no" key → {il, ilce, mahalle, kurum, sayac}
  // İlçeler sandık numaralarını 1001'den tekrar kullandığı için key'e ilçe de eklendi.
  const ballots = new Map();

  for (const file of files) {
    const buf = fs.readFileSync(file);
    const text = decodeIso88599(buf);
    const { header, rows } = parseCsv(text);

    const idx = (name) => header.findIndex(h => h.toUpperCase() === name.toUpperCase());
    const iIl = idx('ADRES IL ADI');
    const iIlce = idx('ADRES ILCE ADI');
    const iBelde = idx('ADRES BELDE ADI');
    const iMah = idx('ADRES MUHTARLIK ADI');
    const iSandikNo = idx('SANDIK NO');
    const iSandikAlani = idx('SANDIK ALANI');

    if (iSandikNo < 0 || iSandikAlani < 0) {
      console.warn(`  ${path.basename(file)}: başlık eşleşmedi, atlanıyor`);
      continue;
    }

    let fileCount = 0;
    for (const r of rows) {
      const sandikNo = (r[iSandikNo] || '').trim();
      if (!sandikNo) continue;
      fileCount++;

      const ilceRaw = (r[iIlce] || '').trim().toLocaleUpperCase('tr-TR');
      const key = `${ilceRaw}|${sandikNo}`;

      if (!ballots.has(key)) {
        const il = 'Elazığ';
        const ilce = mapDistrict(r[iIlce] || '');           // sistem formatı (MERKEZ, AĞIN...)
        const belde = mapTown(r[iBelde] || '');             // sistem formatı (BÜKARDİ...)
        const muhRaw = (r[iMah] || '').trim();
        const isMah = isMahalleStr(muhRaw);
        const ad = stripLocSuffix(muhRaw).toLocaleUpperCase('tr-TR');
        const mahalle = isMah ? ad : '';
        const koy = isMah ? '' : ad;
        const kurum = (r[iSandikAlani] || '').trim();

        ballots.set(key, {
          il, ilce, belde, mahalle, koy, kurum, seçmen: 0,
        });
      }
      ballots.get(key).seçmen += 1;
    }
    console.log(`  ${path.basename(file)}: ${fileCount} seçmen satırı`);
  }

  // Sırala: ilce → sandık no
  const rows = [...ballots.entries()]
    .map(([key, b]) => ({ ...b, sandikNo: key.split('|')[1] }))
    .sort((a, b) => {
      const c = a.ilce.localeCompare(b.ilce, 'tr');
      if (c !== 0) return c;
      return a.sandikNo.localeCompare(b.sandikNo, undefined, { numeric: true });
    });

  // Excel şablonu — 8 kolon (BallotBoxesPage import ile uyumlu)
  const header = [
    'İl', 'İlçe', 'Belde (opsiyonel)', 'Mahalle', 'Köy',
    'Sandık Alanı / Kurum', 'Sandık Numarası', 'Seçmen Sayısı (Toplam)'
  ];
  const aoa = [header];
  for (const r of rows) {
    aoa.push([r.il, r.ilce, r.belde, r.mahalle, r.koy, r.kurum, r.sandikNo, r.seçmen]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 10 }, // İl
    { wch: 14 }, // İlçe
    { wch: 18 }, // Belde
    { wch: 22 }, // Mahalle
    { wch: 22 }, // Köy
    { wch: 30 }, // Kurum
    { wch: 14 }, // Sandık No
    { wch: 18 }  // Seçmen
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Sandıklar');
  XLSX.writeFile(wb, OUTPUT);

  // Özet
  const byDistrict = {};
  for (const r of rows) {
    byDistrict[r.ilce] = (byDistrict[r.ilce] || 0) + 1;
  }
  console.log(`\n[✓] Yazıldı: ${OUTPUT}`);
  console.log(`[✓] Toplam sandık: ${rows.length}`);
  console.log('[✓] İlçe dağılımı:');
  for (const [d, c] of Object.entries(byDistrict).sort()) {
    console.log(`    ${d.padEnd(20)} ${c}`);
  }
}

main();
