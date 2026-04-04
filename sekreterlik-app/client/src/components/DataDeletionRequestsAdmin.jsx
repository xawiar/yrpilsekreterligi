import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const DataDeletionRequestsAdmin = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectModal, setRejectModal] = useState({ open: false, id: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getDataDeletionRequests();
      setRequests(response.data || []);
    } catch (err) {
      console.error('Error fetching deletion requests:', err);
      setError('Talepler yuklenirken hata olustu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm('Bu talebi onaylamak istediginize emin misiniz? Uye verileri KALICI olarak silinecektir.')) {
      return;
    }

    try {
      setProcessing(id);
      await ApiService.approveDataDeletionRequest(id);
      await fetchRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Talep onaylanirken hata olustu');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Ret nedeni zorunludur');
      return;
    }

    try {
      setProcessing(rejectModal.id);
      await ApiService.rejectDataDeletionRequest(rejectModal.id, rejectionReason.trim());
      setRejectModal({ open: false, id: null });
      setRejectionReason('');
      await fetchRequests();
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Talep reddedilirken hata olustu');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', label: 'Bekliyor' },
      approved: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', label: 'Onaylandi' },
      rejected: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', label: 'Reddedildi' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <svg className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Veri Silme Talepleri (KVKK)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Uyelerin kisisel verilerinin silinmesine iliskin talepleri yonetin.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Henuz veri silme talebi bulunmamaktadir</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {request.member_name || `Uye #${request.member_id}`}
                    </h4>
                    {getStatusBadge(request.status)}
                  </div>
                  {request.member_tc && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      TC: {request.member_tc} | Tel: {request.member_phone || '-'}
                    </p>
                  )}
                  {request.reason && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      <span className="font-medium">Sebep:</span> {request.reason}
                    </p>
                  )}
                  {request.rejection_reason && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      <span className="font-medium">Ret nedeni:</span> {request.rejection_reason}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Talep tarihi: {new Date(request.created_at).toLocaleDateString('tr-TR', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                    {request.processed_at && (
                      <> | Islem tarihi: {new Date(request.processed_at).toLocaleDateString('tr-TR', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}</>
                    )}
                  </p>
                </div>

                {request.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={processing === request.id}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {processing === request.id ? '...' : 'Onayla'}
                    </button>
                    <button
                      onClick={() => setRejectModal({ open: true, id: request.id })}
                      disabled={processing === request.id}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Reddet
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md mx-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Talebi Reddet
            </h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ret Nedeni <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Talebin reddedilme nedenini yazin..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setRejectModal({ open: false, id: null });
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {processing ? 'Isleniyor...' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataDeletionRequestsAdmin;
