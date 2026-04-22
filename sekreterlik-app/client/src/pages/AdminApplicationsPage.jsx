import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ApiService from '../utils/ApiService';
import ApplicationCard from '../components/ApplicationCard';
import ApplicationFormModal from '../components/ApplicationFormModal';
import Modal from '../components/Modal';

/**
 * Admin — Başvuru Kampanyaları Yönetim Sayfası
 * Route: /admin/applications  (App.jsx'e entegrasyon ana ajan tarafından yapılır)
 *
 * Sekmeler:
 *  - Aktif Kampanyalar
 *  - Kapalı Kampanyalar
 *  - Başvurular (tüm submissions — onay/red)
 */

const TABS = [
  { key: 'active', label: 'Aktif Kampanyalar' },
  { key: 'closed', label: 'Kapalı Kampanyalar' },
  { key: 'submissions', label: 'Başvurular' }
];

const STATUS_LABELS = {
  pending: { label: 'Beklemede', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  approved: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' }
};

const SUB_STATUS_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Beklemede' },
  { key: 'approved', label: 'Onaylandı' },
  { key: 'rejected', label: 'Reddedildi' }
];

const formatDateTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '-';
  }
};

const AdminApplicationsPage = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [applications, setApplications] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);

  // Reject note modal
  const [rejectModal, setRejectModal] = useState({ open: false, sub: null });
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  // Campaign filter for submissions tab
  const [subCampaignFilter, setSubCampaignFilter] = useState('all');
  const [subStatusFilter, setSubStatusFilter] = useState('all');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadApplications = useCallback(async () => {
    try {
      const data = await ApiService.getApplications();
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Kampanyalar yüklenemedi:', err);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    try {
      const data = await ApiService.getSubmissions();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Başvurular yüklenemedi:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadApplications(), loadSubmissions()]);
    setLoading(false);
  }, [loadApplications, loadSubmissions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeApps = useMemo(
    () => applications.filter(a => a.status !== 'closed'),
    [applications]
  );
  const closedApps = useMemo(
    () => applications.filter(a => a.status === 'closed'),
    [applications]
  );

  const filteredSubmissions = useMemo(() => {
    let list = submissions;
    if (subCampaignFilter !== 'all') {
      list = list.filter(s => String(s.applicationId) === String(subCampaignFilter));
    }
    if (subStatusFilter !== 'all') {
      list = list.filter(s => s.status === subStatusFilter);
    }
    return list;
  }, [submissions, subCampaignFilter, subStatusFilter]);

  // ---- Kampanya aksiyonları
  const handleNew = () => {
    setEditingApp(null);
    setFormOpen(true);
  };

  const handleEdit = (app) => {
    setEditingApp(app);
    setFormOpen(true);
  };

  const handleClose = async (app) => {
    if (!window.confirm(`"${app.title}" başvurusu kapatılacak. Onaylıyor musunuz?`)) return;
    const res = await ApiService.closeApplication(app.id);
    if (res?.success) {
      showToast('Başvuru kapatıldı');
      loadApplications();
    } else {
      showToast(res?.message || 'Kapatılamadı', 'error');
    }
  };

  const handleDelete = async (app) => {
    if (!window.confirm(`"${app.title}" kampanyası kalıcı olarak silinecek. Onaylıyor musunuz?`)) return;
    const res = await ApiService.deleteApplication(app.id);
    if (res?.success) {
      showToast('Kampanya silindi');
      loadApplications();
    } else {
      showToast(res?.message || 'Silinemedi', 'error');
    }
  };

  const handleViewSubmissions = (app) => {
    setSubCampaignFilter(String(app.id));
    setSubStatusFilter('all');
    setActiveTab('submissions');
  };

  // ---- Submission aksiyonları
  const handleApprove = async (sub) => {
    if (!window.confirm('Bu başvuruyu onaylıyor musunuz?')) return;
    const res = await ApiService.processSubmission(sub.id, 'approved', null);
    if (res?.success) {
      showToast('Başvuru onaylandı');
      loadSubmissions();
    } else {
      showToast(res?.message || 'Onaylanamadı', 'error');
    }
  };

  const openReject = (sub) => {
    setRejectModal({ open: true, sub });
    setRejectNote('');
  };

  const handleReject = async () => {
    const sub = rejectModal.sub;
    if (!sub) return;
    setRejectSaving(true);
    try {
      const res = await ApiService.processSubmission(sub.id, 'rejected', rejectNote.trim() || null);
      if (res?.success) {
        showToast('Başvuru reddedildi');
        setRejectModal({ open: false, sub: null });
        setRejectNote('');
        loadSubmissions();
      } else {
        showToast(res?.message || 'Reddedilemedi', 'error');
      }
    } finally {
      setRejectSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 min-w-[260px] max-w-md rounded-lg shadow-lg p-3 text-sm border ${
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Başvuru Kampanyaları
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Üyelere açılan başvuruları yönetin ve başvuranları değerlendirin
          </p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Başvuru Kampanyası
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {TABS.map(tab => {
            const count =
              tab.key === 'active' ? activeApps.length :
              tab.key === 'closed' ? closedApps.length :
              submissions.length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Yükleniyor...
        </div>
      ) : activeTab === 'active' ? (
        activeApps.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Aktif başvuru kampanyası yok. Yeni bir kampanya oluşturun.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeApps.map(app => (
              <ApplicationCard
                key={app.id}
                application={app}
                isAdmin
                onEdit={handleEdit}
                onClose={handleClose}
                onDelete={handleDelete}
                onViewSubmissions={handleViewSubmissions}
              />
            ))}
          </div>
        )
      ) : activeTab === 'closed' ? (
        closedApps.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Kapalı başvuru kampanyası yok.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {closedApps.map(app => (
              <ApplicationCard
                key={app.id}
                application={app}
                isAdmin
                onDelete={handleDelete}
                onViewSubmissions={handleViewSubmissions}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Filtreler */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <select
              value={subCampaignFilter}
              onChange={(e) => setSubCampaignFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">Tüm Kampanyalar</option>
              {applications.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>

            <div className="flex gap-1 flex-wrap">
              {SUB_STATUS_FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSubStatusFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    subStatusFilter === f.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadSubmissions}
              className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Yenile
            </button>
          </div>

          {/* Submissions tablosu */}
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Kriterlere uygun başvuru yok.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Üye</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kampanya</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gönderim</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Durum</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ek</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredSubmissions.map(sub => {
                    const parent = applications.find(a => String(a.id) === String(sub.applicationId));
                    const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.pending;
                    return (
                      <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {sub.memberName || '-'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs line-clamp-2">
                            {sub.answer}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {parent?.title || sub.applicationId}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDateTime(sub.submittedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                          {sub.adminNote && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs line-clamp-2">
                              Not: {sub.adminNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sub.attachmentUrl ? (
                            <a
                              href={sub.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                              title={sub.attachmentName || 'Dosya'}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                              </svg>
                              İndir
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sub.status === 'pending' ? (
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleApprove(sub)}
                                className="px-2.5 py-1 text-xs font-medium rounded bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 text-green-800 dark:text-green-200"
                              >
                                Onayla
                              </button>
                              <button
                                type="button"
                                onClick={() => openReject(sub)}
                                className="px-2.5 py-1 text-xs font-medium rounded bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-800 dark:text-red-200"
                              >
                                Reddet
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {formatDateTime(sub.processedAt)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Form modalı */}
      <ApplicationFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        application={editingApp}
        onSaved={() => { loadApplications(); showToast(editingApp ? 'Güncellendi' : 'Oluşturuldu'); }}
      />

      {/* Red notu modalı */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, sub: null })}
        title="Başvuruyu Reddet"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <b>{rejectModal.sub?.memberName}</b> kullanıcısının başvurusunu reddedeceksiniz. İsterseniz bir not ekleyebilirsiniz (üye görecek).
          </p>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Red gerekçesi (opsiyonel)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectModal({ open: false, sub: null })}
              disabled={rejectSaving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={rejectSaving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {rejectSaving ? 'Kaydediliyor...' : 'Reddet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminApplicationsPage;
