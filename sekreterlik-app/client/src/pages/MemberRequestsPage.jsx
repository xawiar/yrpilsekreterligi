import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';
import RequestNewModal from '../components/RequestNewModal';
import RequestThread from '../components/RequestThread';

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

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'open', label: 'Açık' },
  { key: 'closed', label: 'Kapalı' }
];

const formatRelative = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'az önce';
    if (min < 60) return `${min} dk önce`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} sa önce`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} gün önce`;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (_) { return ''; }
};

/**
 * Üyenin kendi taleplerini listelediği sayfa.
 * Route önerisi: /my-requests
 */
const MemberRequestsPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const memberId = user?.id || user?.uid || user?.memberId || null;
  const memberName = user?.name || user?.fullName || user?.ad_soyad || 'Üye';

  const load = useCallback(async () => {
    if (!memberId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await ApiService.getRequests({ memberId });
      setRequests(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('MemberRequestsPage load error:', e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  // 30 saniyede bir arka planda yenile
  useEffect(() => {
    if (!memberId) return;
    const id = setInterval(() => {
      ApiService.getRequests({ memberId })
        .then((list) => setRequests(Array.isArray(list) ? list : []))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [memberId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return requests;
    if (filter === 'closed') return requests.filter(r => r.status === 'closed');
    return requests.filter(r => r.status !== 'closed');
  }, [requests, filter]);

  const handleCreated = async () => {
    await load();
  };

  const handleThreadClosed = async () => {
    await load();
  };

  const handleRowClick = async (r) => {
    setSelectedId(r.id);
    // Üye bu talebi açtığında, okunmamış sayacı sıfırlansın
    try {
      if (r.unreadByMember > 0) {
        // Optimistic update
        setRequests((prev) => prev.map(x => x.id === r.id ? { ...x, unreadByMember: 0 } : x));
      }
    } catch (_) {}
  };

  const selectedRequest = selectedId ? requests.find(r => r.id === selectedId) : null;

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Taleplerim
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              İstek, şikayet, soru ve diğer talepleriniz
            </p>
          </div>
          <button
            onClick={() => setNewModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Yeni Talep
          </button>
        </div>

        {/* Filtre */}
        <div className="inline-flex rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition ${
                filter === f.key
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Yükleniyor...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Henüz talep yok. Yeni bir talep oluşturmak için yukarıdaki butonu kullanın.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((r) => {
                const cat = r.category || 'diğer';
                const status = r.status || 'new';
                const unread = Number(r.unreadByMember || 0);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => handleRowClick(r)}
                      className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_STYLES[cat] || CATEGORY_STYLES['diğer']}`}>
                              {CATEGORY_LABELS[cat] || 'Diğer'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES['new']}`}>
                              {STATUS_LABELS[status] || 'Yeni'}
                            </span>
                            {unread > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                                {unread} yeni
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {r.subject || 'Başlıksız'}
                          </h3>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            Son mesaj: {formatRelative(r.lastMessageAt || r.createdAtISO)}
                          </p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Yeni talep modal */}
      <RequestNewModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        member={{ id: memberId, name: memberName }}
        onCreated={handleCreated}
      />

      {/* Thread modal (fullscreen) */}
      {selectedRequest && (
        <RequestThread
          requestId={selectedRequest.id}
          currentUser={{ id: memberId, name: memberName, type: 'member' }}
          onClose={() => { setSelectedId(null); load(); }}
          onClosed={handleThreadClosed}
        />
      )}
    </div>
  );
};

export default MemberRequestsPage;
