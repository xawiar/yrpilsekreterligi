import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';

// İlçe ismi normalizasyonu — sandık verisindeki ismi GeoJSON'daki isimle eşleştir
// (case-insensitive + Türkçe karakter tolere + "X Merkez" → "Merkez" gibi varyantlar)
const normalizeName = (s) => {
  if (!s) return '';
  return String(s).trim().toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/i̇/g, 'i')
    .replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/^elazig\s+merkez$/, 'merkez')
    .replace(/\s+merkez$/, 'merkez');
};

const DEFAULT_FILL = '#cbd5e1'; // slate-300 — veri yok
const HOVER_GLOW = 'rgba(14, 165, 233, 0.55)';

/**
 * İl haritası — her ilçe lider partinin rengiyle boyanır.
 *
 * Props:
 *   geojsonUrl — public/ altında geojson dosyasının yolu (ör. /maps/elazig.geojson)
 *   results    — sandık-bazlı sonuçlar dizisi (filteredResults). Her item: { district_name, cb_votes, mv_votes, mayor_votes, ... }
 *   voteField  — hangi alan kullanılsın: 'cb_votes' | 'mv_votes' | 'mayor_votes'
 *   pickColor  — (name, idx) => '#hex' — parti adından renk üreten fonksiyon
 *   onDistrictClick — (districtName) => void — ilçe tıklanınca tetiklenir
 *   selectedDistrict — şu an seçili ilçenin adı (highlight için)
 *   theme — 'light' | 'dark' — etiket ve border rengi
 */
