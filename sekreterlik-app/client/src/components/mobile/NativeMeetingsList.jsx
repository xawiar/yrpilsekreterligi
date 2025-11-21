/**
 * Native Mobile Meetings List Component
 * Toplantılar sayfası için native mobil görünümü
 */
import React from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

const NativeMeetingsList = ({ 
  meetings = [],
  onMeetingClick,
  onCreateMeeting,
  onPlanMeeting,
  searchTerm = '',
  onSearchChange,
  loading = false,
  calculateAttendanceStats = () => ({}),
  getAttendanceColor = () => ''
}) => {
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
            const stats = calculateAttendanceStats(meeting);
            const attendanceColor = getAttendanceColor(stats.attendancePercentage);
            
            return (
              <NativeCard
                key={meeting.id}
                onClick={() => onMeetingClick && onMeetingClick(meeting)}
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
  );
};

export default NativeMeetingsList;

