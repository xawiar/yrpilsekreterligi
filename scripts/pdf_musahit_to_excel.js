#!/usr/bin/env node
/**
 * Müşahit PDF → Excel
 *
 * Girdi: MCP pdf-reader tarafından /tmp benzeri bir dosyaya yazılmış
 *        iç içe JSON (outer: [{type:'text', text:<json>}], inner: {results:[...]})
 *
 * Çıktı: ~/Downloads/musahitler_MERKEZ.xlsx
 *        TC | Ad Soyad | Telefon | İl | İlçe | Belde | Mahalle | Köy | Başmüşahit
 *
 * Normalize:
 * - "ABDULAHPAŞA MAH", "ABDULLAHPAŞA", "ABDULLAHPAŞA*", "ABDULLAHPAŞA TOKİ"
 *   hepsi ABDULLAHPAŞA olarak toplanır
 * - Sistemdeki mahalle isimleriyle fuzzy match
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require(path.join(__dirname, '..', 'sekreterlik-app', 'client', 'node_modules', 'xlsx'));

const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const PDF_JSON = '/Users/dayhan/.claude/projects/-Users-dayhan-Desktop-ilsekreterlikyrp-sekreterlik4/d5681819-6868-4178-a7e3-caf98ccee576/tool-results/mcp-pdf-reader-read_pdf-1776953403201.txt';
const OUT = path.join(DOWNLOADS, 'musahitler_MERKEZ.xlsx');
const REPORT_OUT = path.join(DOWNLOADS, 'musahit_parse_rapor.xlsx');

// ---- Sistemdeki mahalle/köy isimleriyle karşılaştırma için yükle ----
function loadSystemLocations() {
  const neighborhoods = [];
  const villages = [];
  const towns = [];
  try {
    const f = path.join(DOWNLOADS, 'mahalleler_2026-04-23.xlsx');
    if (fs.existsSync(f)) {
      const wb = XLSX.readFile(f);
      for (const r of XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])) {
        neighborhoods.push({ name: r['Mahalle Adı'], ilce: r['İlçe'], belde: r['Belde'] });
      }
    }
  } catch (_) {}
  try {
    const f = path.join(DOWNLOADS, 'koyler_2026-04-23.xlsx');
    if (fs.existsSync(f)) {
      const wb = XLSX.readFile(f);
      for (const r of XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])) {
        villages.push({ name: r['Köy Adı'], ilce: r['İlçe'], belde: r['Belde'] });
      }
    }
  } catch (_) {}
  return { neighborhoods, villages, towns };
}

// ---- Normalize ----
function normKey(s) {
  return (s || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/MAHALLESİ|MAHALLESI|MAH\.?\s*$|MAH\.?(?=\s)|\bMALLE\b|\bMAL\b|KÖYÜ|KOYU|KÖY\b|TOKİ|TOKI|OKULSOR|OKUL\b|[*]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function normTc(s) {
  return String(s || '').replace(/\D/g, '');
}

function normPhone(s) {
  if (!s) return '';
  const d = String(s).replace(/\D/g, '');
  if (d.length === 10) return '0' + d;
  if (d.length === 11 && d.startsWith('0')) return d;
  if (d.length > 11) return '0' + d.slice(-10); // fazladan hane var, son 10'u al
  return d;
}

// ---- Parse PDF JSON ----
function loadAllPageTexts() {
  const raw = fs.readFileSync(PDF_JSON, 'utf8');
  // outer: [{type:'text', text: '<inner json>'}]
  const outer = JSON.parse(raw);
  const innerStr = outer[0].text;
  const inner = JSON.parse(innerStr);
  const data = inner.results[0].data;
  if (data.page_texts) return data.page_texts.map(p => p.text).join(' ');
  if (data.full_text) return data.full_text;
  return '';
}

// ---- Satır parse ----
// Format örnekleri (boşluklu/boşluksuz arası değişken):
// "1 ABDULAHPAŞA MAH MAHMUT ARI 19810869080 (536) 440-7813"
// "22 ABDULLAHPAŞA* ZEYNEP BAĞBUDAR 28607395886 (534) 514-9469"
// "57 AKSARAY MAH EZGİ YILDIZ 30868480096 0534 041 20 17"
// "277 DOĞUKENT ERKAN ÖZDEMİR 35788336508"   (telefon yok)
// "85 ATAŞEHİR MELEK KILINÇ 1230511092 (530) 406-6520"  (TC 10 hane — hatalı)
//
// Stratejim: rakam grupları üzerinden parse. TC = 11 hane rakam blok (başta 0 olmayan).
// Telefon = sonrası. Mahalle = başa kadar.
//
// Satır başı: "\d+\s+SIRA", sonrasında mahalle + isim soyisim
// "SIRA MAHALLE AD SOYAD TC TELEFON" — ama mahalle kelimesi değişken (MAHALLE MAH, MALLE, TOKİ, *)
//
// Yaklaşım:
// 1) Tüm text'i satırlara böl — SIRA numaralarına göre split
// 2) Her satırda TC regex ile bul (11 hane)
// 3) TC'den sonrası telefon
// 4) TC'den öncesi: SIRA + mahalle + isim
// 5) Mahalle kısmını normalize ederek çıkar

const KNOWN_MAHALLE_KEYWORDS = [
  'ABDULLAHPAŞA','ABDULAHPAŞA','ABDULLAH PAŞA',
  'AKPINAR',
  'AKSARAY',
  'ALAYAPRAK',
  'AŞAĞI DEMİRTAŞ','AŞAĞIDEMİRTAŞ',
  'YUKARI DEMİRTAŞ','YUKARIDEMİRTAŞ',
  'ATAŞEHİR','ATAŞEHİ',
  'BAHÇELİEVLER','BİZMİŞEN',
  'CUMHURİYET',
  'ÇARŞI','ÇATALÇEŞME','ÇAYDAÇIRA',
  'DOĞUKENT','DOĞUKET',
  'ESENTEPE',
  'FEVZİÇAKMAK','FEYZİÇAKMAK','FEVZİ ÇAKMAK',
  'GÖLLÜBAĞ',
  'GÜMÜŞKAVAK',
  'GÜNEYKENT',
  'HANKENDİ','HARPUT','HİCRET','HİLALKENT',
  'İCADİYE','İZZETPAŞA',
  'KARŞIYAKA','KIRKLAR','KIZILAY','KÜLTÜR',
  'MUSTAFAPAŞA','MUSTAFA PAŞA',
  'NAİLBEY',
  'OLGUNLAR',
  'RIZAİYE','RÜSTEMPAŞA',
  'SALI BABA','SALIBABA','SANAYİ','SARAYATİK','SUGÖZÜ','SÜRSÜRÜ',
  'ŞAHİNKAYA',
  'ULUKENT','ÜNİVERSİTE',
  'YENİ MAHALLE','YENİMAHALLE','YENİ',
  'YEMİŞLİK','YILDIZBAĞLARI',
  'ZAFRAN',
];

const MAHALLE_RE = new RegExp(
  '^(?:' + KNOWN_MAHALLE_KEYWORDS.sort((a,b) => b.length - a.length).join('|') + ')' +
  '(?:\\s*[*]|\\s+MAH(?:ALLESİ|ALLESI|ALLE|\\.?)?|\\s+MALLE|\\s+MAL|\\s+TOKİ|\\s+TOKI|\\s+OKULSOR|\\s+OKUL)*',
  'i'
);

function canonicalMahalle(raw) {
  if (!raw) return '';
  const up = raw.toLocaleUpperCase('tr-TR').trim();
  // Normalize yaygın yazım hataları
  const fix = {
    'ABDULAHPAŞA': 'ABDULLAHPAŞA',
    'ABDULLAH PAŞA': 'ABDULLAHPAŞA',
    'ATAŞEHİ': 'ATAŞEHİR',
    'DOĞUKET': 'DOĞUKENT',
    'FEYZİÇAKMAK': 'FEVZİÇAKMAK',
    'FEVZİ ÇAKMAK': 'FEVZİÇAKMAK',
    'MUSTAFA PAŞA': 'MUSTAFAPAŞA',
    'SALI BABA': 'SALIBABA',
    'YENİ MAHALLE': 'YENİ',
    'YENİMAHALLE': 'YENİ',
    'AŞAĞIDEMİRTAŞ': 'AŞAĞI DEMİRTAŞ',
    'YUKARIDEMİRTAŞ': 'YUKARI DEMİRTAŞ',
  };
  return fix[up] || up;
}

function parseRecords() {
  const text = loadAllPageTexts();
  // Satırları bul: "SIRA\s+MAHALLE..." pattern'i
  // SIRA numaraları 1..N — her satır bir sıra numarası ile başlar
  // Trick: all text concatenated, split by pattern "\d+\s+(MAHALLE_KEYWORD)"

  // Önce text'i stabilleştir: newline'ları boşluk yap, çoklu boşluğu tekle
  const flat = text.replace(/\s+/g, ' ').trim();

  // Satır başlarını bul: rakam(lar) + boşluk + mahalle-keyword
  const keywords = KNOWN_MAHALLE_KEYWORDS.sort((a,b) => b.length - a.length).join('|');
  const rowStartRe = new RegExp('(\\b\\d+)\\s+(' + keywords + ')', 'gi');

  const starts = [];
  let m;
  while ((m = rowStartRe.exec(flat)) !== null) {
    starts.push({ idx: m.index, sira: m[1], keyword: m[2] });
  }

  const records = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].idx : flat.length;
    const chunk = flat.slice(s.idx, end).trim();
    // chunk = "1 ABDULAHPAŞA MAH MAHMUT ARI 19810869080 (536) 440-7813"
    // sira_str + mahalleRaw + isim + TC + telefon

    // SIRA'yı at
    let rest = chunk.replace(/^\d+\s+/, '');

    // TC'yi bul (11 hane)
    const tcM = rest.match(/\b(\d{11})\b/);
    let tc = tcM ? tcM[1] : '';
    let tcIdx = tcM ? tcM.index : -1;

    // 10 haneli TC fallback (yazım hatası — örn. ATAŞEHİR MELEK KILINÇ 1230511092)
    if (!tc) {
      const tc10 = rest.match(/\b(\d{10})\b/);
      if (tc10) { tc = tc10[1]; tcIdx = tc10.index; }
    }

    let beforeTc = tcIdx >= 0 ? rest.slice(0, tcIdx).trim() : rest.trim();
    let afterTc = tcIdx >= 0 ? rest.slice(tcIdx + tc.length).trim() : '';

    // Telefon: beforeTc sonunda rakam olma ihtimali (noksan TC)
    // afterTc ile telefon — normalize
    const phone = normPhone(afterTc);

    // beforeTc = "ABDULAHPAŞA MAH MAHMUT ARI"
    // Mahalle kısmını çıkar (KEYWORD + olası MAH/MAL/TOKİ/* ek'ler)
    const mm = beforeTc.match(MAHALLE_RE);
    let mahalleRaw = '';
    let name = '';
    if (mm) {
      mahalleRaw = mm[0];
      name = beforeTc.slice(mm[0].length).trim();
    } else {
      // fallback: ilk kelime mahalle
      const parts = beforeTc.split(/\s+/);
      mahalleRaw = parts[0];
      name = parts.slice(1).join(' ');
    }

    // keyword normalize (yazım hataları)
    const canonMah = canonicalMahalle(mahalleRaw.replace(/\b(MAH\.?|MAHALLESİ|MALLE|MAL|TOKİ|OKULSOR|OKUL|[*])\b/gi, '').trim());

    records.push({
      sira: parseInt(s.sira),
      mahalleRaw,
      mahalle: canonMah,
      tc,
      name: name.trim(),
      phone,
    });
  }
  return records;
}

// ---- Ana akış ----
function main() {
  const { neighborhoods, villages } = loadSystemLocations();
  console.log(`[+] Sistemde ${neighborhoods.length} mahalle, ${villages.length} köy yüklü`);

  const records = parseRecords();
  console.log(`[+] PDF'den ${records.length} kayıt parse edildi`);

  // Sistemdeki mahalle isimlerinin normKey seti (MERKEZ ilçesi için)
  const sysMahKeySet = new Map(); // normKey → orijinal full name
  for (const n of neighborhoods) {
    if ((n.ilce || '').toUpperCase() === 'MERKEZ') {
      sysMahKeySet.set(normKey(n.name), n.name);
    }
  }
  const sysKoyKeySet = new Map();
  for (const v of villages) {
    if ((v.ilce || '').toUpperCase() === 'MERKEZ') {
      sysKoyKeySet.set(normKey(v.name), v.name);
    }
  }

  // TC dublike: aynı TC varsa ilk kaydı tut
  const seenTc = new Map();
  const rows = [];
  const noTc = [];
  const unmatched = [];

  for (const r of records) {
    if (!r.tc) {
      noTc.push(r);
      continue;
    }
    // TC dublike
    if (seenTc.has(r.tc)) continue;
    seenTc.set(r.tc, true);

    // Mahalle eşleştir
    const mahKey = normKey(r.mahalle);
    const matchedMah = sysMahKeySet.get(mahKey);
    const matchedKoy = sysKoyKeySet.get(mahKey);

    let mahalle = '';
    let koy = '';
    if (matchedMah) {
      mahalle = matchedMah; // sistemdeki tam isim
    } else if (matchedKoy) {
      koy = matchedKoy;
    } else {
      unmatched.push(r);
      mahalle = r.mahalle; // yine de kaydet, canonical form
    }

    rows.push({
      tc: r.tc,
      ad: r.name,
      tel: r.phone,
      il: 'Elazığ',
      ilce: 'MERKEZ',
      belde: '',
      mahalle,
      koy,
      basmusahit: 'Evet',
    });
  }

  // ---- Excel yaz ----
  const header = ['TC', 'Ad Soyad', 'Telefon', 'İl', 'İlçe', 'Belde', 'Mahalle', 'Köy', 'Başmüşahit'];
  const aoa = [header];
  for (const r of rows) {
    aoa.push([r.tc, r.ad, r.tel, r.il, r.ilce, r.belde, r.mahalle, r.koy, r.basmusahit]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:14},{wch:28},{wch:14},{wch:10},{wch:10},{wch:14},{wch:28},{wch:22},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws, 'Müşahitler');
  XLSX.writeFile(wb, OUT);

  // ---- Rapor ----
  const mahCount = {};
  for (const r of rows) {
    const k = r.mahalle || r.koy;
    mahCount[k] = (mahCount[k] || 0) + 1;
  }

  const repAoa = [['Mahalle/Köy', 'Müşahit Sayısı', 'Sistemde Var mı?']];
  for (const [k, c] of Object.entries(mahCount).sort((a,b) => b[1]-a[1])) {
    const inSys = sysMahKeySet.has(normKey(k)) || sysKoyKeySet.has(normKey(k));
    repAoa.push([k, c, inSys ? 'Evet' : 'HAYIR']);
  }
  const wbR = XLSX.utils.book_new();
  const wsR = XLSX.utils.aoa_to_sheet(repAoa);
  wsR['!cols'] = [{wch:28},{wch:16},{wch:18}];
  XLSX.utils.book_append_sheet(wbR, wsR, 'Özet');

  if (unmatched.length > 0) {
    const uAoa = [['SIRA', 'Ham Mahalle', 'Canonical', 'Ad Soyad', 'TC', 'Telefon']];
    for (const r of unmatched) {
      uAoa.push([r.sira, r.mahalleRaw, r.mahalle, r.name, r.tc, r.phone]);
    }
    const wsU = XLSX.utils.aoa_to_sheet(uAoa);
    wsU['!cols'] = [{wch:8},{wch:24},{wch:24},{wch:24},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wbR, wsU, 'Eşleşmeyen');
  }
  if (noTc.length > 0) {
    const nAoa = [['SIRA', 'Mahalle', 'Ad', 'Telefon']];
    for (const r of noTc) nAoa.push([r.sira, r.mahalleRaw, r.name, r.phone]);
    const wsN = XLSX.utils.aoa_to_sheet(nAoa);
    wsN['!cols'] = [{wch:8},{wch:20},{wch:24},{wch:14}];
    XLSX.utils.book_append_sheet(wbR, wsN, 'TC Yok');
  }
  XLSX.writeFile(wbR, REPORT_OUT);

  console.log(`\n[✓] Yazıldı: ${OUT}`);
  console.log(`[✓] Kayıt:    ${rows.length} (dublike TC elendi)`);
  console.log(`[✓] TC yok:   ${noTc.length}`);
  console.log(`[✓] Mahalle eşleşmeyen: ${unmatched.length}`);
  console.log(`[✓] Rapor:    ${REPORT_OUT}`);
  console.log('\n[✓] Mahalle başına müşahit (ilk 20):');
  const top = Object.entries(mahCount).sort((a,b) => b[1]-a[1]).slice(0, 20);
  for (const [k, c] of top) {
    const sys = sysMahKeySet.has(normKey(k)) ? 'M' : sysKoyKeySet.has(normKey(k)) ? 'K' : '?';
    console.log(`    [${sys}] ${k.padEnd(22)} ${c}`);
  }
}

main();
