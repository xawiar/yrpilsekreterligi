import React from 'react';

/**
 * ApplyCTASection — Full-width kurumsal gradient banner.
 * Buyuk beyaz baslik + beyaz buton. Yan dekoratif geometrik suslemeler.
 * Props: { title, text, buttonText, buttonLink }
 */
const ApplyCTASection = ({
  title = 'Yönetimde Siz Olun',
  text = 'Partimizin yönetim kademelerinde görev almak için başvurun. Birlikte Elazığ için üretelim.',
  buttonText = 'Hemen Başvur',
  buttonLink = '/public/apply',
}) => {
  return (
    <section id="apply" className="relative w-full">
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-700 via-primary-800 to-primary-900">
        {/* Dekoratif pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 1200 400"
          aria-hidden="true"
        >
          <defs>
            <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="1200" height="400" fill="url(#dots)" />
        </svg>

        {/* Radial aksanlar */}
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl pointer-events-none" />

        {/* Geometric shapes */}
        <div className="absolute top-10 right-12 w-24 h-24 border-2 border-white/10 rounded-2xl rotate-12 pointer-events-none hidden lg:block" />
        <div className="absolute bottom-12 right-32 w-16 h-16 border-2 border-amber-400/20 rounded-full pointer-events-none hidden lg:block" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 lg:py-24">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12">
            <div className="flex-1 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-semibold tracking-wider uppercase mb-5 backdrop-blur-sm">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
                Göreve Çağrı
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
                {title}
              </h2>
              <p className="mt-5 text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed">
                {text}
              </p>
            </div>

            <div className="shrink-0">
              <a
                href={buttonLink}
                className="group inline-flex items-center justify-center min-h-[60px] px-8 py-4 rounded-md bg-white text-primary-800 font-bold text-base md:text-lg shadow-2xl hover:bg-amber-50 hover:shadow-amber-400/30 active:scale-95 transition-all"
              >
                {buttonText}
                <svg className="ml-3 w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <p className="mt-3 text-center text-xs text-white/60">
                Birkaç dakikanızı alır
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ApplyCTASection;
