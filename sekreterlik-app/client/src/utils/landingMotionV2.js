// Landing v2 motion utilities — Lenis smooth scroll + IntersectionObserver
// reveal + counter + magnetic + parallax. Tek dosya, tüm hook'lar minimal.

import { useEffect } from 'react';

// Lenis smooth scroll — bir kez init, unmount'ta cleanup
export const useLenis = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;
    let lenis;
    let raf;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('lenis');
        if (cancelled) return;
        const Lenis = mod.default || mod;
        lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        console.warn('[Lenis] yüklenemedi:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      try { lenis?.destroy?.(); } catch (_) { /* noop */ }
    };
  }, [enabled]);
};

// Reveal — IntersectionObserver, [data-reveal] elementlerine is-visible ekler.
// Deps verilirse veri geldikçe (lider/galeri/news yüklendikçe) yeniden tarar
// → geç eklenen elementler de yakalanır.
export const useReveal = (deps = []) => {
  useEffect(() => {
    let io;
    const setup = () => {
      const els = document.querySelectorAll('.landing-v2 [data-reveal]:not(.is-visible)');
      if (!els.length) return;
      if (io) io.disconnect();
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -5% 0px' });
      els.forEach((el) => io.observe(el));
    };
    setup();
    // Sayfa kısa süre sonra tekrar tara (data render zamanlama farkları için)
    const t1 = setTimeout(setup, 200);
    const t2 = setTimeout(setup, 800);
    const t3 = setTimeout(setup, 2000);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (io) io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

// Counter — [data-counter] + data-target sayıyı 0'dan target'a animate
export const useCounter = () => {
  useEffect(() => {
    const els = document.querySelectorAll('.landing-v2 [data-counter]');
    if (!els.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.target || '0', 10) || 0;
        const suffix = el.dataset.suffix || '';
        const duration = 1600;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const cur = Math.round(target * eased);
          el.textContent = cur.toLocaleString('tr-TR') + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
};

// Magnetic — fareyle çekilen buton, [data-magnetic]
export const useMagnetic = () => {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.landing-v2 [data-magnetic]'));
    if (!els.length) return undefined;
    const handlers = els.map((el) => {
      const strength = parseFloat(el.dataset.magneticStrength || '0.25');
      const onMove = (e) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) * strength;
        const dy = (e.clientY - cy) * strength;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const onLeave = () => { el.style.transform = ''; };
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      return { el, onMove, onLeave };
    });
    return () => {
      handlers.forEach(({ el, onMove, onLeave }) => {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
      });
    };
  }, []);
};

// Scroll progress + nav.is-scrolled
export const useScrollChrome = (progressId = 'lv-progress', navId = 'lv-nav') => {
  useEffect(() => {
    const progressEl = document.getElementById(progressId);
    const navEl = document.getElementById(navId);
    const onScroll = () => {
      const y = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? (y / docH) * 100 : 0;
      if (progressEl) progressEl.style.width = pct + '%';
      if (navEl) navEl.classList.toggle('is-scrolled', y > 80);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [progressId, navId]);
};

// Hero parallax + stamp follow mouse
export const useHeroParallax = (heroSelector = '.lv-hero') => {
  useEffect(() => {
    const hero = document.querySelector(heroSelector);
    if (!hero) return undefined;
    const bg = hero.querySelector('.lv-hero-bg');
    const stamp = hero.querySelector('.lv-hero-stamp');
    let raf;
    let targetMx = 0, targetMy = 0;
    let curMx = 0, curMy = 0;
    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetMx = x * 30;
      targetMy = y * 20;
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (bg) bg.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
    };
    const loop = () => {
      curMx += (targetMx - curMx) * 0.08;
      curMy += (targetMy - curMy) * 0.08;
      if (stamp) {
        stamp.style.setProperty('--mx', curMx + 'px');
        stamp.style.setProperty('--my', curMy + 'px');
      }
      raf = requestAnimationFrame(loop);
    };
    hero.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      hero.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [heroSelector]);
};

// Vision sticky scroll panel switcher
export const useVisionScroll = (panelCount = 4) => {
  useEffect(() => {
    if (panelCount < 1) return undefined;
    // setup'ı veri/DOM hazır olunca yap — kısa gecikmeyle birkaç deneme
    let cleanup = () => {};
    const tryAttach = () => {
      const track = document.querySelector('.lv-vision-track');
      if (!track) return false;
      const panels = track.querySelectorAll('.lv-vision-panel');
      const images = track.querySelectorAll('.lv-vision-image');
      if (panels.length === 0 || images.length === 0) return false;
      const stepEl = track.querySelector('#lv-vision-step');
      const barEl = track.querySelector('.lv-vision-progress-bar');

      // Tüm görselleri preload et (browser lazy etmesin)
      images.forEach((img) => {
        const bg = img.style.backgroundImage;
        if (bg && bg !== 'none') {
          const url = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
          const preload = new Image();
          preload.src = url;
        }
      });

      let last = -2;
      const onScroll = () => {
        const rect = track.getBoundingClientRect();
        const total = track.offsetHeight - window.innerHeight;
        if (total <= 0) return;
        const passed = Math.max(0, -rect.top);
        const progress = Math.min(Math.max(passed / total, 0), 1);
        const cur = Math.min(Math.floor(progress * panelCount), panelCount - 1);
        if (barEl) barEl.style.setProperty('--vp', `${progress * 100}%`);
        if (cur !== last) {
          panels.forEach((p, i) => p.classList.toggle('is-active', i === cur));
          images.forEach((img, i) => img.classList.toggle('is-active', i === cur));
          if (stepEl) stepEl.textContent = String(cur + 1).padStart(2, '0');
          last = cur;
        }
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      cleanup = () => window.removeEventListener('scroll', onScroll);
      return true;
    };
    // Hemen dene, başarısızsa kısa gecikmelerle tekrar
    if (!tryAttach()) {
      const t1 = setTimeout(() => { if (!tryAttach()) {
        const t2 = setTimeout(tryAttach, 800);
        cleanup = () => clearTimeout(t2);
      }}, 200);
      return () => { clearTimeout(t1); cleanup(); };
    }
    return () => cleanup();
  }, [panelCount]);
};
