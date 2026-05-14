import React from 'react';

/**
 * Section'lar arası geçiş bandı.
 * SVG dalga + glow line + dot'lar (scroll'da animate olur).
 *
 * Props:
 *   fillColor — alttaki section'ın background rengi (dalga buraya akar).
 *               Tailwind class'larıyla zor olduğu için doğrudan hex/rgb verilir.
 *               Tipik: white (#ffffff), gray-50 (#f9fafb), gray-100 (#f3f4f6).
 *   shape — 'wave' | 'curve' | 'zigzag' (default wave)
 *   variant — path varyasyonu (1-7), her section'a farklı şekil verir
 */
const PATHS = {
  // 7 farklı dalga path — monoton olmasın
  1: 'M0,60 C240,100 480,20 720,40 C960,60 1200,100 1440,60 L1440,100 L0,100 Z',
  2: 'M0,40 C320,90 640,10 960,50 C1180,80 1320,30 1440,60 L1440,100 L0,100 Z',
  3: 'M0,70 C200,30 480,100 720,40 C960,5 1200,80 1440,30 L1440,100 L0,100 Z',
  4: 'M0,50 C240,90 480,30 720,70 C960,100 1200,40 1440,60 L1440,100 L0,100 Z',
  5: 'M0,80 C240,40 480,90 720,50 C960,20 1200,70 1440,40 L1440,100 L0,100 Z',
  6: 'M0,40 C240,80 480,20 720,90 C960,50 1200,100 1440,30 L1440,100 L0,100 Z',
  7: 'M0,55 C320,15 640,85 960,45 C1180,15 1320,75 1440,55 L1440,100 L0,100 Z',
};

const LandingBridge = ({ fillColor = '#ffffff', variant = 1, height = 80 }) => {
  const path = PATHS[variant] || PATHS[1];
  return (
    <div
      className="landing-bridge"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      <svg preserveAspectRatio="none" viewBox="0 0 1440 100">
        <path d={path} fill={fillColor} />
      </svg>
      <div className="landing-bridge-glow" />
      <span className="landing-bridge-dot" />
      <span className="landing-bridge-dot" />
      <span className="landing-bridge-dot" />
      <span className="landing-bridge-dot" />
    </div>
  );
};

export default LandingBridge;
