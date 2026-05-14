import React, { useEffect, useState } from 'react';
import VoterCacheService from '../services/VoterCacheService';

/** Highlight: farklı olan haneleri renklendir */
const TCHighlight = ({ source, target }) => {
  const s = String(source || '');
  const t = String(target || '');
  const len = Math.max(s.length, t.length);
  const out = [];
  for (let i = 0; i < len; i++) {
    const a = s[i] || '';
    const b = t[i] || '';
    const same = a === b;
    out.push(
      <span
        key={i}
        className={
          same
            ? 'text-gray-700 dark:text-gray-200'
            : 'text-red-600 font-bold'
        }
      >
        {b || '·'}
      </span>
    );
  }
  return <span className="font-mono">{out}</span>;
};

const VoterMatchModal = ({ row, onClose, onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const run = async () => {
      setErr('');
      setResults([]);
      setLoading(true);
      try {
        const valid = await VoterCacheService.isCacheValid();
        if (!valid) {
          setSyncing(true);
          await VoterCacheService.ensureLoaded((p) => setSyncProgress(p));
          setSyncing(false);
        } else {
          await VoterCacheService.ensureLoaded();
        }
        const found = await VoterCacheService.search(row, 10);
        setResults(found);
      } catch (e) {
        console.error('Voter search error:', e);
        setErr(e.message || 'Arama hatası');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [row]);

  const handleSelect = (voter) => {
    onSelect({
      tc: voter.tc,
      ad: voter.firstName,
      soyad: voter.lastName,
      dogum_tarihi: voter.birthDate
    });
    onClose();
  };

  const handleForceResync = async () => {
    setSyncing(true);
    setResults([]);
    setErr('');
    try {
      await VoterCacheService.clearCache();
      await VoterCacheService.ensureLoaded((p) => setSyncProgress(p));
      const found = await VoterCacheService.search(row, 10);
      setResults(found);
    } catch (e) {
      setErr(e.message || 'Yeniden senkronizasyon hatası');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Seçmen Listesinde Eşleşme Ara
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Aranan: <strong>{row.ad} {row.soyad}</strong>
              {row.tc && <> · TC: <span className="font-mono">{row.tc}</span></>}
              {row.dogum_tarihi && <> · Doğum: {row.dogum_tarihi}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {syncing && (
            <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">
                Seçmen listesi indiriliyor... (ilk kez, sonraki aramalar anında
                olacak)
              </div>
              {syncProgress && (
                <>
                  <div className="text-xs text-indigo-700 dark:text-indigo-300">
                    {syncProgress.done.toLocaleString('tr-TR')}
                    {syncProgress.total
                      ? ` / ${syncProgress.total.toLocaleString('tr-TR')}`
                      : ''}
                  </div>
                  {syncProgress.total && (
                    <div className="mt-2 h-2 bg-indigo-200 dark:bg-indigo-900 rounded overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (syncProgress.done / syncProgress.total) * 100
                          )}%`
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {loading && !syncing && (
            <div className="text-center py-8 text-gray-500">Aranıyor...</div>
          )}

          {err && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300 text-sm mb-4">
              {err}
            </div>
          )}

          {!loading && !syncing && results.length === 0 && !err && (
            <div className="text-center py-8 text-gray-500">
              Eşleşme bulunamadı. Ad/soyad/doğum tarihini düzenleyip tekrar
              deneyin.
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <button
                  key={r.voter.tc + '_' + i}
                  onClick={() => handleSelect(r.voter)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {r.voter.firstName} {r.voter.lastName}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex flex-wrap gap-x-3">
                        <span>
                          TC:{' '}
                          <TCHighlight source={row.tc} target={r.voter.tc} />
                        </span>
                        {r.voter.birthDate && (
                          <span>Doğum: {r.voter.birthDate}</span>
                        )}
                        {r.voter.ballotNumber && (
                          <span>Sandık: {r.voter.ballotNumber}</span>
                        )}
                      </div>
                      {(r.voter.district || r.voter.address) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {r.voter.district} {r.voter.town && `• ${r.voter.town}`}
                          {r.voter.address && ` • ${r.voter.address}`}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-lg font-bold ${
                          r.score >= 80
                            ? 'text-green-600'
                            : r.score >= 60
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {Math.round(r.score)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        İs {Math.round(r.nameScore)} · TC{' '}
                        {Math.round(r.tcScore)} · D {Math.round(r.birthScore)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={handleForceResync}
            disabled={syncing}
            className="text-xs text-indigo-600 hover:underline disabled:text-gray-400"
          >
            Seçmen listesini yeniden indir
          </button>
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded text-sm"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoterMatchModal;
