import React from 'react';

/**
 * HeroSection
 * Mobile-first: dikey stack, masaustunde yan yana (md:grid-cols-2).
 * Props: { title, subtitle, image, ctaText, ctaLink }
 */
const HeroSection = ({
  title = 'Yeniden Refah Partisi',
  subtitle = 'Il Sekreterligi',
  image = '',
  ctaText = 'Yonetime Basvur',
  ctaLink = '/public/apply',
}) => {
  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-900 dark:from-indigo-900 dark:via-purple-900 dark:to-gray-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 lg:py-28">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Gorsel - mobilde ustte, masaustunde sagda */}
          <div className="order-1 md:order-2 flex justify-center">
            {image ? (
              <img
                src={image}
                alt={title}
                className="w-full max-w-md rounded-2xl shadow-2xl object-cover aspect-[4/3]"
                loading="eager"
              />
            ) : (
              <div className="w-full max-w-md aspect-[4/3] rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <svg className="w-24 h-24 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M4 18V9.5l8-6 8 6V18M9 22V12h6v10" />
                </svg>
              </div>
            )}
          </div>

          {/* Metin - mobilde altta, masaustunde solda */}
          <div className="order-2 md:order-1 text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 text-lg sm:text-xl md:text-2xl text-indigo-100 font-medium">
                {subtitle}
              </p>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <a
                href={ctaLink}
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
              >
                {ctaText}
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="#about"
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-xl border-2 border-white/70 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Daha Fazla Bilgi
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Dekoratif alt dalga */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-gray-900 to-transparent pointer-events-none" />
    </section>
  );
};

export default HeroSection;
