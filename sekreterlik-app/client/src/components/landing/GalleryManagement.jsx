import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../UI/ConfirmDialog';
import ApiService from '../../utils/ApiService';
import { resizeImageFile } from '../../utils/imageResize';

/**
 * Landing Page — Galeri Yönetim Paneli
 *
 * Firestore: landing_gallery/{id}
 * Storage:   landing_gallery/{timestamp}.{ext}
 *
 * Şema:
 *   { url, caption, date (YYYY-MM-DD), order (number), path?, createdAt, updatedAt }
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

const GalleryManagement = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total }
  const [captionDraft, setCaptionDraft] = useState({}); // { [id]: string }
  const [urlInput, setUrlInput] = useState('');
  const [urlCaption, setUrlCaption] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await ApiService.getLandingGallery();
      setItems(Array.isArray(list) ? list : []);
      // caption draft senkronu
      const drafts = {};
      (list || []).forEach((it) => { drafts[it.id] = it.caption || ''; });
      setCaptionDraft(drafts);
    } catch (err) {
      console.error('Galeri yuklenemedi:', err);
      toast.error('Galeri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const validateFile = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Sadece JPG, PNG veya WebP destekleniyor';
    // Boyut kontrolü kaldırıldı — resizeImageFile otomatik küçültür
    return null;
  };

  const handleMultiUpload = async (files) => {
    if (!files || files.length === 0) return;

    const arr = Array.from(files);
    const valid = [];
    for (const f of arr) {
      const err = validateFile(f);
      if (err) {
        toast.error(`${f.name}: ${err}`);
      } else {
        valid.push(f);
      }
    }
    if (valid.length === 0) return;

    setUploadProgress({ done: 0, total: valid.length });
    let successCount = 0;
    const today = todayISODate();
    // Yeni öğelerin mevcut öğelerden sonra görünmesi için maksimum order'dan başla
    const baseOrder = items.reduce((max, it) => Math.max(max, it.order ?? 0), 0) + 1;

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      try {
        const optimized = await resizeImageFile(file, { maxBytes: 2 * 1024 * 1024, maxDim: 1920 });
        const up = await ApiService.uploadLandingGalleryImage(optimized);
        if (!up?.success || !up.url) throw new Error(up?.message || 'Yükleme hatası');
        const created = await ApiService.createLandingGalleryItem({
          url: up.url,
          path: up.path || '',
          caption: '',
          date: today,
          order: baseOrder + i
        });
        if (!created?.success) throw new Error(created?.message || 'Firestore kaydı başarısız');
        successCount += 1;
      } catch (err) {
        console.error('Galeri yükleme hatasi:', file?.name, err);
        toast.error(`${file.name} yüklenemedi: ${err?.message || 'bilinmeyen hata'}`);
      } finally {
        setUploadProgress({ done: i + 1, total: valid.length });
      }
    }

    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (successCount > 0) {
      toast.success(`${successCount}/${valid.length} görsel yüklendi`);
      await load();
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Görseli Sil',
      message: 'Bu görsel galeriden kalıcı olarak silinecek. Emin misiniz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      // Önce Firestore dokümanını sil
      const res = await ApiService.deleteLandingGalleryItem(item.id);
      if (!res?.success) throw new Error(res?.message || 'Silme başarısız');

      // Storage dosyasını sil (hata olursa sessiz geç — zaten yetim file)
      if (item.path) {
        await ApiService.deleteLandingStorageFile(item.path).catch(() => {});
      }
      toast.success('Görsel silindi');
      await load();
    } catch (err) {
      toast.error('Silme hatası: ' + (err?.message || 'bilinmeyen hata'));
    }
  };

  const saveCaption = async (item) => {
    const nextCaption = (captionDraft[item.id] ?? '').trim();
    if (nextCaption === (item.caption || '')) return; // değişmemiş
    try {
      const res = await ApiService.updateLandingGalleryItem(item.id, { caption: nextCaption });
      if (res?.success) {
        setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, caption: nextCaption } : it));
      } else {
        throw new Error(res?.message || 'Güncelleme başarısız');
      }
    } catch (err) {
      toast.error('Açıklama güncellenemedi: ' + (err?.message || 'bilinmeyen hata'));
    }
  };

  const saveOrder = async (item, newOrder) => {
    const orderNum = Number(newOrder);
    if (Number.isNaN(orderNum)) return;
    if (orderNum === (item.order ?? 0)) return;
    try {
      const res = await ApiService.updateLandingGalleryItem(item.id, { order: orderNum });
      if (res?.success) {
        setItems((prev) => {
          const next = prev.map((it) => it.id === item.id ? { ...it, order: orderNum } : it);
          return [...next].sort((a, b) => {
            const diff = (a.order ?? 999) - (b.order ?? 999);
            if (diff !== 0) return diff;
            return new Date(b.date || 0) - new Date(a.date || 0);
          });
        });
      } else {
        throw new Error(res?.message || 'Sıra güncellenemedi');
      }
    } catch (err) {
      toast.error('Sıra güncellenemedi: ' + (err?.message || 'bilinmeyen hata'));
    }
  };

  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="space-y-4">
      {/* Üst: çoklu yükleme */}
      <div className="rounded-lg border border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10 p-4 space-y-2">
        <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">Saha çalışması görsellerini yükleyin</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Birden fazla dosya seçebilirsiniz. JPG/PNG/WebP, her biri maks. 5MB.
        </p>
        <label className={labelCls + ' sr-only'} htmlFor="gallery-upload">Görsel seç</label>
        <input
          id="gallery-upload"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={!!uploadProgress}
          onChange={(e) => handleMultiUpload(e.target.files)}
          className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700 disabled:opacity-50"
        />
        {uploadProgress && (
          <div className="text-xs text-primary-700 dark:text-primary-300">
            Yükleniyor: {uploadProgress.done}/{uploadProgress.total}
          </div>
        )}

        {/* Link ile görsel ekle */}
        <div className="pt-3 mt-3 border-t border-primary-200 dark:border-primary-800 space-y-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Veya harici link ile ekle</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
            <input
              type="text"
              value={urlCaption}
              onChange={(e) => setUrlCaption(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
            <button
              type="button"
              disabled={!urlInput.trim() || addingUrl}
              onClick={async () => {
                if (!urlInput.trim()) return;
                try {
                  setAddingUrl(true);
                  const today = new Date().toISOString().slice(0, 10);
                  const created = await ApiService.createLandingGalleryItem({
                    url: urlInput.trim(),
                    caption: urlCaption.trim(),
                    date: today,
                    order: items.length,
                    external: true
                  });
                  if (created?.success) {
                    toast.success('Görsel eklendi');
                    setUrlInput('');
                    setUrlCaption('');
                    await load();
                  } else {
                    toast.error(created?.message || 'Eklenemedi');
                  }
                } catch (err) {
                  toast.error('Hata: ' + (err?.message || ''));
                } finally {
                  setAddingUrl(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium"
            >
              {addingUrl ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </div>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          Yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          Henüz galeri görseli yok. Yukarıdan çoklu yükleme yapabilirsiniz.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden flex flex-col"
            >
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative">
                <img
                  src={item.url}
                  alt={item.caption || 'Galeri görseli'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <input
                  type="text"
                  value={captionDraft[item.id] ?? ''}
                  onChange={(e) => setCaptionDraft((p) => ({ ...p, [item.id]: e.target.value }))}
                  onBlur={() => saveCaption(item)}
                  placeholder="Açıklama (opsiyonel)"
                  maxLength={200}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    Sıra
                    <input
                      type="number"
                      min={0}
                      defaultValue={item.order ?? 0}
                      onBlur={(e) => saveOrder(item, e.target.value)}
                      className="w-14 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs font-medium transition-colors"
                  >
                    Sil
                  </button>
                </div>
                {item.date && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{item.date}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default GalleryManagement;
