import React, { useEffect, useMemo, useState } from 'react';
import ApiService from '../utils/ApiService';

/**
 * Seçime Hazırlık — Beldeler sekmesi
 * - İlçe bazında belde sayıları
 * - Her belde altında kaç mahalle + kaç köy
 * - İlçe filtresi + isim arama
 */
const TownsOverviewPage = () => {
  const [towns, setTowns] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [t, d, n, v] = await Promise.all([
          ApiService.getTowns(),
          ApiService.getDistricts(),
          ApiService.getNeighborhoods().catch(() => []),
          ApiService.getVillages().catch(() => []),
        ]);
        setTowns(Array.isArray(t) ? t : []);
        setDistricts(Array.isArray(d) ? d : []);
        setNeighborhoods(Array.isArray(n) ? n : []);
        setVillages(Array.isArray(v) ? v : []);
      } catch (e) {
        console.error('Beldeler yükleme hatası:', e);
        setError('Beldeler yüklenemedi');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    return towns.map(t => {
      const dist = districts.find(d => String(d.id) === String(t.district_id));
      const distName = dist?.name || '-';
      const mah = neighborhoods.filter(n => String(n.town_id) === String(t.id)).length;
      const koy = villages.filter(v => String(v.town_id) === String(t.id)).length;
      return { id: t.id, name: t.name, distName, district_id: t.district_id, mah, koy };
    }).sort((a, b) => {
      const c = a.distName.localeCompare(b.distName, 'tr');
      if (c !== 0) return c;
      return (a.name || '').localeCompare(b.name || '', 'tr');
    });
  }, [towns, districts, neighborhoods, villages]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterDistrict && String(r.district_id || '') !== String(filterDistrict)) return false;
      if (searchTerm && !r.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [rows, filterDistrict, searchTerm]);

  const byDistrict = useMemo(() => {
    const m = {};
    for (const r of rows) m[r.distName] = (m[r.distName] || 0) + 1;
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0], 'tr'));
  }, [rows]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Beldeler yükleniyor...</div>
    );
  }
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Özet kart */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-amber-900 dark:text-amber-200">
          <span><span className="font-semibold">Toplam Belde:</span> {towns.length}</span>
          <span><span className="font-semibold">Görüntülenen:</span> {filtered.length}</span>
          <span><span className="font-semibold">Toplam Mahalle (beldelerde):</span> {rows.reduce((s, r) => s + r.mah, 0)}</span>
          <span><span className="font-semibold">Toplam Köy (beldelerde):</span> {rows.reduce((s, r) => s + r.koy, 0)}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {byDistrict.map(([name, c]) => (
            <span key={name} className="inline-flex items-center px-2 py-1 rounded-full bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
              {name}: <strong className="ml-1">{c}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <input
          type="text"
          placeholder="Belde adı ile ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-gray-700 dark:text-gray-300">İlçe:</label>
          <select
            value={filterDistrict}
            onChange={(e) => setFilterDistrict(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">Tümü</option>
            {districts
              .filter(d => towns.some(t => String(t.district_id) === String(d.id)))
              .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'))
              .map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
          </select>
          {(filterDistrict || searchTerm) && (
            <button
              onClick={() => { setFilterDistrict(''); setSearchTerm(''); }}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">İlçe</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Belde</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Mahalle</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Köy</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Toplam</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm || filterDistrict ? 'Filtreye uyan belde yok' : 'Henüz belde eklenmemiş'}
                </td>
              </tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300">{r.distName}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{r.name}</td>
                <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300">{r.mah}</td>
                <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300">{r.koy}</td>
                <td className="px-4 py-2.5 text-sm text-right font-semibold text-indigo-700 dark:text-indigo-300">{r.mah + r.koy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TownsOverviewPage;