const DistrictMap = ({
  geojsonUrl = '/maps/elazig.geojson',
  results = [],
  voteField = 'cb_votes',
  pickColor,
  onDistrictClick,
  selectedDistrict = null,
  theme = 'light',
  title = 'İlçe Dağılımı',
  subtitle = '',
}) => {
  const [geojson, setGeojson] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // GeoJSON yükle (bir kez)
  useEffect(() => {
    let cancelled = false;
    fetch(geojsonUrl)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setGeojson(data); })
      .catch(() => { if (!cancelled) setGeojson(null); });
    return () => { cancelled = true; };
  }, [geojsonUrl]);

  // İlçe-bazlı sonuçlar: { 'merkez': { leader, leaderPct, total, voters, voteMap } }
  const districtData = useMemo(() => {
    const byDistrict = {};
    (results || []).forEach(r => {
      const key = normalizeName(r.district_name);
      if (!key) return;
      if (!byDistrict[key]) {
        byDistrict[key] = { voteMap: {}, voters: 0, ballotCount: 0, originalName: r.district_name };
      }
      const votes = r[voteField];
      if (votes && typeof votes === 'object') {
        Object.keys(votes).forEach(party => {
          byDistrict[key].voteMap[party] = (byDistrict[key].voteMap[party] || 0) + (parseInt(votes[party]) || 0);
        });
      }
      byDistrict[key].voters += parseInt(r.total_voters) || 0;
      byDistrict[key].ballotCount += 1;
    });

    Object.keys(byDistrict).forEach(key => {
      const d = byDistrict[key];
      const entries = Object.entries(d.voteMap);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      d.total = total;
      if (total > 0) {
        const sorted = entries.sort((a, b) => b[1] - a[1]);
        d.leader = sorted[0][0];
        d.leaderPct = (sorted[0][1] / total) * 100;
        d.sortedParties = sorted.map(([name, v]) => ({ name, value: v, pct: (v / total) * 100 }));
      } else {
        d.sortedParties = [];
      }
    });
    return byDistrict;
  }, [results, voteField]);

  // Path hesapla
  const { paths, labels, width, height } = useMemo(() => {
    if (!geojson) return { paths: [], labels: [], width: 700, height: 480 };
    const w = 700, h = 480;
    const projection = geoMercator().fitSize([w - 24, h - 24], geojson);
    const pathGen = geoPath(projection);
    const partyIdxMap = {};
    let partyCounter = 0;
    const pickPartyColor = (name) => {
      if (!name) return DEFAULT_FILL;
      if (!(name in partyIdxMap)) {
        partyIdxMap[name] = partyCounter++;
      }
      return pickColor ? pickColor(name, partyIdxMap[name]) : '#0ea5e9';
    };

    const out = [];
    const lbls = [];
    geojson.features.forEach((f) => {
      const name = f.properties?.name || f.properties?.NAME_2 || '';
      const key = normalizeName(name);
      const data = districtData[key];
      const fill = data && data.leader ? pickPartyColor(data.leader) : DEFAULT_FILL;
      const d = pathGen(f);
      if (!d) return;
      out.push({ name, key, fill, d, data });
      const c = pathGen.centroid(f);
      if (c && !isNaN(c[0])) lbls.push({ name, x: c[0], y: c[1] });
    });
    return { paths: out, labels: lbls, width: w, height: h };
  }, [geojson, districtData, pickColor]);

  // Lejand
  const legend = useMemo(() => {
    const counts = {};
    paths.forEach(p => {
      if (p.data && p.data.leader) {
        counts[p.data.leader] = (counts[p.data.leader] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        name,
        count,
        color: pickColor ? pickColor(name, i) : '#0ea5e9'
      }));
  }, [paths, pickColor]);

  const isDark = theme === 'dark';
  const labelStroke = isDark ? '#020617' : 'rgba(0,0,0,0.7)';
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.70)' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15, 23, 42, 0.06)';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  if (!geojson) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textMuted }}>
        Harita yükleniyor…
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rounded-2xl p-4 relative" style={{ background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(15, 23, 42, 0.06)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div style={{ fontSize: 16 }}>📍</div>
          <div>
            <div style={{ fontWeight: 700, color: textPrimary, fontSize: 14 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: textMuted, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{subtitle}</div>}
          </div>
        </div>
        {legend.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {legend.map(l => (
              <div key={l.name} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.15)' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>{l.name}</span>
                <span style={{ fontSize: 10, color: textMuted, fontFamily: 'monospace' }}>{l.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <g transform="translate(12, 12)">
          {paths.map((p, i) => {
            const isSelected = selectedDistrict && normalizeName(selectedDistrict) === p.key;
            const isHovered = hovered === p.key;
            return (
              <path
                key={p.key + i}
                d={p.d}
                fill={p.fill}
                stroke={isDark ? '#0f172a' : '#ffffff'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                style={{
                  cursor: 'pointer',
                  transition: 'filter 0.2s, stroke-width 0.2s',
                  filter: isHovered || isSelected
                    ? `brightness(1.15) drop-shadow(0 4px 12px ${HOVER_GLOW})`
                    : 'none',
                  transformOrigin: 'center',
                  animation: `dm-fade-in 0.5s ${i * 70}ms ease-out backwards`,
                }}
                onMouseEnter={(e) => {
                  setHovered(p.key);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onDistrictClick && onDistrictClick(p.name, p.data)}
              />
            );
          })}
          {labels.map((l, i) => (
            <text
              key={l.name + i}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              style={{
                fontSize: 9,
                fontWeight: 700,
                fill: '#ffffff',
                pointerEvents: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              }}
              stroke={labelStroke}
              strokeWidth="0.4"
              paintOrder="stroke"
            >
              {l.name}
            </text>
          ))}
        </g>
      </svg>

      {hovered && (() => {
        const p = paths.find(x => x.key === hovered);
        if (!p) return null;
        const data = p.data;
        return (
          <div
            style={{
              position: 'absolute',
              left: tooltipPos.x,
              top: tooltipPos.y - 16,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(15, 23, 42, 0.96)',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              pointerEvents: 'none',
              zIndex: 50,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
            {data && data.leader ? (
              <>
                <div style={{ color: '#38bdf8', marginTop: 4, fontWeight: 600, fontFamily: 'monospace' }}>
                  🏆 {data.leader} · %{data.leaderPct.toFixed(1)}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>
                  {data.total.toLocaleString('tr-TR')} oy · {data.ballotCount} sandık
                </div>
              </>
            ) : (
              <div style={{ color: '#94a3b8', marginTop: 4, fontFamily: 'monospace', fontSize: 10 }}>Veri yok</div>
            )}
          </div>
        );
      })()}

      <style>{`
        @keyframes dm-fade-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default DistrictMap;
