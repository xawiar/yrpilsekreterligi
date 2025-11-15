import React from 'react';

const TopAttendeesTable = ({ topAttendees }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">En Çok Toplantılara Katılanlar</h2>
      {topAttendees.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Üye Adı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Katılım Sayısı
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {topAttendees.map((item, index) => (
                  <tr key={item.member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center">
                        <span className="mr-2">{index + 1}.</span>
                        {item.member.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {topAttendees.map((item, index) => (
              <div key={item.member.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {item.member.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900 rounded-lg px-3 py-1.5">
                      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {item.count} katılım
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Henüz katılım bulunmamaktadır.</p>
      )}
    </div>
  );
};

export default TopAttendeesTable;