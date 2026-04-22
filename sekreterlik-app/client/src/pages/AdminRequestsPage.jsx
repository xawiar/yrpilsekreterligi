import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';
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
 * Admin tarafı — tüm talepleri yönetir.
 * Route önerisi: /admin/requests
 */
const AdminRequestsPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const adminId = user?.id || user?.uid || 'admin';
  const adminName = user?.name || user?.fullName || 'Yönetim';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ApiService.getRequests({});
      setRequests(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('AdminRequestsPage load error:', e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Arka planda 30sn'de bir yenile
  useEffect(() => {
    const id = setInterval(() => {
      ApiService.getRequests({})
        .then((list) => setRequests(Array.isArray(list) ? list : []))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    let arr = requests;
    if (categoryFilter !== 'all') arr = arr.filter(r => r.category === categoryFilter);
    if (statusFilter !== 'all') arr = arr.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(r =>
        (r.memberName || '').toLowerCase().includes(q) ||
        (r.subject || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [requests, categoryFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const total = requests.length;
    const unreadSum = requests.reduce((s, r) => s + Number(r.unreadByAdmin || 0), 0);
    const open = requests.filter(r => r.status !== 'closed').length;
    const closed = requests.filter(r => r.status === 'closed').length;
    return { total, unreadSum, open, closed };
  }, [requests]);

  const handleRowClick = (r) => {
    setSelectedId(r.id);
    // Optimistic: admin okudu
    if (Number(r.unreadByAdmin || 0) > 0) {
      setRequests((prev) => prev.map(x => x.id === r.id ? { ...x, unreadByAdmin: 0 } : x));
    }
  };

  const selectedRequest = selectedId ? requests.find(r => r.id === selectedId) : null;

  const selectClass = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Talepler & Şikayetler
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Üyelerden gelen tüm talepler burada yönetilir
          </p>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Toplam</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Açık</div>
            <div className="text-xl font-bold text-sky-600 dark:text-sky-400">{stats.open}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Kapalı</div>
            <div className="text-xl font-bold text-gray-600 dark:text-gray-300">{stats.closed}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Okunmamış</div>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.unreadSum}</div>
          </div>
        </div>

        {/* Filtreler */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kategori</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${selectClass} w-full`}>
                <option value="all">Tümü</option>
                <option value="istek">İstek</option>
                <option value="şikayet">Şikayet</option>
                <option value="soru">Soru</option>
                <option value="diğer">Diğer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Durum</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${selectClass} w-full`}>
                <option value="all">Tümü</option>
                <option value="new">Yeni</option>
                <option value="in_review">İncelemede</option>
                <option value="answered">Cevaplandı</option>
                <option value="closed">Kapalı</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ara</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Üye adı veya başlık..."
                className={`${selectClass} w-full`}
              />
            </div>
          </div>
        </div>

        {/* Liste */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Yükleniyor...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Eşleşen talep bulunamadı.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((r) => {
                const cat = r.category || 'diğer';
                const status = r.status || 'new';
                const unread = Number(r.unreadByAdmin || 0);
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
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {r.subject || 'Başlıksız'}
                            </h3>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              — {r.memberName || 'Anonim'}
                            </span>
                          </div>
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

      {selectedRequest && (
        <RequestThread
          requestId={selectedRequest.id}
          currentUser={{ id: adminId, name: adminName, type: 'admin' }}
          onClose={() => { setSelectedId(null); load(); }}
          onClosed={load}
        />
      )}
    </div>
  );
};

export default AdminRequestsPage;
