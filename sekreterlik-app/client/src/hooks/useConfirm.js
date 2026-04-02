import { useState, useCallback, useEffect, useRef } from 'react';

// Named export — tüm dosyalar { useConfirm } olarak import ediyor
export const useConfirm = () => {
  const [state, setState] = useState({
    isOpen: false,
    title: 'Emin misiniz?',
    message: '',
    confirmText: 'Evet',
    cancelText: 'Vazgeç',
    variant: 'danger',
    resolve: null,
  });

  const resolveRef = useRef(null);

  // Unmount cleanup — açık promise'i resolve(false) ile çöz
  useEffect(() => {
    return () => {
      if (resolveRef.current) {
        resolveRef.current(false);
        resolveRef.current = null;
      }
    };
  }, []);

  const confirm = useCallback(({
    title = 'Emin misiniz?',
    message = 'Bu işlemi gerçekleştirmek istediğinize emin misiniz?',
    confirmText = 'Evet',
    cancelText = 'Vazgeç',
    variant = 'danger',
  } = {}) => {
    // Art arda çağrı koruması — önceki promise'i resolve(false) ile çöz
    if (resolveRef.current) {
      resolveRef.current(false);
    }

    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        variant,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current = null;
    state.resolve?.(true);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    resolveRef.current = null;
    state.resolve?.(false);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  return {
    confirm,
    confirmDialogProps: {
      isOpen: state.isOpen,
      title: state.title,
      message: state.message,
      confirmText: state.confirmText,
      cancelText: state.cancelText,
      variant: state.variant,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
};

// Default export da koru — iki türlü import da çalışsın
export default useConfirm;
