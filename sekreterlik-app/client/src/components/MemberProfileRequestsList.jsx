import React, { useState, useEffect, useCallback, useRef } from 'react';
import ApiService from '../utils/ApiService';

/**
 * Üyenin kendi profil değişiklik taleplerini listeleyen bileşen.
 * Otomatik olarak 60 saniyede bir yenilenir.
 *
 * @param {Object} props
 * @param {string|number} props.memberId Üyenin ID'si
 */
const MemberProfileRequestsList = ({ memberId }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  const mask = (value) => {
    if (!value) return '—';
    const digits = String(value).replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    return digits.replace(/^(\d{3})\d+(\d{2})$/, '$1******$2');
  };

  const fetchRequests = useCallback(async () => {
    if (!memberId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      setError('');
      const data = await ApiService.getProfileUpdateRequests({ memberId });
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('MemberProfileRequestsList fetch error:', e);
      setError('Talepler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    setLoading(true);
    fetchRequests();
    // 60 saniyede bir otomatik yenile
    intervalRef.current = setInterval(fetchRequests, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchRequests]);

  const getStatusBadge = (status) => {
    const badges = {
      pending: {
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        text: 'text-amber-800 dark:text-amber-200',
        label: 'Beklemede'
      },
      approved: {
        bg: 'bg-green-100 dark:bg-green-900/40',
        text: 'text-green-800 dark:text-green-200',
        label: 'Onaylandı'
      },
      rejected: {
        bg: 'bg-red-100 dark:bg-red-900/40',
        text: 'text-red-800 dark:text-red-200',
        label: 'Reddedildi'
      }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('tr-TR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Taleplerim
        </h4>
        <button
          onClick={fetchRequests}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          title="Listeyi yenile"
        >
          Yenile
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {requests.length === 0 && !error ? (
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Henüz bir profil değişiklik talebiniz bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const tcChanged = req.newTc && req.newTc !== req.currentTc;
            const phoneChanged = req.newPhone && req.newPhone !== req.currentPhone;

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(req.createdAt)}
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                <div className="space-y-1 text-sm">
                  {tcChanged && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 text-xs">TC:</span>
                      <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                        {mask(req.currentTc)}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">
                        {mask(req.newTc)}
                      </span>
                    </div>
                  )}
                  {phoneChanged && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Telefon:</span>
                      <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                        {mask(req.currentPhone)}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">
                        {mask(req.newPhone)}
                      </span>
                    </div>
                  )}
                </div>

                {req.reason && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Sebep:</span> {req.reason}
                  </p>
                )}

                {req.status === 'rejected' && req.adminNote && (
                  <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      <span className="font-medium">Admin Notu:</span> {req.adminNote}
                    </p>
                  </div>
                )}

                {req.processedAt && (
                  <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                    İşlem tarihi: {formatDate(req.processedAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MemberProfileRequestsList;
