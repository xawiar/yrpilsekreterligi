import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const DataDeletionRequestButton = ({ memberId }) => {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingRequests, setExistingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  useEffect(() => {
    if (memberId) {
      fetchMyRequests();
    }
  }, [memberId]);

  const fetchMyRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await ApiService.getMyDataDeletionRequests(memberId);
      setExistingRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching deletion requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Lutfen silme talebinizin nedenini yaziniz.');
      return;
    }

    try {
      setSubmitting(true);
      await ApiService.createDataDeletionRequest(memberId, reason.trim());
      setShowModal(false);
      setReason('');
      await fetchMyRequests();
    } catch (error) {
      alert(error.message || 'Talep olusturulurken hata olustu');
    } finally {
      setSubmitting(false);
    }
  };

  const hasPendingRequest = existingRequests.some(r => r.status === 'pending');

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', label: 'Bekliyor' },
      approved: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', label: 'Onaylandi' },
      rejected: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', label: 'Reddedildi' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loadingRequests) return null;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            KVKK - Kisisel Veri Haklari
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            6698 sayili KVKK kapsaminda kisisel verilerinizin silinmesini talep edebilirsiniz.
          </p>
        </div>
        <div className="p-6">
          {/* Mevcut talepler */}
          {existingRequests.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mevcut Talepleriniz:</p>
              {existingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {new Date(req.created_at).toLocaleDateString('tr-TR', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </span>
                    {req.rejection_reason && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Ret nedeni: {req.rejection_reason}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(req.status)}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowModal(true)}
            disabled={hasPendingRequest}
            className={`inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
              hasPendingRequest
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {hasPendingRequest ? 'Bekleyen Talep Mevcut' : 'Verilerimin Silinmesini Talep Et'}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Aydinlatma Metni
            </a>
            {' '}kapsaminda haklariniz hakkinda bilgi alabilirsiniz.
          </p>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Veri Silme Talebi</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Bu islem geri alinamaz</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>Uyari:</strong> Bu talebiniz admin tarafindan onaylandiginda tum kisisel verileriniz kalici olarak silinecektir.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Silme Talebi Nedeniniz
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Verilerinizin silinmesini neden talep ediyorsunuz?"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Gonderiliyor...' : 'Talebi Gonder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DataDeletionRequestButton;
