import { useMemo } from 'react';

const normalizeName = (s) => {
  if (!s) return '';
  return String(s).trim().toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/i̇/g, 'i')
    .replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/^elazig\s+merkez$/, 'merkez')
    .replace(/\s+merkez$/, 'merkez');
};

/**
 * İlçe detay paneli — DistrictMap'in yanında durur.
 * selectedDistrict varsa o ilçenin verileri, yoksa il geneli özet.
 */
const DistrictDetailPanel = ({
  results = [],
  selectedDistrict = null,
  voteField = 'cb_votes',
  pickColor,
  onClear,
  title = 'İlçe Detayı',
}) => {
  const data = useMemo(() => {
    const filtered = selectedDistrict
      ? (results || []).filter(r => normalizeName(r.district_name) === normalizeName(selectedDistrict))
      : (results || []);

    const voteMap = {};
    let voters = 0;
    let usedVotes = 0;
    let invalidVotes = 0;
    let ballotCount = 0;

    filtered.forEach(r => {
      const votes = r[voteField];
      if (votes && typeof votes === 'object') {
        Object.keys(votes).forEach(party => {
          voteMap[party] = (voteMap[party] || 0) + (parseInt(votes[party]) || 0);
        });
      }
      voters += parseInt(r.total_voters) || 0;
      usedVotes += parseInt(r.used_votes) || 0;
      invalidVotes += parseInt(r.invalid_votes) || 0;
      ballotCount += 1;
    });

    const total = Object.values(voteMap).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(voteMap)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    return {
      sorted,
      total,
      voters,
      usedVotes,
      invalidVotes,
      ballotCount,
      leader: sorted[0] || null,
    };
  }, [results, selectedDistrict, voteField]);

  const leader = data.leader;
  const leaderColor = leader ? (pickColor ? pickColor(leader.name, 0) : '#0ea5e9') : '#0ea5e9';
  const hasData = data.total > 0;
  const isFiltered = !!selectedDistrict;

  return (
    <div
      className="rounded-2xl backdrop-blur-xl overflow-hidden h-full flex flex-col"
      style={{
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-wrap gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>📊</span>
          <div>
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-slate-400">
              {isFiltered ? selectedDistrict : 'İl Geneli'}
            </div>
          </div>
        </div>
        {isFiltered && (
          <button
            onClick={onClear}
            className="text-[11px] font-mono px-3 py-1 rounded-lg transition-all"
            style={{
              background: 'rgba(14,165,233,0.10)',
              border: '1px solid rgba(14,165,233,0.25)',
              color: '#38bdf8',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(14,165,233,0.20)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(14,165,233,0.10)'; }}
          >
            ✕ İL GENELİNE DÖN
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-1 overflow-y-auto">
        {!hasData ? (
          <div className="text-center py-12 text-slate-500">
            <div style={{ fontSize: 36, opacity: 0.4, marginBottom: 8 }}>📭</div>
            <div className="text-sm">Henüz veri yok</div>
            <div className="text-[11px] text-slate-600 mt-1 font-mono">
              {isFiltered ? 'Bu ilçeden sonuç gelmedi' : 'Sandık sonuçları bekleniyor'}
            </div>
          </div>
        ) : (
          <>
            {/* Lider Kartı */}
            {leader && (
              <div
                className="relative overflow-hidden rounded-2xl px-5 py-4 mb-4"
                style={{
                  background: `linear-gradient(135deg, ${leaderColor} 0%, rgba(0,0,0,0.5) 130%)`,
                }}
              >
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 56, opacity: 0.15 }}>🏆</div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/80 font-bold">
                    Şu an önde
                  </div>
                  <div className="text-2xl font-black text-white mt-1 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                    {leader.name}
                  </div>
                  <div className="text-sm font-mono font-bold text-white mt-1">
                    %{leader.pct.toFixed(1)} · {leader.value.toLocaleString('tr-TR')} oy
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown List */}
            <div className="flex flex-col gap-1.5">
              {data.sorted.slice(0, 12).map((item, i) => {
                const color = pickColor ? pickColor(item.name, i) : '#0ea5e9';
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      fontSize: 12,
                      animation: `dpanel-slide-in 0.35s ${i * 50}ms ease-out backwards`,
                    }}
                  >
                    <div
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                        background: i === 0 ? leaderColor : 'rgba(0,0,0,0.4)',
                        color: i === 0 ? '#fff' : '#cbd5e1',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="font-semibold flex-1 truncate" style={{ color }}>{item.name}</div>
                    <div className="h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ width: 70, background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${item.pct}%`,
                          background: color,
                          borderRadius: 3,
                          transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                      />
                    </div>
                    <div className="font-mono font-extrabold text-right text-white" style={{ fontSize: 13, width: 52 }}>
                      %{item.pct.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div
                className="px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #10b981' }}
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Toplam Seçmen</div>
                <div className="text-base font-extrabold font-mono text-white mt-0.5">{data.voters.toLocaleString('tr-TR')}</div>
              </div>
              <div
                className="px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #f59e0b' }}
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Sandık Sayısı</div>
                <div className="text-base font-extrabold font-mono text-white mt-0.5">{data.ballotCount}</div>
              </div>
              <div
                className="px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #06b6d4' }}
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Kullanılan</div>
                <div className="text-base font-extrabold font-mono text-white mt-0.5">{data.usedVotes.toLocaleString('tr-TR')}</div>
              </div>
              <div
                className="px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #dc2626' }}
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Geçersiz</div>
                <div className="text-base font-extrabold font-mono text-white mt-0.5">{data.invalidVotes.toLocaleString('tr-TR')}</div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes dpanel-slide-in {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default DistrictDetailPanel;
