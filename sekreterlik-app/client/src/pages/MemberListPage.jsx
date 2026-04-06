import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import * as XLSX from 'xlsx';

const MemberListPage = () => {
  const [members, setMembers] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectorFilter, setInspectorFilter] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'hierarchy'

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [membersData, regionsData] = await Promise.all([
          ApiService.getMembers(false),
          ApiService.getRegions()
        ]);
        setMembers(membersData || []);
        setRegions(regionsData || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Helper: find supervisor name
  const getSupervisorName = useCallback((supervisorId) => {
    if (!supervisorId) return '';
    const sup = members.find(m => String(m.id) === String(supervisorId));
    return sup ? sup.name : '';
  }, [members]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (selectedRegion && m.region !== selectedRegion) return false;
      if (searchQuery && !m.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (inspectorFilter === 'inspector' && m.inspectorTitle !== 'Müfettiş') return false;
      if (inspectorFilter === 'deputy' && m.inspectorTitle !== 'Müfettiş Yardımcısı') return false;
      return true;
    });
  }, [members, selectedRegion, searchQuery, inspectorFilter]);

  // Build hierarchy
  const hierarchy = useMemo(() => {
    const supervisors = members.filter(m => {
      const hasAssistants = members.some(a => a.supervisorId === String(m.id));
      return hasAssistants || m.inspectorTitle === 'Müfettiş';
    });

    // Also find members whose position contains "Yardımcı" and have a supervisorId
    const positionBasedSupervisors = members.filter(m => {
      const hasPositionAssistants = members.some(a =>
        a.supervisorId === String(m.id) &&
        a.position?.toLowerCase().includes('yardımcı')
      );
      return hasPositionAssistants && !supervisors.some(s => String(s.id) === String(m.id));
    });

    const allSupervisors = [...supervisors, ...positionBasedSupervisors];

    return allSupervisors.map(sup => ({
      ...sup,
      assistants: members.filter(a => a.supervisorId === String(sup.id))
    }));
  }, [members]);

  // Excel export
  const handleExcelExport = useCallback(() => {
    const data = filteredMembers.map(m => ({
      'Ad Soyad': m.name || '',
      'Bolge': m.region || '',
      'Gorev': m.position || '',
      'Mufettislik': m.inspectorTitle || '',
      'Bagli Oldugu Kisi': getSupervisorName(m.supervisorId),
      'Telefon': m.phone || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Uye Listesi');

    // Auto column widths
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `uye_listesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filteredMembers, getSupervisorName]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 animate-pulse"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-72 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Uye Listesi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Toplam {filteredMembers.length} uye {selectedRegion || searchQuery || inspectorFilter ? `(filtrelenmis)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Tablo
            </button>
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'hierarchy'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Hiyerarsi
            </button>
          </div>
          {/* Excel export */}
          <button
            onClick={handleExcelExport}
            disabled={filteredMembers.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Isme gore ara..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>

        {/* Region filter */}
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
        >
          <option value="">Tum Bolgeler</option>
          {regions.map(r => (
            <option key={r.id} value={r.name}>{r.name}</option>
          ))}
        </select>

        {/* Inspector filter */}
        <select
          value={inspectorFilter}
          onChange={(e) => setInspectorFilter(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
        >
          <option value="">Tumu</option>
          <option value="inspector">Sadece Mufettisler</option>
          <option value="deputy">Sadece Mufettis Yardimcilari</option>
        </select>

        {/* Clear filters */}
        {(selectedRegion || searchQuery || inspectorFilter) && (
          <button
            onClick={() => { setSelectedRegion(''); setSearchQuery(''); setInspectorFilter(''); }}
            className="inline-flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Temizle
          </button>
        )}
      </div>

      {/* Content */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">Uye bulunamadi</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Filtre kriterlerinize uygun uye bulunmamaktadir.</p>
        </div>
      ) : viewMode === 'table' ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ad Soyad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bolge</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gorev</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mufettislik</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Yardimcilik</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Telefon</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{m.name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {m.region || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {m.position || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.inspectorTitle ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            m.inspectorTitle === 'Müfettiş'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                          }`}>
                            {m.inspectorTitle}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {getSupervisorName(m.supervisorId) || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {m.phone || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredMembers.map((m) => (
              <div key={m.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{m.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.position || '-'}</p>
                  </div>
                  {m.inspectorTitle && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.inspectorTitle === 'Müfettiş'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                    }`}>
                      {m.inspectorTitle}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">Bolge:</span>
                    <span className="ml-1 text-gray-700 dark:text-gray-300">{m.region || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">Telefon:</span>
                    <span className="ml-1 text-gray-700 dark:text-gray-300">{m.phone || '-'}</span>
                  </div>
                  {getSupervisorName(m.supervisorId) && (
                    <div className="col-span-2">
                      <span className="text-gray-400 dark:text-gray-500">Bagli:</span>
                      <span className="ml-1 text-gray-700 dark:text-gray-300">{getSupervisorName(m.supervisorId)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Hierarchy view */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          {hierarchy.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">Hiyerarsik yapi icin mufettis veya yardimci atamasi yapilmamis.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hierarchy.map((sup) => (
                <div key={sup.id} className="border-l-4 border-indigo-400 dark:border-indigo-600 pl-4">
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {sup.position || sup.inspectorTitle || 'Uye'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{sup.name}</span>
                        {sup.region && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {sup.region}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {sup.assistants.length > 0 && (
                    <div className="ml-6 space-y-1 pb-2">
                      {sup.assistants.map((asst) => (
                        <div key={asst.id} className="flex items-center gap-3 py-1.5 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {asst.position || asst.inspectorTitle || 'Yardimci'}
                            </span>
                            <span className="text-xs text-gray-400">-</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{asst.name}</span>
                            {asst.region && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                {asst.region}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Members not in any hierarchy */}
              {(() => {
                const hierarchyIds = new Set();
                hierarchy.forEach(sup => {
                  hierarchyIds.add(String(sup.id));
                  sup.assistants.forEach(a => hierarchyIds.add(String(a.id)));
                });
                const unassigned = members.filter(m => !hierarchyIds.has(String(m.id)));
                if (unassigned.length === 0) return null;
                return (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      Hiyerarsi disindaki uyeler ({unassigned.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {unassigned.map(m => (
                        <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{m.name}</span>
                          {m.position && <span className="text-xs text-gray-400">({m.position})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberListPage;
