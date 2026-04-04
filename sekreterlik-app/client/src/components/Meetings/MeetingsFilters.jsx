import React from 'react';

const MeetingsFilters = ({
  searchTerm,
  setSearchTerm,
  regions,
  selectedRegion,
  setSelectedRegion,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-gray-200">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Toplanti ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Region Filter */}
        {regions && regions.length > 0 && (
          <div className="min-w-[180px]">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="block w-full py-2.5 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
            >
              <option value="">Tum Bolgeler</option>
              {regions.map((region, index) => (
                <option key={region.id || index} value={region.name || region}>
                  {region.name || region}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            title="Baslangic tarihi"
          />
          <span className="text-gray-400 text-sm">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            title="Bitis tarihi"
          />
          {(startDate || endDate || selectedRegion) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setSelectedRegion(''); }}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Filtreleri temizle"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingsFilters;
