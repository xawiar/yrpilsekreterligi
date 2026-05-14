import React, { useState, useEffect } from 'react';

const LiveIndicator = ({ showClock = true }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return (
    <div className="inline-flex items-center gap-2 text-[10px] font-mono font-extrabold tracking-[2px] uppercase">
      <span className="inline-flex items-center gap-1.5 text-sky-600">
        <span
          className="w-1.5 h-1.5 rounded-full bg-sky-500"
          style={{ boxShadow: '0 0 8px #0ea5e9', animation: 'pulse-dot 1.6s ease-in-out infinite' }}
        />
        CANLI
      </span>
      {showClock && (
        <>
          <span className="w-px h-3 bg-slate-300" />
          <span className="text-sky-600">{hh}:{mm}</span>
        </>
      )}
    </div>
  );
};

export default LiveIndicator;
