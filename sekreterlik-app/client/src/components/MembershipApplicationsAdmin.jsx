import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import FirebaseApiService from '../utils/FirebaseApiService';
import FirebaseService from '../services/FirebaseService';

const STATUS_MAP = {
  pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  approved: { label: 'Onaylandi', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  interview: { label: 'Gorusmeye Cagrildi', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
};

const MembershipApplicationsAdmin = () => {
  const [applications, setApplications] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [noteModal, setNoteModal] = useState({ open: false, appId: null, action: null });
  const [note, setNote] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (!db) return;

      // Fetch applications
      const appSnapshot = await getDocs(
        query(collection(db, 'membership_applications'), orderBy('created_at', 'desc'))
      );
      const apps = appSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setApplications(apps);

      // Fetch districts for mapping
      const distSnapshot = await getDocs(collection(db, 'districts'));
      const dists = distSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setDistricts(dists);
    } catch (err) {
      console.error('Veri yuklenirken hata:', err);
      showToast('Veriler yuklenirken hata olustu.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDistrictName = (districtId) => {
    if (!districtId) return '-';
    const d = districts.find(x => x.id === districtId);
    return d ? d.name : districtId;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    // Firestore timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openNoteModal = (appId, action) => {
    setNoteModal({ open: true, appId, action });
    setNote('');
  };

  const closeNoteModal = () => {
    setNoteModal({ open: false, appId: null, action: null });
    setNote('');
  };

  const handleAction = async () => {
    const { appId, action } = noteModal;
    if (!appId || !action) return;

    setActionLoading(appId);
    try {
      const appRef = doc(db, 'membership_applications', appId);
      const updateData = {
        status: action,
        admin_note: note.trim() || '',
        updated_at: serverTimestamp(),
      };

      await updateDoc(appRef, updateData);

      // If approved, create member and member_user
      if (action === 'approved') {
        const app = applications.find(a => a.id === appId);
        if (app) {
          try {
            // Create member via FirebaseApiService
            const memberData = {
              name: app.name,
              tc: app.tc,
              phone: app.phone,
              district_id: app.district_id || '',
              status: 'active',
              membership_date: new Date().toISOString().split('T')[0],
              source: 'online_application',
            };

            const newMember = await FirebaseApiService.createMember(memberData);
            const memberId = newMember?.id || newMember;

            if (memberId) {
              showToast(`${app.name} basariyla uye olarak kaydedildi ve kullanici hesabi olusturuldu.`);
            } else {
              showToast(`${app.name} uye olarak kaydedildi.`);
            }
          } catch (memberErr) {
            console.error('Uye olusturma hatasi:', memberErr);
            showToast('Basvuru onaylandi ancak uye olusturulurken hata olustu: ' + memberErr.message, 'error');
          }
        }
      } else if (action === 'rejected') {
        showToast('Basvuru reddedildi.');
      } else if (action === 'interview') {
        showToast('Basvuru gorusmeye cagrildi.');
      }

      // Refresh list
      await fetchData();
      closeNoteModal();
    } catch (err) {
      console.error('Islem hatasi:', err);
      showToast('Islem sirasinda hata olustu: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredApps = filterStatus === 'all'
    ? applications
    : applications.filter(a => a.status === filterStatus);

  const statusCounts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    interview: applications.filter(a => a.status === 'interview').length,
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-green-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Uyelik Basvurulari</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Toplam {applications.length} basvuru ({statusCounts.pending} beklemede)
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Yenile
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'all', label: 'Tumu' },
          { key: 'pending', label: 'Beklemede' },
          { key: 'approved', label: 'Onaylandi' },
          { key: 'rejected', label: 'Reddedildi' },
          { key: 'interview', label: 'Gorusme' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f.label} ({statusCounts[f.key]})
          </button>
        ))}
      </div>

      {/* Applications List */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Basvuru bulunamadi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.map(app => {
            const status = STATUS_MAP[app.status] || STATUS_MAP.pending;
            return (
              <div
                key={app.id}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {app.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span>TC: {app.tc}</span>
                      <span>Tel: {app.phone}</span>
                      <span>Ilce: {getDistrictName(app.district_id)}</span>
                      <span>Tarih: {formatDate(app.created_at)}</span>
                    </div>
                    {app.reason && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        <span className="font-medium">Neden:</span> {app.reason}
                      </p>
                    )}
                    {app.admin_note && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                        <span className="font-medium">Admin Notu:</span> {app.admin_note}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {app.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => openNoteModal(app.id, 'approved')}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Onayla
                      </button>
                      <button
                        onClick={() => openNoteModal(app.id, 'rejected')}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Reddet
                      </button>
                      <button
                        onClick={() => openNoteModal(app.id, 'interview')}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Gorusme
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Modal */}
      {noteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {noteModal.action === 'approved' && 'Basvuruyu Onayla'}
              {noteModal.action === 'rejected' && 'Basvuruyu Reddet'}
              {noteModal.action === 'interview' && 'Gorusmeye Cagir'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {noteModal.action === 'approved' && 'Basvuruyu onayladiginizda otomatik olarak uye kaydedilecek ve kullanici hesabi olusturulacaktir.'}
              {noteModal.action === 'rejected' && 'Bu basvuruyu reddetmek istediginizden emin misiniz?'}
              {noteModal.action === 'interview' && 'Basvuru sahibi gorusmeye cagrilacaktir.'}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Not ekleyin (opsiyonel)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none mb-4 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={closeNoteModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  noteModal.action === 'approved'
                    ? 'bg-green-600 hover:bg-green-700'
                    : noteModal.action === 'rejected'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {actionLoading ? 'Isleniyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipApplicationsAdmin;
