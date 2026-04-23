import React, { useState, useEffect, useMemo, useRef } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

// ==============================================================
// Seçmen Listesi (Voters) — sıfırdan Firestore tabanlı implementasyon
//
// Dosya formatı:
//   - YSK CSV: ISO-8859-9 (Windows Latin-5 Turkish) encoding, ";" ayracı
//   - XLSX:    normal encoding, tek sayfa okunur
// Firestore'a yalnızca 9 alan yazılır (KVKK + boyut):
//   tc, firstName, lastName, birthDate, district, town, address,
//   ballotNumber, ballotArea
// ==============================================================

// ---------- Yardımcılar ----------
const trUpper = (s) => (s || '').toString().toLocaleUpperCase('tr-TR');

// Türkçe karakterleri ASCII'ye çevirip normalize et (başlık eşlemesi için)
const normalize = (s) =>
  trUpper(s)
    .replace(/İ/g, 'I')
    .replace(/I/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();

// Basit CSV satır parser'ı — çift tırnak ve ";" destekler
const parseCsvLine = (line, sep = ';') => {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
};

// Kolon indeksini bul: ilk eşleşen patterni kullan (exact veya includes)
const findCol = (headersNorm, patterns, { exact = false } = {}) => {
  for (const pat of patterns) {
    const pn = normalize(pat);
    const idx = exact
      ? headersNorm.findIndex((h) => h === pn)
      : headersNorm.findIndex((h) => h.includes(pn));
    if (idx >= 0) return idx;
  }
  return -1;
};

// CSV dosyasını ISO-8859-9 decode edip satır/hücre dizisine çevir
const readCsvIso88599 = async (file) => {
  const buffer = await file.arrayBuffer();
  // ISO-8859-9 desteği tüm modern tarayıcılarda TextDecoder ile mevcut
  const decoder = new TextDecoder('iso-8859-9');
  const text = decoder.decode(buffer);
  // BOM temizliği
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.length > 0);
  return lines.map((l) => parseCsvLine(l, ';'));
};

// XLSX dosyasını satır/hücre dizisine çevir (lazy import)
const readXlsx = async (file) => {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
};

// Önce exact match, bulamazsa includes fallback
const findColSmart = (normHeaders, exactPatterns, fuzzyPatterns = []) => {
  const exactIdx = findCol(normHeaders, exactPatterns, { exact: true });
  if (exactIdx >= 0) return exactIdx;
  return findCol(normHeaders, [...exactPatterns, ...fuzzyPatterns], { exact: false });
};

// Başlık dizisinden kolon indekslerini çıkar
const extractColumnMap = (headers) => {
  const normHeaders = headers.map(normalize);
  // SOYADI'nın "ADI" içeriyor olması ADI aramasını yanıltmasın diye önce soyadı bul
  const lastNameIdx = findColSmart(normHeaders, ['SOYADI'], ['SOYAD']);
  // ADI ararken SOYADI indeksini hariç tut
  let firstNameIdx = findCol(normHeaders, ['ADI'], { exact: true });
  if (firstNameIdx < 0) {
    firstNameIdx = normHeaders.findIndex((h, i) => i !== lastNameIdx && h.includes('ADI') && !h.includes('SOYAD'));
  }
  return {
    tc: findColSmart(normHeaders, ['TC KIMLIK NO'], ['TC KIMLIK', 'TC KIML', 'TC NO', 'TC']),
    firstName: firstNameIdx,
    lastName: lastNameIdx,
    birthDate: findColSmart(normHeaders, ['DOGUM TARIHI'], ['DOGUM TAR']),
    district: findColSmart(normHeaders, ['ADRES ILCE ADI'], ['ILCE ADI']),
    town: findColSmart(normHeaders, ['ADRES BELDE ADI'], ['BELDE ADI']),
    muhtarlik: findColSmart(normHeaders, ['ADRES MUHTARLIK ADI'], ['MUHTARLIK ADI']),
    address: findColSmart(normHeaders, ['ADRES CADDE/SOKAK ADI'], ['CADDE/SOKAK', 'CADDE', 'SOKAK']),
    ballotNumber: findColSmart(normHeaders, ['SANDIK NO'], []),
    ballotArea: findColSmart(normHeaders, ['SANDIK ALANI'], ['SANDIK ALAN']),
  };
};

