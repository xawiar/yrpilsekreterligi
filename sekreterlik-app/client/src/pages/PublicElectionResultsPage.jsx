import React, { useEffect, useMemo, useRef, useState } from 'react';
import PublicApiService from '../utils/PublicApiService';
import { PARTY_COLORS } from '../utils/partyColors';
import DistrictMap from '../components/Dashboard/shared/DistrictMap';
import DistrictDetailPanel from '../components/Dashboard/shared/DistrictDetailPanel';

/**
 * Public Sandık Komuta Merkezi — koyu cyber dashboard, Elazığ haritası,
 * CB/MV tab switcher, parti detay paneli, canlı sayaç, tam ekran modu.
 *
 * Tasarım kaynağı: secim-sandik ElectionResultsPage readOnly bölümü.
 * Veri kaynağı: PublicApiService.getElectionDetail (Cloud Function)
 */

const ITEM_COLOR_PALETTE = [
  '#0ea5e9', '#dc2626', '#16a34a', '#a855f7', '#ea580c',
  '#fbbf24', '#ec4899', '#14b8a6', '#6366f1', '#f97316',
  '#84cc16', '#06b6d4', '#d946ef', '#f59e0b', '#8b5cf6',
];
const pickItemColor = (name, idx = 0) => {
  if (name && PARTY_COLORS[name] && PARTY_COLORS[name].border) return PARTY_COLORS[name].border;
  return ITEM_COLOR_PALETTE[idx % ITEM_COLOR_PALETTE.length];
};

const fmt = (n) => (parseInt(n) || 0).toLocaleString('tr-TR');

// API response → DistrictMap'in beklediği snake_case sandık formatı
const adaptBallotBoxes = (apiBoxes = []) => apiBoxes.map((bb) => ({
  id: bb.resultId || bb.ballotBoxId,
  ballot_box_id: bb.ballotBoxId,
  ballot_number: bb.ballotNumber,
  district_name: bb.districtName || '',
  town_name: bb.townName || '',
  neighborhood_name: bb.neighborhoodName || '',
  village_name: bb.villageName || '',
  total_voters: bb.totalVoters || 0,
  used_votes: bb.usedVotes || 0,
  valid_votes: bb.validVotes || 0,
  invalid_votes: bb.invalidVotes || 0,
  cb_votes: bb.cbVotes || {},
  mv_votes: bb.mvVotes || {},
  mayor_votes: bb.mayorVotes || {},
  provincial_assembly_votes: bb.provincialAssemblyVotes || {},
  municipal_council_votes: bb.municipalCouncilVotes || {},
  referendum_votes: bb.referendumVotes || {},
}));

