import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import ApiService from '../utils/ApiService';

/**
 * Üye başvuru formu modal'ı.
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - application: {...}   // hangi kampanyaya başvurduğu
 *  - member: { id, firstName, lastName, full_name, ... }
 *  - onSubmitted?: (submissionId) => void   // başarılı gönderim sonrası
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const ApplicationSubmitModal = ({ isOpen, onClose, application, member, onSubmitted }) => {
  const [answer, setAnswer] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnswer('');
      setFile(null);
      setFileError('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!application) return null;

  const requiresAttachment = !!application.requiresAttachment;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFileError('');
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError('Dosya 10 MB üzerinde olamaz');
      setFile(null);
      return;
    }
    if (!ALLOWED_MIME.includes(f.type)) {
      setFileError('Sadece PDF, JPG veya PNG yükleyebilirsiniz');
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!answer.trim() || answer.trim().length < 20) {
      setError('Başvuru metniniz en az 20 karakter olmalı');
      return;
    }
    if (requiresAttachment && !file) {
      setError('Bu başvuru için ek dosya yüklemek zorunludur');
      return;
    }
    if (!member?.id) {
      setError('Üye bilgisi bulunamadı');
      return;
    }

    setSubmitting(true);
    try {
      let attachmentUrl = null;
      let attachmentName = null;

      if (file) {
        const up = await ApiService.uploadApplicationAttachment(member.id, file);
        if (!up?.success) {
          setError(up?.message || 'Dosya yüklenemedi');
          setSubmitting(false);
          return;
        }
        attachmentUrl = up.url;
        attachmentName = up.name;
      }

      const memberName =
        member.full_name ||
        [member.firstName, member.lastName].filter(Boolean).join(' ') ||
        member.name ||
        'Üye';

      const res = await ApiService.submitApplication({
        applicationId: application.id,
        memberId: String(member.id),
        memberName,
        answer: answer.trim(),
        attachmentUrl,
        attachmentName
      });

      if (res?.success) {
        if (onSubmitted) onSubmitted(res.id);
        onClose();
      } else {
        setError(res?.message || 'Başvuru gönderilemedi');
      }
    } catch (err) {
      console.error('Submit application error:', err);
      setError(err?.message || 'Başvuru gönderilirken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Başvuru Formu" size="md">
      {/* Kampanya bilgisi (read-only) */}
      <div className="mb-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
        <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
          {application.title}
        </h3>
        {application.description && (
          <p className="text-sm text-indigo-800 dark:text-indigo-300 whitespace-pre-line">
            {application.description}
          </p>
        )}
        {application.deadline && (
          <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-2">
            Son Tarih:{' '}
            {new Date(application.deadline).toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Motivasyon / açıklama */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Başvurunuz / Motivasyonunuz <span className="text-red-500">*</span>
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            maxLength={2000}
            required
            minLength={20}
            placeholder="Neden başvurduğunuzu, uygun olduğunuzu düşündüğünüz özelliklerinizi kısaca anlatın (en az 20 karakter)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              En az 20 karakter
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {answer.length}/2000
            </span>
          </div>
        </div>

        {/* Dosya yükleme */}
        {(requiresAttachment || true) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ek Dosya (PDF, JPG, PNG — max 10 MB){' '}
              {requiresAttachment && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
              required={requiresAttachment}
              className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 cursor-pointer"
            />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
            {fileError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileError}</p>
            )}
          </div>
        )}

        {/* Hata mesajı */}
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
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {submitting ? 'Gönderiliyor...' : 'Başvuruyu Gönder'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ApplicationSubmitModal;