// Bir satırdan Firestore dökümanı üret (null dönerse atla)
const rowToVoter = (row, colMap) => {
  const tcRaw = (row[colMap.tc] || '').toString().trim();
  const tc = tcRaw.replace(/\D/g, '');
  if (tc.length !== 11) return null;

  // Türkçe locale ile uppercase — search için indexli prefix query şart
  const firstName = trUpper((row[colMap.firstName] || '').toString().trim());
  const lastName = trUpper((row[colMap.lastName] || '').toString().trim());
  const birthDate = (row[colMap.birthDate] || '').toString().trim();
  const district = trUpper((row[colMap.district] || '').toString().trim());
  const town = trUpper((row[colMap.town] || '').toString().trim());
  const muhtarlik = colMap.muhtarlik >= 0 ? (row[colMap.muhtarlik] || '').toString().trim() : '';
  const addressRaw = (row[colMap.address] || '').toString().trim();
  // Mahalle + cadde birlikte daha anlamlı bir adres üretir
  const address = [muhtarlik, addressRaw].filter(Boolean).join(' ');
  const ballotNumber = (row[colMap.ballotNumber] || '').toString().trim();
  const ballotArea = (row[colMap.ballotArea] || '').toString().trim();

  return {
    tc,
    firstName,
    lastName,
    birthDate,
    district,
    town,
    address,
    ballotNumber,
    ballotArea,
  };
};

