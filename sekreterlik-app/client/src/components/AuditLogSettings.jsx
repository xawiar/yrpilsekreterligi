import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../config/firebase';

const USE_FIREBASE =
  import.meta.env.VITE_USE_FIREBASE === 'true' ||
  import.meta.env.VITE_USE_FIREBASE === true ||
  String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

const PAGE_SIZE = 30;

const AuditLogSettings = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions] = useState([]);
  const [lastDocs, setLastDocs] = useState({}); // Pagination cursors for Firebase

  // Firebase: Firestore'dan audit loglari oku
  const fetchLogsFirebase = async (p = 1) => {
    try {
      setLoading(true);
      if (!db) {
        setLogs([]);
        return;
      }

      const logsRef = collection(db, 'audit_logs');
      const constraints = [];

      if (actionFilter) {
        constraints.push(where('action', '==', actionFilter));
      }

      constraints.push(orderBy('created_at', 'desc'));

      // Toplam sayfa sayisini hesapla
      try {
        const countSnap = await getCountFromServer(query(logsRef, ...(actionFilter ? [where('action', '==', actionFilter)] : [])));
        const totalCount = countSnap.data().count;
        setTotalPages(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
      } catch {
        // Count basarisiz olursa varsayilan deger
        setTotalPages(1);
      }

      // Cursor-based pagination
      if (p > 1 && lastDocs[p - 1]) {
        constraints.push(startAfter(lastDocs[p - 1]));
      }
      constraints.push(limit(PAGE_SIZE));

      const q = query(logsRef, ...constraints);
      const snapshot = await getDocs(q);

      const fetchedLogs = [];
      let lastDoc = null;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedLogs.push({
          id: docSnap.id,
          ...data,
          created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
        });
        lastDoc = docSnap;
      });

      // Son dokumani bir sonraki sayfa icin sakla
      if (lastDoc) {
        setLastDocs(prev => ({ ...prev, [p]: lastDoc }));
      }

      setLogs(fetchedLogs);
      setPage(p);
    } catch (err) {
      console.error('Firebase audit log fetch error:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Firebase: Benzersiz action degerlerini al
  const fetchActionsFirebase = async () => {
    try {
      if (!db) return;
      const logsRef = collection(db, 'audit_logs');
      // Son 500 kayittan benzersiz action degerlerini cikar
      const q = query(logsRef, orderBy('created_at', 'desc'), limit(500));
      const snapshot = await getDocs(q);
      const actionSet = new Set();
      snapshot.forEach((docSnap) => {
        const action = docSnap.data().action;
        if (action) actionSet.add(action);
      });
      setActions([...actionSet].sort());
    } catch (err) {
      console.error('Firebase audit actions fetch error:', err);
    }
  };

  // Backend: API uzerinden audit loglari oku
  const fetchLogsBackend = async (p = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
      if (actionFilter) params.append('action', actionFilter);

      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setLogs(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setPage(data.pagination?.page || 1);
      }
    } catch (err) {
      console.error('Audit log fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActionsBackend = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/audit-logs/actions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setActions(data.data || []);
      }
    } catch (err) {
      console.error('Audit actions fetch error:', err);
    }
  };

  const fetchLogs = USE_FIREBASE ? fetchLogsFirebase : fetchLogsBackend;
  const fetchActions = USE_FIREBASE ? fetchActionsFirebase : fetchActionsBackend;

  useEffect(() => {
    fetchActions();
    fetchLogs(1);
  }, []);

  useEffect(() => {
    // Filtre degistiginde cursoru sifirla ve ilk sayfadan basla
    if (USE_FIREBASE) {
      setLastDocs({});
    }
    fetchLogs(1);
  }, [actionFilter]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('tr-TR');
    } catch {
      return dateStr;
    }
  };

  const getActionBadgeColor = (action) => {
    if (action?.includes('login')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (action?.includes('create')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (action?.includes('update')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (action?.includes('delete')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Denetim Kayitlari (Audit Log)</h3>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">Tum Islemler</option>
          {actions.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Henuz kayit bulunmuyor.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tarih</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Kullanici</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Islem</th>
                  {USE_FIREBASE ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Varlik Tipi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Varlik ID</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Metod</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Yol</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">IP</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Durum</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {log.user_id ? `#${log.user_id}` : '-'}
                      <span className="text-xs text-gray-500 ml-1">({log.user_type || '-'})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    {USE_FIREBASE ? (
                      <>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{log.entity_type || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{log.entity_id || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{log.method || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{log.path || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{log.ip_address || '-'}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={log.status_code >= 400 ? 'text-red-600' : 'text-green-600'}>
                            {log.status_code || '-'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => fetchLogs(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Onceki
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Sayfa {page} / {totalPages}
            </span>
            <button
              onClick={() => fetchLogs(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Sonraki
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogSettings;
