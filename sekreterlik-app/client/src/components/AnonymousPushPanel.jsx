import React, { useEffect, useState, useCallback } from 'react';
import {
  getAnonymousSubscribers,
  sendPushToAnonymousSubscribers,
} from '../services/NotificationService';

/**
 * AnonymousPushPanel
 * Admin-only. Login olmayan ziyaretcilerin push aboneliklerini
 * yonetir ve toplu bildirim gonderir.
 *
 * Veri kaynagi: push_tokens koleksiyonunda isAnonymous=true dokumanlari
 * Cloud Function: sendpush-bsrvxijkia-ew.a.run.app
 */
const AnonymousPushPanel = () => {
  const [count, setCount] = useState(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState(null); // { type, message }

  // VAPID key değiştiğinde eski abonelikler invalidate olur — temizleme
  const handleResetAll = async () => {
    if (!window.confirm(`${count || 0} anonim aboneliği SIFIRLANACAK.\nKullanıcılar yeniden abone olmak zorunda kalır.\n\nDevam edilsin mi?`)) return;
    setResetting(true);
    try {
      const { collection, getDocs, query, where, writeBatch } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const q = query(collection(db, 'push_tokens'), where('isAnonymous', '==', true));
      const snap = await getDocs(q);
      const docs = snap.docs;
      const CHUNK = 400;
      let deleted = 0;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + CHUNK)) batch.delete(d.ref);
        await batch.commit();
        deleted += Math.min(CHUNK, docs.length - i);
      }
      showToast('success', `${deleted} eski abonelik silindi. Kullanıcılar yeniden abone olabilir.`);
      loadCount();
    } catch (err) {
      showToast('error', 'Sıfırlama hatası: ' + (err.message || 'bilinmeyen'));
    } finally {
      setResetting(false);
    }
  };

  const loadCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const list = await getAnonymousSubscribers();
      setCount(list.length);
    } catch (_) {
      setCount(0);
    } finally {
      setLoadingCount(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!title.trim()) {
      showToast('error', 'Baslik bos olamaz.');
      return;
    }
    if (!body.trim()) {
      showToast('error', 'Mesaj bos olamaz.');
      return;
    }
    if (!window.confirm(`${count || 0} anonim aboneye bildirim gonderilecek. Onayliyor musunuz?`)) {
      return;
    }
    setSending(true);
    try {
      const res = await sendPushToAnonymousSubscribers({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || '/',
        image: imageUrl.trim() || undefined,
      });
      if (res.success) {
        showToast('success', `${res.sentCount} aboneye gonderildi.`);
        setTitle('');
        setBody('');
      } else {
        showToast('error', `Gonderim basarisiz: ${res.error || 'bilinmeyen hata'}`);
      }
    } catch (err) {
      showToast('error', `Hata: ${err?.message || 'bilinmeyen'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Anonim Bildirim Yonetimi
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tanitim sayfasindan abone olan (login olmayan) ziyaretcilere toplu push bildirim gonderir.
        </p>
      </div>

      {/* Abone sayisi karti */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80 mb-1">Toplam Anonim Abone</p>
            <p className="text-3xl font-bold">
              {loadingCount ? '...' : (count ?? 0)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        </div>
        <button
          type="button"
          onClick={loadCount}
          className="mt-3 text-xs underline opacity-80 hover:opacity-100"
          disabled={loadingCount}
        >
          {loadingCount ? 'Yukleniyor...' : 'Yenile'}
        </button>
      </div>

      {/* Bildirim formu */}
      <form
        onSubmit={handleSend}
        className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Baslik <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Yeni duyuru"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">{title.length}/80</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mesaj <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="Bildirim icerigi..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">{body.length}/200</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tiklayinca acilacak URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bildirim Görseli URL (opsiyonel)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... (büyük resim, mobil bildirimde görünür)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {imageUrl && (
            <div className="mt-2">
              <img src={imageUrl} alt="Önizleme" className="max-h-32 rounded border border-gray-300 dark:border-gray-700" onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={sending || (count !== null && count === 0)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
          >
            {sending ? 'Gonderiliyor...' : 'Bildirim Gonder'}
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={resetting || (count !== null && count === 0)}
            title="VAPID key değiştiğinde eski abonelikler invalidate olur. Bu buton tüm anonim aboneleri siler — kullanıcılar yeniden abone olur."
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
          >
            {resetting ? 'Sıfırlanıyor...' : 'Eski Abonelikleri Sıfırla'}
          </button>
          {count === 0 && !loadingCount && (
            <span className="text-xs text-amber-600 dark:text-amber-400 self-center">
              Henuz anonim abone yok.
            </span>
          )}
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AnonymousPushPanel;
