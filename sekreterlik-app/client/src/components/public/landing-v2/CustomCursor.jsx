import React, { useEffect, useRef } from 'react';

// Hilal + içinde başak custom cursor — hover'da büyür, click'te yıldıza döner.
// Sadece desktop'ta (>768px) çalışır. Touch device'ta tamamen gizli.
const CustomCursor = () => {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;
    if (window.matchMedia('(max-width: 768px)').matches) return undefined;

    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let pos = { ...target };

    const onMove = (e) => { target = { x: e.clientX, y: e.clientY }; };
    const onDown = () => wrap.classList.add('is-star');
    const onUp = () => wrap.classList.remove('is-star');
    const onOver = (e) => {
      const el = e.target;
      const hover = el.closest?.('[data-cursor="hover"], a, button, [role="button"]');
      const text = el.closest?.('[data-cursor="text"]');
      wrap.classList.toggle('is-hover', !!hover && !text);
      wrap.classList.toggle('is-text', !!text);
    };
    const loop = () => {
      pos.x += (target.x - pos.x) * 0.22;
      pos.y += (target.y - pos.y) * 0.22;
      wrap.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    let raf = requestAnimationFrame(loop);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseover', onOver);
    document.documentElement.classList.add('lv-cursor-on');

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseover', onOver);
      document.documentElement.classList.remove('lv-cursor-on');
    };
  }, []);

  return (
    <div className="lv-cur-wrap" ref={wrapRef} aria-hidden="true">
      <div className="lv-cur-halo" />
      <svg className="lv-cur-crescent" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
        <defs>
          <mask id="lvHilalMask" maskUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="black" />
            <circle cx="10" cy="12" r="10" fill="white" />
            <circle cx="14" cy="12" r="10" fill="black" />
          </mask>
        </defs>
        <rect width="24" height="24" fill="currentColor" mask="url(#lvHilalMask)" />
      </svg>
      <svg className="lv-cur-wheat" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V8" />
        <path d="M12 14c-2 0-4-1.5-4-4M12 14c2 0 4-1.5 4-4" />
        <path d="M12 10c-2 0-4-1.5-4-4M12 10c2 0 4-1.5 4-4" />
        <path d="M12 18c-2 0-4-1.5-4-4M12 18c2 0 4-1.5 4-4" />
        <path d="M12 6c-1.5 0-3-1-3-3M12 6c1.5 0 3-1 3-3" />
      </svg>
      <svg className="lv-cur-star" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.39 7.36H22l-6.18 4.49L18.21 21 12 16.5 5.79 21l2.39-7.15L2 9.36h7.61L12 2z" />
      </svg>
    </div>
  );
};

export default CustomCursor;
