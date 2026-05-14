import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';
import MemberFormOCRService from '../services/MemberFormOCRService';
import VoterMatchModal from './VoterMatchModal';
import VoterCacheService from '../services/VoterCacheService';

const emptyRow = () => ({
  seri_no: '',
  ad: '',
  soyad: '',
  tc: '',
  telefon: '',
  dogum_tarihi: '',
  notlar: '',
  tcGecerli: false,
  uyarilar: [],
  _source: ''
});

const MemberFormOCRSettings = () => {
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [matchIndex, setMatchIndex] = useState(null); // modal için satır index
  const [isBulkMatching, setIsBulkMatching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [suggestions, setSuggestions] = useState([]); // [{rowIdx, candidates:[...]}]
  const fileInputRef = useRef(null);

  const onFilesSelected = (fileList) => {
    const arr = Array.from(fileList || []).filter((f) =>
      f.type.startsWith('image/')
    );
    setFiles((prev) => [...prev, ...arr]);
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      toast.error('Önce fotoğraf ekleyin');
      return;
    }
    setIsProcessing(true);
    setProgress({ done: 0, total: files.length });
    const collected = [];
    const THROTTLE_MS = 4500; // ~13 RPM (free tier 15 RPM limit altında kal)
    let quotaHit = false;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const parsed = await MemberFormOCRService.readFromFile(f);
        parsed.forEach((p) => collected.push({ ...p, _source: f.name }));
      } catch (err) {
        console.error('OCR error for', f.name, err);
        toast.error(`${f.name}: ${err.message || 'OCR hatası'}`);
        // Quota hatası ise devam etmek anlamsız — diğerleri de fail olacak
        if (err.message && err.message.includes('kotası doldu')) {
          quotaHit = true;
          break;
        }
      }
      setProgress({ done: i + 1, total: files.length });
      if (i < files.length - 1) {
        await new Promise((r) => setTimeout(r, THROTTLE_MS));
      }
    }
    if (quotaHit) {
      toast.error('Kota nedeniyle işlem durduruldu. Billing veya yeni key ekleyin.', { duration: 6000 });
    }
    setRows((prev) => [...prev, ...collected]);
    setIsProcessing(false);
    toast.success(`${collected.length} form çıkarıldı`);
  };

  const updateRow = (index, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[index], [field]: value };
      // tc/telefon değiştirildiyse validasyonu yenile
      if (field === 'tc') {
        r.tcGecerli = MemberFormOCRService.isValidTC((value || '').replace(/\D/g, ''));
      }
      next[index] = r;
      return next;
    });
  };

  const deleteRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Tüm satırlar için seçmen listesinden top 5 aday bul (otomatik DOLDURMA YOK).
  // Öneriler ayrı bir tabloda gösterilir, kullanıcı istediğini onaylar.
  const handleBulkMatch = async () => {
    if (rows.length === 0) {
      toast.error('Önce form okut');
      return;
    }
    setIsBulkMatching(true);
    setBulkProgress({ done: 0, total: rows.length });
    setSuggestions([]);
    try {
      await VoterCacheService.ensureLoaded((p) => {
        if (p.total) {
          setBulkProgress({
            done: p.done,
            total: p.total,
            phase: 'download'
          });
        }
      });

      const collected = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const candidates = await VoterCacheService.search(r, 5);
        collected.push({ rowIdx: i, candidates });
        setBulkProgress({ done: i + 1, total: rows.length });
      }
      setSuggestions(collected);
      const withMatch = collected.filter((c) => c.candidates.length > 0).length;
      toast.success(
        `${withMatch}/${rows.length} satır için öneri hazır. Alttaki tablodan seç.`
      );
      // Sayfayı öneri tablosuna kaydır
      setTimeout(() => {
        const el = document.getElementById('suggestions-table');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (e) {
      console.error('Bulk match error:', e);
      toast.error('Toplu eşleştirme hatası: ' + (e.message || 'bilinmeyen'));
    } finally {
      setIsBulkMatching(false);
    }
  };

  const applyCandidate = (rowIdx, voter) => {
    applyVoterMatch(rowIdx, {
      tc: voter.tc,
      ad: voter.firstName,
      soyad: voter.lastName,
      dogum_tarihi: voter.birthDate
    });
    // Bu satırın önerilerini listeden çıkar
    setSuggestions((prev) => prev.filter((s) => s.rowIdx !== rowIdx));
  };

  const dismissSuggestion = (rowIdx) => {
    setSuggestions((prev) => prev.filter((s) => s.rowIdx !== rowIdx));
  };

  const applyVoterMatch = (idx, data) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[idx] };
      r.tc = data.tc || r.tc;
      r.ad = data.ad || r.ad;
      r.soyad = data.soyad || r.soyad;
      r.dogum_tarihi = data.dogum_tarihi || r.dogum_tarihi;
      r.tcGecerli = MemberFormOCRService.isValidTC((r.tc || '').replace(/\D/g, ''));
      // Uyarıları yeniden hesapla
      const u = [];
      if (r.tc && !r.tcGecerli) u.push('TC geçersiz');
      if (!r.tc) u.push('TC eksik');
      if (!r.telefon) u.push('Telefon eksik');
      if (!r.ad || !r.soyad) u.push('Ad/Soyad eksik');
      r.uyarilar = u;
      next[idx] = r;
      return next;
    });
    toast.success('Seçmen bilgileri uygulandı');
  };

  const addEmptyRow = () => setRows((prev) => [...prev, emptyRow()]);

  const exportExcel = () => {
    if (rows.length === 0) {
      toast.error('Aktarılacak kayıt yok');
      return;
    }
    const data = rows.map((r) => ({
      'Ad': r.ad,
      'Soyad': r.soyad,
      'TC': r.tc,
      'Telefon': r.telefon,
      'Doğum Tarihi': r.dogum_tarihi,
      'Seri No': r.seri_no,
      'Notlar': r.notlar,
      'TC Geçerli': r.tcGecerli ? 'Evet' : 'Hayır',
      'Uyarılar': (r.uyarilar || []).join(', '),
      'Kaynak Dosya': r._source
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Üyeler');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `uye_formlari_ocr_${stamp}.xlsx`);
    toast.success('Excel indirildi');
  };

  const clearAll = () => {
    if (!window.confirm('Tüm veriler silinsin mi?')) return;
    setFiles([]);
    setRows([]);
    setProgress({ done: 0, total: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Üye Formu OCR
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Elle doldurulmuş parti üye formlarının fotoğraflarını yükleyin.
          Sistem Gemini AI ile TC, Telefon, Doğum Tarihi, Ad-Soyad ve Seri No'yu
          çıkaracak. Tek fotoğrafta birden çok form olabilir.
        </p>

        <div
          className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg p-6 text-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFilesSelected(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Fotoğrafları sürükleyip bırakın veya tıklayıp seçin
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {files.length > 0
              ? `${files.length} dosya seçildi`
              : 'JPG, PNG, HEIC desteklenir'}
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
              >
                {f.name}
                <button
                  className="ml-2 text-red-500"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleProcess}
            disabled={isProcessing || files.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {isProcessing
              ? `Okunuyor... ${progress.done}/${progress.total}`
              : `OCR Başlat (${files.length} fotoğraf)`}
          </button>
          <button
            onClick={handleBulkMatch}
            disabled={isBulkMatching || rows.length === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
            title="Tüm satırları seçmen listesiyle karşılaştır, en iyi eşleşenleri otomatik doldur"
          >
            {isBulkMatching ? (
              bulkProgress.phase === 'download'
                ? `Seçmen listesi indiriliyor... ${bulkProgress.done.toLocaleString('tr-TR')}/${(bulkProgress.total || 0).toLocaleString('tr-TR')}`
                : `Eşleştiriliyor... ${bulkProgress.done}/${bulkProgress.total}`
            ) : (
              `Seçmenden Eşleştir (${rows.length})`
            )}
          </button>
          <button
            onClick={exportExcel}
            disabled={rows.length === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Excel İndir ({rows.length})
          </button>
          <button
            onClick={addEmptyRow}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Boş Satır Ekle
          </button>
          <button
            onClick={clearAll}
            disabled={files.length === 0 && rows.length === 0}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Temizle
          </button>
        </div>
      </div>

      {matchIndex !== null && rows[matchIndex] && (
        <VoterMatchModal
          row={rows[matchIndex]}
          onClose={() => setMatchIndex(null)}
          onSelect={(data) => applyVoterMatch(matchIndex, data)}
        />
      )}

      {rows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Ad</th>
                  <th className="px-3 py-2 text-left">Soyad</th>
                  <th className="px-3 py-2 text-left">TC</th>
                  <th className="px-3 py-2 text-left">Telefon</th>
                  <th className="px-3 py-2 text-left">Doğum Tarihi</th>
                  <th className="px-3 py-2 text-left">Seri No</th>
                  <th className="px-3 py-2 text-left">Notlar</th>
                  <th className="px-3 py-2 text-left">Uyarı</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-3 py-1 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-1">
                      <input
                        className="w-28 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                        value={r.ad}
                        onChange={(e) => updateRow(i, 'ad', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className="w-28 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                        value={r.soyad}
                        onChange={(e) => updateRow(i, 'soyad', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className={`w-32 bg-transparent border rounded px-1 py-0.5 ${
                          r.tc && !r.tcGecerli
                            ? 'border-red-500 text-red-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        value={r.tc}
                        onChange={(e) => updateRow(i, 'tc', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className="w-32 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                        value={r.telefon}
                        onChange={(e) => updateRow(i, 'telefon', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className="w-28 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                        value={r.dogum_tarihi}
                        onChange={(e) =>
                          updateRow(i, 'dogum_tarihi', e.target.value)
                        }
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className="w-20 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                        value={r.seri_no}
                        onChange={(e) => updateRow(i, 'seri_no', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className="w-32 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                        value={r.notlar}
                        onChange={(e) => updateRow(i, 'notlar', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1 text-xs text-amber-600">
                      {(r.uyarilar || []).join(', ')}
                    </td>
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setMatchIndex(i)}
                          className="px-2 py-1 rounded text-xs font-medium border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200"
                          title="Bu satırı seçmen listesinden eşleştir"
                        >
                          🔍 Eşleştir
                        </button>
                        <button
                          onClick={() => deleteRow(i)}
                          className="text-red-500 hover:text-red-700 px-2"
                          title="Satırı sil"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div id="suggestions-table" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-purple-300 dark:border-purple-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20">
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
              Seçmen Listesi Eşleştirme Önerileri
            </h3>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
              Her OCR satırı için seçmen listesinden en yüksek skorlu 5 aday. Doğru olana tıkla → üstteki tablo güncellenir. Skor kırılımı: İsim 20, Soyisim 20, TC ilk 6h=20, Doğum 20 (yıl 10 + ay 5 + gün 5), +bonuslar.
            </p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {suggestions.map(({ rowIdx, candidates }) => {
              const row = rows[rowIdx];
              if (!row) return null;
              return (
                <div key={rowIdx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        #{rowIdx + 1} OCR: {row.ad} {row.soyad}
                      </span>
                      {row.tc && <span className="ml-2 font-mono text-gray-600">TC: {row.tc}</span>}
                      {row.dogum_tarihi && <span className="ml-2 text-gray-600">D: {row.dogum_tarihi}</span>}
                    </div>
                    <button
                      onClick={() => dismissSuggestion(rowIdx)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      önerileri gizle
                    </button>
                  </div>
                  {candidates.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">
                      Eşleşme bulunamadı. Bu satırı elle düzeltin veya 🔍 Eşleştir ile arama yapın.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {candidates.map((c, ci) => (
                        <button
                          key={c.voter.tc + '_' + ci}
                          onClick={() => applyCandidate(rowIdx, c.voter)}
                          className="text-left p-3 rounded border border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                {c.voter.firstName} {c.voter.lastName}
                              </div>
                              <div className="text-xs font-mono text-gray-600 mt-0.5">
                                {c.voter.tc}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {c.voter.birthDate}
                                {c.voter.district && ` • ${c.voter.district}`}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-1">
                                {c.breakdown.adMatch && <span className="bg-green-100 text-green-700 px-1 rounded mr-1">ad ✓</span>}
                                {c.breakdown.soyadMatch && <span className="bg-green-100 text-green-700 px-1 rounded mr-1">soyad ✓</span>}
                                {c.breakdown.tcPrefix !== 'yok' && <span className="bg-blue-100 text-blue-700 px-1 rounded mr-1">TC: {c.breakdown.tcPrefix}</span>}
                                {c.breakdown.birthYear && <span className="bg-amber-100 text-amber-700 px-1 rounded">yıl ✓</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-lg font-bold ${
                                c.score >= 60 ? 'text-green-600' :
                                c.score >= 40 ? 'text-amber-600' : 'text-gray-500'
                              }`}>
                                {c.score}
                              </div>
                              <div className="text-[10px] text-gray-400">%{c.scorePercent}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberFormOCRSettings;
