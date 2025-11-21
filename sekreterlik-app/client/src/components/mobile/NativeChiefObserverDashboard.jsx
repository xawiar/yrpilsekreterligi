/**
 * Native Mobile Chief Observer Dashboard Component
 * Başmüşahit dashboard'u için native mobil görünümü
 */
import React from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

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
  const completedCount = elections.filter(e => electionResults[e.id]).length;
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
              const hasResult = electionResults[election.id] !== undefined;
              const daysUntil = getDaysUntil(election.date);
              
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
                      <div className="flex items-center space-x-2 mt-2">
                        {hasResult ? (
                          <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
                            ✅ Sonuç Girildi
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg">
                            ⏳ Bekliyor
                          </span>
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

