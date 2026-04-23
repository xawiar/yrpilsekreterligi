#!/usr/bin/env node
/**
 * PDF'deki temsilci listelerini mahalle/köy Excel şablonuna dönüştür.
 *
 * Girdi (PDF text raw):
 *   ~/Downloads/EN SON YRP_MAHALLE_LİSTESİ_1 (1).pdf (page 1)
 *   ~/Downloads/ELAZIĞ MERKEZ İLÇE KÖYLERİ SON (2).pdf (pages 1-4)
 *
 * Çıktı:
 *   ~/Downloads/mahalle_temsilci_MERKEZ.xlsx
 *   ~/Downloads/koy_temsilci_MERKEZ.xlsx
 *
 * Import upsert mantığıyla aynı mahalle/köy varsa sadece temsilci eklenir.
 */

const path = require('path');
const os = require('os');
const XLSX = require(path.join(__dirname, '..', 'sekreterlik-app', 'client', 'node_modules', 'xlsx'));

const DOWNLOADS = path.join(os.homedir(), 'Downloads');

// ---- PDF text'leri burada hardcoded (pdf-reader sonucu) ----
// Mahalle PDF page 1
const MAHALLE_TEXT = `
1 ELAZIĞ MERKEZ AŞAĞI DEMİRTAŞ MAHALLESİ MURAT ÖZEN 38320245894 0507 534 32 82
2 ELAZIĞ MERKEZ YUKARI DEMİRTAŞ MAHALLESİ MURAT ÖZEN 38320245894 0507 534 32 82
3 ELAZIĞ MERKEZ GÜNEYKENT MAHALLESİ RAHMİ ÜZEK 17050950186 0539 823 56 20
4 ELAZIĞ MERKEZ YEMİŞLİK MAHALLESİ MURAT FIRAT 0534 224 45 44
5 ELAZIĞ MERKEZ HİLALKENT MAHALLESİ BÜLENT MASTAR 17494936722 0539 457 99 90
6 ELAZIĞ MERKEZ ABDULLAHPAŞA MAHALLESİ ZÜLFÜ TOPUZ
7 ELAZIĞ MERKEZ ATAŞEHİR MAHALLESİ HALİT CANPOLAT 43438068310 0501 035 30 23
8 ELAZIĞ MERKEZ HANKENDİ MAHALLESİ HÜSEYİN ORHAN 14009054698 0507 275 55 85
8 ELAZIĞ MERKEZ CUMHURİYET MAHALLESİ SEZAİ KURNAZ 41086148934 0533 664 43 36
9 ELAZIĞ MERKEZ ŞAHİNKAYA MAHALLESİ HÜSEYİN KAPTAN 23383743890 0552 732 37 23
10 ELAZIĞ MERKEZ ÇAYDAÇIRA MAHALLESİ MEHMET ÇAKMAK 36121319332 0505 969 89 12
11 ELAZIĞ MERKEZ ZAFRAN MAHALLESİ ÖNER GENÇ 26452641370 0531 553 97 95
12 ELAZIĞ MERKEZ YENİ MAHALLE GÜRKAN ÇOK 38788228040 0546 143 49 97
13 ELAZIĞ MERKEZ YILDIZBAĞLARI MAHALLESİ CEMAL TOPRAK 0538 213 76 43
14 ELAZIĞ MERKEZ FEVZİÇAKMAK MAHALLESİ BİLAL GÜNEŞ
15 ELAZIĞ MERKEZ ESENTEPE MAHALLESİ KEMAL ÖNCÜ 46865529438 0554 560 59 06
16 ELAZIĞ MERKEZ ÜNİVERSİTE MAHALLESİ MEHMET ALİ ARSLAN 26182607844 0535 874 52 21
17 ELAZIĞ MERKEZ HARPUT MAHALLESİ ERGÜN AKDEMİROĞLU 24427707564 0535 220 23 15
18 ELAZIĞ MERKEZ GÖLLÜBAĞ ALİ ATEŞ 13001088472 0533 359 86 23
19 ELAZIĞ MERKEZ ALAYAPRAK MAHALLESİ YAŞAR IŞIK 45067019596 0538 464 04 71
20 ELAZIĞ MERKEZ RIZAİYE MAHALLESİ ALİ DOĞAN 10832161114 0542 411 19 69
21 ELAZIĞ MERKEZ İCADİYE MAHALLESİ SUCEDDİN ÖZDEMİR 30721497452 0534 353 51 52
22 ELAZIĞ MERKEZ İZZETPAŞA MAHALLESİ MİNE SORAN 22468772480 0544 768 69 75
23 ELAZIĞ MERKEZ SÜRSÜRÜ MAHALLESİ MEHMET CEBELOĞLU 13229070396 0532 479 70 23
24 ELAZIĞ MERKEZ OLGUNLAR MAHALLESİ SİNAN AYDOĞAN 28054587964 0536 847 66 20
25 ELAZIĞ MERKEZ KÜLTÜR MAHALLESİ HÜSEYİN DENİZ 17902934432 0533 495 53 82
26 ELAZIĞ MERKEZ NAİLBEY MAHALLESİ
27 ELAZIĞ MERKEZ AKPINAR MAHALLESİ ASIM SÖNMEZ 27892593410 0537 704 62 30
28 ELAZIĞ MERKEZ HİCRET MAHALLESİ FETHİ GÜVEN
29 ELAZIĞ MERKEZ SARAYATİK MAHALLESİ HÜSEYİN KAYA 22360784192 0538 219 77 90
30 ELAZIĞ MERKEZ ÇARŞI MAHALLESİ ŞAHİN UÇAR 30991478236 0539 383 68 52
31 ELAZIĞ MERKEZ AKSARAY MAHALLESİ MEHMET CAN GÜLAÇ 27466607918 0536 037 46 82
32 ELAZIĞ MERKEZ KIZILAY MAHALLESİ TURAN CİRİT 0539 658 74 23
33 ELAZIĞ MERKEZ GÜMÜŞKAVAK MAHALLESİ KEMAL ÇELİKDEMİR 17995920350 0536 580 54 48
34 ELAZIĞ MERKEZ KARŞIYAKA MAHALLESİ AHMET SİVRİTEPE 32896425582 0538 684 65 90
35 ELAZIĞ MERKEZ SALI BABA MAHALLESİ ALİ GEZER 17329894586 0531 743 47 62
36 ELAZIĞ MERKEZ ÇATALÇEŞME MAHALLESİ EŞREF KILIÇ 31624475226 0552 028 00 45
37 ELAZIĞ MERKEZ SUGÖZÜ MAHALLESİ
38 ELAZIĞ MERKEZ DOĞUKENT MAHALLESİ
39 ELAZIĞ MERKEZ ULUKENT MAHALLESİ MURAT DEMİR 23035752546 0534 620 89 23
40 ELAZIĞ MERKEZ KIRKLAR MAHALLESİ HASAN DEMİRKIRAN 26452634686 0541 245 23 62
41 ELAZIĞ MERKEZ MUSTAFAPAŞA MAHALLESİ MUHAMMED TOLAN 20398838528 0536 716 97 49
42 ELAZIĞ MERKEZ RÜSTEMPAŞA MAHALLESİ AYHAN DEMİRTAŞOĞLU 24193703166 0536 944 33 85
43 ELAZIĞ MERKEZ SANAYİ MAHALLESİ OĞUZHAN ÇÖTELİ 0531 439 82 23
`.trim();

