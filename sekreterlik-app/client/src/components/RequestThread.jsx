import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

/** Kategori etiketi */
const CATEGORY_LABELS = {
  'istek': 'İstek',
  'şikayet': 'Şikayet',
  'soru': 'Soru',
  'diğer': 'Diğer'
};

const CATEGORY_STYLES = {
  'istek': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'şikayet': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'soru': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'diğer': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

const STATUS_LABELS = {
  'new': 'Yeni',
  'in_review': 'İncelemede',
  'answered': 'Cevaplandı',
  'closed': 'Kapalı'
};

const STATUS_STYLES = {
  'new': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'in_review': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  'answered': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'closed': 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) {
    return '';
  }
};

/**
 * Talep mesaj thread'i — WhatsApp benzeri.
 * Props:
 *  - requestId: string
 *  - currentUser: { id, name, type: 'member' | 'admin' }
 *  - onClose: () => void   (panel kapatma, talebi kapatma DEĞİL)
 *  - onClosed: () => void  (talep durumu 'closed' olduğunda)
 *  - embedded: bool        (modal yerine panel olarak gömülü göster)
 */
const RequestThread = ({ requestId, currentUser, onClose, onClosed, embedded = false }) => {
  const toast = useToast();
  const [request, setRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [text, setText] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);

  const isClosed = request?.status === 'closed';
  const userType = currentUser?.type === 'admin' ? 'admin' : 'member';

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    if (!requestId) return;
    if (!silent) setLoading(true);
    try {
      const [req, msgs] = await Promise.all([
        ApiService.getRequestById(requestId),
        ApiService.getRequestMessages(requestId)
      ]);
      setRequest(req);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      console.error('loadAll error:', e);
      if (!silent) toast?.error?.('Talep yüklenemedi');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestId, toast]);

  // İlk yükleme + okundu olarak işaretle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadAll(false);
      if (cancelled) return;
      try {
        await ApiService.markRequestRead(requestId, userType);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [requestId, userType, loadAll]);

  // Mesajlar değiştiğinde en alta kaydır
  useEffect(() => {
    const t = setTimeout(scrollToBottom, 40);
    return () => clearTimeout(t);
  }, [messages.length, scrollToBottom]);

  // 15 saniyede bir yenile (polling)
  useEffect(() => {
    if (!requestId) return;
    pollRef.current = setInterval(() => {
      loadAll(true);
    }, 15000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [requestId, loadAll]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const t = text.trim();
    if (!t || sending || isClosed) return;
    setSending(true);
    try {
      const result = await ApiService.sendRequestMessage(requestId, {
        senderId: currentUser.id,
        senderType: userType,
        senderName: currentUser.name,
        text: t
      });
      if (result?.success) {
        setText('');
        await loadAll(true);
        // Gönderen taraf kendi mesajını hemen okumuş sayılır
        try { await ApiService.markRequestRead(requestId, userType); } catch (_) {}
      } else {
        toast?.error?.(result?.message || 'Mesaj gönderilemedi');
      }
    } catch (err) {
      console.error('sendMessage error:', err);
      toast?.error?.('Mesaj gönderilirken hata oluştu');
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const result = await ApiService.closeRequest(requestId, userType);
      if (result?.success) {
        toast?.success?.('Talep kapatıldı');
        setConfirmClose(false);
        await loadAll(true);
        onClosed?.();
      } else {
        toast?.error?.(result?.message || 'Talep kapatılamadı');
      }
    } catch (err) {
      console.error('closeRequest error:', err);
      toast?.error?.('Talep kapatılırken hata oluştu');
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const result = await ApiService.reopenRequest(requestId);
      if (result?.success) {
        toast?.success?.('Talep yeniden açıldı');
        await loadAll(true);
      } else {
        toast?.error?.(result?.message || 'Talep yeniden açılamadı');
      }
    } catch (err) {
      console.error('reopenRequest error:', err);
      toast?.error?.('Talep yeniden açılırken hata oluştu');
    } finally {
      setClosing(false);
    }
  };

  const categoryBadge = useMemo(() => {
    const c = request?.category || 'diğer';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_STYLES[c] || CATEGORY_STYLES['diğer']}`}>
        {CATEGORY_LABELS[c] || 'Diğer'}
      </span>
    );
  }, [request?.category]);

  const statusBadge = useMemo(() => {
    const s = request?.status || 'new';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s] || STATUS_STYLES['new']}`}>
        {STATUS_LABELS[s] || 'Yeni'}
      </span>
    );
  }, [request?.status]);

  const containerClass = embedded
    ? 'flex flex-col h-full w-full bg-white dark:bg-gray-900'
    : 'fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4';

  const innerClass = embedded
    ? 'flex flex-col h-full w-full'
    : 'flex flex-col w-full h-full md:max-w-3xl md:h-[90vh] md:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden';

  return (
    <div
      className={containerClass}
      onClick={embedded ? undefined : (e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={innerClass}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {categoryBadge}
              {statusBadge}
              {userType === 'admin' && request?.memberName && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {request.memberName}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {request?.subject || 'Talep'}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isClosed && (
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                disabled={closing}
                className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-50"
                title="Talebi kapat"
              >
                Kapat
              </button>
            )}
            {isClosed && (
              <button
                type="button"
                onClick={handleReopen}
                disabled={closing}
                className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition disabled:opacity-50"
              >
                {closing ? 'İşleniyor...' : 'Yeniden Aç'}
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                aria-label="Paneli kapat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Kapatma onayı */}
        {confirmClose && !isClosed && (
          <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm text-amber-900 dark:text-amber-200">
                Bu talebi kapatmak istediğinize emin misiniz? Kapatılmış talepler daha sonra yeniden açılabilir.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmClose(false)}
                  disabled={closing}
                  className="px-3 py-1 rounded-md text-xs font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleClose}
                  disabled={closing}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
                >
                  {closing ? 'Kapatılıyor...' : 'Evet, Kapat'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mesaj listesi */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-900"
        >
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
              Yükleniyor...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
              Henüz mesaj yok
            </div>
          ) : (
            messages.map((m) => {
              const mine = String(m.senderId) === String(currentUser?.id) || m.senderType === userType;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-sm ${
                      mine
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md'
                    }`}
                  >
                    {!mine && (
                      <div className={`text-[11px] font-medium mb-0.5 ${
                        m.senderType === 'admin'
                          ? 'text-primary-700 dark:text-primary-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {m.senderName || (m.senderType === 'admin' ? 'Yönetim' : 'Üye')}
                        {m.senderType === 'admin' && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-[10px]">
                            Yönetim
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {m.text}
                    </div>
                    <div className={`text-[10px] mt-1 ${mine ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'} text-right`}>
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          {isClosed ? (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
              Bu talep kapalı. Yeni mesaj göndermek için "Yeniden Aç" butonunu kullanın.
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Mesajınızı yazın... (Enter ile gönder, Shift+Enter yeni satır)"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 max-h-32 disabled:opacity-50"
                style={{ minHeight: '40px' }}
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {sending ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.105 3.105a1.5 1.5 0 011.62-.317l13 5.5a1.5 1.5 0 010 2.736l-13 5.5a1.5 1.5 0 01-2.03-1.844l1.5-4.5a.5.5 0 01.45-.34l6.32-.527a.25.25 0 000-.498l-6.32-.526a.5.5 0 01-.45-.34l-1.5-4.5a1.5 1.5 0 01.41-1.244z" />
                  </svg>
                )}
                Gönder
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestThread;
