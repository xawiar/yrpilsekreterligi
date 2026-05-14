import React, { useEffect, useRef, useId } from 'react';
import { isMobile } from '../utils/capacitorUtils';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const mobileView = isMobile();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // WCAG 2.1.2: Focus trap + return focus.
  // Modal açılınca odak içeri sıçrar, kapanınca eski elemana döner.
  // Tab tuşu modal sınırları içinde döner (dışarı atmaz).
  useEffect(() => {
    if (!isOpen) return;

    // Açılırken: o anki odaklı elemanı sakla, modal'a odaklan
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog) {
      const firstFocusable = dialog.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable || dialog).focus({ preventScroll: true });
    }

    // Tab tuşunda focus'u modal içinde tut
    const handleTab = (e) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);

    // Kapanınca: önceki odağa geri dön
    return () => {
      document.removeEventListener('keydown', handleTab);
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        try { previousFocusRef.current.focus({ preventScroll: true }); } catch (_) {}
      }
    };
  }, [isOpen]);

  // Mobile scroll lock - Hook'u component'in en üst seviyesinde tutmalıyız
  useEffect(() => {
    if (mobileView && isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen, mobileView]);

  if (!isOpen) return null;

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-md';
      case 'lg':
        return 'max-w-4xl';
      case 'xl':
        return 'max-w-6xl';
      default:
        return 'max-w-2xl';
    }
  };

  // Native mobile görünümü
  if (mobileView) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        style={{
          overscrollBehavior: 'contain',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="bg-white dark:bg-gray-800 rounded-none shadow-2xl w-full h-full overflow-hidden flex flex-col focus:outline-none"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative'
          }}
        >
          {/* Header - Native mobile style */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 flex-shrink-0">
            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 pr-2 flex-1 truncate">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex-shrink-0 active:scale-95"
              aria-label="Kapat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Desktop görünümü
  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-2 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full h-auto ${getSizeClasses()} max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 rounded-t-2xl flex-shrink-0">
          <h2 id={titleId} className="text-xl font-bold text-gray-900 dark:text-gray-100 pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex-shrink-0"
            aria-label="Kapat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 min-h-0 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;