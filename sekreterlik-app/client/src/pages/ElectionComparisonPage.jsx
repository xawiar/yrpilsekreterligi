import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

const ElectionComparisonPage = () => {
  const toast = useToast();
  const [elections, setElections] = useState([]);
  const [election1Id, setElection1Id] = useState('');
  const [election2Id, setElection2Id] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchElections = async () => {
      try {
        const data = await ApiService.getElections();
        setElections(Array.isArray(data) ? data : data.data || []);
      } catch (err) {
        toast.error('Seçimler yüklenirken hata oluştu');
      }
    };
    fetchElections();
  }, []);

  const handleCompare = async () => {
    if (!election1Id || !election2Id) {
      toast.warning('Lütfen iki seçim seçin');
      return;
    }
    if (election1Id === election2Id) {
      toast.warning('Farklı iki seçim seçmelisiniz');
      return;
    }

    setLoading(true);
    try {
      const [results1, results2] = await Promise.all([
        ApiService.getElectionResults(election1Id),
        ApiService.getElectionResults(election2Id),
      ]);

      const r1 = Array.isArray(results1) ? results1 : results1.data || [];
      const r2 = Array.isArray(results2) ? results2 : results2.data || [];

      // Filter approved only
      const approved1 = r1.filter(r => r.approval_status !== 'rejected');
      const approved2 = r2.filter(r => r.approval_status !== 'rejected');

      // Aggregate votes by party
      const aggregate = (results, voteField) => {
        const totals = {};
        let totalValid = 0;
        let totalVoters = 0;
        let totalUsed = 0;
        results.forEach(r => {
          totalValid += parseInt(r.valid_votes) || 0;
          totalVoters += parseInt(r.total_voters) || 0;
          totalUsed += parseInt(r.used_votes) || 0;
          const votes = r[voteField];
          if (votes && typeof votes === 'object') {
            Object.entries(votes).forEach(([party, count]) => {
              totals[party] = (totals[party] || 0) + (parseInt(count) || 0);
            });
          }
        });
        return { totals, totalValid, totalVoters, totalUsed, ballotBoxCount: results.length };
      };

      // Detect which vote field to use
      const detectVoteField = (results) => {
        const fields = ['cb_votes', 'mv_votes', 'mayor_votes', 'municipal_council_votes', 'provincial_assembly_votes'];
        for (const field of fields) {
          if (results.some(r => r[field] && Object.keys(r[field]).length > 0)) return field;
        }
        return 'mv_votes';
      };

      const voteField1 = detectVoteField(approved1);
      const voteField2 = detectVoteField(approved2);

      const agg1 = aggregate(approved1, voteField1);
      const agg2 = aggregate(approved2, voteField2);

      // Combine all parties
      const allParties = [...new Set([...Object.keys(agg1.totals), ...Object.keys(agg2.totals)])];

      const partyComparison = allParties.map(party => {
        const votes1 = agg1.totals[party] || 0;
        const votes2 = agg2.totals[party] || 0;
        const pct1 = agg1.totalValid > 0 ? (votes1 / agg1.totalValid * 100) : 0;
        const pct2 = agg2.totalValid > 0 ? (votes2 / agg2.totalValid * 100) : 0;
        return {
          party,
          votes1, votes2,
          diff: votes2 - votes1,
          pct1: pct1.toFixed(2),
          pct2: pct2.toFixed(2),
          pctDiff: (pct2 - pct1).toFixed(2),
        };
      }).sort((a, b) => b.votes2 - a.votes2);

      const e1 = elections.find(e => String(e.id) === String(election1Id));
      const e2 = elections.find(e => String(e.id) === String(election2Id));

      setComparison({
        election1: e1, election2: e2,
        agg1, agg2,
        partyComparison,
        turnout1: agg1.totalVoters > 0 ? (agg1.totalUsed / agg1.totalVoters * 100).toFixed(1) : 0,
        turnout2: agg2.totalVoters > 0 ? (agg2.totalUsed / agg2.totalVoters * 100).toFixed(1) : 0,
      });
    } catch (err) {
      toast.error('Karşılaştırma yapılırken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seçim Karşılaştırması</h1>

      {/* Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seçim 1 (Eski)</label>
            <select value={election1Id} onChange={e => setElection1Id(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500">
              <option value="">Seçim seçin...</option>
              {elections.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.date})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seçim 2 (Yeni)</label>
            <select value={election2Id} onChange={e => setElection2Id(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500">
              <option value="">Seçim seçin...</option>
              {elections.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.date})</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={handleCompare} disabled={loading}
          className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all active:scale-95 disabled:opacity-50">
          {loading ? 'Karşılaştırılıyor...' : 'Karşılaştır'}
        </button>
      </div>

      {/* Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Toplam Seçmen</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{comparison.agg1.totalVoters.toLocaleString('tr-TR')} → {comparison.agg2.totalVoters.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Katılım Oranı</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">%{comparison.turnout1} → %{comparison.turnout2}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Geçerli Oy</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{comparison.agg1.totalValid.toLocaleString('tr-TR')} → {comparison.agg2.totalValid.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sandık Sayısı</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{comparison.agg1.ballotBoxCount} → {comparison.agg2.ballotBoxCount}</p>
            </div>
          </div>

          {/* Party Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Parti Bazlı Karşılaştırma</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Parti</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{comparison.election1?.name}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{comparison.election2?.name}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Fark</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">% Değişim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {comparison.partyComparison.map(p => (
                    <tr key={p.party} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{p.party}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{p.votes1.toLocaleString('tr-TR')} (%{p.pct1})</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{p.votes2.toLocaleString('tr-TR')} (%{p.pct2})</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${p.diff > 0 ? 'text-green-600 dark:text-green-400' : p.diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                        {p.diff > 0 ? '+' : ''}{p.diff.toLocaleString('tr-TR')}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${parseFloat(p.pctDiff) > 0 ? 'text-green-600 dark:text-green-400' : parseFloat(p.pctDiff) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                        {parseFloat(p.pctDiff) > 0 ? '+' : ''}{p.pctDiff}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectionComparisonPage;
