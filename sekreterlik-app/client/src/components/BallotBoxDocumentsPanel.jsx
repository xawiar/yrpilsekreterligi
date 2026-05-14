import React, { useEffect, useState, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import DocumentClassifierService from '../services/DocumentClassifierService';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';

// Kullanıcı dostu evrak tipi etiketleri
const TYPE_LABELS = {
  signed_protocol: 'Seçim Tutanağı',
  objection_protocol: 'İtiraz Tutanağı',
  other: 'Diğer'
};

const TYPE_BADGE_CLASSES = {
  signed_protocol: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  objection_protocol: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

/**
 * Sandık başına yüklenen evrakları gösteren panel.
 *
 * Props:
 * - ballotBoxId (zorunlu)
 * - ballotNumber (opsiyonel — başlık için)
 * - canUpload (boolean) — Evrak Yükle butonu görünsün mü
 * - canDelete (boolean) — Sil butonu görünsün mü
 * - uploaderName, uploaderRole — yükleme sırasında metadata olarak yazılır
 * - extraDocuments — mevcut electionResult'lardan gelen tutanak fotoğrafları (virtual evrak)
 *   Format: [{ id, document_type, download_url, uploaded_by_name, created_at, _virtual: true }]
 */
const BallotBoxDocumentsPanel = ({
  ballotBoxId,
  ballotNumber = '',
  canUpload = false,
  canDelete = false,
  uploaderName = '',
  uploaderRole = '',
  extraDocuments = [],
  includeProtocolPhotos = true
}) => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();

  const [documents, setDocuments] = useState([]);
  const [protocolPhotos, setProtocolPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [previewUrl, setPreviewUrl] = useState(null);

  const loadDocuments = useCallback(async () => {
    if (!ballotBoxId) return;
    try {
      setLoading(true);
      const data = await ApiService.getBallotBoxDocuments(ballotBoxId);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Evrak listesi yüklenemedi:', e);
    } finally {
      setLoading(false);
    }
  }, [ballotBoxId]);

  // Mevcut election_results'taki signed_protocol_photo ve objection_protocol_photo'yu
  // virtual evrak olarak göster (başmüşahitin sonuç giriş formundan yüklediği fotoğraflar)
  const loadProtocolPhotos = useCallback(async () => {
    if (!ballotBoxId || !includeProtocolPhotos) return;
    try {
      const results = await ApiService.getElectionResults(null, ballotBoxId);
      const photos = [];
      const photoFields = [
        { field: 'signed_protocol_photo', type: 'signed_protocol', tag: 'signed' },
        { field: 'signed_mv_protocol_photo', type: 'signed_protocol', tag: 'signed_mv' },
        { field: 'objection_protocol_photo', type: 'objection_protocol', tag: 'objection' }
      ];
      (Array.isArray(results) ? results : []).forEach((r) => {
        const baseDate = r.updatedAt?.toDate?.() || r.updatedAt || r.createdAt?.toDate?.() || r.createdAt || null;
        const baseName = r.entered_by_name || r.created_by_name || 'Başmüşahit';
        photoFields.forEach(({ field, type, tag }) => {
          const url = r[field];
          if (url) {
            photos.push({
              id: `er_${tag}_${r.id}`,
              document_type: type,
              download_url: url,
              uploaded_by_name: baseName,
              created_at: baseDate,
              file_type: 'image/jpeg',
              _virtual: true,
              _source: 'election_result'
            });
          }
        });
      });
      setProtocolPhotos(photos);
    } catch (e) {
      console.warn('Tutanak fotoğrafları yüklenemedi:', e.message);
      setProtocolPhotos([]);
    }
  }, [ballotBoxId, includeProtocolPhotos]);

  useEffect(() => {
    loadDocuments();
    loadProtocolPhotos();
  }, [loadDocuments, loadProtocolPhotos]);

  const allDocs = [
    ...(extraDocuments || []).map(d => ({ ...d, _virtual: true })),
    ...protocolPhotos,
    ...documents
  ].sort((a, b) => {
    const ta = new Date(a.createdAt?.toDate?.() || a.createdAt || a.created_at || 0).getTime();
    const tb = new Date(b.createdAt?.toDate?.() || b.createdAt || b.created_at || 0).getTime();
    return tb - ta;
  });

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // input reset
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });
      try {
        // Önce AI sınıflandır (başarısız olursa "other" olarak devam et)
        let aiResult = { type: 'other', confidence: 0, reasoning: '' };
        try {
          aiResult = await DocumentClassifierService.classify(file);
        } catch (aiErr) {
          console.warn('AI sınıflandırma başarısız:', aiErr.message);
        }

        await ApiService.uploadBallotBoxDocument(ballotBoxId, file, {
          documentType: aiResult.type,
          aiClassifiedType: aiResult.type,
          aiConfidence: aiResult.confidence,
          aiReasoning: aiResult.reasoning,
          uploadedByName: uploaderName,
          uploadedByRole: uploaderRole
        });
        success++;
      } catch (err) {
        console.error('Evrak yüklenemedi:', err);
        failed++;
      }
    }

    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });

    if (success > 0) toast.success(`${success} evrak yüklendi.`);
    if (failed > 0) toast.error(`${failed} evrak yüklenemedi.`);

    await loadDocuments();
  };

  const handleChangeType = async (doc, newType) => {
    if (doc._virtual) {
      toast.error('Bu evrak otomatik tutanak — tipi değiştirilemez.');
      return;
    }
    try {
      await ApiService.updateBallotBoxDocument(doc.id, {
        document_type: newType,
        manual_override: true
      });
      toast.success('Evrak tipi güncellendi.');
      await loadDocuments();
    } catch (e) {
      toast.error('Güncellenemedi: ' + e.message);
    }
  };

  const handleDelete = async (doc) => {
    if (doc._virtual) {
      toast.error('Bu evrak seçim sonucu kaydında — silmek için sonucu düzenleyin.');
      return;
    }
    const ok = await confirm({
      title: 'Evrak Sil',
      message: 'Bu evrak silinecek. Devam edilsin mi?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await ApiService.deleteBallotBoxDocument(doc.id);
      toast.success('Evrak silindi.');
      await loadDocuments();
    } catch (e) {
      toast.error('Silinemedi: ' + e.message);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Yüklenen Evraklar
            {ballotNumber && <span className="ml-2 text-sm font-normal text-gray-500">— Sandık {ballotNumber}</span>}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Tutanak ve diğer evraklar. Yapay zeka türü otomatik tahmin eder; gerekirse elle düzeltebilirsiniz.
          </p>
        </div>
        {canUpload && (
          <label className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition ${
            uploading
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}>
            {uploading
              ? `Yükleniyor… ${uploadProgress.current}/${uploadProgress.total}`
              : '+ Evrak Yükle'}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={handleFilesSelected}
            />
          </label>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center text-sm text-gray-500 py-6">Yükleniyor…</div>
        ) : allDocs.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-6">
            Henüz evrak yüklenmedi.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allDocs.map((doc) => {
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
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50"
                >
                  <button
                    type="button"
                    onClick={() => isImage && url && setPreviewUrl(url)}
                    className="block w-full aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden focus:outline-none"
                  >
                    {isImage && url ? (
                      <img
                        src={url}
                        alt={doc.file_name || 'Evrak'}
                        className="w-full h-full object-cover hover:opacity-90 transition"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        {url ? 'PDF / Diğer' : 'Önizleme yok'}
                      </div>
                    )}
                  </button>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE_CLASSES[type] || TYPE_BADGE_CLASSES.other}`}>
                        {TYPE_LABELS[type] || 'Diğer'}
                      </span>
                      {doc._virtual && (
                        <span className="text-[10px] text-gray-400">Otomatik</span>
                      )}
                    </div>
                    {doc.uploaded_by_name && (
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
                        {doc.uploaded_by_name}
                      </div>
                    )}
                    {dateStr && (
                      <div className="text-[10px] text-gray-400">{dateStr}</div>
                    )}
                    {doc.ai_confidence !== null && doc.ai_confidence !== undefined && !doc._virtual && (
                      <div className="text-[10px] text-gray-400" title={doc.ai_reasoning || ''}>
                        AI güven: %{Math.round((doc.ai_confidence || 0) * 100)}
                      </div>
                    )}
                    {!doc._virtual && (canUpload || canDelete) && (
                      <div className="flex items-center gap-1 pt-1">
                        <select
                          value={type}
                          onChange={(e) => handleChangeType(doc, e.target.value)}
                          className="flex-1 text-[11px] px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                        >
                          <option value="signed_protocol">Seçim Tutanağı</option>
                          <option value="objection_protocol">İtiraz Tutanağı</option>
                          <option value="other">Diğer</option>
                        </select>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc)}
                            className="text-red-600 hover:text-red-800 text-xs px-1.5"
                            title="Sil"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

export default BallotBoxDocumentsPanel;