// Köy PDF 4 sayfa
const KOY_TEXT = `
1 ACIPAYAM İSA AYTEKİN 0532 677 76 23
2 AKÇAKALE HÜSEYİN SELEN 0538 221 90 76 38485238090
3 ALACA BÜNYAMİN ORZAN 0537 445 45 88 32521436860
4 ALATARLA NİHAT ÇALAN 0534 711 71 03 29566535382
5 ALPAĞUT FAİK ALTUNBULAK 0532 065 44 74 17737929634
6 ALTINKUŞAK
7 ARINDIK KAZIM ÇÖTELİ 0533 329 96 94 43750061556
8 AVCILI ORHAN İLBEK 0531 883 11 28 33979388336
9 AYDINCIK
10 AYDINLAR BAHATTİN AKBULUT 0536 322 27 36 20926823484
11 BADEMPINARI BURHAN EKİNCİ 0531 975 92 01 29563545896
12 BAĞDERE TAHSİN SAN 0537 930 08 20 16621966984
13 BAĞLARCA ZÜLFÜ KAYMAZ 0538 316 33 24 14471038660
14 BALIBEY ÇAĞLAYAN COŞKUN 0530 553 30 30 37246275594
15 BALLICA FERHAT YAMAN 0532 575 42 48 34390374700
16 BALPINAR
17 BEŞİKKÖY HALİME KARATAŞ 0537 594 07 62 27904590994
18 BEŞOLUK ERDİNÇ GENÇ 0534 014 21 73 26569635484
19 BEYDALI
20 BEYDOĞMUŞ
21 BÖLÜKLÜ HASAN AYDIN 0544 247 00 23 19450872792
22 BULUTLU ABDULKADİR ÖZMEN 0553 436 23 24 29624257232
23 CEVİZDERE VOLKAN ECDER 0537 694 14 45 10802161076
24 CİPKÖY AHMET BÖYÜK 0530 089 50 20 15911879898
25 ÇAĞLAR EYÜP GÜNER 0538 869 95 13 12839028698
26 ÇALICA AYHAN DAĞDEVİREN 0537 628 71 12 23305744356
27 ÇATALHARMAN
28 ÇÖTELİ MEHMET AYHAN 0535 474 93 90 29905524466
29 DALLICA ADNAN YENER 0543 583 53 23 25162682574
30 DAMBÜYÜK
31 DEDEPINARI FİKRİ YALÇINKAYA 0533 476 90 60 17899924638
32 DEĞİRMENÖNÜ
33 DEREBOĞAZI BERAT KARAKAYA 0537 355 62 07 15440006482
34 DOĞANKUŞ ABDURRAHMAN GÜLER 0538 703 76 55 38251246472
35 DURUPINAR HAŞİM BULUT 0544 226 88 16 28813560924
36 ELMAPINARI NİHAT ASMA 0532 617 86 45 29947520266
37 ERBİLDİ BAHRİ KARABULUT 0537 356 88 23 18424907218
38 ESENKENT
39 FATMALI
40 GEDİKYOLU RAMAZAN AYDIN 0539 841 23 95 13451073004
41 GÖKÇE
42 GÖLARDI ÖZKAN DALGAKIRAN 0542 805 23 07 39277212250
43 GÖLKÖY ENES NAMLI 0541 180 34 62 15575004254
44 GÖZEBAŞI MUSTAFA DURSUN 0530 643 89 30 25867659222
45 GÖZPINAR ZÜLKÜF ECE 0552 323 21 23 11294092312
46 GÜLPINAR
47 GÜMÜŞBAĞLAR BİROL GECEKUŞU 0535 421 13 03 17485938612
48 GÜNAÇTI LEVENT KAYA 0536 359 52 92 37933257188
49 GÜNBAĞI İLHAN BULUT 0533 263 90 65 33661399572
50 GÜNEYÇAYIRI VEYSEL ISSİ 0532 540 16 49 29071552584
51 GÜZELYALI BEKİR ÇETİN 0530 580 00 44 17440940728
52 HAL HAYRULLAH DUMAN 0535 714 72 53 15062020972
53 HARMANTEPE BARIŞ BAL 0537 949 40 23 32351443156
54 HIDIRBABA SELAHADDİN KARAASLAN 0536 837 67 92 35593335444
55 HOŞKÖY FERHAT MENEKŞE 0541 852 77 50 23563736476
56 IŞIKYOLU HAMZA GÜNCÜ 0537 382 97 81 20476837344
57 İÇME HÜDAİ KILINÇ
58 İKİTEPE HALİL GÜVEN 0537 331 39 90 38557236740
59 KALKANTEPE MEHMET NURİ ÇELİK 0543 945 76 39 42580102798
60 KAPLIKAYA SAMET ARSLAN 0534 824 62 68 14399042046
61 KARAALİ YÜKSEL KERTİ 0538 949 57 89 38992211296
62 KARAÇAVUŞ
63 KARASAZ MEHMET ALİ ASLAN 0535 666 95 08 30559461946
64 KARATAŞ CABİR YAVUZ 0539 252 47 23 13547070412
65 KAVAKPINAR
66 KAVAKTEPE TAYFUN ERBAY 0532 577 98 32 34903358678
67 KELMAHMUT MUSTAFA DÜZEL 0538 709 91 39 45481015266
68 KEPEKTAŞ
69 KIRAÇKÖY KEMAL BEY 0541 948 13 55
70 KOÇHARMANI İSMET YÖŞ 0537 654 31 28 38251248216
71 KOÇKALE MEHMET TÜRKOĞLU 0530 746 49 96
72 KONAKALMAZ ORHAN TUNÇ 0533 242 64 10 15458006818
73 KOPARUŞAĞI EYÜPCAN ARPACI 0552 389 13 22 15347006882
74 KORUCU ERHAN ALTAŞ 0535 880 98 60 37990255820
75 KORUKÖY ÇINAR YILDIRIM 0538 409 55 30 23461747352
76 KOZLUK İBRAHİM GÜRKAN ÖZDEMİR 0546 733 20 92 19639867526
77 KÖRPE ŞAHİN UMUTCAN 0536 791 83 62 16198982240
78 KUMLA MUSTAFA TOSUN 0537 324 99 45 12896092366
79 KURTDERE
80 KUŞHANE MUSA YILDIZ 0536 740 51 59 13408082232
81 KUŞLUYAZI
82 KUYULU RAMAZAN BAĞCI 0537 509 01 87 31804462176
83 KÜLLÜK SERVET BULUT 0537 894 05 70 25405675486
84 MEŞELİ SIDDIK KUŞ 0535 931 38 72 25313566494
85 MURATÇIK
86 NURALI NUSRETTİN KİL 0534 315 06 60 39352209250
87 OBUZ AHMET ÖZTÜRK 0533 592 46 61 25147683534
88 ORTAÇALI
89 OYMAAĞAÇ MEHMET GECEKUŞU 0536 764 06 54
90 GÜZELYURT HİKMET ALMIŞ 0537 065 65 87 33952390622
91 ÖRENÇAY CÜNEYT KAYA 0536 619 41 14 31891406350
92 PELTEKÖY YAVUZ ÖNER 0539 936 26 91 23317745136
93 PİRİNÇÇİ
94 POYRAZ HAFIZ MURAT GÜL 0545 382 27 13 15347010810
95 SAKABAŞI OSMAN BAYHAN 0530 329 60 23 12095119222
96 SALKAYA OSMAN YILMAZ - 13820068402
97 SANCAKLI
98 SARIBÜK
99 SARIÇUBUK YAĞIZ KAPTAN 0534 551 07 18
100 SARIGÜL ERDAL YILMAZ 0536 445 41 88 20998822538
101 SARIKAMIŞ MEHMET ÇELİK 0539 601 73 54 16558970528
102 SARILI
103 SARIYAKUP MUHAMMET BAŞ 0538 885 44 93 30751497590
104 SEDEFTEPE NÜSRET BAYRAM 0531 404 85 83 18454841612
105 SERİNCE
106 SİNANKÖY
107 SULTANUŞAĞI AYDIN ALTUNBEY 0535 284 84 37 42397098192
108 SÜNKÖY MUSTAFA BOYRAZ 0533 365 38 32 13745065012
109 SÜTLÜCE ABDULLAH AKTALIN 0537 912 20 90 35980323306
110 ŞABANLI MAHMUT BULUT 0536 067 54 40 34894359500
111 ŞAHAPLI
112 ŞEHSUVAR OSMAN KILIÇ 0535 728 57 30 13541071316
113 ŞEYHACI NİYAZİ KARATAŞ 0536 763 99 62 13202081838
114 TADIM ALİ ÇELİK 0535 299 58 73 37993256374
115 TEMÜRKÖY
116 TEPEKÖY LÜTFÜ AY 0533 391 33 20 32464440658
117 TOHUMLU
118 UZUNTARLA ÖMER ERDEM 0530 262 93 70 40582170142
119 ÜÇAĞAÇ CAHİT BAL 0543 831 01 23 31051487830
120 ÜRÜNVEREN FIRAT AKARSU 0530 881 95 02 28480573524
121 YALINDAMLAR ENVER BAYRAMCI 0534 611 77 59 24661700826
122 YALNIZ AHMET ZİHNİ ERAN 0533 582 95 23 10445180328
123 YAZIPINARI AHMET HULİSİ AKYOL 0533 556 26 36 34273377590
124 YEDİGÖZE ZÜLFÜ GÖZETLEYEN 0535 838 11 06 27172615450
125 YENİKAPI
126 YENİKONAK YUSUF YERLİ 0532 411 22 17 27292613350
127 YOLÇATI SELİM BARIŞ 0534 559 34 23 39745206422
128 YOLÜSTÜ ALİ SORAN 0532 565 27 47 21580803782
129 YUKARIÇAKMAK
130 YÜNLÜCE MİKTAT BAYKAL 0506 508 50 94 10679167232
131 YÜREKLİ
`.trim();

