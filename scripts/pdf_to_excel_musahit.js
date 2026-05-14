#!/usr/bin/env node
/**
 * Müşahit PDF → Excel
 * Tek seferlik script: PDF'deki "S.NO MAHALLE ADI ADI SOYADI T.C. NO TLF [SANDIK NO]"
 * formatını okur, temiz bir Excel üretir.
 */
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('/Users/dayhan/Desktop/ilsekreterlikyrp/sekreterlik4/sekreterlik-app/server/node_modules/pdf-parse');
const XLSX = require('/Users/dayhan/Desktop/ilsekreterlikyrp/sekreterlik4/sekreterlik-app/client/node_modules/xlsx');

const PDF_PATH = process.argv[2] || '/Users/dayhan/Downloads/SANDIK MÜŞ.MAHALLE-BELDE-KÖYLER (1).pdf';
const OUT_PATH = process.argv[3] || '/Users/dayhan/Downloads/musahitler_pdf_temiz.xlsx';

// Telefonu normalize et: (505) 942-0599 → 05059420599
function normalizePhone(s) {
  if (!s) return '';
  const digits = String(s).replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('5')) return '0' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  return digits;
}

function parseLine(line) {
  // Pattern: <sıra> <mahalle çok kelimeli> <isim çok kelimeli> <TC 11 hane> <telefon> [<sandık>]
  // Önce TC'yi yakala, etrafını parçala
  const tcMatch = line.match(/(?<!\d)(\d{11})(?!\d)/);
  if (!tcMatch) return null;
  const tc = tcMatch[1];
  const tcStart = tcMatch.index;

  // TC'den öncesi: sıra no + mahalle + ad soyad
  const before = line.substring(0, tcStart).trim();
  // TC'den sonrası: telefon + sandık (varsa)
  const after = line.substring(tcStart + 11).trim();

  // Telefon yakala (parantezli, tireli, boşluklu hepsini)
  const phoneMatch = after.match(/[\(\d][\d\s\(\)\-]{8,}/);
  const phoneRaw = phoneMatch ? phoneMatch[0].trim() : '';
  const phone = normalizePhone(phoneRaw);

  // Sandık no telefondan sonra olabilir
  let sandik = '';
  if (phoneMatch) {
    const afterPhone = after.substring(phoneMatch.index + phoneRaw.length).trim();
    const sandikMatch = afterPhone.match(/\b\d{3,5}\b/);
    if (sandikMatch) sandik = sandikMatch[0];
  }

  // Before'dan: sıra no + mahalle + ad soyad ayır
  // Sıra no: ilk sayı
  const seqMatch = before.match(/^(\d+)\s+(.+)$/);
  if (!seqMatch) return null;
  const rest = seqMatch[2];

  // Mahalle: tipik mahalle isimleri büyük harf, "MAH" ile bitebilir
  // Mantık: rest'in sonu ad soyad (her kelimesi büyük harfli) ama mahalle de büyük harfli.
  // Heuristic: Türk isimleri çoğu 2-3 kelime. PDF'te mahalle önce, isim sonra.
  // Mahalle anahtar kelimeler: MAH, KÖY, BELDE
  // Eğer "MAH" / "KÖY" / "BELDE" geçiyorsa o noktada böl
  let mahalle = '', name = '';
  const tokens = rest.split(/\s+/);

  // En sağlam: kelimeleri tek tek kontrol et, mahalle/köy bittikten sonra isim başlar
  // PDF formatında mahalle adı genelde 1-3 kelime, isim 2-4 kelime
  // Eğer rest'te "MAH", "BELDE", "KÖY" varsa o token'a kadar (dahil) mahalle
  let splitIdx = -1;
  const stopWords = ['MAH', 'MAHALLESİ', 'MAHALLE', 'KÖY', 'KÖYÜ', 'BELDE', 'BELDESİ', 'MERKEZ'];
  for (let i = 0; i < tokens.length; i++) {
    if (stopWords.includes(tokens[i].toUpperCase())) {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx >= 0) {
    mahalle = tokens.slice(0, splitIdx + 1).join(' ');
    name = tokens.slice(splitIdx + 1).join(' ');
  } else {
    // Fallback: ilk kelime mahalle, gerisi isim
    // (PDF'te bazı satırlarda "ABDULLAHPAŞA AHMET ALİ YILDIZ" gibi tek kelime mahalle var)
    if (tokens.length >= 4) {
      // Eğer 4+ kelime varsa, son 2-3'ü isim varsayılır
      // Türk ismi tipik: 2-3 kelime. Mahalle çoğunlukla 1 kelime.
      mahalle = tokens[0];
      name = tokens.slice(1).join(' ');
    } else if (tokens.length === 3) {
      mahalle = tokens[0];
      name = tokens.slice(1).join(' ');
    } else if (tokens.length === 2) {
      mahalle = tokens[0];
      name = tokens[1];
    } else {
      mahalle = '';
      name = rest;
    }
  }

  return {
    seq: parseInt(seqMatch[1], 10),
    mahalle: mahalle.trim(),
    name: name.trim(),
    tc,
    phone,
    sandik
  };
}

(async () => {
  console.log('PDF okunuyor:', PDF_PATH);
  const parser = new PDFParse({ data: fs.readFileSync(PDF_PATH) });
  const result = await parser.getText();
  const text = result.text || '';

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  console.log('Toplam satır:', lines.length);

  const records = [];
  const errors = [];
  for (const line of lines) {
    if (line.startsWith('S.NO') || line.includes('T.C. NO') || line.includes('SANDIK NO')) continue;
    const rec = parseLine(line);
    if (rec) records.push(rec);
    else errors.push(line);
  }

  console.log('Parse edilen kayıt:', records.length);
  console.log('Parse edilemeyen satır:', errors.length);
  if (errors.length > 0) {
    console.log('İlk 5 hata satırı:');
    errors.slice(0, 5).forEach(l => console.log('  ', l));
  }

  // Duplicate detect (TC bazlı)
  const tcSeen = new Map();
  const unique = [];
  let dupCount = 0;
  for (const r of records) {
    if (tcSeen.has(r.tc)) {
      dupCount++;
      continue;
    }
    tcSeen.set(r.tc, true);
    unique.push(r);
  }
  console.log('Benzersiz TC:', unique.length);
  console.log('Atılan duplicate:', dupCount);

  // Excel formatı (sistem ile uyumlu, ObserversPage handleExcelImportFile sırası):
  // TC | Ad Soyad | Telefon | Bölge | İlçe | Belde | Mahalle | Köy | Başmüşahit
  // Mahalle suffix temizliği: "ABDULLAHPAŞA MAH" → "ABDULLAHPAŞA"
  const cleanMahalle = (m) => {
    if (!m) return '';
    return m.replace(/\s+(MAH|MAHALLESİ|MAHALLE)\s*$/i, '').trim();
  };

  const data = unique.map(r => ({
    'TC': r.tc,
    'Ad Soyad': r.name,
    'Telefon': r.phone,
    'Bölge': '',
    'İlçe': 'Merkez',
    'Belde': '',
    'Mahalle': cleanMahalle(r.mahalle),
    'Köy': '',
    'Başmüşahit': 'Evet'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 12 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Müşahitler');
  XLSX.writeFile(wb, OUT_PATH);

  console.log('\n✅ Excel oluşturuldu:', OUT_PATH);
  console.log('   Toplam kayıt:', unique.length);
})().catch(e => {
  console.error('Hata:', e.message);
  process.exit(1);
});
