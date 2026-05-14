import React, { useState, useEffect, useMemo } from 'react';

/**
 * Public Secim Sonuclari Sayfasi
 * Cloud Function API'den veri alir — Firestore rules ile ugrasma yok
 * Admin component'inden TAMAMEN bagimsiz, temiz, basit
 */

const API_URL = '/api/election-results';
const COLORS = ['#E30613','#2563eb','#f59e0b','#10b981','#8b5cf6','#ec4899','#6366f1','#14b8a6','#f97316','#64748b'];

export default function PublicElectionResultsPage({ electionIdProp }) {
  // electionIdProp varsa kullan, yoksa URL'den parse et
  const electionId = electionIdProp || window.location.pathname.split('/public/election-results/')[1]?.split('/')[0] || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ district: '', town: '', neighborhood: '' });

  // Veri cek + 60sn polling
  useEffect(() => {
    if (!electionId) return;
    const fetchData = () => {
      fetch(`${API_URL}?id=${encodeURIComponent(electionId)}`)
        .then(r => r.json())
        .then(json => {
          if (json.success) { setData(json.data); setError(null); }
          else setError('Veri alinamadi');
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [electionId]);

  // Filtre secenekleri
  const filterOptions = useMemo(() => {
    if (!data?.ballotBoxResults) return { districts: [], towns: [], neighborhoods: [] };
    const d = new Set(), t = new Set(), n = new Set();
    data.ballotBoxResults.forEach(bb => {
      if (bb.districtName) d.add(bb.districtName);
      if (bb.townName) t.add(bb.townName);
      if (bb.neighborhoodName) n.add(bb.neighborhoodName);
    });
    return { districts: [...d].sort(), towns: [...t].sort(), neighborhoods: [...n].sort() };
  }, [data]);

  // Filtrelenmis aggregate
  const filtered = useMemo(() => {
    if (!data?.ballotBoxResults) return { boxes: [], cb: empty(), mv: empty(), mayor: empty(), prov: empty(), muni: empty(), voters: 0, used: 0, valid: 0, invalid: 0 };
    let boxes = data.ballotBoxResults;
    if (filter.district) boxes = boxes.filter(b => b.districtName === filter.district);
    if (filter.town) boxes = boxes.filter(b => b.townName === filter.town);
    if (filter.neighborhood) boxes = boxes.filter(b => b.neighborhoodName === filter.neighborhood);

    const cb = {}, mv = {}, mayor = {}, prov = {}, muni = {};
    let voters = 0, used = 0, valid = 0, invalid = 0;
    boxes.forEach(b => {
      voters += b.totalVoters || 0;
      used += b.usedVotes || 0;
      valid += b.validVotes || 0;
      invalid += b.invalidVotes || 0;
      aggregate(b.cbVotes, cb);
      aggregate(b.mvVotes, mv);
      aggregate(b.mayorVotes, mayor);
      aggregate(b.provincialAssemblyVotes, prov);
      aggregate(b.municipalCouncilVotes, muni);
    });

    return { boxes, cb: toSorted(cb), mv: toSorted(mv), mayor: toSorted(mayor), prov: toSorted(prov), muni: toSorted(muni), voters, used, valid, invalid };
  }, [data, filter]);

  if (loading) return <Loading />;
  if (error || !data) return <Error message={error} />;

  const el = data.election || {};
  const hasFilter = filter.district || filter.town || filter.neighborhood;
  const openedRatio = data.totalBallotBoxes > 0 ? ((data.openedBallotBoxes / data.totalBallotBoxes) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{el.name || 'Secim Sonuclari'}</h1>
            <p className="text-xs text-gray-500">{el.date ? new Date(el.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
          </div>
          <a href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Ana Sayfa</a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">

        {/* Ozet Istatistikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Toplam Sandik" value={fmt(data.totalBallotBoxes)} />
          <Stat label="Acilan Sandik" value={fmt(data.openedBallotBoxes)} sub={`%${openedRatio}`} accent />
          <Stat label="Kayitli Secmen" value={fmt(hasFilter ? filtered.voters : data.totalVoters)} />
          <Stat label="Oy Kullanan" value={fmt(hasFilter ? filtered.used || filtered.valid : data.usedVotes || data.validVotes)} />
        </div>

        {/* Bolge Filtresi */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bolge Filtresi</p>
            {hasFilter && <button onClick={() => setFilter({ district: '', town: '', neighborhood: '' })} className="text-xs text-red-500 hover:underline">Temizle</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={filter.district} onChange={v => setFilter({ district: v, town: '', neighborhood: '' })} placeholder="Tum Ilceler" options={filterOptions.districts} />
            <Select value={filter.town} onChange={v => setFilter({ ...filter, town: v, neighborhood: '' })} placeholder="Tum Beldeler" options={filterOptions.towns} />
            <Select value={filter.neighborhood} onChange={v => setFilter({ ...filter, neighborhood: v })} placeholder="Tum Mahalleler" options={filterOptions.neighborhoods} />
          </div>
          {hasFilter && <p className="mt-2 text-xs text-gray-400">{filtered.boxes.length} sandiktan sonuclar gosteriliyor</p>}
        </div>

        {/* Sonuc Bloklari */}
        {filtered.cb.items.length > 0 && <ResultBlock title="Cumhurbaskani Secimi" icon="🗳️" data={filtered.cb} />}
        {filtered.mv.items.length > 0 && <ResultBlock title="Milletvekili Secimi" icon="🏛️" data={filtered.mv} />}
        {filtered.mayor.items.length > 0 && <ResultBlock title="Belediye Baskani" icon="🏢" data={filtered.mayor} />}
        {filtered.prov.items.length > 0 && <ResultBlock title="Il Genel Meclisi" icon="📋" data={filtered.prov} />}
        {filtered.muni.items.length > 0 && <ResultBlock title="Belediye Meclisi" icon="📜" data={filtered.muni} />}

        {/* Hic sonuc yoksa */}
        {filtered.cb.items.length === 0 && filtered.mv.items.length === 0 && filtered.mayor.items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-lg">Secim sonucu henuz girilmemis.</p>
            <p className="text-gray-300 text-sm mt-1">Sonuclar girildikce burada gorunecektir.</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-6">
          Son guncelleme: {data.updatedAt ? new Date(data.updatedAt).toLocaleString('tr-TR') : '-'} · Otomatik yenileme: 60sn
        </p>
      </div>
    </div>
  );
}

// === Alt Bilesenler ===

function Stat({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl p-3 sm:p-4 border ${accent ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-0.5 ${accent ? 'text-red-600' : 'text-gray-900'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p className="text-xs text-red-500 font-semibold mt-0.5">{sub}</p>}
    </div>
  );
}

function Select({ value, onChange, placeholder, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-full">
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ResultBlock({ title, icon, data }) {
  if (!data.items || data.items.length === 0) return null;
  const winner = data.items[0];
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">{icon} {title}</h2>
          <span className="text-sm text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>Toplam: {fmt(data.total)} oy</span>
        </div>
        {/* Kazanan */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 sm:p-4 flex items-center gap-3 border border-green-100">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl shrink-0">🏆</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Kazanan</p>
            <p className="text-base sm:text-lg font-bold text-gray-900 truncate">{winner.name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl sm:text-2xl font-bold text-green-700" style={{ fontVariantNumeric: 'tabular-nums' }}>%{winner.percent}</p>
            <p className="text-xs text-gray-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(winner.votes)} oy</p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-2.5">
        {data.items.map((item, i) => (
          <div key={item.name}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-300 w-4 text-right shrink-0">#{i + 1}</span>
                <span className={`text-sm truncate ${i === 0 ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{item.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-xs text-gray-400 hidden sm:inline" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(item.votes)} oy</span>
                <span className="text-sm font-bold w-14 text-right" style={{ color: COLORS[i % COLORS.length], fontVariantNumeric: 'tabular-nums' }}>%{item.percent}</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(item.percent, 100)}%`, background: COLORS[i % COLORS.length] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: '#E30613' }} />
        <p className="text-gray-400 text-sm">Yukleniyor...</p>
      </div>
    </div>
  );
}

function Error({ message }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 font-medium">{message || 'Bir hata olustu'}</p>
        <a href="/" className="text-blue-500 text-sm mt-2 inline-block hover:underline">Ana sayfaya don</a>
      </div>
    </div>
  );
}

// === Yardimci ===
function aggregate(votes, target) {
  if (!votes || typeof votes !== 'object') return;
  Object.entries(votes).forEach(([k, v]) => { target[k] = (target[k] || 0) + (parseInt(v) || 0); });
}
function toSorted(obj) {
  const total = Object.values(obj).reduce((s, v) => s + v, 0);
  return { items: Object.entries(obj).map(([name, votes]) => ({ name, votes, percent: total > 0 ? parseFloat(((votes / total) * 100).toFixed(2)) : 0 })).sort((a, b) => b.votes - a.votes), total };
}
function empty() { return { items: [], total: 0 }; }
function fmt(n) { return (n || 0).toLocaleString('tr-TR'); }
