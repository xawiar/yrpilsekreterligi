import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/UI/ConfirmDialog';

const TYPE_LABELS = {
  signed_protocol: 'Seçim Tutanağı',
  objection_protocol: 'İtiraz Tutanağı',
  other: 'Diğer'
};

const TYPE_BADGE = {
  signed_protocol: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  objection_protocol: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

/**
 * Tüm sandıkların yüklenen evrakları — admin ve sorumlular için merkezi liste.
 *
 * - Admin: tüm sandıkların evrakları
 * - Sorumlu: kendi sorumluluk alanındaki sandıkların evrakları
 *   (CoordinatorDashboard'dan ayrıca link ile gelir; user.coordinatorId üzerinden filtre yapılır)
 */
const UploadedDocumentsPage = () => {
  const { user, userRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { confirm, confirmDialogProps } = useConfirm();
  const isAdmin = userRole === 'admin' || user?.role === 'admin';

  // Geri dönüş hedefi: rol bazlı
  const handleBack = () => {
    if (isAdmin) {
      navigate('/election-preparation');
    } else if (user?.coordinatorId) {
      navigate('/coordinator-dashboard');
    } else {
      navigate(-1);
    }
  };

  const [allBallotBoxes, setAllBallotBoxes] = useState([]);
  const [accessibleBallotBoxIds, setAccessibleBallotBoxIds] = useState(null); // null = tümü
  const [documents, setDocuments] = useState([]);
  const [protocolPhotos, setProtocolPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterUploader, setFilterUploader] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        // 1) Sandıklar (sandık no eşleştirmesi için)
        const boxes = await ApiService.getBallotBoxes();
        if (!mounted) return;
        setAllBallotBoxes(Array.isArray(boxes) ? boxes : []);

        // 2) Yetki alanı: admin değilse coordinator dashboard'dan kendi sandıkları
        let accessibleIds = null; // null = sınırsız
        if (!isAdmin && user?.coordinatorId) {
          try {
            const dash = await ApiService.getCoordinatorDashboard(user.coordinatorId);
            const ids = (dash?.ballotBoxes || []).map((bb) => String(bb.id));
            accessibleIds = new Set(ids);
          } catch (e) {
            console.warn('Coordinator dashboard alınamadı, tümü gösteriliyor:', e.message);
          }
        }
        if (!mounted) return;
        setAccessibleBallotBoxIds(accessibleIds);

        const targetIds = accessibleIds ? Array.from(accessibleIds) : (boxes || []).map((bb) => String(bb.id));

        // 3) Yüklenen evraklar (ballot_box_documents)
        const docs = await ApiService.getBallotBoxDocumentsForBoxes(targetIds);
        if (!mounted) return;
        setDocuments(Array.isArray(docs) ? docs : []);

        // 4) Election results'taki tutanak fotoğrafları — tek sorguda hepsini al
        const photos = [];
        try {
          const results = await ApiService.getElectionResults(null, null);
          (Array.isArray(results) ? results : []).forEach((r) => {
            const bbId = String(r.ballot_box_id || r.ballotBoxId || '');
            if (!bbId || (accessibleIds && !accessibleIds.has(bbId))) return;
            const baseDate = r.updatedAt?.toDate?.() || r.updatedAt || r.createdAt?.toDate?.() || r.createdAt || null;
            const baseName = r.entered_by_name || r.created_by_name || 'Başmüşahit';

            // 3 farklı tutanak alanı: signed (CB veya genel), signed_mv (MV ayrı), objection
            const photoFields = [
              { field: 'signed_protocol_photo', type: 'signed_protocol', tag: 'signed' },
              { field: 'signed_mv_protocol_photo', type: 'signed_protocol', tag: 'signed_mv' },
              { field: 'objection_protocol_photo', type: 'objection_protocol', tag: 'objection' }
            ];

            photoFields.forEach(({ field, type, tag }) => {
              const url = r[field];
              if (url) {
                photos.push({
                  id: `er_${tag}_${r.id}`,
                  ballot_box_id: bbId,
                  document_type: type,
                  download_url: url,
                  uploaded_by_name: baseName,
                  created_at: baseDate,
                  file_type: 'image/jpeg',
                  _virtual: true
                });
              }
            });
          });
        } catch (innerErr) {
          console.warn('Election results alınamadı:', innerErr.message);
        }
        if (!mounted) return;
        setProtocolPhotos(photos);
      } catch (e) {
        console.error('Yüklenen evraklar yüklenemedi:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isAdmin, user?.coordinatorId]);

  const ballotNumberById = useMemo(() => {
    const m = new Map();
    allBallotBoxes.forEach((bb) => m.set(String(bb.id), bb.ballot_number || ''));
    return m;
  }, [allBallotBoxes]);

  // Geçerli sandık ID'leri seti — orphan tespiti için
  const validBallotBoxIds = useMemo(() => {
    return new Set(allBallotBoxes.map((bb) => String(bb.id)));
  }, [allBallotBoxes]);

  // Tüm evraklar — geçerli vs orphan ayrı
  const { validDocs, orphanDocs } = useMemo(() => {
    const merged = [...documents, ...protocolPhotos];
    merged.sort((a, b) => {
      const ta = new Date(a.createdAt?.toDate?.() || a.createdAt || a.created_at || 0).getTime();
      const tb = new Date(b.createdAt?.toDate?.() || b.createdAt || b.created_at || 0).getTime();
      return tb - ta;
    });
    const valid = [];
    const orphan = [];
    for (const d of merged) {
      const bbId = String(d.ballot_box_id || '');
      if (!bbId || !validBallotBoxIds.has(bbId)) {
        orphan.push(d);
      } else {
        valid.push(d);
      }
    }
    return { validDocs: valid, orphanDocs: orphan };
  }, [documents, protocolPhotos, validBallotBoxIds]);

  const allDocs = validDocs;

  const uploaderOptions = useMemo(() => {
    const set = new Set();
    allDocs.forEach((d) => { if (d.uploaded_by_name) set.add(d.uploaded_by_name); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [allDocs]);

  const handleCleanOrphans = async () => {
    const orphanCount = orphanDocs.length;
    if (orphanCount === 0) {
      toast.success('Temizlenecek orphan kayıt yok.');
      return;
    }
    const ok = await confirm({
      title: 'Orphan Tutanakları Temizle',
      message: `Sandığı silinmiş ${orphanCount} adet evrak/tutanak fotoğrafı bulundu. Bunlar kalıcı olarak silinecek. Devam edilsin mi?`,
      confirmText: `Evet, ${orphanCount} kaydı sil`,
      cancelText: 'Vazgeç',
      variant: 'danger'
    });
    if (!ok) return;

    let deletedDocs = 0;
    let clearedResults = 0;
    let failed = 0;

    // 1) ballot_box_documents — direkt silinebilir (Storage + Firestore)
    for (const d of orphanDocs) {
      if (d._virtual) continue; // election_result'tan gelen; aşağıda ayrı temizlenecek
      try {
        await ApiService.deleteBallotBoxDocument(d.id);
        deletedDocs++;
      } catch (e) {
        console.error('Doküman silinemedi:', e);
        failed++;
      }
    }

    // 2) Election result virtual kayıtları — election_result'ın foto field'ını temizle
    //    (sandık kaydı yok ama result kayıt varsa, foto'yu null yap; ya da result'ı tamamen sil)
    const orphanResultIds = new Set();
    orphanDocs.forEach((d) => {
      if (d._virtual && typeof d.id === 'string') {
        // id format: er_{tag}_{resultId}
        const m = d.id.match(/^er_[a-z_]+_(.+)$/);
        if (m) orphanResultIds.add(m[1]);
      }
    });

    for (const resultId of orphanResultIds) {
      try {
        await ApiService.deleteElectionResult?.(resultId);
        clearedResults++;
      } catch (e) {
        console.error('Sonuç silinemedi:', e);
        failed++;
      }
    }

    if (failed === 0) {
      toast.success(`${deletedDocs} evrak ve ${clearedResults} sonuç kaydı temizlendi.`);
    } else {
      toast.error(`${deletedDocs + clearedResults} silindi, ${failed} hata. Detay konsolda.`);
    }

    // Sayfayı yenile (state'i tazele)
    setTimeout(() => window.location.reload(), 800);
  };

  const filtered = useMemo(() => {
    const q = (search || '').toLocaleLowerCase('tr-TR').trim();
    return allDocs.filter((d) => {
      const bbNo = ballotNumberById.get(String(d.ballot_box_id)) || '';
      const matchesSearch = !q ||
        String(bbNo).toLocaleLowerCase('tr-TR').includes(q) ||
        (d.uploaded_by_name || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (d.file_name || '').toLocaleLowerCase('tr-TR').includes(q);
      const matchesType = !filterType || d.document_type === filterType;
      const matchesUploader = !filterUploader || d.uploaded_by_name === filterUploader;
      return matchesSearch && matchesType && matchesUploader;
    });
  }, [allDocs, search, filterType, filterUploader, ballotNumberById]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <button
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Geri Dön
      </button>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yüklenen Evraklar</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {isAdmin
              ? 'Tüm sandıklar için yüklenen tutanak ve evraklar.'
              : 'Sorumlu olduğunuz sandıklar için yüklenen tutanak ve evraklar.'}
          </p>
        </div>
        {isAdmin && orphanDocs.length > 0 && (
          <button
            onClick={handleCleanOrphans}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm"
            title="Sandığı silinmiş kayıtları temizler"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Orphan Temizle ({orphanDocs.length})
          </button>
        )}
      </div>

      {/* Özet */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Toplam Evrak</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{allDocs.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Seçim Tutanağı</div>
          <div className="text-2xl font-bold text-green-600">
            {allDocs.filter((d) => d.document_type === 'signed_protocol').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">İtiraz Tutanağı</div>
          <div className="text-2xl font-bold text-orange-600">
            {allDocs.filter((d) => d.document_type === 'objection_protocol').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Diğer</div>
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {allDocs.filter((d) => d.document_type === 'other' || !d.document_type).length}
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Sandık no, yükleyen veya dosya adı ile ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
        >
          <option value="">Tüm Tipler</option>
          <option value="signed_protocol">Seçim Tutanağı</option>
          <option value="objection_protocol">İtiraz Tutanağı</option>
          <option value="other">Diğer</option>
        </select>
        <select
          value={filterUploader}
          onChange={(e) => setFilterUploader(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
        >
          <option value="">Tüm Yükleyenler</option>
          {uploaderOptions.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {(search || filterType || filterUploader) && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterUploader(''); }}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Filtreleri Temizle
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500">Henüz evrak bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((doc) => {
            const bbId = String(doc.ballot_box_id);
            const bbNo = ballotNumberById.get(bbId) || '?';
            const url = doc.download_url || doc.url || '';
            const type = doc.document_type || 'other';
            const isImage = !doc.file_type || (doc.file_type || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_name || '');
            const dateStr = (() => {
              const t = doc.createdAt?.toDate?.() || doc.createdAt || doc.created_at;
              if (!t) return '';
              const d = new Date(t);
              return isNaN(d.getTime()) ? '' : d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
            })();

            return (
              <div
                key={doc.id || url}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => isImage && url && setPreviewUrl(url)}
                  className="block w-full aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden focus:outline-none"
                >
                  {isImage && url ? (
                    <img src={url} alt={doc.file_name || 'Evrak'} className="w-full h-full object-cover hover:opacity-90" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      {url ? 'PDF / Diğer' : 'Önizleme yok'}
                    </div>
                  )}
                </button>
                <div className="p-2 space-y-1 text-xs flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <Link
                      to={`/ballot-boxes/${bbId}`}
                      className="font-bold text-indigo-600 hover:underline"
                    >
                      Sandık {bbNo}
                    </Link>
                    {doc._virtual && (
                      <span className="text-[9px] text-gray-400">Tutanak</span>
                    )}
                  </div>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[type] || TYPE_BADGE.other}`}>
                    {TYPE_LABELS[type] || 'Diğer'}
                  </span>
                  {doc.uploaded_by_name && (
                    <div className="text-gray-600 dark:text-gray-400 truncate">{doc.uploaded_by_name}</div>
                  )}
                  {dateStr && <div className="text-[10px] text-gray-400">{dateStr}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Önizleme modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Önizleme"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 bg-white text-gray-900 rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default UploadedDocumentsPage;
