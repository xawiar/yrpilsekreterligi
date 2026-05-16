import React from 'react';

/**
 * Başmüşahit Hero Kartı — sade YRP brand.
 *
 * Sol: durum rozeti (TAMAMLANDI/EKSİK/BAŞLANMADI/HENÜZ) + sandık + kurum.
 * Sağ: 4 inline mini stat — Toplam, Tamamlanan, Bekleyen, Onay Bekleyen.
 *
 * Props:
 *   ballotNumber — string/number, gösterilecek sandık no
 *   institutionName — string (opsiyonel)
 *   stats = { totalElections, completed, pending, awaitingApproval }
 *   onApprovalsClick — onay sayısı tıklanınca tetiklenir
 */
const HeroCard = ({ ballotNumber, institutionName, stats = {}, onApprovalsClick }) => {
  const { totalElections = 0, completed = 0, pending = 0, awaitingApproval = 0 } = stats;

  // Durum mantığı — kart sol kenarındaki rozet için
  let label = 'HENÜZ';
  let color = '#64748b';
  let bg = 'rgba(100,116,139,0.10)';
  let icon = '○';
  if (totalElections > 0) {
    if (pending === 0 && completed === totalElections) {
      label = 'TAMAMLANDI'; color = '#059669'; bg = 'rgba(5,150,105,0.10)'; icon = '✓';
    } else if (completed > 0) {
      label = 'EKSİK'; color = '#d97706'; bg = 'rgba(217,119,6,0.10)'; icon = '◐';
    } else {
      label = 'BAŞLANMADI'; color = '#E30613'; bg = 'rgba(227,6,19,0.10)'; icon = '!';
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 18,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {/* SOL — Durum + Sandık */}
      <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 12,
            background: bg,
            color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 900, flexShrink: 0,
            border: `2px solid ${color}33`,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color, textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2, lineHeight: 1.2 }}>
            {ballotNumber ? <>Sandık <span style={{ fontVariantNumeric: 'tabular-nums' }}>{ballotNumber}</span></> : 'Sandık bekleniyor'}
          </div>
          {institutionName && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {institutionName}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ — 4 mini stat */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          flex: '1 1 380px',
          minWidth: 0,
        }}
      >
        <MiniStat label="Toplam Seçim" value={totalElections} color="#475569" />
        <MiniStat label="Tamamlanan" value={completed} color="#059669" />
        <MiniStat label="Bekleyen" value={pending} color="#d97706" />
        <MiniStat
          label="Onay Bekleyen"
          value={awaitingApproval}
          color="#E30613"
          onClick={awaitingApproval > 0 && onApprovalsClick ? onApprovalsClick : undefined}
        />
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    style={{
      background: '#f8fafc',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '10px 12px',
      textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all .15s',
    }}
    onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = color)}
    onMouseLeave={(e) => onClick && (e.currentTarget.style.borderColor = '#e5e7eb')}
  >
    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.2 }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
      {value}
    </div>
  </button>
);

export default HeroCard;
