/**
 * Native Mobile Dashboard Example
 * Bu component, native mobile app görünümünün nasıl olacağını gösterir
 * DashboardPage'de mobil için kullanılacak
 */
import React from 'react';
import NativeCard from './NativeCard';
import NativeButton from './NativeButton';

const NativeDashboardExample = ({ 
  stats, 
  topRegistrars, 
  topAttendees, 
  upcomingEvents, 
  upcomingMeetings,
  onMemberClick,
  onMeetingClick,
  onEventClick
}) => {
  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Hoş Geldiniz
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-base">
          Bugün {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats Cards - Native Style */}
      <div className="grid grid-cols-2 gap-3">
        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
            {stats.totalMembers}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Toplam Üye
          </div>
        </NativeCard>

        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
            {stats.totalMeetings}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Toplantı
          </div>
        </NativeCard>

        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
            {stats.totalEvents}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Etkinlik
          </div>
        </NativeCard>

        <NativeCard className="text-center">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
            {stats.avgAttendanceRate}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Katılım
          </div>
        </NativeCard>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
          Hızlı İşlemler
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <NativeButton variant="primary" fullWidth icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }>
            Üye Ekle
          </NativeButton>
          <NativeButton variant="secondary" fullWidth icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }>
            Toplantı Oluştur
          </NativeButton>
        </div>
      </div>

      {/* Top Registrars - Native List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
          En Çok Üye Kaydedenler
        </h2>
        {topRegistrars.length > 0 ? (
          <div className="space-y-2">
            {topRegistrars.slice(0, 5).map((item, index) => (
              <NativeCard 
                key={item.member?.id || index} 
                onClick={() => onMemberClick && onMemberClick(item.member)}
                className="cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.member?.name || 'Bilinmeyen'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {item.member?.region || 'Bölge belirtilmemiş'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">
                      {item.count || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      üye
                    </div>
                  </div>
                </div>
              </NativeCard>
            ))}
          </div>
        ) : (
          <NativeCard>
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              Henüz kayıt yok
            </p>
          </NativeCard>
        )}
      </div>

      {/* Top Attendees - Native List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
          En Çok Toplantılara Katılanlar
        </h2>
        {topAttendees.length > 0 ? (
          <div className="space-y-2">
            {topAttendees.slice(0, 5).map((item, index) => (
              <NativeCard 
                key={item.member?.id || index} 
                onClick={() => onMemberClick && onMemberClick(item.member)}
                className="cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.member?.name || 'Bilinmeyen'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {item.member?.region || 'Bölge belirtilmemiş'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600 dark:text-green-400">
                      {item.count || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      katılım
                    </div>
                  </div>
                </div>
              </NativeCard>
            ))}
          </div>
        ) : (
          <NativeCard>
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              Henüz katılım yok
            </p>
          </NativeCard>
        )}
      </div>

      {/* Upcoming Meetings - Native List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
          Yaklaşan Toplantılar
        </h2>
        {upcomingMeetings.length > 0 ? (
          <div className="space-y-2">
            {upcomingMeetings.slice(0, 3).map((meeting, index) => (
              <NativeCard 
                key={meeting.id || index} 
                onClick={() => onMeetingClick && onMeetingClick(meeting)}
                className="cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {meeting.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {meeting.date && (
                        <span>
                          {meeting.date.includes('T') 
                            ? new Date(meeting.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                            : meeting.date}
                        </span>
                      )}
                    </div>
                    {meeting.regions && meeting.regions.length > 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        📍 {meeting.regions.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </NativeCard>
            ))}
          </div>
        ) : (
          <NativeCard>
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              Yaklaşan toplantı yok
            </p>
          </NativeCard>
        )}
      </div>

      {/* Upcoming Events - Native List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">
          Yaklaşan Etkinlikler
        </h2>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-2">
            {upcomingEvents.slice(0, 3).map((event, index) => (
              <NativeCard 
                key={event.id || index} 
                onClick={() => onEventClick && onEventClick(event)}
                className="cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {event.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {event.date && (
                        <span>
                          {event.date.includes('T') 
                            ? new Date(event.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                            : event.date}
                        </span>
                      )}
                    </div>
                    {event.location && (
                      <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        📍 {event.location}
                      </div>
                    )}
                  </div>
                </div>
              </NativeCard>
            ))}
          </div>
        ) : (
          <NativeCard>
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              Yaklaşan etkinlik yok
            </p>
          </NativeCard>
        )}
      </div>
    </div>
  );
};

export default NativeDashboardExample;