// ---------- Bileşen ----------
const VoterListSettings = ({ mode = 'full' }) => {
  // mode: 'full' (yükleme + arama) veya 'search-only' (sadece arama, seçim hazırlık için)
  const isSearchOnly = mode === 'search-only';
  const toast = useToast();
  const fileInputRef = useRef(null);

  // Yükleme durumu
  const [files, setFiles] = useState([]);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewFileName, setPreviewFileName] = useState('');
  const [colMap, setColMap] = useState(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastResult, setLastResult] = useState(null);

  // Meta
  const [totalCount, setTotalCount] = useState(null);
  const [districts, setDistricts] = useState([]);

  // Arama durumu
  const [searchTc, setSearchTc] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchBallotNo, setSearchBallotNo] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterTown, setFilterTown] = useState('');

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchedOnce, setSearchedOnce] = useState(false);

  // İlk açılışta sayım + ilçe listesi çek
  const refreshMeta = async () => {
    try {
      const count = await ApiService.getVoterCount();
      setTotalCount(count);
      const ds = await ApiService.getVoterDistricts();
      setDistricts(ds || []);
    } catch (e) {
      // Sessizce geç
    }
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  // ---------- Dosya seçimi + önizleme ----------
  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setFiles(selected);
    setLastResult(null);

    // İlk dosyadan önizleme üret
    try {
      const first = selected[0];
      setPreviewFileName(first.name);
      const isCsv = first.name.toLowerCase().endsWith('.csv');
      const rows = isCsv ? await readCsvIso88599(first) : await readXlsx(first);
      if (!rows || rows.length === 0) {
        toast.error('Dosya boş veya okunamadı.');
        setPreviewHeaders([]);
        setPreviewRows([]);
        setColMap(null);
        return;
      }
      const headers = rows[0];
      const map = extractColumnMap(headers);
      setPreviewHeaders(headers);
      setPreviewRows(rows.slice(1, 21));
      setColMap(map);

      if (map.tc < 0) {
        toast.warning('TC kimlik sütunu bulunamadı. Başlıkları kontrol edin.');
      }
    } catch (err) {
      console.error('Preview hatası:', err);
      toast.error('Dosya önizleme hatası: ' + (err.message || err));
    }
  };

  // ---------- Tüm seçilmiş dosyaları yükle ----------
  const handleUpload = async () => {
    if (!files || files.length === 0) {
      toast.error('Lütfen en az bir dosya seçin.');
      return;
    }

    setProcessing(true);
    setProgress({ current: 0, total: 0 });
    const fileReports = [];
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalSeen = 0;

    try {
      // Önce tüm dosyalardan seçmenleri çıkar
      const allVoters = [];
      for (const file of files) {
        const report = { fileName: file.name, rows: 0, valid: 0, skipped: 0, status: 'ok', message: '' };
        try {
          const isCsv = file.name.toLowerCase().endsWith('.csv');
          const rows = isCsv ? await readCsvIso88599(file) : await readXlsx(file);
          if (!rows || rows.length < 2) {
            report.status = 'error';
            report.message = 'Dosya boş ya da sadece başlık satırı içeriyor.';
            fileReports.push(report);
            continue;
          }
          const headers = rows[0];
          const map = extractColumnMap(headers);
          if (map.tc < 0) {
            report.status = 'error';
            report.message = 'TC kimlik sütunu bulunamadı.';
            fileReports.push(report);
            continue;
          }
          report.rows = rows.length - 1;
          for (let i = 1; i < rows.length; i++) {
            const v = rowToVoter(rows[i], map);
            if (v) {
              allVoters.push(v);
              report.valid++;
            } else {
              report.skipped++;
            }
          }
          report.message = `${report.valid} geçerli kayıt bulundu`;
        } catch (err) {
          report.status = 'error';
          report.message = 'Okuma hatası: ' + (err.message || err);
        }
        fileReports.push(report);
      }

      totalSeen = allVoters.length;
      setProgress({ current: 0, total: totalSeen });

      if (totalSeen === 0) {
        setLastResult({ fileReports, created: 0, skipped: 0, total: 0 });
        toast.warning('Hiç geçerli kayıt çıkarılamadı.');
        return;
      }

      // Batch'leri 400'lük parçalarla Firestore'a yaz
      const BATCH_SIZE = 400;
      for (let i = 0; i < allVoters.length; i += BATCH_SIZE) {
        const chunk = allVoters.slice(i, i + BATCH_SIZE);
        const res = await ApiService.batchCreateVoters(chunk);
        if (res && res.success) {
          totalCreated += res.created || 0;
          totalSkipped += res.skipped || 0;
        } else {
          totalSkipped += chunk.length;
        }
        setProgress({ current: Math.min(i + BATCH_SIZE, totalSeen), total: totalSeen });
      }

      setLastResult({ fileReports, created: totalCreated, skipped: totalSkipped, total: totalSeen });
      toast.success(`${totalCreated} kayıt yüklendi. ${totalSkipped} atlandı.`);
      setFiles([]);
      setPreviewHeaders([]);
      setPreviewRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      refreshMeta();
    } catch (err) {
      console.error('Upload hatası:', err);
      toast.error('Yükleme hatası: ' + (err.message || err));
    } finally {
      setProcessing(false);
    }
  };

  // ---------- Arama ----------
  const runSearch = async () => {
    setSearching(true);
    setSearchedOnce(true);
    try {
      const filters = {};
      if (searchTc.trim()) filters.tc = searchTc.trim();
      if (searchFirstName.trim()) filters.firstName = searchFirstName.trim();
      if (searchLastName.trim()) filters.lastName = searchLastName.trim();
      if (searchBallotNo.trim()) filters.ballotNumber = searchBallotNo.trim();
      if (filterDistrict) filters.district = filterDistrict;
      if (filterTown.trim()) filters.town = filterTown.trim();
      if (Object.keys(filters).length === 0) {
        toast.warning('En az bir arama kriteri girin');
        setResults([]);
        return;
      }
      const list = await ApiService.searchVoters(filters);
      setResults(list || []);
    } catch (err) {
      console.error('Arama hatası:', err);
      toast.error('Arama hatası: ' + (err.message || err));
    } finally {
      setSearching(false);
    }
  };

  const resetSearch = () => {
    setSearchTc('');
    setSearchFirstName('');
    setSearchLastName('');
    setSearchBallotNo('');
    setFilterDistrict('');
    setFilterTown('');
    setResults([]);
    setSearchedOnce(false);
  };

  // ---------- Tümünü sil ----------
  const handleDeleteAll = async () => {
    const ok = window.confirm(
      `DİKKAT: Firestore'daki TÜM seçmen kayıtları silinecek${totalCount != null ? ` (yaklaşık ${totalCount} kayıt)` : ''}. Devam edilsin mi?`
    );
    if (!ok) return;
    const ok2 = window.confirm('Son onay: Bu işlem geri alınamaz. Silmek istediğinizden emin misiniz?');
    if (!ok2) return;

    setProcessing(true);
    try {
      const res = await ApiService.deleteAllVoters();
      if (res && res.success) {
        toast.success(`${res.deleted || 0} kayıt silindi.`);
      } else {
        toast.error('Silme hatası: ' + (res?.message || 'bilinmeyen'));
      }
      refreshMeta();
      setResults([]);
    } catch (err) {
      toast.error('Silme hatası: ' + (err.message || err));
    } finally {
      setProcessing(false);
    }
  };

  // ---------- Render ----------
  const detectedSummary = useMemo(() => {
    if (!colMap) return null;
    const labels = {
      tc: 'TC',
      firstName: 'Adı',
      lastName: 'Soyadı',
      birthDate: 'Doğum Tarihi',
      district: 'İlçe',
      town: 'Belde',
      muhtarlik: 'Mahalle',
      address: 'Cadde/Sokak',
      ballotNumber: 'Sandık No',
      ballotArea: 'Sandık Alanı',
    };
    return Object.entries(labels).map(([k, label]) => ({
      label,
      found: colMap[k] >= 0,
      header: colMap[k] >= 0 ? previewHeaders[colMap[k]] : '—',
    }));
  }, [colMap, previewHeaders]);

  return (
    <div className="space-y-6">
      {/* Başlık + Özet */}
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Seçmen Listesi</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              YSK CSV (ISO-8859-9) veya XLSX dosyalarını Firestore'a yükleyin. Yalnızca zorunlu 9 alan kaydedilir.
            </p>
          </div>
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Kayıtlı seçmen:</span>{' '}
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {totalCount == null ? '—' : totalCount.toLocaleString('tr-TR')}
            </span>
          </div>
        </div>
      </div>

      {/* Yükleme bölümü — sadece full mode'da */}
      {!isSearchOnly && (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Dosya Yükleme</h4>

        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <label
            htmlFor="voter-file-upload"
            className={`flex-1 flex items-center justify-center px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              processing ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-500 dark:hover:border-indigo-400'
            } border-gray-300 dark:border-gray-600`}
          >
            <div className="text-center">
              <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
              </svg>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium text-indigo-600 dark:text-indigo-400">Dosya seçin</span>
                <span className="pl-1">veya sürükleyip bırakın</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">CSV (YSK) veya XLSX — çoklu seçim desteklenir</p>
              {files && files.length > 0 && (
                <p className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                  {files.length} dosya seçildi
                </p>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="voter-file-upload"
              type="file"
              className="sr-only"
              accept=".csv,.xlsx,.xls"
              multiple
              disabled={processing}
              onChange={handleFileChange}
            />
          </label>

          <div className="flex flex-col gap-2 sm:w-48">
            <button
              type="button"
              onClick={handleUpload}
              disabled={processing || files.length === 0}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'İşleniyor…' : 'Yükle ve İşle'}
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={processing || totalCount === 0}
              className="inline-flex items-center justify-center px-4 py-2 border border-red-300 dark:border-red-700 text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              Tümünü Sil
            </button>
          </div>
        </div>

        {/* Sütun eşleşme özeti */}
        {detectedSummary && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Sütun Eşleşmesi — {previewFileName}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              {detectedSummary.map((d) => (
                <div
                  key={d.label}
                  className={`px-2 py-1 rounded ${
                    d.found
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  <span className="font-medium">{d.label}:</span> {d.found ? d.header : 'yok'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {processing && progress.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
              <span>Yükleniyor…</span>
              <span>
                {progress.current.toLocaleString('tr-TR')} / {progress.total.toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 transition-all"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Önizleme */}
        {previewRows.length > 0 && (
          <div className="mt-5">
            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Önizleme (ilk {previewRows.length} satır)
            </h5>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md max-h-80">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                  <tr>
                    {previewHeaders.map((h, i) => (
                      <th key={i} className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-700/20'}>
                      {previewHeaders.map((_, ci) => (
                        <td key={ci} className="px-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200">
                          {row[ci] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sonuç raporu */}
        {lastResult && (
          <div className="mt-5 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Yükleme Sonucu</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Toplam Satır</div>
                <div className="font-semibold">{lastResult.total.toLocaleString('tr-TR')}</div>
              </div>
              <div>
                <div className="text-xs text-green-600 dark:text-green-400">Yüklenen</div>
                <div className="font-semibold text-green-700 dark:text-green-300">
                  {lastResult.created.toLocaleString('tr-TR')}
                </div>
              </div>
              <div>
                <div className="text-xs text-red-600 dark:text-red-400">Atlanan</div>
                <div className="font-semibold text-red-700 dark:text-red-300">
                  {lastResult.skipped.toLocaleString('tr-TR')}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Dosya Sayısı</div>
                <div className="font-semibold">{lastResult.fileReports.length}</div>
              </div>
            </div>
            {lastResult.fileReports.length > 0 && (
              <div className="mt-3 space-y-1 text-xs">
                {lastResult.fileReports.map((r, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded ${
                      r.status === 'ok'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    }`}
                  >
                    <strong>{r.fileName}</strong> — {r.message} ({r.valid || 0} geçerli, {r.skipped || 0} atlandı)
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Arama bölümü */}
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Seçmen Sorgulama</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">TC Kimlik No (11 hane)</label>
            <input
              type="text"
              maxLength={11}
              value={searchTc}
              onChange={(e) => setSearchTc(e.target.value.replace(/\D/g, ''))}
              placeholder="12345678901"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Adı</label>
            <input
              type="text"
              value={searchFirstName}
              onChange={(e) => setSearchFirstName(e.target.value)}
              placeholder="Ad"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Soyadı</label>
            <input
              type="text"
              value={searchLastName}
              onChange={(e) => setSearchLastName(e.target.value)}
              placeholder="Soyad"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sandık No</label>
            <input
              type="text"
              value={searchBallotNo}
              onChange={(e) => setSearchBallotNo(e.target.value)}
              placeholder="Sandık numarası"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">İlçe</label>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Tümü —</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Belde</label>
            <input
              type="text"
              value={filterTown}
              onChange={(e) => setFilterTown(e.target.value)}
              placeholder="Belde adı"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            {searching ? 'Aranıyor…' : 'Ara'}
          </button>
          <button
            type="button"
            onClick={resetSearch}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Temizle
          </button>
          <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 self-center">
            * TC dışı aramalar ilk 1000 kayıt üzerinden filtrelenir.
          </div>
        </div>

        {/* Sonuç tablosu */}
        <div className="mt-4">
          {results.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">TC</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Adı</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Soyadı</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Doğum</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">İlçe</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Belde</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Adres</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Sandık No</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Sandık Alanı</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {results.map((v) => (
                    <tr key={v.id || v.tc} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-900 dark:text-gray-100">{v.tc}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{v.firstName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{v.lastName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{v.birthDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{v.district}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{v.town}</td>
                      <td className="px-3 py-2">{v.address}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-indigo-600 dark:text-indigo-400">
                        {v.ballotNumber}
                      </td>
                      <td className="px-3 py-2">{v.ballotArea}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                {results.length} sonuç gösteriliyor.
              </div>
            </div>
          ) : (
            searchedOnce &&
            !searching && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">Kriterlere uyan kayıt bulunamadı.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default VoterListSettings;
