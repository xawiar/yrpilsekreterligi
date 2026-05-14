/**
 * Landing Page Animations — vanilla JS, framework-agnostic.
 *
 * IntersectionObserver tabanlı:
 *  - section / [data-reveal] / [data-stagger] / .landing-bridge → in olunca
 *    `is-visible` class'ı ekler
 *  - [data-counter] → görünür olunca sıfırdan hedefe animate
 *  - [data-magnetic] → mousemove'a göre transform translate
 *  - [data-tilt] → mouse position'a göre 3D rotate
 *  - [data-parallax] → scroll'da yavaş kayar
 *  - .landing-progress-fill → scroll progress bar
 *
 * Kullanım: useEffect(() => { const cleanup = initLandingAnimations(rootEl); return cleanup; }, [])
 */

const SELECTORS = {
  reveal: '[data-reveal], [data-stagger], .landing-bridge',
  autoReveal: '.landing-animated > main > section, .landing-animated > main > div[data-banner]',
  counter: '[data-counter]',
  magnetic: '[data-magnetic]',
  tilt: '[data-tilt]',
  parallax: '[data-parallax]',
  progress: '.landing-progress-fill',
};

const isReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initLandingAnimations(root = document) {
  if (isReducedMotion()) return () => {};

  const cleanupFns = [];

  // ===== Intersection observer =====
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('is-visible');

      // Counter — varsa
      el.querySelectorAll('[data-counter]').forEach(animateCounter);
      if (el.matches && el.matches('[data-counter]')) animateCounter(el);

      io.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  const observeEls = root.querySelectorAll(
    SELECTORS.reveal + ',' + SELECTORS.autoReveal + ',' + SELECTORS.counter
  );
  observeEls.forEach((el) => io.observe(el));

  cleanupFns.push(() => io.disconnect());

  // ===== Counter helper =====
  function animateCounter(el) {
    if (el.dataset.counterDone === '1') return;
    el.dataset.counterDone = '1';
    const target = parseFloat(el.dataset.counter || el.textContent.replace(/[^0-9.]/g, '')) || 0;
    const suffix = el.dataset.counterSuffix || '';
    const prefix = el.dataset.counterPrefix || '';
    const dur = parseInt(el.dataset.counterDur || '1800', 10);
    const start = performance.now();
    const isFloat = target % 1 !== 0;
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      const v = target * ease;
      const formatted = isFloat ? v.toFixed(1) : Math.floor(v).toLocaleString('tr-TR');
      el.textContent = prefix + formatted + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + (isFloat ? target.toFixed(1) : target.toLocaleString('tr-TR')) + suffix;
    }
    requestAnimationFrame(tick);
  }

  // ===== Magnetic buttons =====
  const magneticEls = root.querySelectorAll(SELECTORS.magnetic);
  magneticEls.forEach((el) => {
    const strength = parseFloat(el.dataset.magneticStrength || '0.25');
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${(x * strength).toFixed(1)}px, ${(y * strength * 1.2).toFixed(1)}px)`;
    };
    const onLeave = () => { el.style.transform = ''; };
    el.classList.add('magnetic-hover');
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    cleanupFns.push(() => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      el.style.transform = '';
    });
  });

  // ===== 3D Tilt =====
  const tiltEls = root.querySelectorAll(SELECTORS.tilt);
  tiltEls.forEach((el) => {
    const max = parseFloat(el.dataset.tiltMax || '10');
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotY = (x - 0.5) * max * 2;
      const rotX = (0.5 - y) * max * 2;
      el.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
    };
    const onLeave = () => { el.style.transform = ''; };
    el.classList.add('tilt-card');
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    cleanupFns.push(() => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      el.style.transform = '';
    });
  });

  // ===== Parallax =====
  const parallaxEls = root.querySelectorAll(SELECTORS.parallax);
  let scrollTicking = false;
  function updateParallax() {
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 50;
      const parent = el.closest('section') || el.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      const progress = (vh - rect.top) / (vh + rect.height);
      const offset = (progress - 0.5) * speed;
      el.style.transform = `translateY(${offset.toFixed(1)}px)`;
    });
    scrollTicking = false;
  }

  // ===== Scroll progress + parallax =====
  const progressFill = document.querySelector(SELECTORS.progress);
  function onScroll() {
    if (progressFill) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      progressFill.style.width = pct.toFixed(2) + '%';
    }
    if (!scrollTicking && parallaxEls.length > 0) {
      scrollTicking = true;
      requestAnimationFrame(updateParallax);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (parallaxEls.length > 0) updateParallax();
  cleanupFns.push(() => window.removeEventListener('scroll', onScroll));

  return () => cleanupFns.forEach((fn) => fn());
}

/**
 * Section'lar arasına bridge eklemek için JSX helper.
 * Kullanım: <LandingBridge fill="#ffffff" />
 */
export function createBridgeProps(fillColor = '#ffffff') {
  return {
    className: 'landing-bridge',
    'aria-hidden': true,
    'data-bridge-fill': fillColor,
  };
}
