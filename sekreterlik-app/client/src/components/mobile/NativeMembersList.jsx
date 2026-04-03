/**
 * Native Mobile Members List Component
 * Üyeler sayfası için native mobil görünümü
 */
import React, { useState, useEffect } from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

const ITEMS_PER_PAGE = 20;

const NativeMembersList = ({
  members = [],
  onMemberClick,
  onAddMember,
  searchTerm = '',
  onSearchChange,
  selectedRegion = '',
  onRegionChange,
  regions = [],
  loading = false
}) => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset visible count when members list changes (search/filter)
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [members.length, searchTerm, selectedRegion]);

  const visibleMembers = members.slice(0, visibleCount);
  const hasMore = visibleCount < members.length;

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Üyeler
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-base">
          {members.length} üye
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Üye ara..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-3 pl-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
          />
          <svg
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Region Filter */}
      {regions.length > 0 && (
        <div className="mb-4">
          <select
            value={selectedRegion}
            onChange={(e) => onRegionChange(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
          >
            <option value="">Tüm Bölgeler</option>
            {regions.map((region) => {
              // Handle both string and object formats
              const regionValue = typeof region === 'string' ? region : (region.name || region.id || '');
              const regionKey = typeof region === 'string' ? region : (region.id || region.name || '');
              return (
                <option key={regionKey} value={regionValue}>
                  {regionValue}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Add Member Button */}
      {onAddMember && (
        <NativeButton
          variant="primary"
          fullWidth
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          onClick={onAddMember}
        >
          Yeni Üye Ekle
        </NativeButton>
      )}

      {/* Members List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : members.length === 0 ? (
        <NativeCard>
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            {searchTerm || selectedRegion ? 'Arama sonucu bulunamadı' : 'Henüz üye eklenmemiş'}
          </p>
        </NativeCard>
      ) : (
        <div className="space-y-3">
          {visibleMembers.map((member) => (
            <NativeCard
              key={member.id}
              onClick={() => onMemberClick && onMemberClick(member)}
            >
              <div className="flex items-center space-x-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {member.name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                    {member.name || 'Isimsiz Uye'}
                  </div>
                  {member.position && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {member.position}
                    </div>
                  )}
                  {member.region && (
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      {member.region}
                    </div>
                  )}
                  {member.phone && (
                    <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      {member.phone}
                    </div>
                  )}
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
          ))}

          {/* Load More Button */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
              className="w-full py-3 mt-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium rounded-xl text-base hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              Daha Fazla Yukle ({members.length - visibleCount} kaldi)
            </button>
          )}

          {/* Showing count */}
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 pt-1">
            {visibleMembers.length} / {members.length} uye gosteriliyor
          </p>
        </div>
      )}
    </div>
  );
};

export default NativeMembersList;

