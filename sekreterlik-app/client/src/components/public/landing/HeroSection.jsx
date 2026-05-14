import React from 'react';

/**
 * HeroSection — Full-viewport, kurumsal hero.
 * - Arka plan: primary gradient + SVG dalga pattern overlay
 * - Eger image varsa: tam ekran gorsel + koyu overlay
 * - Sol hizali icerik: eyebrow tag + buyuk h1 + alt metin + iki buton
 * - Alt merkezde: scroll down indicator
 * Props: { title, subtitle, image, ctaText, ctaLink }
 */
// Sosyal medya icon'ları (inline SVG, küçük + temiz)
const SOCIAL_ICONS = {
  facebook: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  instagram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  youtube: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  tiktok: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
    </svg>
  ),
};

const SOCIAL_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const HeroSection = ({
  title = 'Yeniden Refah Partisi',
  image = '',
  ctaText = 'Yönetime Başvur',
  ctaLink = '/public/apply',
  chairmanPhoto = '',
  chairmanName = '',
  chairmanTitle = '',
  social = {},
}) => {
  const socialEntries = Object.entries(social).filter(([key, url]) => url && SOCIAL_ICONS[key]);
  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-gradient-to-br from-primary-800 to-primary-900"
    >
      {/* Arka plan görsel (opsiyonel) */}
      {image && (
        <>
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 to-primary-900/85" />
        </>
      )}

      {/* Hafif grid pattern (kurumsal doku) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1200 800" aria-hidden="true">
        <defs>
          <pattern id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1200" height="800" fill="url(#hero-grid)" />
      </svg>

      {/* İçerik */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-28">
        <div className={`grid items-center gap-10 lg:gap-16 ${chairmanPhoto ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>

          {/* SOL/ÜST: METİN */}
          <div className="text-center lg:text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/85 text-[11px] sm:text-xs font-semibold tracking-wider uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Yeniden Refah Partisi Elazığ
            </div>

            {/* Başlık */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              {title}
            </h1>

            {/* CTA — magnetic effect */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <a
                href={ctaLink}
                data-magnetic
                data-magnetic-strength="0.3"
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-md bg-white text-primary-800 font-semibold text-sm sm:text-base shadow-lg hover:bg-amber-50 active:scale-[0.98] transition-all"
              >
                {ctaText}
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="#about"
                data-magnetic
                data-magnetic-strength="0.2"
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-md border border-white/40 text-white text-sm sm:text-base font-medium hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                Bizi Tanıyın
              </a>
            </div>

            {/* Sosyal medya */}
            {socialEntries.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3 justify-center lg:justify-start">
                <span className="text-white/60 text-xs uppercase tracking-wider font-semibold">Takip Edin</span>
                <div className="flex items-center gap-2">
                  {socialEntries.map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={SOCIAL_LABELS[key] || key}
                      title={SOCIAL_LABELS[key] || key}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white hover:text-primary-800 active:scale-95 transition-all"
                    >
                      {SOCIAL_ICONS[key]}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SAĞ/ALT: CHAIRMAN KART (varsa) */}
          {chairmanPhoto && (
            <div className="flex flex-col items-center lg:items-end">
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[380px]">
                <div className="rounded-2xl overflow-hidden ring-1 ring-white/20 shadow-2xl bg-white/5">
                  <img
                    src={chairmanPhoto}
                    alt={chairmanName || 'Genel Başkan'}
                    className="w-full h-auto block"
                    loading="eager"
                  />
                </div>
                {(chairmanName || chairmanTitle) && (
                  <div className="mt-3 text-center">
                    {chairmanTitle && (
                      <p className="text-amber-300/90 text-[10px] font-semibold tracking-[0.2em] uppercase">
                        {chairmanTitle}
                      </p>
                    )}
                    {chairmanName && (
                      <p className="mt-0.5 text-white font-semibold text-base">
                        {chairmanName}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

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
