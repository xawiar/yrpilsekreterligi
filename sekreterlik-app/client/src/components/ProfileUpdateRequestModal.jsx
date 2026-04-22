import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

/**
 * Üye profil (TC / Telefon) değişiklik talebi modalı.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen       Modal açık mı?
 * @param {Function} props.onClose      Kapatma handler
 * @param {Object}   props.member       Üye objesi (id, tc, phone, name, surname vb.)
 * @param {Function} [props.onSubmitted] Talep gönderildikten sonra çağrılır
 */
const ProfileUpdateRequestModal = ({ isOpen, onClose, member, onSubmitted }) => {
  const toast = useToast();
  const [newTc, setNewTc] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Modal her açıldığında formu sıfırla
  useEffect(() => {
    if (isOpen) {
      setNewTc('');
      setNewPhone('');
      setReason('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTc = (member?.tc || '').toString();
  const currentPhone = (member?.phone || '').toString();

  const handleTcChange = (e) => {
    // Sadece rakam, 11 haneye kadar
    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
    setNewTc(val);
  };

  const handlePhoneChange = (e) => {
    // Sadece rakam, 15 haneye kadar (uluslararasi formatlar için esnek)
    const val = e.target.value.replace(/\D/g, '').slice(0, 15);
    setNewPhone(val);
  };

  const validate = () => {
    const tcTrim = (newTc || '').trim();
    const phoneTrim = (newPhone || '').trim();
    const reasonTrim = (reason || '').trim();

    if (!tcTrim && !phoneTrim) {
      return 'En az bir alan (TC veya telefon) doldurulmalıdır.';
    }
    if (tcTrim && tcTrim.length !== 11) {
      return 'TC kimlik numarası 11 haneli olmalıdır.';
    }
    if (phoneTrim && phoneTrim.length < 10) {
      return 'Telefon numarası en az 10 haneli olmalıdır.';
    }
    if (tcTrim && tcTrim === currentTc.replace(/\D/g, '')) {
      return 'Girdiğiniz TC mevcut TC ile aynı. Farklı bir TC girin veya boş bırakın.';
    }
    if (phoneTrim && phoneTrim === currentPhone.replace(/\D/g, '')) {
      return 'Girdiğiniz telefon mevcut telefon ile aynı. Farklı bir numara girin veya boş bırakın.';
    }
    if (reasonTrim.length < 10) {
      return 'Değişiklik sebebi en az 10 karakter olmalıdır.';
    }
    return '';
  };

  const handleSubmit = async () => {
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      const resp = await ApiService.createProfileUpdateRequest({
        memberId: member?.id,
        currentTc,
        currentPhone,
        newTc: newTc.trim(),
        newPhone: newPhone.trim(),
        reason: reason.trim()
      });

      if (resp?.success) {
        toast?.success?.('Talebiniz oluşturuldu. Admin onayından sonra geçerli olacaktır.');
        if (typeof onSubmitted === 'function') onSubmitted();
        onClose?.();
      } else {
        const msg = resp?.message || 'Talep oluşturulamadı.';
        setError(msg);
        toast?.error?.(msg);
      }
    } catch (e) {
      const msg = e?.message || 'Beklenmeyen bir hata oluştu.';
      setError(msg);
      toast?.error?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const maskedTc = currentTc
    ? currentTc.replace(/\D/g, '').replace(/^(\d{3})\d+(\d{2})$/, '$1******$2')
    : '—';
  const maskedPhone = currentPhone
    ? currentPhone.replace(/\D/g, '').replace(/^(\d{3})\d+(\d{2})$/, '$1******$2')
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Profil Değişiklik Talebi
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              TC veya telefon numarası değişikliği için admin onayı gereklidir
            </p>
          </div>
        </div>

        {/* Mevcut bilgiler */}
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Mevcut Bilgileriniz</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs block">TC:</span>
              <span className="text-gray-900 dark:text-gray-100 font-mono">{maskedTc}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs block">Telefon:</span>
              <span className="text-gray-900 dark:text-gray-100 font-mono">{maskedPhone}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Yeni TC Kimlik Numarası
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 font-normal">(değişmeyecekse boş bırakın)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={newTc}
              onChange={handleTcChange}
              placeholder="11 haneli TC"
              maxLength={11}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Yeni Telefon Numarası
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 font-normal">(değişmeyecekse boş bırakın)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={newPhone}
              onChange={handlePhoneChange}
              placeholder="Örn: 5551234567"
              maxLength={15}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Değişiklik Sebebi <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Neden değişiklik talep ediyorsunuz? (en az 10 karakter)"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {reason.trim().length} / 10 karakter
            </p>
          </div>
        </div>

        {/* Uyarı */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Bilgi:</strong> Bu talep admin onayından sonra geçerli olacaktır. Talebiniz onaylanana kadar mevcut bilgileriniz kullanılmaya devam edecektir.
          </p>
        </div>

        {/* Hata mesajı */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Butonlar */}
        <div className="flex justify-end space-x-3 mt-5">
          <button
            onClick={() => { if (!submitting) onClose?.(); }}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Gönderiliyor...' : 'Talep Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileUpdateRequestModal;
