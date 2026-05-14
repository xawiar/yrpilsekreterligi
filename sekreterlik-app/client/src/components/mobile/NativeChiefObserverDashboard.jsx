/**
 * Native Mobile Chief Observer Dashboard Component
 * Başmüşahit dashboard'u için native mobil görünümü
 */
import React from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

// Kategori-bazlı durum hesabı (web ile birebir aynı mantık)
// Durum: 'not_entered' | 'pending' | 'approved' | 'rejected'
const getCategoryStatus = (r, category) => {
  if (!r) return { status: 'not_entered', reason: null };
  if (category === 'cb') {
    if (r.cb_status === 'rejected') return { status: 'rejected', reason: r.cb_rejection_reason || null };
    const has = (r.cb_votes && Object.keys(r.cb_votes).length > 0) || !!r.signed_protocol_photo;
    if (!has) return { status: 'not_entered', reason: null };
    if (r.cb_status === 'approved') return { status: 'approved', reason: null };
    return { status: 'pending', reason: null };
  }
  if (category === 'mv') {
    if (r.mv_status === 'rejected') return { status: 'rejected', reason: r.mv_rejection_reason || null };
    const has = (r.mv_votes && Object.keys(r.mv_votes).length > 0) || !!r.signed_mv_protocol_photo;
    if (!has) return { status: 'not_entered', reason: null };
    if (r.mv_status === 'approved') return { status: 'approved', reason: null };
    return { status: 'pending', reason: null };
  }
  if (r.approval_status === 'rejected') return { status: 'rejected', reason: r.rejection_reason || null };
  const mayorHas = r.mayor_votes && Object.keys(r.mayor_votes).length > 0;
  const provincialHas = r.provincial_assembly_votes && Object.keys(r.provincial_assembly_votes).length > 0;
  const municipalHas = r.municipal_council_votes && Object.keys(r.municipal_council_votes).length > 0;
  const referendumHas = r.referendum_votes && Object.keys(r.referendum_votes).some(k => r.referendum_votes[k] > 0);
  const partyHas = r.party_votes && Object.keys(r.party_votes).length > 0;
  const cbSoloHas = (r.cb_votes && Object.keys(r.cb_votes).length > 0) || !!r.signed_protocol_photo;
  const mvSoloHas = (r.mv_votes && Object.keys(r.mv_votes).length > 0) || !!r.signed_mv_protocol_photo;
  const has = mayorHas || provincialHas || municipalHas || referendumHas || partyHas || cbSoloHas || mvSoloHas;
  if (!has) return { status: 'not_entered', reason: null };
  if (r.approval_status === 'approved') return { status: 'approved', reason: null };
  return { status: 'pending', reason: null };
};

const STATUS_META = {
  not_entered: { label: 'Henüz Girilmedi', icon: '⏳', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200' },
  pending:     { label: 'Onay Bekliyor',   icon: '🟡', bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-900 dark:text-yellow-100' },
  approved:    { label: 'Onaylandı',       icon: '✅', bg: 'bg-green-100 dark:bg-green-900/40',  text: 'text-green-900 dark:text-green-100' },
  rejected:    { label: 'Reddedildi — Tekrar Gir', icon: '🔴', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-900 dark:text-red-100' },
};

const StatusBadge = ({ status, prefix, reason }) => {
  const meta = STATUS_META[status] || STATUS_META.not_entered;
  return (
    <div className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg ${meta.bg} ${meta.text} font-semibold text-xs`}>
      <span className="flex items-center gap-1.5">
        <span>{meta.icon}</span>
        {prefix && <span className="opacity-80">{prefix}:</span>}
        <span>{meta.label}</span>
      </span>
      {status === 'rejected' && reason && (
        <span className="font-normal opacity-90 text-[11px] leading-tight">
          Sebep: {reason}
        </span>
      )}
    </div>
  );
};

const NativeChiefObserverDashboard = ({
  elections = [],
  electionResults = {},
  institutionSupervisor = null,
  regionSupervisor = null,
  onElectionClick,
  formatDate = (d) => d,
  getTypeLabel = (t) => t,
  getTypeColor = (t) => 'from-gray-500 to-gray-600',
  getDaysUntil = (d) => null,
  loading = false
}) => {
  const electionStatusFor = (election) => {
    const r = electionResults[election.id];
    if (election?.type === 'genel') {
      return { type: 'multi', cb: getCategoryStatus(r, 'cb'), mv: getCategoryStatus(r, 'mv') };
    }
    return { type: 'single', overall: getCategoryStatus(r, null) };
  };

  const isElectionDone = (e) => {
    const s = electionStatusFor(e);
    if (s.type === 'multi') {
      const ok = (st) => st === 'pending' || st === 'approved';
      return ok(s.cb.status) && ok(s.mv.status);
    }
    return s.overall.status === 'pending' || s.overall.status === 'approved';
  };

  const completedCount = elections.filter(isElectionDone).length;
  const pendingCount = elections.length - completedCount;

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Başmüşahit Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-base">
          Seçim sonuçlarınızı girin
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
            {completedCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Tamamlanan
          </div>
        </NativeCard>

        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
            {pendingCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Bekleyen
          </div>
        </NativeCard>
      </div>

      {/* Üst Sorumlular */}
      {(institutionSupervisor || regionSupervisor) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
            Üst Sorumlular
          </h2>
          {institutionSupervisor && (
            <NativeCard>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {institutionSupervisor.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Kurum Sorumlusu
                  </div>
                  {institutionSupervisor.phone && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      📞 {institutionSupervisor.phone}
                    </div>
                  )}
                </div>
              </div>
            </NativeCard>
          )}
          {regionSupervisor && (
            <NativeCard>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h1.5M21 11a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0H21m-1.5 0H18" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {regionSupervisor.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Bölge Sorumlusu
                  </div>
                  {regionSupervisor.phone && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      📞 {regionSupervisor.phone}
                    </div>
                  )}
                </div>
              </div>
            </NativeCard>
          )}
        </div>
      )}

      {/* Elections List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
          Seçimler
        </h2>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : elections.length === 0 ? (
          <NativeCard>
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Aktif seçim bulunmuyor
            </p>
          </NativeCard>
        ) : (
          <div className="space-y-3">
            {elections.map((election) => {
              const daysUntil = getDaysUntil(election.date);
              const electionStatus = electionStatusFor(election);

              return (
                <NativeCard
                  key={election.id}
                  onClick={() => onElectionClick && onElectionClick(election)}
                >
                  <div className="flex items-start space-x-4">
                    {/* Election Icon */}
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${getTypeColor(election.type)} flex items-center justify-center flex-shrink-0`}>
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>

                    {/* Election Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                        {election.name || 'İsimsiz Seçim'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {getTypeLabel(election.type)}
                      </div>
                      {election.date && (
                        <div className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                          📅 {formatDate(election.date)}
                          {daysUntil !== null && daysUntil > 0 && (
                            <span className="ml-2">({daysUntil} gün kaldı)</span>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {electionStatus.type === 'multi' ? (
                          <>
                            <StatusBadge status={electionStatus.cb.status} prefix="CB" reason={electionStatus.cb.reason} />
                            <StatusBadge status={electionStatus.mv.status} prefix="MV" reason={electionStatus.mv.reason} />
                          </>
                        ) : (
                          <StatusBadge status={electionStatus.overall.status} reason={electionStatus.overall.reason} />
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </NativeCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NativeChiefObserverDashboard;

