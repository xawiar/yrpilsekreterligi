import React from 'react';
import EmptyMembersState from './EmptyMembersState';
import MemberAvatar from '../Members/MemberAvatar';
import RegionBadge from '../Members/RegionBadge';
import { formatMemberName } from '../../utils/nameFormatter';

const ArchivedMembersTable = ({ archivedMembers, onShowMember, onDeleteMember, onRestoreMember }) => {
  return (
    <div>
      {/* Mobile card list */}
      <div className="md:hidden space-y-3 p-3">
        {archivedMembers.length === 0 ? (
          <EmptyMembersState />
        ) : (
          archivedMembers.map((member) => (
            <div
              key={member.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <MemberAvatar name={member.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {formatMemberName(member.name)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{member.tc}</p>
                </div>
                <RegionBadge region={member.region} />
              </div>
              <div className="mt-3 flex items-center space-x-3">
                <button
                  onClick={() => onShowMember(member.id)}
                  className="text-indigo-600 dark:text-indigo-400 p-1.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  title="Göster"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => onRestoreMember(member.id)}
                  className="text-green-600 dark:text-green-400 p-1.5 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  title="Geri Yükle"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => onDeleteMember(member.id)}
                  className="text-red-600 dark:text-red-400 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Sil"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Üye Adı
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Bölge
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pozisyon
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Telefon
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {archivedMembers.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <MemberAvatar name={member.name} />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatMemberName(member.name)}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{member.tc}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <RegionBadge region={member.region} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {member.position}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {member.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onShowMember(member.id)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 transition-colors p-1 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 mr-2"
                    title="Göster"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onRestoreMember(member.id)}
                    className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors p-1 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 mr-2"
                    title="Geri Yükle"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteMember(member.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Sil"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {archivedMembers.length === 0 && (
              <EmptyMembersState />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchivedMembersTable;