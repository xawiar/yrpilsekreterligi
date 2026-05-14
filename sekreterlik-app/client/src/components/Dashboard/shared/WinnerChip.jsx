import React from 'react';

const darkenHex = (hex, k = 0.7) => {
  if (!hex || typeof hex !== 'string') return '#0369a1';
  const c = hex.replace('#', '');
  if (c.length !== 6) return '#0369a1';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const dr = Math.round(r * k);
  const dg = Math.round(g * k);
  const db = Math.round(b * k);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
};

const WinnerChip = ({ partyName, partyColor, suffix = 'Şu an önde' }) => {
  if (!partyName) return null;
  const color = partyColor || '#0ea5e9';
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white mt-2 tracking-wider"
      style={{
        background: `linear-gradient(90deg, ${color}, ${darkenHex(color)})`,
        boxShadow: `0 0 12px ${color}99`,
        border: '1px solid rgba(251,191,36,0.4)',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber-400"
        style={{ boxShadow: '0 0 4px #fbbf24' }}
      />
      {partyName} · {suffix}
    </div>
  );
};

export default WinnerChip;
