import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../UI/ConfirmDialog';
import ApiService from '../../utils/ApiService';
import { resizeImageFile } from '../../utils/imageResize';

/**
 * Landing Page — Duyurular Yönetim Paneli
 *
 * Firestore: landing_news/{id}
 * Storage:   landing_news/{timestamp}.{ext}
 *
 * Şema:
 *   { title, content, date (YYYY-MM-DD), image (URL), createdAt, updatedAt }
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const todayISODate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateTR = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
};

const emptyForm = () => ({
  id: null,
  title: '',
  content: '',
  date: todayISODate(),
  image: ''
});

const NewsManagement = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isEdit = !!form.id;

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await ApiService.getLandingNews();
      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Duyurular yuklenemedi:', err);
      toast.error('Duyurular yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({
      id: item.id,
      title: item.title || '',
      content: item.content || '',
      date: item.date || todayISODate(),
      image: item.image || ''
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    if (uploading || saving) return;
    setForm(emptyForm());
    setShowForm(false);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Sadece JPG, PNG veya WebP dosyaları yükleyebilirsiniz');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Dosya boyutu 10MB\'dan küçük olmalıdır');
      return;
    }
    try {
      setUploading(true);
      const optimized = await resizeImageFile(file, { maxBytes: 2 * 1024 * 1024, maxDim: 1920 });
      const res = await ApiService.uploadLandingNewsImage(optimized);
      if (res?.success && res.url) {
        setForm((prev) => ({ ...prev, image: res.url }));
        toast.success('Görsel yüklendi');
      } else {
        throw new Error(res?.message || 'Görsel yüklenemedi');
      }
    } catch (err) {
      toast.error('Görsel yüklenemedi: ' + (err?.message || 'bilinmeyen hata'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const title = (form.title || '').trim();
    const content = (form.content || '').trim();
    if (!title) { toast.error('Başlık zorunludur'); return; }
    if (!content) { toast.error('İçerik zorunludur'); return; }

    const payload = {
      title,
      content,
      date: form.date || todayISODate(),
      image: form.image || ''
    };

    try {
      setSaving(true);
      const res = isEdit
        ? await ApiService.updateLandingNews(form.id, payload)
        : await ApiService.createLandingNews(payload);

      if (res?.success) {
        toast.success(isEdit ? 'Duyuru güncellendi' : 'Duyuru eklendi');
        setShowForm(false);
        setForm(emptyForm());
        await load();
      } else {
        throw new Error(res?.message || 'Kaydetme başarısız');
      }
    } catch (err) {
      toast.error('Kaydetme hatası: ' + (err?.message || 'bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Duyuruyu Sil',
      message: `"${item.title || 'Bu duyuru'}" silinsin mi? Bu işlem geri alınamaz.`,
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      const res = await ApiService.deleteLandingNews(item.id);
      if (res?.success) {
        toast.success('Duyuru silindi');
        await load();
      } else {
        throw new Error(res?.message || 'Silme başarısız');
      }
    } catch (err) {
      toast.error('Silme hatası: ' + (err?.message || 'bilinmeyen hata'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Üst aksiyonlar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tanıtım sayfasında yayınlanacak duyurular ve haberler.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          + Yeni Duyuru
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20 p-4 space-y-3"
        >
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Duyuruyu Düzenle' : 'Yeni Duyuru'}
          </h4>
          <div>
            <label className={labelCls} htmlFor="news-title">Başlık <span className="text-red-500">*</span></label>
            <input
              id="news-title"
              type="text"
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Duyuru başlığı"
              maxLength={200}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="news-content">İçerik <span className="text-red-500">*</span></label>
            <textarea
              id="news-content"
              rows={5}
              className={inputCls}
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Duyuru metni (markdown veya düz metin)"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="news-date">Tarih</label>
              <input
                id="news-date"
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="news-image">Görsel — dosya yükle veya link yapıştır</label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  id="news-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/40 dark:file:text-primary-200 hover:file:bg-primary-100"
                />
                {uploading && <span className="text-xs text-primary-600 animate-pulse whitespace-nowrap">Yükleniyor...</span>}
              </div>
              <input
                type="url"
                value={form.image || ''}
                onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
                placeholder="veya görsel URL'si yapıştır (https://...)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                jpg/png/webp, dosya maks 10MB. Harici link kullanıyorsan yapıştır.
              </p>
            </div>
          </div>
          {form.image && (
            <div className="flex items-center gap-3">
              <img
                src={form.image}
                alt="Duyuru görseli"
                className="h-20 w-32 object-cover rounded border border-gray-200 dark:border-gray-700"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, image: '' }))}
                className="text-xs text-red-600 hover:underline"
              >
                Görseli kaldır
              </button>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {saving ? 'Kaydediliyor...' : (isEdit ? 'Güncelle' : 'Kaydet')}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving || uploading}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      {loading ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          Yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          Henüz duyuru yok. Yukarıdan yeni duyuru ekleyin.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title || 'Duyuru'}
                  className="h-16 w-24 object-cover rounded flex-shrink-0 border border-gray-200 dark:border-gray-700"
                  loading="lazy"
                />
              ) : (
                <div className="h-16 w-24 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs text-gray-400">
                  Görsel yok
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h5 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {item.title || '(başlıksız)'}
                </h5>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatDateTR(item.date)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                  {item.content || ''}
                </p>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="px-3 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-xs font-medium transition-colors"
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="px-3 py-1 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs font-medium transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default NewsManagement;
