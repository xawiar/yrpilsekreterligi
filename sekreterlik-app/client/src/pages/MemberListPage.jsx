import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ApiService from '../utils/ApiService';
import * as XLSX from 'xlsx';

const MemberListPage = () => {
  const [members, setMembers] = useState([]);
  const [regions, setRegions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectorFilter, setInspectorFilter] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [importStatus, setImportStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [membersData, regionsData, positionsData] = await Promise.all([
          ApiService.getMembers(false),
          ApiService.getRegions(),
          ApiService.getPositions()
        ]);
        setMembers(membersData || []);
        setRegions(regionsData || []);
        setPositions(positionsData || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getSupervisorName = useCallback((supervisorId) => {
    if (!supervisorId) return '';
    const sup = members.find(m => String(m.id) === String(supervisorId));
    return sup ? sup.name : '';
  }, [members]);

  // Multi-region filter
  const toggleRegion = (regionName) => {
    setSelectedRegions(prev =>
      prev.includes(regionName)
        ? prev.filter(r => r !== regionName)
        : [...prev, regionName]
    );
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (selectedRegions.length > 0 && !selectedRegions.includes(m.region)) return false;
      if (searchQuery && !m.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (inspectorFilter === 'inspector' && m.inspectorTitle !== 'Müfettiş') return false;
      if (inspectorFilter === 'deputy' && m.inspectorTitle !== 'Müfettiş Yardımcısı') return false;
      return true;
    });
  }, [members, selectedRegions, searchQuery, inspectorFilter]);

  const hierarchy = useMemo(() => {
    const supervisors = members.filter(m => {
      const hasAssistants = members.some(a => a.supervisorId === String(m.id));
      return hasAssistants || m.inspectorTitle === 'Müfettiş';
    });
    const positionBasedSupervisors = members.filter(m => {
      const hasPositionAssistants = members.some(a =>
        a.supervisorId === String(m.id) && a.position?.toLowerCase().includes('yardımcı')
      );
      return hasPositionAssistants && !supervisors.some(s => String(s.id) === String(m.id));
    });
    return [...supervisors, ...positionBasedSupervisors].map(sup => ({
      ...sup,
      assistants: members.filter(a => a.supervisorId === String(sup.id))
    }));
  }, [members]);

  // İlçe bazlı gruplama
  const districtGroups = useMemo(() => {
    const groups = {};
    members.forEach(m => {
      if (m.inspectorDistrict) {
        const dist = m.inspectorDistrict.trim();
        if (!groups[dist]) groups[dist] = { mufettis: [], yardimci: [] };
        if (m.inspectorTitle === 'Müfettiş') groups[dist].mufettis.push(m);
        else if (m.inspectorTitle === 'Müfettiş Yardımcısı') groups[dist].yardimci.push(m);
      }
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], 'tr'));
  }, [members]);

  // Excel EXPORT — görünüme göre format değişir
  const handleExcelExport = useCallback(() => {
    const wb = XLSX.utils.book_new();

    if (viewMode === 'district') {
      // İlçe bazlı gruplanmış Excel
      const rows = [];
      districtGroups.forEach(([district, group]) => {
        // İlçe başlığı
        rows.push({ 'Ad Soyad': `── ${district} İlçesi ──`, 'Bölge': '', 'Görev': '', 'Müfettişlik': '', 'Müfettiş İlçesi': '' });
        // Müfettişler
        group.mufettis.forEach(m => {
          rows.push({ 'Ad Soyad': m.name || '', 'Bölge': m.region || '', 'Görev': m.position || '', 'Müfettişlik': 'Müfettiş', 'Müfettiş İlçesi': district });
        });
        // Yardımcılar
        group.yardimci.forEach(m => {
          rows.push({ 'Ad Soyad': `   ${m.name || ''}`, 'Bölge': m.region || '', 'Görev': m.position || '', 'Müfettişlik': 'Müfettiş Yardımcısı', 'Müfettiş İlçesi': district });
        });
        // Boş satır ayracı
        rows.push({ 'Ad Soyad': '', 'Bölge': '', 'Görev': '', 'Müfettişlik': '', 'Müfettiş İlçesi': '' });
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 25 }, { wch: 22 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, 'İlçe Bazlı Müfettişler');
    } else {
      // Normal tablo formatı
      const data = filteredMembers.map(m => ({
        'Ad Soyad': m.name || '',
        'Bölge': m.region || '',
        'Görev': m.position || '',
        'Müfettişlik': m.inspectorTitle || '',
        'Müfettiş İlçesi': m.inspectorDistrict || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length)) + 2
      }));
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, 'Üye Listesi');
    }

    const filename = viewMode === 'district'
      ? `ilce_mufettisler_${new Date().toISOString().slice(0, 10)}.xlsx`
      : `uye_listesi_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [filteredMembers, viewMode, districtGroups]);

  // Excel IMPORT — bölge, görev, müfettişlik güncelleme
  const handleExcelImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      let updated = 0;
      let skipped = 0;
      let errors = [];

      for (const row of rows) {
        const name = (row['Ad Soyad'] || '').trim();
        if (!name) { skipped++; continue; }

        // Üyeyi isimle eşleştir
        const member = members.find(m => m.name?.trim().toLowerCase() === name.toLowerCase());
        if (!member) {
          errors.push(`"${name}" bulunamadı`);
          skipped++;
          continue;
        }

        const newRegion = (row['Bölge'] || '').trim();
        const newPosition = (row['Görev'] || '').trim();
        const newInspectorTitle = (row['Müfettişlik'] || '').trim();
        const newInspectorDistrict = (row['Müfettiş İlçesi'] || '').trim();
        // Müfettiş yardımcısı ise aynı ilçedeki müfettişi otomatik bul
        let newSupervisorId = '';
        if (newInspectorTitle === 'Müfettiş Yardımcısı' && newInspectorDistrict) {
          // Aynı ilçedeki müfettişi otomatik bul
          // Önce bu import batch'indeki müfettişlerden ara
          const inspectorRow = rows.find(r =>
            (r['Müfettişlik'] || '').trim() === 'Müfettiş' &&
            (r['Müfettiş İlçesi'] || '').trim().toLowerCase() === newInspectorDistrict.toLowerCase()
          );
          if (inspectorRow) {
            const inspectorMember = members.find(m => m.name?.trim().toLowerCase() === (inspectorRow['Ad Soyad'] || '').trim().toLowerCase());
            if (inspectorMember) newSupervisorId = String(inspectorMember.id);
          }
          // Yoksa mevcut üyelerden ara
          if (!newSupervisorId) {
            const existingInspector = members.find(m =>
              m.inspectorTitle === 'Müfettiş' &&
              (m.inspectorDistrict || '').toLowerCase() === newInspectorDistrict.toLowerCase()
            );
            if (existingInspector) newSupervisorId = String(existingInspector.id);
          }
        }

        // Değişiklik var mı kontrol et
        const changed =
          (newRegion && newRegion !== (member.region || '')) ||
          (newPosition && newPosition !== (member.position || '')) ||
          (newInspectorTitle !== (member.inspectorTitle || '')) ||
          (newInspectorDistrict !== (member.inspectorDistrict || '')) ||
          (newSupervisorId !== (member.supervisorId || ''));

        if (!changed) { skipped++; continue; }

        // Güncelle
        try {
          const updateData = {};
          if (newRegion) updateData.region = newRegion;
          if (newPosition) updateData.position = newPosition;
          updateData.inspectorTitle = newInspectorTitle || null;
          updateData.inspectorDistrict = newInspectorDistrict || null;
          updateData.supervisorId = newSupervisorId || null;

          await ApiService.updateMember(member.id, updateData);
          updated++;
        } catch (err) {
          errors.push(`"${name}" güncellenemedi: ${err.message}`);
        }
      }

      setImportStatus({
        type: errors.length > 0 && updated === 0 ? 'error' : updated > 0 ? 'success' : 'warning',
        message: `${updated} üye güncellendi, ${skipped} atlandı.${errors.length > 0 ? ` Hatalar: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? ` (+${errors.length - 5} daha)` : ''}` : ''}`
      });

      // Verileri yeniden yükle
      if (updated > 0) {
        const freshMembers = await ApiService.getMembers(false);
        setMembers(freshMembers || []);
      }
    } catch (error) {
      setImportStatus({ type: 'error', message: `Excel okunamadı: ${error.message}` });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [members]);

  // Şablon Excel indir
  const handleDownloadTemplate = useCallback(() => {
    const data = filteredMembers.map(m => ({
      'Ad Soyad': m.name || '',
      'Bölge': m.region || '',
      'Görev': m.position || '',
      'Müfettişlik': m.inspectorTitle || '',
      'Müfettiş İlçesi': m.inspectorDistrict || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Üye Listesi');

    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `uye_sablon_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filteredMembers, getSupervisorName]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Üye Listesi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredMembers.length} üye {selectedRegions.length > 0 || searchQuery || inspectorFilter ? '(filtrelenmiş)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              Tablo
            </button>
            <button onClick={() => setViewMode('hierarchy')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'hierarchy' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              Hiyerarşi
            </button>
            <button onClick={() => setViewMode('district')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'district' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              İlçe
            </button>
          </div>

          {/* Excel Export */}
          <button onClick={handleExcelExport} disabled={filteredMembers.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 rounded-lg transition-colors shadow-sm" aria-label="Excel indir">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Excel İndir
          </button>

          {/* Şablon indir */}
          <button onClick={handleDownloadTemplate} disabled={filteredMembers.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm" aria-label="Şablon indir">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Şablon
          </button>

          {/* Excel Import */}
          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer" aria-label="Excel yükle">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            {importing ? 'Yükleniyor...' : 'Excel Yükle'}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" disabled={importing} />
          </label>
        </div>
      </div>

      {/* Import Status */}
      {importStatus && (
        <div className={`p-3 rounded-lg text-sm ${importStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : importStatus.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'}`}>
          {importStatus.message}
          <button onClick={() => setImportStatus(null)} className="ml-2 text-xs underline">Kapat</button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="İsme göre ara..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm" />
          </div>

          {/* Inspector filter */}
          <select value={inspectorFilter} onChange={(e) => setInspectorFilter(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm">
            <option value="">Tüm Görevler</option>
            <option value="inspector">Sadece Müfettişler</option>
            <option value="deputy">Sadece Müfettiş Yardımcıları</option>
          </select>

          {/* Clear */}
          {(selectedRegions.length > 0 || searchQuery || inspectorFilter) && (
            <button onClick={() => { setSelectedRegions([]); setSearchQuery(''); setInspectorFilter(''); }} className="inline-flex items-center justify-center gap-1 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Temizle
            </button>
          )}
        </div>

        {/* Multi-region filter chips */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 py-1">Bölge:</span>
          {regions.map(r => (
            <button
              key={r.id}
              onClick={() => toggleRegion(r.name)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedRegions.includes(r.name)
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {r.name}
              {selectedRegions.includes(r.name) && (
                <span className="ml-1">✕</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">Üye bulunamadı</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Filtre kriterlerinize uygun üye bulunmamaktadır.</p>
        </div>
      ) : viewMode === 'district' ? (
        /* İlçe bazlı görünüm */
        <div className="space-y-4">
          {districtGroups.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Henüz ilçe ataması yapılmamış.</p>
            </div>
          ) : (
            districtGroups.map(([district, group]) => (
              <div key={district} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-sm">{district} İlçesi</h2>
                    <span className="text-primary-100 text-xs">{group.mufettis.length} müfettiş, {group.yardimci.length} yardımcı</span>
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  {group.mufettis.map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{m.name}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">Müfettiş</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{m.region}</span>
                    </div>
                  ))}
                  {group.yardimci.map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 pl-6 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                        <svg className="w-3 h-3 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{m.name}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">Yardımcı</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{m.region}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bölge</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Görev</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Müfettişlik</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Müfettiş İlçesi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredMembers.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{m.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">{m.region || '-'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{m.position || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.inspectorTitle ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.inspectorTitle === 'Müfettiş' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'}`}>{m.inspectorTitle}</span>
                        ) : <span className="text-sm text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{m.inspectorDistrict || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredMembers.map(m => (
              <div key={m.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{m.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.position || '-'}</p>
                  </div>
                  {m.inspectorTitle && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.inspectorTitle === 'Müfettiş' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'}`}>{m.inspectorTitle}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">Bölge:</span> <span className="text-gray-700 dark:text-gray-300">{m.region || '-'}</span></div>
                  {m.inspectorDistrict && (
                    <div><span className="text-gray-400">İlçe:</span> <span className="text-gray-700 dark:text-gray-300">{m.inspectorDistrict}</span></div>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Hiyerarşik yapı için müfettiş veya yardımcı ataması yapılmamış.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hierarchy.map(sup => (
                <div key={sup.id} className="border-l-4 border-primary-400 dark:border-primary-600 pl-4">
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{sup.position || sup.inspectorTitle || 'Üye'}</span>
                      <span className="text-gray-400">—</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{sup.name}</span>
                      {sup.region && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">{sup.region}</span>}
                    </div>
                  </div>
                  {sup.assistants.length > 0 && (
                    <div className="ml-6 space-y-1 pb-2">
                      {sup.assistants.map(asst => (
                        <div key={asst.id} className="flex items-center gap-3 py-1.5 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{asst.position || asst.inspectorTitle || 'Yardımcı'}</span>
                            <span className="text-xs text-gray-400">—</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{asst.name}</span>
                            {asst.region && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{asst.region}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kullanım kılavuzu */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-xs text-blue-700 dark:text-blue-300">
        <p className="font-medium mb-1">Excel ile toplu güncelleme:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>"Şablon" butonuyla mevcut listeyi indirin</li>
          <li>Excel'de Bölge, Görev, Müfettişlik sütunlarını düzenleyin</li>
          <li>"Excel Yükle" butonuyla dosyayı yükleyin — sadece değişen alanlar güncellenir</li>
        </ol>
        <p className="mt-1 text-blue-500 dark:text-blue-400">Not: Ad Soyad sütunu eşleştirme için kullanılır, değiştirmeyin.</p>
      </div>
    </div>
  );
};

export default MemberListPage;
