import React, { useEffect, useCallback, useRef, useState } from 'react';
import { isMobile } from '../../utils/capacitorUtils';

const ConfirmDialog = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Emin misiniz?',
  message = 'Bu işlemi gerçekleştirmek istediğinize emin misiniz?',
  confirmText = 'Evet',
  cancelText = 'Vazgeç',
  variant = 'danger',
}) => {
  const mobileView = isMobile();
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useRef(`confirm-title-${Date.now()}`).current;
  const descId = useRef(`confirm-desc-${Date.now()}`).current;

  const handleConfirm = useCallback(() => {
    if (confirming) return;
    setConfirming(true);
    onConfirm();
  }, [onConfirm, confirming]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  // Reset confirming state when dialog closes
  useEffect(() => {
    if (!isOpen) setConfirming(false);
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleCancel]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Focus trap — açılınca cancel butonuna focus ver
  useEffect(() => {
    if (isOpen && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [isOpen]);

  // Tab key focus trap
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current.querySelectorAll('button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmButtonClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed';

  const iconBg = variant === 'danger'
    ? 'bg-red-100 dark:bg-red-900/30'
    : 'bg-indigo-100 dark:bg-indigo-900/30';

  const iconColor = variant === 'danger'
    ? 'text-red-600 dark:text-red-400'
    : 'text-indigo-600 dark:text-indigo-400';

  const icon = variant === 'danger' ? (
    <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ) : (
    <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-[10001] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`bg-white dark:bg-gray-800 shadow-xl w-full ${
          mobileView ? 'max-w-sm mx-4 rounded-2xl' : 'max-w-md rounded-2xl'
        } overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${iconBg}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
              <p id={descId} className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{message}</p>
            </div>
          </div>
        </div>
        <div className={`px-6 pb-6 flex gap-3 ${mobileView ? 'flex-col-reverse' : 'justify-end'}`}>
          <button
            ref={cancelRef}
            onClick={handleCancel}
            className={`px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 ${
              mobileView ? 'w-full min-h-[44px]' : ''
            }`}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmButtonClass} ${
              mobileView ? 'w-full min-h-[44px]' : ''
            }`}
          >
            {confirming ? 'İşleniyor...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