// ==== PARSE ====

// Telefon ve TC tanıma
const TC_RE = /\b\d{11}\b/g;
// Telefon: "0XXX XXX XX XX" (boşluklu), "0XXXXXXXXXX" (bitişik), "XXX XXX XXXX" (0'sız)
function normalizePhone(s) {
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) return '0' + digits.slice(1,4) + digits.slice(4,7) + digits.slice(7,9) + digits.slice(9,11);
  if (digits.length === 10) return '0' + digits;
  return digits;
}
function isValidTc(s) {
  return /^[1-9]\d{10}$/.test(s);
}

// Telefon tanıma: (0?\d{3})\s*\d{3}\s*\d{2}\s*\d{2}
const PHONE_RE = /(?:0\s*)?(\d{3})\s*(\d{3})\s*(\d{2})\s*(\d{2})/;

function parseMahalleLine(line) {
  // "X ELAZIĞ MERKEZ AKPINAR MAHALLESİ ASIM SÖNMEZ 27892593410 0537 704 62 30"
  const m = line.match(/^\d+\s+ELAZIĞ\s+MERKEZ\s+(.+?)\s*(?:MAHALLESİ|MAHALLE)(?:\s+(.+))?$/);
  if (!m) return null;
  let mahalleAdi = m[1].trim();
  let rest = (m[2] || '').trim();
  // "GÖLLÜBAĞ ALİ ATEŞ..." — GÖLLÜBAĞ MAHALLESİ yok, sadece "GÖLLÜBAĞ". Fallback:
  // fallback regex
  return { mahalleAdi, rest };
}
function parseMahalleFallback(line) {
  const m = line.match(/^\d+\s+ELAZIĞ\s+MERKEZ\s+(GÖLLÜBAĞ)\s*(.*)$/);
  if (!m) return null;
  return { mahalleAdi: m[1], rest: m[2].trim() };
}

