import React from 'react';

/**
 * variant: 'good' | 'warn' | 'tech' | 'brand' | 'danger' | 'neutral'
 */
const VARIANT = {
  good:    { acc: '#16a34a', numColor: '#16a34a', bg: '#ffffff', border: '#e2e8f0' },
  warn:    { acc: '#ea580c', numColor: '#ea580c', bg: '#ffffff', border: '#e2e8f0' },
  tech:    { acc: '#0ea5e9', numColor: '#0284c7', bg: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)', border: '#bae6fd' },
  brand:   { acc: '#0ea5e9', numColor: '#0ea5e9', bg: '#ffffff', border: '#e2e8f0' },
  danger:  { acc: '#0ea5e9', numColor: '#0f172a', bg: '#ffffff', border: '#e2e8f0' },
  neutral: { acc: '#64748b', numColor: '#0f172a', bg: '#ffffff', border: '#e2e8f0' },
};

const padTwo = (n) => String(n ?? 0).padStart(2, '0');

const StatCard = ({ label, value, delta, variant = 'neutral' }) => {
  const v = VARIANT[variant] || VARIANT.neutral;
  return (
    <div
      className="relative rounded-2xl p-3 px-3.5 overflow-hidden hover-lift"
      style={{
        background: v.bg,
        border: `1px solid ${v.border}`,
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}
      role="group"
      aria-label={`${label} ${value}${delta ? `, ${delta}` : ''}`}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, transparent, ${v.acc}, transparent)`,
          animation: 'sweep 3s ease-in-out infinite',
        }}
      />
      <div className="text-[9px] tracking-[1.5px] text-slate-500 uppercase font-bold font-mono">{label}</div>
      <div className="text-[28px] font-extrabold leading-none mt-1 font-mono tracking-tight" style={{ color: v.numColor }}>
        {typeof value === 'number' ? padTwo(value) : value}
      </div>
      {delta && (
        <div className="text-[10px] mt-1 font-semibold font-mono" style={{ color: v.numColor }}>
          {delta}
        </div>
      )}
    </div>
  );
};

export default StatCard;
