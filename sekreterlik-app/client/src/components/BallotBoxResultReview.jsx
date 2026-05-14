import React, { useEffect, useState } from 'react';
import ApiService from '../utils/ApiService';

/**
 * Bir sandığın TÜM girilmiş seçim sonuçlarını sol/sağ panel olarak gösterir.
 * - Sol: Tutanak fotoğrafları (signed_protocol_photo, signed_mv_protocol_photo, objection_protocol_photo)
 * - Sağ: Oy değerleri (CB/MV/mayor/provincial assembly/municipal council/referendum) + özet
 *
 * Props:
 * - ballotBoxId (zorunlu)
 * - ballotNumber (görüntü için)
 * - onClose
 * - onEdit (opsiyonel, "Düzenle" butonu için — result objesi geçer)
 */
const BallotBoxResultReview = ({ ballotBoxId, ballotNumber = '', onClose, onEdit }) => {
  const [results, setResults] = useState([]);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!ballotBoxId) return;
      try {
        setLoading(true);
        const [allResults, allElections] = await Promise.all([
          ApiService.getElectionResults(null, ballotBoxId),
          ApiService.getElections()
        ]);
        if (!mounted) return;
        setResults(Array.isArray(allResults) ? allResults : []);
        setElections(Array.isArray(allElections) ? allElections : []);
      } catch (e) {
        console.error('Sonuç verileri yüklenemedi:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ballotBoxId]);

  const electionById = (id) => elections.find((e) => String(e.id) === String(id));

  const renderVoteList = (label, votes) => {
    if (!votes || typeof votes !== 'object') return null;
    const entries = Object.entries(votes).filter(([, v]) => v !== null && v !== undefined);
    if (entries.length === 0) return null;
    return (
      <div>
        <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">{label}:</div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {entries.map(([key, votes]) => (
            <div key={key} className="flex justify-between items-center text-xs py-1.5 px-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
              <span className="text-gray-700 dark:text-gray-300 font-medium">{key}</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">{parseInt(votes) || 0} oy</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const StatusBadge = ({ status, label }) => {
    const cls = status === 'approved'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    const text = status === 'approved' ? 'Onaylı' : status === 'rejected' ? 'Reddedildi' : 'Onay Bekliyor';
    return (
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
        {label ? `${label}: ${text}` : text}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl max-w-6xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Sandık {ballotNumber || ballotBoxId} — Girilen Sonuçlar
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tutanak ve sisteme girilmiş rakamları yan yana karşılaştırın.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-2xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Yükleniyor…</div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Bu sandığa henüz seçim sonucu girilmemiş.
            </div>
          ) : (
            results.map((result) => {
              const election = electionById(result.election_id);
              const eName = election?.name || result.election_name || 'Seçim';
              const eType = election?.type || result.election_type;

              // Toplam oy hesapları (CB/MV ayrı)
              const sumValues = (obj) => {
                if (!obj || typeof obj !== 'object') return 0;
                return Object.values(obj).reduce((s, v) => s + (parseInt(v) || 0), 0);
              };

              return (
                <div
                  key={result.id}
                  className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-900/40"
                >
                  {/* Başlık + durum + meta */}
                  <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{eName}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {eType || 'tip yok'}
                      </span>
                      {result.cb_status && <StatusBadge status={result.cb_status} label="CB" />}
                      {result.mv_status && <StatusBadge status={result.mv_status} label="MV" />}
                      {!result.cb_status && !result.mv_status && result.approval_status && (
                        <StatusBadge status={result.approval_status} />
                      )}
                    </div>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(result, election)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Düzenle
                      </button>
                    )}
                  </div>

                  {/* İçerik: sol tutanak / sağ rakamlar */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Sol: Tutanak fotoğrafları */}
                    <div className="space-y-3">
                      {result.signed_protocol_photo && (
                        <div>
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">📄 Tutanak</div>
                          <img
                            src={result.signed_protocol_photo}
                            alt="Tutanak"
                            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-700 cursor-pointer hover:opacity-90 shadow"
                            loading="lazy"
                            onClick={() => setZoomImage(result.signed_protocol_photo)}
                          />
                        </div>
                      )}
                      {result.signed_mv_protocol_photo && (
                        <div>
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">📄 MV Tutanağı</div>
                          <img
                            src={result.signed_mv_protocol_photo}
                            alt="MV Tutanağı"
                            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-700 cursor-pointer hover:opacity-90 shadow"
                            loading="lazy"
                            onClick={() => setZoomImage(result.signed_mv_protocol_photo)}
                          />
                        </div>
                      )}
                      {result.objection_protocol_photo && (
                        <div>
                          <div className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">⚠️ İtiraz Tutanağı</div>
                          <img
                            src={result.objection_protocol_photo}
                            alt="İtiraz Tutanağı"
                            className="w-full rounded-lg border-2 border-orange-300 dark:border-orange-700 cursor-pointer hover:opacity-90 shadow"
                            loading="lazy"
                            onClick={() => setZoomImage(result.objection_protocol_photo)}
                          />
                        </div>
                      )}
                      {!result.signed_protocol_photo && !result.signed_mv_protocol_photo && !result.objection_protocol_photo && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded">
                          Tutanak fotoğrafı yok.
                        </div>
                      )}
                    </div>

                    {/* Sağ: Girilmiş rakamlar */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Sisteme Girilen Rakamlar
                      </h4>

                      {/* CB / MV / yerel / referandum */}
                      {renderVoteList('Cumhurbaşkanı', result.cb_votes)}
                      {renderVoteList('Bağımsız CB Adayları', result.independent_cb_votes)}
                      {renderVoteList('Milletvekili (Parti)', result.mv_votes)}
                      {renderVoteList('Bağımsız MV Adayları', result.independent_mv_votes)}
                      {renderVoteList('Belediye Başkanı', result.mayor_votes)}
                      {renderVoteList('Bağımsız Belediye Başkanı', result.independent_mayor_votes)}
                      {renderVoteList('İl Genel Meclisi', result.provincial_assembly_votes)}
                      {renderVoteList('Belediye Meclisi', result.municipal_council_votes)}
                      {renderVoteList('Referandum', result.referendum_votes)}

                      {/* Özet */}
                      <div className="mt-2 pt-3 border-t border-blue-200 dark:border-blue-700 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between p-1.5 bg-white dark:bg-gray-800 rounded">
                          <span className="text-gray-600">Toplam Seçmen:</span>
                          <span className="font-semibold">{result.total_voters || 0}</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-white dark:bg-gray-800 rounded">
                          <span className="text-gray-600">Kullanılan:</span>
                          <span className="font-semibold">{result.used_votes || 0}</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-white dark:bg-gray-800 rounded">
                          <span className="text-gray-600">Geçerli:</span>
                          <span className="font-semibold">{result.valid_votes || 0}</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-white dark:bg-gray-800 rounded">
                          <span className="text-gray-600">Geçersiz:</span>
                          <span className="font-semibold text-red-600">{result.invalid_votes || 0}</span>
                        </div>
                      </div>

                      {/* Çapraz kontrol uyarısı */}
                      {(() => {
                        const cbSum = sumValues(result.cb_votes) + sumValues(result.independent_cb_votes);
                        const mvSum = sumValues(result.mv_votes) + sumValues(result.independent_mv_votes);
                        const valid = parseInt(result.valid_votes) || 0;
                        const checks = [];
                        if (cbSum > 0 && cbSum !== valid) checks.push(`CB toplam (${cbSum}) ≠ Geçerli oy (${valid})`);
                        if (mvSum > 0 && mvSum !== valid) checks.push(`MV toplam (${mvSum}) ≠ Geçerli oy (${valid})`);
                        if (checks.length === 0) return null;
                        return (
                          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-800 dark:text-amber-300">
                            ⚠️ {checks.join(' · ')}
                          </div>
                        );
                      })()}

                      {/* Meta bilgi */}
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 pt-2 border-t border-blue-200 dark:border-blue-700">
                        {result.entered_by_name && <>Giriş: <strong>{result.entered_by_name}</strong> · </>}
                        {result.updatedAt && (
                          <>Güncellenme: {new Date(result.updatedAt?.toDate?.() || result.updatedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tutanak zoom */}
      {zoomImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Tutanak Büyük" className="max-w-full max-h-[95vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 bg-white text-gray-900 rounded-full w-10 h-10 flex items-center justify-center shadow-lg"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default BallotBoxResultReview;
