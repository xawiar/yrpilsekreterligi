import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import FirebaseApiService from '../utils/FirebaseApiService';

/**
 * Admin tarafı: Üyelerin profil (TC/Telefon) değişiklik taleplerini yönetir.
 * Route: /admin/profile-requests (entegrasyonu App.jsx içinde yapılacak)
 */
const AdminProfileRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [memberNames, setMemberNames] = useState({}); // memberId -> "Ad Soyad"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | approved | rejected
  const [processing, setProcessing] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null });
  const [adminNote, setAdminNote] = useState('');

  const mask = (value) => {
    if (!value) return '—';
    const digits = String(value).replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    return digits.replace(/^(\d{3})\d+(\d{2})$/, '$1******$2');
  };

  const fetchRequests = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const filters = statusFilter === 'all' ? {} : { status: statusFilter };
      const list = await ApiService.getProfileUpdateRequests(filters);
      const arr = Array.isArray(list) ? list : [];
      setRequests(arr);

      // Üye adlarını çek (paralel)
      const uniqueIds = [...new Set(arr.map(r => r.memberId).filter(Boolean))];
      const names = {};
      await Promise.all(uniqueIds.map(async (id) => {
        try {
          const m = await FirebaseApiService.getMemberById(id);
          if (m) {
            const full = [m.name, m.surname].filter(Boolean).join(' ').trim();
            names[String(id)] = full || `Üye #${id}`;
          } else {
            names[String(id)] = `Üye #${id}`;
          }
        } catch {
          names[String(id)] = `Üye #${id}`;
        }
      }));
      setMemberNames(names);
    } catch (e) {
      console.error('AdminProfileRequestsPage fetch error:', e);
      setError('Talepler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id) => {
    if (!window.confirm('Bu talebi onaylamak istediğinize emin misiniz?\n\nOnaylarsanız üye bilgileri (TC / Telefon) güncellenecek ve giriş bilgileri değişecektir.')) {
      return;
    }
    try {
      setProcessing(id);
      const resp = await ApiService.approveProfileUpdateRequest(id);
      if (resp?.success) {
        await fetchRequests();
      } else {
        alert(resp?.message || 'Talep onaylanırken hata oluştu');
      }
    } catch (e) {
      console.error('approve error:', e);
      alert('Talep onaylanırken hata oluştu: ' + (e?.message || ''));
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectClick = (id) => {
    setRejectModal({ open: true, id });
    setAdminNote('');
  };

  const handleRejectSubmit = async () => {
    if (!adminNote.trim()) {
      alert('Red nedeni zorunludur');
      return;
    }
    try {
      setProcessing(rejectModal.id);
      const resp = await ApiService.rejectProfileUpdateRequest(rejectModal.id, adminNote.trim());
      if (resp?.success) {
        setRejectModal({ open: false, id: null });
        setAdminNote('');
        await fetchRequests();
      } else {
        alert(resp?.message || 'Talep reddedilirken hata oluştu');
      }
    } catch (e) {
      console.error('reject error:', e);
      alert('Talep reddedilirken hata oluştu: ' + (e?.message || ''));
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', label: 'Beklemede' },
      approved: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-200', label: 'Onaylandı' },
      rejected: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-200', label: 'Reddedildi' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
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

  const filters = [
    { key: 'all', label: 'Tümü' },
    { key: 'pending', label: 'Bekleyen' },
    { key: 'approved', label: 'Onaylanan' },
    { key: 'rejected', label: 'Reddedilen' }
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Başlık */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <svg className="w-6 h-6 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Profil Değişiklik Talepleri
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Üyelerin TC ve telefon numarası değişiklik taleplerini buradan onaylayabilir veya reddedebilirsiniz.
        </p>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={fetchRequests}
          className="ml-auto px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Yenile
        </button>
      </div>

      {/* Hata */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
          <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Gösterilecek profil değişiklik talebi bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const tcChanged = req.newTc && req.newTc !== req.currentTc;
            const phoneChanged = req.newPhone && req.newPhone !== req.currentPhone;
            const memberName = memberNames[String(req.memberId)] || `Üye #${req.memberId}`;

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {memberName}
                      </h4>
                      {getStatusBadge(req.status)}
                    </div>

                    <div className="space-y-1 text-sm">
                      {tcChanged && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">TC:</span>
                          <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {mask(req.currentTc)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold">
                            {mask(req.newTc)}
                          </span>
                        </div>
                      )}
                      {phoneChanged && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Telefon:</span>
                          <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {mask(req.currentPhone)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold">
                            {mask(req.newPhone)}
                          </span>
                        </div>
                      )}
                    </div>

                    {req.reason && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        <span className="font-medium">Sebep:</span> {req.reason}
                      </p>
                    )}

                    {req.adminNote && (
                      <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                        <p className="text-xs text-red-700 dark:text-red-300">
                          <span className="font-medium">Admin Notu:</span> {req.adminNote}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Talep: {formatDate(req.createdAt)}
                      {req.processedAt && (
                        <> | İşlem: {formatDate(req.processedAt)}</>
                      )}
                    </p>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={processing === req.id}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processing === req.id ? '...' : 'Onayla'}
                      </button>
                      <button
                        onClick={() => handleRejectClick(req.id)}
                        disabled={processing === req.id}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        Reddet
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Red Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Talebi Reddet
            </h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Red Nedeni <span className="text-red-500">*</span>
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder="Talebin reddedilme nedenini yazın..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => { setRejectModal({ open: false, id: null }); setAdminNote(''); }}
                disabled={processing !== null}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={processing !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {processing !== null ? 'İşleniyor...' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfileRequestsPage;
