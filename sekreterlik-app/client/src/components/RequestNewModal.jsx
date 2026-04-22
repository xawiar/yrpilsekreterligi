import React, { useState } from 'react';
import Modal from './Modal';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

const CATEGORIES = [
  { value: 'istek', label: 'İstek' },
  { value: 'şikayet', label: 'Şikayet' },
  { value: 'soru', label: 'Soru' },
  { value: 'diğer', label: 'Diğer' }
];

/**
 * Üyenin yeni talep/şikayet açtığı modal.
 * Props: { isOpen, onClose, member: { id, name }, onCreated }
 */
const RequestNewModal = ({ isOpen, onClose, member, onCreated }) => {
  const toast = useToast();
  const [category, setCategory] = useState('istek');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setCategory('istek');
    setSubject('');
    setDescription('');
    setError('');
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');

    const s = subject.trim();
    const d = description.trim();

    if (s.length < 3) {
      setError('Başlık en az 3 karakter olmalı');
      return;
    }
    if (d.length < 10) {
      setError('Açıklama en az 10 karakter olmalı');
      return;
    }
    if (!member?.id) {
      setError('Kullanıcı bilgisi bulunamadı');
      return;
    }

    setSubmitting(true);
    try {
      const result = await ApiService.createRequest({
        memberId: member.id,
        memberName: member.name || 'Üye',
        category,
        subject: s,
        description: d
      });

      if (result?.success) {
        toast?.success?.('Talebiniz oluşturuldu');
        resetForm();
        onCreated?.(result.id);
        onClose?.();
      } else {
        const msg = result?.message || 'Talep oluşturulamadı';
        setError(msg);
        toast?.error?.(msg);
      }
    } catch (err) {
      console.error('createRequest error:', err);
      const msg = err?.message || 'Talep oluşturulurken hata oluştu';
      setError(msg);
      toast?.error?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Yeni Talep Oluştur" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Kategori <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
            disabled={submitting}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Başlık <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Talebin kısa başlığı"
            className={inputClass}
            disabled={submitting}
            maxLength={120}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            En az 3 karakter. {subject.length}/120
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Açıklama <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Talebinizi detaylı anlatın..."
            rows={6}
            className={inputClass}
            disabled={submitting}
            maxLength={2000}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            En az 10 karakter. {description.length}/2000
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
              </svg>
            )}
            {submitting ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RequestNewModal;
