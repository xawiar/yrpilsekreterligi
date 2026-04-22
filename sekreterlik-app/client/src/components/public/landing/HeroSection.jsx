import React from 'react';

/**
 * HeroSection — Full-viewport, kurumsal hero.
 * - Arka plan: primary gradient + SVG dalga pattern overlay
 * - Eger image varsa: tam ekran gorsel + koyu overlay
 * - Sol hizali icerik: eyebrow tag + buyuk h1 + alt metin + iki buton
 * - Alt merkezde: scroll down indicator
 * Props: { title, subtitle, image, ctaText, ctaLink }
 */
const HeroSection = ({
  title = 'Yeniden Refah Partisi',
  subtitle = 'İl Sekreterliği',
  image = '',
  ctaText = 'Yönetime Başvur',
  ctaLink = '/public/apply',
}) => {
  return (
    <section
      id="hero"
      className="relative w-full min-h-[90vh] md:min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-primary-800"
    >
      {/* Arka plan gorsel (varsa) */}
      {image && (
        <>
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/85 via-primary-800/75 to-primary-900/90" />
        </>
      )}

      {/* Dalga SVG pattern (bayrak hissi) */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
        aria-hidden="true"
      >
        <defs>
          <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1200" height="800" fill="url(#grid)" />
        <path
          d="M0,400 C300,300 600,500 1200,350 L1200,800 L0,800 Z"
          fill="white"
          fillOpacity="0.05"
        />
        <path
          d="M0,500 C400,400 800,600 1200,450 L1200,800 L0,800 Z"
          fill="white"
          fillOpacity="0.04"
        />
      </svg>

      {/* Radial glow */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Icerik */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-32">
        <div className="max-w-3xl">
          {/* Eyebrow tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-xs font-semibold tracking-[0.2em] uppercase mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Resmî Web Sitesi · YRP Elazığ
          </div>

          {/* Ana baslik */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
            {title}
          </h1>

          {/* Alt baslik */}
          {subtitle && (
            <p className="mt-6 text-lg sm:text-xl md:text-2xl text-white/80 font-medium max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}

          {/* Butonlar */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <a
              href={ctaLink}
              className="inline-flex items-center justify-center min-h-[52px] px-7 py-3.5 rounded-md bg-white text-primary-800 font-semibold shadow-xl hover:bg-amber-50 hover:shadow-amber-400/20 active:scale-95 transition-all"
            >
              {ctaText}
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="#about"
              className="inline-flex items-center justify-center min-h-[52px] px-7 py-3.5 rounded-md border-2 border-white/60 text-white font-semibold hover:bg-white/10 hover:border-white active:scale-95 transition-all backdrop-blur-sm"
            >
              Bizi Tanıyın
            </a>
          </div>

          {/* Alt sinyal — kisa bilgi satiri */}
          <div className="mt-14 pt-8 border-t border-white/15 flex flex-wrap items-center gap-x-8 gap-y-3 text-white/70 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Adaletli · Hizmetkâr · Güvenilir
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m4-11v11m4-11v11m4-11v11m4-11v11" />
              </svg>
              Elazığ İl Sekreterliği
            </div>
          </div>
        </div>
      </div>

      {/* Scroll down indicator */}
      <a
        href="#about"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors group"
        aria-label="Aşağı kaydır"
      >
        <span className="text-[11px] font-semibold tracking-widest uppercase">Keşfet</span>
        <div className="w-6 h-10 rounded-full border-2 border-white/40 group-hover:border-white/80 flex items-start justify-center pt-2 transition-colors">
          <span className="w-1 h-2 rounded-full bg-white/80 animate-bounce" />
        </div>
      </a>

      {/* Alt dalga — asagidaki section'a gecis */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-16 md:h-24 text-white dark:text-gray-950"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1440 100"
        aria-hidden="true"
      >
        <path
          d="M0,60 C240,100 480,20 720,40 C960,60 1200,100 1440,60 L1440,100 L0,100 Z"
          fill="currentColor"
        />
      </svg>
    </section>
  );
};

export default HeroSection;