function parseName(rest) {
  // Format varyasyonları:
  //   Mahalle: "AD SOYAD TC TELEFON"
  //   Köy:     "AD SOYAD TELEFON TC"
  //   TC ya da telefonun biri veya ikisi eksik olabilir
  //
  // Strateji: rest içinde TC ve telefon bul, ikisinin de EN ERKEN konumuna kadar
  // olan kısmı isim kabul et. TC ve telefonu string'den çıkar, kalan = isim.

  let tc = '';
  let phone = '';
  let cleaned = rest;

  // 1) TC'yi bul ve string'den çıkar (telefon karışmasın)
  const tcMatch = rest.match(/\b(\d{11})\b/);
  if (tcMatch && isValidTc(tcMatch[1])) {
    tc = tcMatch[1];
    cleaned = cleaned.replace(tc, ' ');
  }

  // 2) Telefonu TC çıkarılmış string'de ara (0 ile başlayıp 5XX formatı)
  const STRICT_PHONE_RE = /\b0?(5\d{2})\s*(\d{3})\s*(\d{2})\s*(\d{2})\b/;
  const phMatch = cleaned.match(STRICT_PHONE_RE);
  if (phMatch) {
    phone = phMatch[0];
    cleaned = cleaned.replace(phone, ' ');
  }

  const name = cleaned.replace(/\s+/g, ' ').trim();

  if (phone) {
    const digits = phone.replace(/\D/g, '');
    phone = digits.length >= 10 ? normalizePhone(phone) : '';
  }
  return { name, tc, phone };
}