export default function PublicElectionResultsPage({ electionIdProp }) {
  const electionId =
    electionIdProp ||
    window.location.pathname.split('/public/election-results/')[1]?.split('/')[0] ||
    '';

  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapVoteField, setMapVoteField] = useState('cb_votes');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  // Saat — her saniye güncelle
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Body height override + grayscale dark mode bypass
  useEffect(() => {
    const prev = {
      h: document.documentElement.style.height,
      b: document.body.style.height,
      ho: document.documentElement.style.overflow,
      bo: document.body.style.overflow,
      bg: document.body.style.background,
    };
    document.documentElement.style.height = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflow = 'visible';
    document.body.style.overflow = 'visible';
    document.body.style.background = '#0f172a';
    return () => {
      document.documentElement.style.height = prev.h;
      document.body.style.height = prev.b;
      document.documentElement.style.overflow = prev.ho;
      document.body.style.overflow = prev.bo;
      document.body.style.background = prev.bg;
    };
  }, []);

  // Veri çek + 30sn polling (canlı dashboard)
  useEffect(() => {
    if (!electionId) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        const detail = await PublicApiService.getElectionDetail(electionId);
        if (cancelled) return;
        if (detail) {
          setData(detail);
          setError(null);
        } else {
          setError('Veri alınamadı');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Bir hata oluştu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [electionId]);

  // Document title
  useEffect(() => {
    if (data?.election?.name) document.title = data.election.name;
  }, [data]);

  // Fullscreen
  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  };
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // Sandık verileri adapte
  const ballotBoxes = useMemo(() => adaptBallotBoxes(data?.ballotBoxResults || []), [data]);
  const isGenel = data?.election?.type === 'genel';

  // Aktif harita alanı (Genel'de toggle, diğerinde otomatik)
  const activeField = useMemo(() => {
    if (isGenel) return mapVoteField;
    const el = data?.election;
    if (el?.type === 'yerel') return 'mayor_votes';
    if (el?.type === 'referandum') return 'referendum_votes';
    return 'cb_votes';
  }, [isGenel, mapVoteField, data]);

  // Aktif kategorinin sıralı sonuçlarını çıkar — API'den hazır geliyor
  const categoryResults = useMemo(() => {
    if (!data) return [];
    if (activeField === 'cb_votes') return data.cbResults || [];
    if (activeField === 'mv_votes') return data.mvResults || [];
    if (activeField === 'mayor_votes') return data.mayorResults || [];
    if (activeField === 'provincial_assembly_votes') return data.provincialResults || [];
    if (activeField === 'municipal_council_votes') return data.municipalResults || [];
    return [];
  }, [data, activeField]);

  const panelTitle =
    activeField === 'cb_votes' ? 'Cumhurbaşkanı Detayı'
      : activeField === 'mv_votes' ? 'Milletvekili Detayı'
      : activeField === 'mayor_votes' ? 'Belediye Başkanı Detayı'
      : 'Detay';

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error} />;

  const el = data.election || {};
  const totalVotes = (categoryResults || []).reduce((s, r) => s + (r.votes || 0), 0);
  const validVotes = data.validVotes || 0;
  const invalidVotes = data.invalidVotes || 0;
  const openedRatio = data.totalBallotBoxes > 0
    ? ((data.openedBallotBoxes / data.totalBallotBoxes) * 100).toFixed(1)
    : '0';

  // Yatay topbar stat kart (sağda)
  const StatPill = ({ label, value, sub }) => (
    <div
      className="px-3 py-2 rounded-xl backdrop-blur min-w-[110px]"
      style={{
        background: 'rgba(15,23,42,0.55)',
        border: '1px solid rgba(56,189,248,0.18)',
      }}
    >
      <div className="text-[9px] uppercase tracking-widest text-slate-400 font-mono">{label}</div>
      <div className="text-xl font-extrabold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="text-[10px] font-bold text-sky-400 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="results-page-container relative"
      style={{
        background:
          'radial-gradient(ellipse 1100px 700px at 25% 0%, rgba(14,165,233,0.30), transparent 60%), ' +
          'radial-gradient(ellipse 900px 600px at 80% 30%, rgba(2,132,199,0.26), transparent 65%), ' +
          'radial-gradient(ellipse 800px 500px at 50% 100%, rgba(56,189,248,0.22), transparent 60%), ' +
          'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #1e3a8a 100%)',
        minHeight: '100vh',
        width: '100%',
        padding: '24px 24px 80px',
      }}
    >
      <style>{`
        .results-page-container:fullscreen,
        .results-page-container:-webkit-full-screen { padding: 28px 40px; overflow-y: auto; }
        .district-map-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .district-map-grid { grid-template-columns: 1fr; }
        }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 90%)',
        }}
      />

      <div className="w-full relative" style={{ maxWidth: '100%' }}>

        {/* MASTHEAD */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-base"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                boxShadow: '0 0 24px rgba(14,165,233,0.5), inset 0 -2px 0 rgba(0,0,0,0.3)',
              }}
            >S</div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">Sandık Komuta Merkezi</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                Halka Açık · Canlı
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest backdrop-blur"
              style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.4)', color: '#7dd3fc' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0ea5e9', boxShadow: '0 0 8px #0ea5e9', animation: 'pulse-dot 1s infinite' }} />
              CANLI
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest backdrop-blur"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fde68a' }}
              title="Bu sayfa halka açık paylaşım sürümüdür"
            >▲ HALKA AÇIK</span>
            <span
              className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider font-mono backdrop-blur"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)' }}
            >
              {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest backdrop-blur inline-flex items-center gap-1.5"
              style={{
                background: isFullscreen ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'rgba(255,255,255,0.06)',
                border: isFullscreen ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(56,189,248,0.30)',
                color: isFullscreen ? '#0a0e1a' : '#fff',
              }}
            >
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              {isFullscreen ? 'ÇIK' : 'TAM EKRAN'}
            </button>
            <button
              onClick={async () => {
                const url = window.location.href;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: el.name || 'Seçim Sonuçları', url });
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                    alert('Link panoya kopyalandı');
                  }
                } catch (_) { /* ignore */ }
              }}
              className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest backdrop-blur inline-flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                border: '1px solid rgba(56,189,248,0.4)',
                color: '#fff',
              }}
            >
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-2.684-4.026m2.684 4.026A3 3 0 0118 15zm-9.032-4.026A3 3 0 016 9m12 6a3 3 0 11-6 0 3 3 0 016 0zM6 9a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              PAYLAŞ
            </button>
          </div>
        </div>

        {/* HEADLINE + STATS */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="flex-1 min-w-[280px]">
            <div
              className="font-extrabold uppercase tracking-[3px] mb-1.5 font-mono"
              style={{ fontSize: '11px', color: '#fbbf24' }}
            >
              ▲ {el.date ? new Date(el.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              {el.type === 'cb' && el.round && ` · ${el.round === 1 ? '1. TUR' : '2. TUR'}`}
              {' · ELAZIĞ'}
            </div>
            <h1
              className="font-black leading-[0.95] tracking-tight m-0"
              style={{
                fontSize: 'clamp(28px, 4vw, 48px)',
                background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                letterSpacing: '-1.5px',
              }}
            >
              {el.name || 'Seçim'}
            </h1>
            <div className="text-xs text-slate-400 font-mono mt-2">
              <span className="text-slate-200 font-bold">{data.totalBallotBoxes || 0}</span> sandık
              <span className="mx-2 opacity-40">·</span>
              <span className="text-slate-200 font-bold">{data.openedBallotBoxes || 0}</span> açıldı
              <span className="mx-2 opacity-40">·</span>
              Açılma %{openedRatio}
            </div>
          </div>

          {/* Stat pills */}
          <div className="flex gap-2 flex-wrap">
            <StatPill label="Toplam Oy" value={fmt(totalVotes)} sub={`▲ %${data.totalVoters > 0 ? ((data.usedVotes / data.totalVoters) * 100).toFixed(1) : '0'} katılım`} />
            <StatPill label="Geçerli Oy" value={fmt(validVotes)} sub={`%${(data.usedVotes || 0) > 0 ? ((validVotes / data.usedVotes) * 100).toFixed(1) : '0'} oran`} />
            <StatPill label="Geçersiz" value={fmt(invalidVotes)} sub={`%${(data.usedVotes || 0) > 0 ? ((invalidVotes / data.usedVotes) * 100).toFixed(1) : '0'} oran`} />
            <StatPill label="Açılma" value={`${data.openedBallotBoxes || 0}/${data.totalBallotBoxes || 0}`} sub="" />
          </div>
        </div>

        {/* GÖRÜNÜM TOGGLE (Genel seçimde CB/MV; yerel seçimde tek kategori) */}
        {isGenel && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400 font-bold">Görünüm:</span>
            <div className="inline-flex rounded-lg overflow-hidden" style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <button
                onClick={() => setMapVoteField('cb_votes')}
                className="px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  background: mapVoteField === 'cb_votes' ? 'linear-gradient(135deg, #0ea5e9, #0369a1)' : 'transparent',
                  color: mapVoteField === 'cb_votes' ? '#fff' : '#94a3b8',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >🗳️ Cumhurbaşkanı</button>
              <button
                onClick={() => setMapVoteField('mv_votes')}
                className="px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  background: mapVoteField === 'mv_votes' ? 'linear-gradient(135deg, #0ea5e9, #0369a1)' : 'transparent',
                  color: mapVoteField === 'mv_votes' ? '#fff' : '#94a3b8',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >🏛️ Milletvekili</button>
            </div>
          </div>
        )}

        {/* HARITA + DETAY PANEL */}
        {ballotBoxes.length > 0 ? (
          <div className="district-map-grid mb-6">
            <div className="flex flex-col gap-3">
              <DistrictMap
                geojsonUrl="/maps/elazig.geojson"
                results={ballotBoxes}
                voteField={activeField}
                pickColor={pickItemColor}
                onDistrictClick={(districtName) => {
                  if (String(selectedDistrict).toLowerCase() === String(districtName).toLowerCase()) {
                    setSelectedDistrict('');
                  } else {
                    setSelectedDistrict(districtName);
                  }
                }}
                selectedDistrict={selectedDistrict}
                theme="dark"
                title="Elazığ İlçe Dağılımı"
                subtitle={
                  isGenel
                    ? (activeField === 'cb_votes' ? 'Cumhurbaşkanı · Lider Aday' : 'Milletvekili · Lider Parti')
                    : (el.name || '')
                }
              />
            </div>
            <DistrictDetailPanel
              results={ballotBoxes}
              selectedDistrict={selectedDistrict}
              voteField={activeField}
              pickColor={pickItemColor}
              onClear={() => setSelectedDistrict('')}
              title={panelTitle}
            />
          </div>
        ) : (
          <div
            className="rounded-2xl p-12 text-center mb-6 backdrop-blur"
            style={{
              background: 'rgba(15,23,42,0.55)',
              border: '1px solid rgba(56,189,248,0.18)',
            }}
          >
            <p className="text-lg text-slate-300 font-bold">Henüz sandık sonucu yok</p>
            <p className="text-sm text-slate-500 mt-1">Sonuçlar girildikçe burada anlık görünecek.</p>
          </div>
        )}

        {/* ALT STATS — Toplam Seçmen / Sandık Sayısı / Kullanılan / Geçersiz */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatPill label="Toplam Seçmen" value={fmt(data.totalVoters || 0)} />
          <StatPill label="Sandık Sayısı" value={fmt(data.totalBallotBoxes || 0)} />
          <StatPill label="Kullanılan" value={fmt(data.usedVotes || 0)} />
          <StatPill label="Geçersiz" value={fmt(invalidVotes)} />
        </div>

        {/* FOOTER */}
        <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
          <a href="/" className="hover:text-sky-400 transition">← Ana Sayfa</a>
          <span>
            Son güncelleme:{' '}
            {data.lastUpdated || data.updatedAt
              ? new Date(data.lastUpdated || data.updatedAt).toLocaleString('tr-TR')
              : '-'}
            {' · '}Otomatik yenileme: 30sn
          </span>
        </div>
      </div>
    </div>
  );
}

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
    <div className="text-center">
      <div className="w-10 h-10 border-2 border-slate-700 rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: '#0ea5e9' }} />
      <p className="text-slate-400 text-sm font-mono uppercase tracking-widest">Yükleniyor...</p>
    </div>
  </div>
);

const ErrorView = ({ message }) => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
    <div className="text-center">
      <p className="text-red-400 font-medium">{message || 'Bir hata oluştu'}</p>
      <a href="/" className="text-sky-400 text-sm mt-2 inline-block hover:underline">Ana sayfaya dön</a>
    </div>
  </div>
);
