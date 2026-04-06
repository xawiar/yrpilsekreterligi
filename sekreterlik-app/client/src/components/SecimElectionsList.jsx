import React from 'react';
import { Link } from 'react-router-dom';
import { isMobile } from '../utils/capacitorUtils';
import NativeCard from './mobile/NativeCard';

const SecimElectionsList = ({
  elections,
  getTypeLabel,
  getStatusLabel,
  getStatusColor,
  getAllowedStatusOptions,
  handleStatusChange,
  handleCreateSecondRound,
  handleEdit,
  handleDelete,
}) => {
  if (elections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
        Henüz seçim eklenmemiş
      </div>
    );
  }

  if (isMobile()) {
    return (
      <div className="space-y-3">
        {elections.map((election) => (
          <NativeCard key={election.id}>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{election.name}</h4>
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {election.date ? (() => {
                        try {
                          const date = new Date(election.date);
                          return !isNaN(date.getTime()) ? date.toLocaleDateString('tr-TR') : '-';
                        } catch (e) {
                          return '-';
                        }
                      })() : '-'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {getTypeLabel(election.type)}
                    </span>
                    {election.type === 'cb' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        {(parseInt(election.round) || 1) === 2 ? '2. Tur' : '1. Tur'}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(election.status || 'draft')}`}>
                      {getStatusLabel(election.status || 'draft')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detaylar */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Detaylar:</div>
                {election.type === 'genel' && (
                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                    <div><span className="font-medium">CB:</span> {election.cb_candidates?.length || 0} aday</div>
                    <div><span className="font-medium">Partiler:</span> {election.parties?.length || 0} parti</div>
                  </div>
                )}
                {election.type === 'yerel' && (
                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                    <div><span className="font-medium">Belediye Başkanı:</span> {election.mayor_parties?.length || 0} parti, {election.mayor_candidates?.length || 0} bağımsız</div>
                    <div><span className="font-medium">İl Genel Meclisi:</span> {election.provincial_assembly_parties?.length || 0} parti</div>
                    <div><span className="font-medium">Belediye Meclisi:</span> {election.municipal_council_parties?.length || 0} parti</div>
                  </div>
                )}
                {election.type === 'referandum' && (
                  <div className="text-sm text-gray-900 dark:text-gray-100">Evet / Hayır</div>
                )}
              </div>

              {/* İşlemler */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                <select
                  value={election.status || 'draft'}
                  onChange={(e) => handleStatusChange(election.id, e.target.value)}
                  className={`text-xs px-2 py-1 rounded border ${getStatusColor(election.status || 'draft')} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                >
                  {getAllowedStatusOptions(election.status || 'draft').map(s => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>
                {(election.type === 'cb' || election.type === 'genel') && election.status === 'closed' && (parseInt(election.round) || 1) === 1 && (
                  <button
                    onClick={() => handleCreateSecondRound(election.id)}
                    className="w-full text-xs px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                  >
                    2. Tur Oluştur
                  </button>
                )}
                <div className="flex gap-2">
                  <Link
                    to={`/election-results/${election.id}`}
                    className="flex-1 text-center text-xs px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Sonuçlar
                  </Link>
                  <button
                    onClick={() => handleEdit(election)}
                    className="flex-1 text-xs px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleDelete(election.id)}
                    className="flex-1 text-xs px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          </NativeCard>
        ))}
      </div>
    );
  }

  // Desktop table
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Seçim Adı
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Tarih
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Tip
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Durum
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Detaylar
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {elections.map((election) => (
            <tr key={election.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                {election.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {election.date ? (() => {
                  try {
                    const date = new Date(election.date);
                    return !isNaN(date.getTime()) ? date.toLocaleDateString('tr-TR') : '-';
                  } catch (e) {
                    return '-';
                  }
                })() : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  {getTypeLabel(election.type)}
                  {election.type === 'cb' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      {(parseInt(election.round) || 1) === 2 ? '2. Tur' : '1. Tur'}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(election.status || 'draft')}`}>
                  {getStatusLabel(election.status || 'draft')}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                {election.type === 'genel' && (
                  <div className="space-y-1">
                    <div><span className="font-medium">CB:</span> {election.cb_candidates?.length || 0} aday</div>
                    <div><span className="font-medium">Partiler:</span> {election.parties?.length || 0} parti</div>
                  </div>
                )}
                {election.type === 'yerel' && (
                  <div className="space-y-1">
                    <div><span className="font-medium">Belediye Başkanı:</span> {election.mayor_parties?.length || 0} parti, {election.mayor_candidates?.length || 0} bağımsız</div>
                    <div><span className="font-medium">İl Genel Meclisi:</span> {election.provincial_assembly_parties?.length || 0} parti</div>
                    <div><span className="font-medium">Belediye Meclisi:</span> {election.municipal_council_parties?.length || 0} parti</div>
                  </div>
                )}
                {election.type === 'referandum' && (
                  <div>Evet / Hayır</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  <select
                    value={election.status || 'draft'}
                    onChange={(e) => handleStatusChange(election.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded border ${getStatusColor(election.status || 'draft')} border-gray-300 dark:border-gray-600`}
                  >
                    {getAllowedStatusOptions(election.status || 'draft').map(s => (
                      <option key={s} value={s}>{getStatusLabel(s)}</option>
                    ))}
                  </select>
                  {(election.type === 'cb' || election.type === 'genel') && election.status === 'closed' && (parseInt(election.round) || 1) === 1 && (
                    <button
                      onClick={() => handleCreateSecondRound(election.id)}
                      className="text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors font-medium"
                    >
                      2. Tur Oluştur
                    </button>
                  )}
                  <Link
                    to={`/election-results/${election.id}`}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                  >
                    Sonuçlar
                  </Link>
                  <button
                    onClick={() => handleEdit(election)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleDelete(election.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                  >
                    Sil
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SecimElectionsList;
