import React from 'react';

/**
 * Bir başvuru kampanyasının kart görünümü.
 * Hem üye (başvuru yapar) hem admin (yönetir) tarafında kullanılır.
 *
 * Props:
 *  - application: { id, title, description, category, requiresAttachment, deadline, status, submissionCount, createdAt }
 *  - onApply?: (application) => void     // Üye "Başvur" butonuna basınca
 *  - onEdit?: (application) => void      // Admin "Düzenle"
 *  - onClose?: (application) => void     // Admin "Kapat"
 *  - onDelete?: (application) => void    // Admin "Sil"
 *  - onViewSubmissions?: (application) => void // Admin "Başvuranları Gör"
 *  - isAdmin?: boolean
 *  - alreadyApplied?: boolean            // Üye zaten başvurmuş mu
 */

const CATEGORY_LABELS = {
  'meclis_üyeliği': 'Meclis Üyeliği',
  'meclis_uyeligi': 'Meclis Üyeliği',
  'görevlendirme': 'Görevlendirme',
  'gorevlendirme': 'Görevlendirme',
  'komisyon': 'Komisyon',
  'diğer': 'Diğer',
  'diger': 'Diğer'
};

const CATEGORY_COLORS = {
  'meclis_üyeliği': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'meclis_uyeligi': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'görevlendirme': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'gorevlendirme': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'komisyon': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'diğer': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'diger': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return '';
  }
};

const ApplicationCard = ({
  application,
  onApply,
  onEdit,
  onClose,
  onDelete,
  onViewSubmissions,
  isAdmin = false,
  alreadyApplied = false
}) => {
  if (!application) return null;

  const {
    title,
    description,
    category,
    requiresAttachment,
    deadline,
    status,
    submissionCount = 0
  } = application;

  const deadlineDate = deadline ? new Date(deadline) : null;
  const isExpired = deadlineDate && deadlineDate < new Date();
  const isClosed = status === 'closed';
  const categoryLabel = CATEGORY_LABELS[category] || category || 'Diğer';
  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS['diger'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 p-5 flex flex-col h-full">
      {/* Üst — kategori + durum badge'leri */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
          {categoryLabel}
        </span>

        {requiresAttachment && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Ek dosya zorunlu
          </span>
        )}

        {isClosed && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            Kapalı
          </span>
        )}

        {isExpired && !isClosed && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
            Süre Doldu
          </span>
        )}
      </div>

      {/* Başlık */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
        {title}
      </h3>

      {/* Açıklama */}
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 whitespace-pre-line">
          {description}
        </p>
      )}

      {/* Meta — son tarih + başvuru sayısı */}
      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
        {deadlineDate && (
          <div className={`flex items-center gap-2 text-xs ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Son Tarih: {formatDate(deadline)}
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {submissionCount} başvuru
          </div>
        )}
      </div>

      {/* Aksiyonlar */}
      <div className="mt-4 flex flex-wrap gap-2">
        {isAdmin ? (
          <>
            {onViewSubmissions && (
              <button
                type="button"
                onClick={() => onViewSubmissions(application)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Başvuranlar
              </button>
            )}
            {onEdit && !isClosed && (
              <button
                type="button"
                onClick={() => onEdit(application)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
              >
                Düzenle
              </button>
            )}
            {onClose && !isClosed && (
              <button
                type="button"
                onClick={() => onClose(application)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 transition-colors"
              >
                Kapat
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(application)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 transition-colors"
              >
                Sil
              </button>
            )}
          </>
        ) : (
          <>
            {alreadyApplied ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Başvurdunuz
              </span>
            ) : isClosed || isExpired ? (
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                Başvuruya kapalı
              </span>
            ) : (
              onApply && (
                <button
                  type="button"
                  onClick={() => onApply(application)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                >
                  Başvur
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ApplicationCard;
