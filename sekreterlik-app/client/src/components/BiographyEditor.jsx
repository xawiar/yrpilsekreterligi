import React, { useEffect, useState } from 'react';
import FirebaseService from '../services/FirebaseService';
import { useToast } from '../contexts/ToastContext';

const MAX_LEN = 2000;
const COLLECTION = 'members';

const BiographyEditor = ({ memberId, initialValue = '', onSaved }) => {
  const toast = useToast();
  const [value, setValue] = useState(initialValue || '');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(initialValue || '');

  useEffect(() => {
    setValue(initialValue || '');
    setLastSaved(initialValue || '');
  }, [initialValue]);

  const dirty = (value || '') !== (lastSaved || '');
  const overLimit = (value || '').length > MAX_LEN;

  const handleSave = async () => {
    if (!memberId) {
      toast.error('Üye bilgisi bulunamadı');
      return;
    }
    if (overLimit) {
      toast.error(`Özgeçmiş ${MAX_LEN} karakteri aşamaz`);
      return;
    }
    try {
      setSaving(true);
      await FirebaseService.update(COLLECTION, String(memberId), {
        biography: value || ''
      }, true);
      setLastSaved(value || '');
      toast.success('Özgeçmiş kaydedildi');
      if (typeof onSaved === 'function') onSaved(value || '');
    } catch (err) {
      console.error('BiographyEditor save error:', err);
      toast.error('Özgeçmiş kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValue(lastSaved || '');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-900 px-6 py-5">
        <h2 className="text-lg font-semibold text-white">Özgeçmişim</h2>
        <p className="text-xs text-emerald-100 mt-0.5">
          Kısa biyografi — public tanıtım sayfasında profil fotoğrafınıza tıklanınca görünür
        </p>
      </div>

      <div className="px-6 py-5 space-y-3">
        <label htmlFor="biography-textarea" className="sr-only">
          Özgeçmiş
        </label>
        <textarea
          id="biography-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          placeholder={'Eğitim bilgileriniz, mesleki geçmişiniz, sivil toplum / siyasi deneyimleriniz, ilgi alanlarınız...'}
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400"
        />

        <div className="flex items-center justify-between text-xs">
          <span className={`${overLimit ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
            {(value || '').length} / {MAX_LEN}
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            Sade metin. Satır sonları korunur.
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
          {dirty && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Vazgeç
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty || overLimit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-900 transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Kaydediliyor...
              </>
            ) : (
              'Kaydet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BiographyEditor;
