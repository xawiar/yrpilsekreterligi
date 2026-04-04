/**
 * Native Mobile Events List Component
 * Etkinlikler sayfası için native mobil görünümü
 */
import React from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

const NativeEventsList = ({
  events = [],
  onEventClick,
  onCreateEvent,
  onPlanEvent,
  onEditEvent,
  onArchiveEvent,
  onUpdateAttendance,
  searchTerm = '',
  onSearchChange,
  loading = false,
  calculateAttendanceStats = () => ({}),
  getAttendanceColor = () => ''
}) => {
  // Filter events by search term
  const filteredEvents = events.filter(event =>
    event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Etkinlikler
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-base">
          {events.length} etkinlik
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Etkinlik ara..."
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
          onClick={onCreateEvent}
        >
          Yeni Etkinlik
        </NativeButton>
        <NativeButton
          variant="secondary"
          fullWidth
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          onClick={onPlanEvent}
        >
          Etkinlik Planla
        </NativeButton>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <NativeCard>
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz etkinlik eklenmemiş'}
          </p>
        </NativeCard>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const stats = calculateAttendanceStats(event);
            const attendanceColor = getAttendanceColor(stats.attendancePercentage);
            
            return (
              <NativeCard key={event.id}>
                <div
                  className="flex items-start space-x-4"
                  onClick={() => onEventClick && onEventClick(event)}
                >
                  {/* Event Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>

                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                      {event.name || 'İsimsiz Etkinlik'}
                    </div>
                    {event.location && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {event.location}
                      </div>
                    )}
                    {event.date && (
                      <div className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                        {new Date(event.date).toLocaleDateString('tr-TR', {
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
                          {stats.attendedCount || 0} kişi
                        </div>
                      </div>
                    )}
                    {event.isPlanned && (
                      <div className="mt-2">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          Planlandı
                        </span>
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

                {/* Mobile action buttons */}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                  {onUpdateAttendance && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdateAttendance(event); }}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg active:scale-95 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span>Yoklama</span>
                    </button>
                  )}
                  {onEditEvent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg active:scale-95 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Düzenle</span>
                    </button>
                  )}
                  {onArchiveEvent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchiveEvent(event.id); }}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg active:scale-95 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l6 6m0 0l6-6m-6 6V4" />
                      </svg>
                      <span>Arşivle</span>
                    </button>
                  )}
                </div>
              </NativeCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NativeEventsList;