function parseMahalle() {
  const rows = [];
  for (const line of MAHALLE_TEXT.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let p = parseMahalleLine(trimmed);
    if (!p) p = parseMahalleFallback(trimmed);
    if (!p) continue;
    const { mahalleAdi, rest } = p;
    const { name, tc, phone } = parseName(rest);
    rows.push({
      ilce: 'MERKEZ',
      belde: '',
      ad: mahalleAdi + (mahalleAdi.endsWith('MAHALLE') ? '' : ' MAHALLESİ'),
      temsilciAd: name,
      tc,
      tel: phone,
    });
  }
  return rows;
}

function parseKoy() {
  const rows = [];
  for (const line of KOY_TEXT.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // "1 ACIPAYAM İSA AYTEKİN 05326777623"
    const m = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const rest = m[2];

    // Köy adını bul: ilk kelime (çoğunlukla tek kelime, bazen "..KÖY" veya "... YURT" gibi)
    // Köy adı her zaman TEK kelime (YENİ, ACIPAYAM, AKÇAKALE gibi)
    // Ama "KIRAÇKÖY" gibi birleşikler de var — TEK kelime.
    const words = rest.split(/\s+/);
    const koyAdi = words[0];
    const restAfterKoy = words.slice(1).join(' ').trim();

    if (!restAfterKoy) {
      rows.push({ ilce: 'MERKEZ', belde: '', ad: koyAdi, temsilciAd: '', tc: '', tel: '' });
      continue;
    }

    const { name, tc, phone } = parseName(restAfterKoy);
    rows.push({
      ilce: 'MERKEZ', belde: '', ad: koyAdi,
      temsilciAd: name, tc, tel: phone,
    });
  }
  return rows;
}

