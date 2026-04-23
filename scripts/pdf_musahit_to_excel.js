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
  // Mahalleler
  'ABDULLAHPAŞA','ABDULAHPAŞA','ABDULLAH PAŞA',
  'AKPINAR','AKSARAY','ALAYAPRAK','AŞAĞI DEMİRTAŞ','AŞAĞIDEMİRTAŞ',
  'YUKARI DEMİRTAŞ','YUKARIDEMİRTAŞ','ATAŞEHİR','ATAŞEHİ',
  'BAHÇELİEVLER','BİZMİŞEN','CUMHURİYET','ÇARŞI','ÇATALÇEŞME','ÇAYDAÇIRA',
  'DOĞUKENT','DOĞUKET','ESENTEPE','FEVZİÇAKMAK','FEYZİÇAKMAK','FEVZİ ÇAKMAK',
  'GÖLLÜBAĞ','GÜMÜŞKAVAK','GÜNEYKENT','HANKENDİ','HARPUT','HİCRET','HİLALKENT',
  'İCADİYE','İZZETPAŞA','KARŞIYAKA','KIRKLAR','KIZILAY','KÜLTÜR',
  'MUSTAFAPAŞA','MUSTAFA PAŞA','NAİLBEY','OLGUNLAR','RIZAİYE','RÜSTEMPAŞA',
  'SALI BABA','SALIBABA','SANAYİ','SARAYATİK','SUGÖZÜ','SÜRSÜRÜ',
  'ŞAHİNKAYA','ULUKENT','ÜNİVERSİTE','YENİ MAHALLE','YENİMAHALLE','YENİ',
  'YEMİŞLİK','YILDIZBAĞLARI','ZAFRAN',
  // Beldeler
  'AKÇAKİRAZ','AKÇAKIRAZ','ERİMLİ','BEYHAN','ÜÇOCAK','BÜKARDİ','BÜKARDI',
  'SARICAN','YAZIKONAK','MOLLAKENDİ','YURTBAŞI',
  // Yaygın köy isimleri (PDF'deki kayıtlardan)
  'BALIKÖYÜ','BALIKÖY','BALI','BELDELER',
  'ELMAPINAR','ELMAPINARKÖYU','ELMAPINAR KÖYÜ',
  'ACIPAYAM','AKÇAKALE','ALACA','ALATARLA','ALPAĞUT','ARINDIK','AVCILI','AYDINLAR',
  'BADEMPINARI','BAĞDERE','BAĞLARCA','BALIBEY','BALLICA','BEŞİKKÖY','BEŞOLUK',
  'BÖLÜKLÜ','BULUTLU','CEVİZDERE','CİPKÖY','ÇAĞLAR','ÇALICA','ÇÖTELİ','DALLICA',
  'DEDEPINARI','DEREBOĞAZI','DOĞANKUŞ','DURUPINAR','ERBİLDİ','GEDİKYOLU',
  'GÖLARDI','GÖLKÖY','GÖZEBAŞI','GÖZPINAR','GÜMÜŞBAĞLAR','GÜNAÇTI','GÜNBAĞI',
  'GÜNEYÇAYIRI','GÜZELYALI','HAL','HARMANTEPE','HIDIRBABA','HOŞKÖY','IŞIKYOLU',
  'İÇME','İKİTEPE','KALKANTEPE','KAPLIKAYA','KARAALİ','KARASAZ','KARATAŞ',
  'KAVAKTEPE','KELMAHMUT','KIRAÇKÖY','KOÇHARMANI','KOÇKALE','KONAKALMAZ',
  'KOPARUŞAĞI','KORUCU','KORUKÖY','KOZLUK','KÖRPE','KUMLA','KUŞHANE','KUYULU',
  'KÜLLÜK','MEŞELİ','NURALI','OBUZ','OYMAAĞAÇ','GÜZELYURT','ÖRENÇAY','PELTEKÖY',
  'POYRAZ','SAKABAŞI','SALKAYA','SARIÇUBUK','SARIGÜL','SARIKAMIŞ','SARIYAKUP',
  'SEDEFTEPE','SULTANUŞAĞI','SÜNKÖY','SÜTLÜCE','ŞABANLI','ŞEHSUVAR','ŞEYHACI',
  'TADIM','TEPEKÖY','UZUNTARLA','ÜÇAĞAÇ','ÜRÜNVEREN','YALINDAMLAR','YALNIZ',
  'YAZIPINARI','YEDİGÖZE','YENİKONAK','YOLÇATI','YOLÜSTÜ','YÜNLÜCE',
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
  // Full text satır sonları olmadan birleşik gelebiliyor: "7813**2** ABDULLAHPAŞA"
  // TC-bazlı parse: TC'ler benzersiz ve sabit (11 hane). Her TC'nin önü=kaydın isim+mahalle,
  // sonu=telefon. İki TC arası mesafeyi phoneEnd ile keserek bir sonraki kaydı ayırırız.

  const flat = text.replace(/\s+/g, ' ').trim();

  // TC'leri sırayla bul — 11+ hane rakam grupları (14 hanelik "TC+sira" birleşikleri için)
  // "35788336508278" → ilk 11 = TC, geri kalan = sonraki kaydın sira no
  const tcMatches = [];
  const tcRe = /(?<!\d)(\d{11,})(?!\d)/g;
  let mt;
  while ((mt = tcRe.exec(flat)) !== null) {
    const block = mt[1];
    const tc = block.slice(0, 11);
    tcMatches.push({ tc, start: mt.index, end: mt.index + 11 });
  }

  // Keyword regex (canonical mahalle adlarını yakalar)
  const keywords = KNOWN_MAHALLE_KEYWORDS.sort((a,b) => b.length - a.length).join('|');
  const keywordRe = new RegExp('(' + keywords + ')', 'i');

  // Telefon: TC'den hemen sonra gelen 10 hane rakam örüntüsü
  // "0507 534 32 82", "(536) 440-7813", "05075343282", "0 532 065 4474"
  const phoneAfterTcRe = /^\s*(?:\(?\s*0?\s*(5\d{2})\s*\)?[\s\-]*(\d{3})[\s\-]*(\d{2})[\s\-]*(\d{2}))/;

  const records = [];
  let prevPhoneEnd = 0;

  for (let i = 0; i < tcMatches.length; i++) {
    const { tc, start: tcStart, end: tcEnd } = tcMatches[i];

    // Prefix = önceki phoneEnd .. bu tcStart arası
    const prefix = flat.slice(prevPhoneEnd, tcStart).trim();
    // prefix = "<sira> <mahalleRaw> <isim>"
    // Örn: "1 ABDULAHPAŞA MAH MAHMUT ARI"

    // Sira: başta gelen 1-4 haneli rakam
    const siraM = prefix.match(/^(\d{1,4})\s+/);
    const sira = siraM ? parseInt(siraM[1]) : null;
    const afterSira = siraM ? prefix.slice(siraM[0].length) : prefix;

    // Mahalle keyword'u bul
    const kwM = afterSira.match(keywordRe);
    let mahalleRaw = '';
    let name = '';
    if (kwM) {
      const kwStart = kwM.index;
      const kwEnd = kwStart + kwM[0].length;
      // mahalle keyword + olası ekler (MAH, MAHALLE, TOKİ, MALLE, *, OKUL, OKULSOR) boşluk sonuna kadar
      // Keyword'den SONRA gelen ek kelimeler mahalle'ye, kalan = isim
      // Keyword'den ÖNCE: önceki kaydın çöp artığı (telefon, eski isim) — YOK SAYILIR
      const rest = afterSira.slice(kwEnd);
      const tokens = rest.split(/\s+/).filter(Boolean);
      let suffixTokens = [];
      let nameTokens = [];
      let collectingSuffix = true;
      for (const t of tokens) {
        if (collectingSuffix && /^(MAH\.?|MAHALLE|MAHALLESİ|MALLE|MAL|TOKİ|TOKI|OKUL|OKULSOR|KÖYÜ|KÖY|KOYU|[*]+)$/i.test(t)) {
          suffixTokens.push(t);
        } else {
          collectingSuffix = false;
          nameTokens.push(t);
        }
      }
      // Sadece keyword + suffix'ler mahalle
      mahalleRaw = afterSira.slice(kwStart, kwEnd) + (suffixTokens.length ? ' ' + suffixTokens.join(' ') : '');
      name = nameTokens.join(' ').trim();
    } else {
      // fallback: ilk kelime mahalle
      const parts = afterSira.split(/\s+/).filter(Boolean);
      mahalleRaw = parts[0] || '';
      name = parts.slice(1).join(' ').trim();
    }

    // Telefon yakalama — TC'den hemen sonra
    const afterTc = flat.slice(tcEnd);
    const phM = afterTc.match(phoneAfterTcRe);
    let phone = '';
    let phoneEnd = tcEnd;
    if (phM) {
      phone = '0' + phM[1] + phM[2] + phM[3] + phM[4]; // 11 hane "05XX..."
      phoneEnd = tcEnd + phM[0].length;
    }

    const canonMah = canonicalMahalle(
      mahalleRaw.replace(/\b(MAH\.?|MAHALLESİ|MAHALLE|MALLE|MAL|TOKİ|TOKI|OKULSOR|OKUL|[*]+)\b/gi, '').trim()
    );

    records.push({
      sira,
      mahalleRaw: mahalleRaw.trim(),
      mahalle: canonMah,
      tc,
      name,
      phone,
    });

    prevPhoneEnd = phoneEnd;
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

  // TC dublike: aynı TC varsa en temiz isim alanı olanı tut
  // Bozuk parse: ad alanında rakam veya 35+ karakter → tercih etmeyip sonrakine bak
  const isBadName = (n) => /\d/.test(n || '') || (n || '').length > 35 || (n || '').length < 3;

  // MANUEL OVERRIDE — PDF'te çakışma yüzünden parse edilemeyen 11 kayıt
  // TC → { name, mahalle (opsiyonel) }
  const MANUAL_OVERRIDES = {
    '24396708872': { name: 'ABDULKADİR OĞLU', mahalle: 'GÜNEYKENT MAHALLESİ' },
    '37339277506': { name: 'AHMET TÜRK', mahalle: 'GÜNEYKENT MAHALLESİ' },
    '58690289052': { name: 'AHMET FURKAN İLBAŞ', mahalle: 'HİCRET MAHALLESİ' },
    '19129891864': { name: 'MEHMET ALİ YILDIRIM', mahalle: 'ULUKENT MAHALLESİ' },
    '10613172674': { name: 'ERTURUL ERHAN', mahalle: 'ÜNİVERSİTE MAHALLESİ' },
    '27025622444': { name: 'SAMET KIZILELMA', mahalle: 'ZAFRAN MAHALLESİ' },
    '29947520266': { name: 'NİHAT ASMA', mahalle: '' },
    '10496178534': { name: 'YUSUF ALPTİKEN', mahalle: '' },
    '22559658204': { name: 'MEHMET DİKMEN', mahalle: '' },
    '38467241230': { name: 'KEMAL KAPTAN', mahalle: '' },
    '38443249816': { name: 'OKTAY KARABUDAK', mahalle: '' },
    // Ekran'da gözüken 6 hane telefonlular için de isim doğru, telefon boş bırakılacak
    '22756763794': { name: 'HIDIR KOÇOĞLU', phone: '' },
    '14648020498': { name: 'YAHYA AYDOĞDU', phone: '' },
    '34618375120': { name: 'MUHLİS KARAMAN', phone: '' },
    '31634759664': { name: 'MEHMET KILIÇ', phone: '' },
    '31615475518': { name: 'ORHAN KILIÇ', phone: '' },
    '11615142214': { name: 'CEVDET YAMAN', phone: '' },
    '39946184734': { name: 'HAMZA DURAN', phone: '' },
    '19906898721': { name: 'FATMA GÜLRU ÖZDEMİR', phone: '' },
    '12305110902': { name: 'MELEK KILINÇ', phone: '' },
    '23179757120': { name: 'MERVE ESMERAY', phone: '' },
    '26230648720': { name: 'İLHAMİ YALÇIN', phone: '' },
    '33374171540': { name: 'HASAN ANAT', phone: '' },
    '16699658400': { name: 'SİBEL ORTA', phone: '' },
    '17329255540': { name: 'ESRA ALYAPI İLHAL', phone: '' },
  };

  const tcBest = new Map(); // tc → en iyi record
  const noTc = [];

  for (const r of records) {
    if (!r.tc) { noTc.push(r); continue; }
    const prev = tcBest.get(r.tc);
    if (!prev) {
      tcBest.set(r.tc, r);
      continue;
    }
    // Hangisi daha iyi? Bozuk olmayan tercih edilir.
    if (isBadName(prev.name) && !isBadName(r.name)) {
      tcBest.set(r.tc, r);
    }
  }

  const rows = [];
  const unmatched = [];
  const bozukIsim = [];

  for (const r of tcBest.values()) {
    // Manuel override varsa uygula
    const ov = MANUAL_OVERRIDES[r.tc];
    if (ov) {
      if (ov.name) r.name = ov.name;
      if (ov.mahalle !== undefined) r.mahalle = ov.mahalle;
      if (ov.phone !== undefined) r.phone = ov.phone;
    }
    // Bozuk isim kayıtları Excel'e yazma — rapora at
    if (isBadName(r.name)) {
      bozukIsim.push(r);
      continue;
    }

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
  if (bozukIsim.length > 0) {
    const bAoa = [['TC', 'Bozuk Ad (PDF)', 'Mahalle', 'Telefon', 'Not']];
    for (const r of bozukIsim) bAoa.push([r.tc, r.name, r.mahalleRaw, r.phone, 'Manuel düzeltme gerek']);
    const wsB = XLSX.utils.aoa_to_sheet(bAoa);
    wsB['!cols'] = [{wch:14},{wch:50},{wch:20},{wch:14},{wch:22}];
    XLSX.utils.book_append_sheet(wbR, wsB, 'Bozuk İsim (manuel)');
  }
  XLSX.writeFile(wbR, REPORT_OUT);

  console.log(`\n[✓] Yazıldı: ${OUT}`);
  console.log(`[✓] Kayıt:    ${rows.length} (dublike TC elendi, bozuk isimli ${bozukIsim.length} kayıt hariç)`);
  console.log(`[✓] TC yok:   ${noTc.length}`);
  console.log(`[✓] Bozuk isim (manuel):  ${bozukIsim.length}`);
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
