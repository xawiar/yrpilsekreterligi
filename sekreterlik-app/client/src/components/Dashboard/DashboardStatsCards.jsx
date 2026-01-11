import React from 'react';
import { isMobile } from '../../utils/capacitorUtils';

const DashboardStatsCards = ({ stats }) => {
  const mobileView = isMobile();
  
  return (
    <div className={`grid grid-cols-1 ${mobileView ? 'gap-3 mb-4' : 'md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8'}`}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${mobileView ? 'p-4' : 'p-6'} border border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center">
          <div className={`${mobileView ? 'p-2' : 'p-3'} rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 ${mobileView ? 'mr-3' : 'mr-4'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${mobileView ? 'h-5 w-5' : 'h-6 w-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className={`${mobileView ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400`}>Toplam Üye</p>
            <p className={`${mobileView ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>{stats.totalMembers}</p>
          </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${mobileView ? 'p-4' : 'p-6'} border border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center">
          <div className={`${mobileView ? 'p-2 mr-3' : 'p-3 mr-4'} rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${mobileView ? 'h-5 w-5' : 'h-6 w-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className={`${mobileView ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400`}>Toplam Toplantı</p>
            <p className={`${mobileView ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>{stats.totalMeetings}</p>
          </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${mobileView ? 'p-4' : 'p-6'} border border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center">
          <div className={`${mobileView ? 'p-2 mr-3' : 'p-3 mr-4'} rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${mobileView ? 'h-5 w-5' : 'h-6 w-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className={`${mobileView ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400`}>Ort. Katılım Oranı</p>
            <p className={`${mobileView ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>%{stats.avgAttendanceRate}</p>
          </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${mobileView ? 'p-4' : 'p-6'} border border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center">
          <div className={`${mobileView ? 'p-2 mr-3' : 'p-3 mr-4'} rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${mobileView ? 'h-5 w-5' : 'h-6 w-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className={`${mobileView ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400`}>Toplam Etkinlik</p>
            <p className={`${mobileView ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>{stats.totalEvents || 0}</p>
          </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${mobileView ? 'p-4' : 'p-6'} border border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center">
          <div className={`${mobileView ? 'p-2 mr-3' : 'p-3 mr-4'} rounded-full bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${mobileView ? 'h-5 w-5' : 'h-6 w-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className={`${mobileView ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400`}>Mahalle Temsilcileri</p>
            <p className={`${mobileView ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>{stats.totalNeighborhoodRepresentatives || 0}</p>
          </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${mobileView ? 'p-4' : 'p-6'} border border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center">
          <div className={`${mobileView ? 'p-2 mr-3' : 'p-3 mr-4'} rounded-full bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${mobileView ? 'h-5 w-5' : 'h-6 w-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <p className={`${mobileView ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400`}>Köy Temsilcileri</p>
            <p className={`${mobileView ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>{stats.totalVillageRepresentatives || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStatsCards;