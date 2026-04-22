import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import ApplicationCard from './ApplicationCard';
import ApplicationSubmitModal from './ApplicationSubmitModal';

/**
 * Üyenin dashboard'unda göreceği "Başvurular" paneli.
 * - Aktif kampanyaları listeler
 * - Üye kendi başvuru durumlarını görür (pending/approved/rejected)
 *
 * Props:
 *  - member: { id, firstName, lastName, full_name, ... }
 */

const STATUS_BADGES = {
  pending: {
    label: 'Beklemede',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  },
  approved: {
    label: 'Onaylandı',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  },
  rejected: {
    label: 'Reddedildi',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  }
};

const formatDateTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

const MemberApplicationsPanel = ({ member }) => {
  const [applications, setApplications] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!member?.id) return;
    setLoading(true);
    try {
      const [apps, subs] = await Promise.all([
        ApiService.getActiveApplicationsForMember(member.id),
        ApiService.getSubmissions({ memberId: member.id })
      ]);
      setApplications(Array.isArray(apps) ? apps : []);
      setMySubmissions(Array.isArray(subs) ? subs : []);
    } catch (err) {
      console.error('Başvurular yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, [member?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submittedAppIds = new Set(mySubmissions.map(s => String(s.applicationId)));

  const handleApply = (application) => {
    setSelectedApp(application);
    setModalOpen(true);
  };

  const handleSubmitted = () => {
    loadData();
  };

  if (!member?.id) return null;

  return (
    <div className="space-y-6">
      {/* Aktif kampanyalar */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Aktif Başvurular
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Şu anda başvurabileceğiniz kampanyalar
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title="Yenile"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Yükleniyor...
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Şu anda aktif bir başvuru kampanyası bulunmuyor.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {applications.map(app => (
              <ApplicationCard
                key={app.id}
                application={app}
                onApply={handleApply}
                alreadyApplied={submittedAppIds.has(String(app.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Kendi başvurularım */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Başvurularım
        </h2>

        {loading ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            Yükleniyor...
          </div>
        ) : mySubmissions.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            Henüz hiçbir başvuru göndermediniz.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {mySubmissions.map(sub => {
              const badge = STATUS_BADGES[sub.status] || STATUS_BADGES.pending;
              const parentApp = applications.find(a => String(a.id) === String(sub.applicationId));
              return (
                <li key={sub.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {parentApp?.title || 'Başvuru'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Gönderildi: {formatDateTime(sub.submittedAt)}
                    </div>
                    {sub.adminNote && (
                      <div className="mt-2 text-xs p-2 rounded bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                        <b>Yönetici notu:</b> {sub.adminNote}
                      </div>
                    )}
                    {sub.attachmentName && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Ek dosya: {sub.attachmentName}
                      </div>
                    )}
                  </div>
                  <span className={`self-start inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Başvuru modal'ı */}
      <ApplicationSubmitModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        application={selectedApp}
        member={member}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
};

export default MemberApplicationsPanel;
