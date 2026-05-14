import React, { useEffect, useState } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import TrainingMaterialCard from '../components/TrainingMaterialCard';

const AUDIENCE_LABEL = {
  chief_observer: 'Sadece Başmüşahit',
  public: 'Sadece Public Sayfa',
  both: 'Hem Başmüşahit Hem Public'
};

const emptyForm = () => ({
  id: null,
  title: '',
  description: '',
  audience: 'chief_observer',
  content_type: 'video',
  video_source: 'youtube',
  video_url: '',
  video_storage_path: '',
  pdf_url: '',
  pdf_storage_path: '',
  text_content: '',
  thumbnail_url: '',
  order: 0,
  active: true
});

// Bir materyalin tamamlama detayını gösteren modal
const CompletionStatsModal = ({ material, completions, onClose }) => {
  const completed = completions.filter((c) => !!c.completed_at);
  const inProgress = completions.filter((c) => !c.completed_at);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Tamamlama Durumu — {material.title}
          </h3>
          <button onClick={onClose} className="text-gray-500 text-2xl leading-none">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {/* Özet */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="text-xs text-green-700 dark:text-green-400">Tamamlayan</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{completed.length}</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="text-xs text-amber-700 dark:text-amber-400">Açtı, Tamamlamadı</div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{inProgress.length}</div>
            </div>
          </div>

          {/* Tamamlayanlar */}
          {completed.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">✓ Tamamlayanlar ({completed.length})</h4>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                {completed.map((c) => (
                  <div key={c.id} className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-sm flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{c.user_name || c.user_id}</span>
                      {c.ballot_number && <span className="text-xs text-gray-500 ml-2">Sandık {c.ballot_number}</span>}
                      {c.user_phone && <span className="text-xs text-gray-500 ml-2">{c.user_phone}</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.completion_method === 'auto_80' ? '%80 izledi' : 'Tikledi'} ·{' '}
                      {c.completed_at ? new Date(c.completed_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yarım kalanlar */}
          {inProgress.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">⏳ Açtı ama Tamamlamadı ({inProgress.length})</h4>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                {inProgress.map((c) => (
                  <div key={c.id} className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-sm flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{c.user_name || c.user_id}</span>
                      {c.ballot_number && <span className="text-xs text-gray-500 ml-2">Sandık {c.ballot_number}</span>}
                      {c.user_phone && <span className="text-xs text-gray-500 ml-2">{c.user_phone}</span>}
                    </div>
                    <div className="text-xs text-amber-600">%{c.progress_percent || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Bu materyali henüz kimse açmadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TrainingManagementPage = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();

  const [materials, setMaterials] = useState([]);
  const [completionsByMaterial, setCompletionsByMaterial] = useState({}); // { materialId: [completion, ...] }
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statsModalMaterial, setStatsModalMaterial] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [data, allCompletions] = await Promise.all([
        ApiService.getTrainingMaterials(undefined, false),
        ApiService.getAllTrainingCompletions()
      ]);
      setMaterials(Array.isArray(data) ? data : []);
      // Materyal başına grupla
      const grouped = {};
      (allCompletions || []).forEach((c) => {
        const k = String(c.material_id);
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(c);
      });
      setCompletionsByMaterial(grouped);
    } catch (e) {
      toast.error('Yüklenemedi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm()); setShowForm(true); };
  const openEdit = (m) => {
    setForm({
      id: m.id,
      title: m.title || '',
      description: m.description || '',
      audience: m.audience || 'chief_observer',
      content_type: m.content_type || 'text',
      video_source: m.video_source || 'youtube',
      video_url: m.video_url || '',
      video_storage_path: m.video_storage_path || '',
      pdf_url: m.pdf_url || '',
      pdf_storage_path: m.pdf_storage_path || '',
      text_content: m.text_content || '',
      thumbnail_url: m.thumbnail_url || '',
      order: typeof m.order === 'number' ? m.order : 0,
      active: m.active !== false
    });
    setShowForm(true);
  };

  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, path } = await ApiService.uploadTrainingFile(file, 'video');
      setForm((f) => ({ ...f, video_source: 'storage', video_url: url, video_storage_path: path }));
      toast.success('Video yüklendi.');
    } catch (err) {
      toast.error('Video yüklenemedi: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePdfFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, path } = await ApiService.uploadTrainingFile(file, 'pdf');
      setForm((f) => ({ ...f, pdf_url: url, pdf_storage_path: path }));
      toast.success('PDF yüklendi.');
    } catch (err) {
      toast.error('PDF yüklenemedi: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Başlık zorunlu'); return; }
    if (form.content_type === 'video' && !form.video_url) { toast.error('Video URL veya dosya gerekli'); return; }
    if (form.content_type === 'pdf' && !form.pdf_url) { toast.error('PDF dosyası gerekli'); return; }
    if (form.content_type === 'text' && !form.text_content.trim()) { toast.error('Metin içeriği boş olamaz'); return; }

    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.id;

      if (form.id) {
        await ApiService.updateTrainingMaterial(form.id, payload);
        toast.success('Güncellendi');
      } else {
        await ApiService.createTrainingMaterial(payload);
        toast.success('Eklendi');
      }
      setShowForm(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error('Kaydedilemedi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    const ok = await confirm({
      title: 'Eğitim Materyalini Sil',
      message: `"${m.title}" silinecek. Devam edilsin mi?`,
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await ApiService.deleteTrainingMaterial(m.id);
      toast.success('Silindi');
      await load();
    } catch (e) {
      toast.error('Silinemedi: ' + e.message);
    }
  };

  const toggleActive = async (m) => {
    try {
      await ApiService.updateTrainingMaterial(m.id, { active: !m.active });
      await load();
    } catch (e) {
      toast.error('Güncellenemedi: ' + e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Eğitim Materyalleri</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Başmüşahitler ve halka açık landing sayfası için video, PDF ve yazılı eğitim içerikleri.
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Materyal
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Yükleniyor…</div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500">Henüz materyal yok. "Yeni Materyal" ile ekleyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {materials.map((m) => {
            const comps = completionsByMaterial[String(m.id)] || [];
            const opened = comps.length;
            const completed = comps.filter((c) => !!c.completed_at).length;
            return (
              <div key={m.id} className={`relative ${m.active === false ? 'opacity-50' : ''}`}>
                <TrainingMaterialCard material={m} />
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {AUDIENCE_LABEL[m.audience] || m.audience}
                    </span>
                    <button
                      onClick={() => toggleActive(m)}
                      className={`text-xs font-medium px-2 py-1 rounded ${m.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {m.active !== false ? 'Aktif' : 'Pasif'}
                    </button>
                    <button onClick={() => openEdit(m)} className="text-xs text-indigo-600 hover:underline">Düzenle</button>
                    <button onClick={() => handleDelete(m)} className="text-xs text-red-600 hover:underline">Sil</button>
                  </div>
                  {/* Tamamlama özeti */}
                  <button
                    onClick={() => setStatsModalMaterial(m)}
                    className="w-full text-left bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 flex items-center gap-2 text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {completed} / {opened} tamamlandı
                      </div>
                      {opened > 0 ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round((completed / opened) * 100)}% — detay için tıkla
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Henüz açan yok
                        </div>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tamamlama detay modal */}
      {statsModalMaterial && (
        <CompletionStatsModal
          material={statsModalMaterial}
          completions={completionsByMaterial[String(statsModalMaterial.id)] || []}
          onClose={() => setStatsModalMaterial(null)}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {form.id ? 'Materyal Düzenle' : 'Yeni Materyal'}
                </h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-2xl leading-none">✕</button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Başlık *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Hedef Kitle</label>
                  <select
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  >
                    <option value="chief_observer">Sadece Başmüşahit</option>
                    <option value="public">Sadece Public Sayfa</option>
                    <option value="both">Her İkisi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tür</label>
                  <select
                    value={form.content_type}
                    onChange={(e) => setForm({ ...form, content_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  >
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                    <option value="text">Yazılı Metin</option>
                  </select>
                </div>
              </div>

              {/* Video alanları */}
              {form.content_type === 'video' && (
                <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium mb-1">Video Kaynağı</label>
                    <div className="flex gap-3 text-sm">
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={form.video_source === 'youtube'} onChange={() => setForm({ ...form, video_source: 'youtube' })} />
                        YouTube Linki
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={form.video_source === 'storage'} onChange={() => setForm({ ...form, video_source: 'storage' })} />
                        Dosya Yükle
                      </label>
                    </div>
                  </div>
                  {form.video_source === 'youtube' ? (
                    <div>
                      <label className="block text-sm font-medium mb-1">YouTube URL</label>
                      <input
                        type="url"
                        value={form.video_url}
                        onChange={(e) => setForm({ ...form, video_url: e.target.value, video_storage_path: '' })}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-1">Video Dosyası (max 200 MB)</label>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileUpload}
                        disabled={uploading}
                        className="w-full text-sm"
                      />
                      {uploading && <p className="text-xs text-gray-500 mt-1">Yükleniyor… büyük dosyalar 1-2 dk sürebilir.</p>}
                      {form.video_url && !uploading && (
                        <p className="text-xs text-green-600 mt-1">✓ Yüklendi: {form.video_storage_path}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PDF */}
              {form.content_type === 'pdf' && (
                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <label className="block text-sm font-medium mb-1">PDF Dosyası (max 200 MB)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfFileUpload}
                    disabled={uploading}
                    className="w-full text-sm"
                  />
                  {uploading && <p className="text-xs text-gray-500 mt-1">Yükleniyor…</p>}
                  {form.pdf_url && !uploading && (
                    <p className="text-xs text-green-600 mt-1">✓ Yüklendi: {form.pdf_storage_path}</p>
                  )}
                </div>
              )}

              {/* Metin */}
              {form.content_type === 'text' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Metin İçeriği</label>
                  <textarea
                    value={form.text_content}
                    onChange={(e) => setForm({ ...form, text_content: e.target.value })}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 font-mono text-sm"
                    placeholder="Eğitim metni... (satır araları korunur)"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Sıra</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Durum</label>
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                    <span className="text-sm">Aktif (görünsün)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowForm(false)} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Vazgeç
                </button>
                <button type="submit" disabled={saving || uploading} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
                  {saving ? 'Kaydediliyor…' : (form.id ? 'Güncelle' : 'Ekle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default TrainingManagementPage;
