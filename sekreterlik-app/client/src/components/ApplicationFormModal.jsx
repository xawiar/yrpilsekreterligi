import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import ApiService from '../utils/ApiService';

/**
 * Admin — yeni başvuru kampanyası oluşturma / düzenleme modal'ı.
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - application?: mevcut kampanya (düzenleme modu)
 *  - onSaved?: (application) => void
 */

const CATEGORY_OPTIONS = [
  { value: 'meclis_üyeliği', label: 'Meclis Üyeliği' },
  { value: 'görevlendirme', label: 'Görevlendirme' },
  { value: 'komisyon', label: 'Komisyon' },
  { value: 'diğer', label: 'Diğer' }
];

const toDateInputValue = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
};

const ApplicationFormModal = ({ isOpen, onClose, application, onSaved }) => {
  const isEditing = !!application?.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('diğer');
  const [deadline, setDeadline] = useState('');
  const [requiresAttachment, setRequiresAttachment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (application) {
      setTitle(application.title || '');
      setDescription(application.description || '');
      setCategory(application.category || 'diğer');
      setDeadline(toDateInputValue(application.deadline));
      setRequiresAttachment(!!application.requiresAttachment);
    } else {
      setTitle('');
      setDescription('');
      setCategory('diğer');
      setDeadline('');
      setRequiresAttachment(false);
    }
    setError('');
    setSaving(false);
  }, [isOpen, application]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || title.trim().length < 3) {
      setError('Başlık en az 3 karakter olmalı');
      return;
    }

    setSaving(true);
    try {
      const deadlineIso = deadline
        ? new Date(`${deadline}T23:59:59`).toISOString()
        : null;

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        deadline: deadlineIso,
        requiresAttachment
      };

      let res;
      if (isEditing) {
        res = await ApiService.updateApplication(application.id, payload);
      } else {
        res = await ApiService.createApplication(payload);
      }

      if (res?.success) {
        if (onSaved) onSaved({ ...application, ...payload, id: application?.id || res.id });
        onClose();
      } else {
        setError(res?.message || 'Kaydedilemedi');
      }
    } catch (err) {
      console.error('Save application error:', err);
      setError(err?.message || 'Kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Başvuru Kampanyasını Düzenle' : 'Yeni Başvuru Kampanyası'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Başlık */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Başlık <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="Ör: Belediye Meclis Üyeliği Başvurusu"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Açıklama
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Başvuru süreci, aranılan nitelikler, gerekli belgeler vb."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
          />
        </div>

        {/* Kategori + Son Tarih */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Son Tarih <span className="text-xs text-gray-400">(opsiyonel)</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Ek dosya zorunlu mu */}
        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <input
            type="checkbox"
            checked={requiresAttachment}
            onChange={(e) => setRequiresAttachment(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Başvuranlar ek dosya (PDF/resim) yüklemek <b>zorundadır</b>
          </span>
        </label>

        {/* Hata */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Butonlar */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {saving ? 'Kaydediliyor...' : isEditing ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ApplicationFormModal;
