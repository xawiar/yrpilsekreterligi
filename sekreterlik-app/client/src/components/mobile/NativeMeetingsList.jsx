/**
 * Native Mobile Meetings List Component
 * Toplantılar sayfası için native mobil görünümü
 */
import React, { useState } from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

const NativeMeetingsList = ({ 
  meetings = [],
  onMeetingClick,
  onCreateMeeting,
  onPlanMeeting,
  onEditMeeting,
  onArchiveMeeting,
  onUpdateAttendance,
  searchTerm = '',
  onSearchChange,
  loading = false,
  calculateAttendanceStats = () => ({}),
  getAttendanceColor = () => ''
}) => {
  const [openMenuId, setOpenMenuId] = useState(null);
  // Filter meetings by search term
  const filteredMeetings = meetings.filter(meeting =>
    meeting.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    meeting.regions?.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Toplantılar
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-base">
          {meetings.length} toplantı
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Toplantı ara..."
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

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <NativeButton
          variant="primary"
          fullWidth
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          onClick={onCreateMeeting}
        >
          Yeni Toplantı
        </NativeButton>
        <NativeButton
          variant="secondary"
          fullWidth
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          onClick={onPlanMeeting}
        >
          Toplantı Planla
        </NativeButton>
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <NativeCard>
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz toplantı eklenmemiş'}
          </p>
        </NativeCard>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => {
            // Güvenlik kontrolü: meeting objesi ve id olmalı
            if (!meeting || !meeting.id) {
              return null;
            }
            
            const stats = calculateAttendanceStats(meeting);
            const attendanceColor = getAttendanceColor(stats?.attendancePercentage || 0);
            
            const isMenuOpen = openMenuId === meeting.id;
            
            return (
              <div key={meeting.id} className="relative">
                <NativeCard
                  onClick={() => {
                    if (onMeetingClick && meeting && meeting.id) {
                      onMeetingClick(meeting);
                    }
                  }}
                >
                  <div className="flex items-start space-x-4">
                    {/* Date Icon */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <div className="text-center text-white">
                        <div className="text-xs font-semibold">
                          {meeting.date ? new Date(meeting.date.split('.').reverse().join('-')).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : ''}
                        </div>
                      </div>
                    </div>

                    {/* Meeting Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                        {meeting.name || 'İsimsiz Toplantı'}
                      </div>
                      {meeting.regions && meeting.regions.length > 0 && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          📍 {meeting.regions.join(', ')}
                        </div>
                      )}
                      {meeting.date && (
                        <div className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                          📅 {new Date(meeting.date.split('.').reverse().join('-')).toLocaleDateString('tr-TR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                      {stats && (
                        <div className="flex items-center space-x-2 mt-2">
                          <div className={`px-2 py-1 rounded-lg text-xs font-semibold ${attendanceColor}`}>
                            {stats.attendancePercentage || 0}% Katılım
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {stats.attendedCount || 0}/{stats.totalAttendees || 0} kişi
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions Menu Button */}
                    <div className="flex-shrink-0 flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : meeting.id);
                        }}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95"
                        aria-label="İşlemler"
                      >
                        <svg
                          className="w-5 h-5 text-gray-600 dark:text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </NativeCard>

                {/* Actions Menu Dropdown */}
                {isMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onMeetingClick && meeting && meeting.id) {
                          onMeetingClick(meeting);
                          setOpenMenuId(null);
                        }
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Detayları Gör</span>
                    </button>
                    {onUpdateAttendance && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onUpdateAttendance && meeting && meeting.id) {
                            onUpdateAttendance(meeting.id);
                            setOpenMenuId(null);
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors"
                      >
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Yoklama Güncelle</span>
                      </button>
                    )}
                    {onEditMeeting && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditMeeting && meeting && meeting.id) {
                            onEditMeeting(meeting.id);
                            setOpenMenuId(null);
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors"
                      >
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Düzenle</span>
                      </button>
                    )}
                    {onArchiveMeeting && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onArchiveMeeting && meeting && meeting.id) {
                            if (window.confirm('Bu toplantıyı arşivlemek istediğinize emin misiniz?')) {
                              onArchiveMeeting(meeting.id);
                              setOpenMenuId(null);
                            }
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors"
                      >
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>Arşivle</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NativeMeetingsList;