// ==== WRITE ====

function writeMahalleExcel(rows) {
  const header = [
    'İlçe Adı', 'Belde Adı (opsiyonel)', 'Mahalle Adı',
    'Mahalle Temsilcisi Adı', 'Mahalle Temsilcisi TC', 'Mahalle Temsilcisi Telefon'
  ];
  const aoa = [header];
  for (const r of rows) {
    aoa.push([r.ilce, r.belde, r.ad, r.temsilciAd, r.tc, r.tel]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:12},{wch:16},{wch:30},{wch:24},{wch:14},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws, 'Mahalle Listesi');
  XLSX.writeFile(wb, path.join(DOWNLOADS, 'mahalle_temsilci_MERKEZ.xlsx'));
}

function writeKoyExcel(rows) {
  const header = [
    'İlçe Adı', 'Belde Adı (opsiyonel)', 'Köy Adı',
    'Köy Temsilcisi Adı', 'Köy Temsilcisi Telefon', 'Köy Temsilcisi TC'
  ];
  const aoa = [header];
  for (const r of rows) {
    aoa.push([r.ilce, r.belde, r.ad, r.temsilciAd, r.tel, r.tc]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:12},{wch:16},{wch:22},{wch:24},{wch:18},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Köy Listesi');
  XLSX.writeFile(wb, path.join(DOWNLOADS, 'koy_temsilci_MERKEZ.xlsx'));
}

function main() {
  const mah = parseMahalle();
  const koy = parseKoy();
  writeMahalleExcel(mah);
  writeKoyExcel(koy);

  console.log(`[✓] Mahalle: ${mah.length} kayıt (${mah.filter(r=>r.temsilciAd).length} temsilci dolu)`);
  console.log(`    ~/Downloads/mahalle_temsilci_MERKEZ.xlsx`);
  console.log(`[✓] Köy:     ${koy.length} kayıt (${koy.filter(r=>r.temsilciAd).length} temsilci dolu)`);
  console.log(`    ~/Downloads/koy_temsilci_MERKEZ.xlsx`);

  // Örnek ilk 5
  console.log('\nMahalle ilk 5:');
  mah.slice(0, 5).forEach(r => console.log('  ', r));
  console.log('\nKöy ilk 5:');
  koy.slice(0, 5).forEach(r => console.log('  ', r));
}

main();
