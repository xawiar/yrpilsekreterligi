import React from 'react';

/**
 * ApplyCTASection
 * Genis banner: gradient arka plan + baslik + buton.
 * Props: { title, text, buttonText, buttonLink }
 */
const ApplyCTASection = ({
  title = 'Yonetimde Siz Olun',
  text = 'Partimizin yonetim kademelerinde gorev almak icin basvurun.',
  buttonText = 'Basvur',
  buttonLink = '/public/apply',
}) => {
  return (
    <section
      id="apply"
      className="w-full py-12 md:py-20 bg-gray-50 dark:bg-gray-950"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-800 dark:via-purple-800 dark:to-pink-800 p-6 sm:p-10 md:p-14 shadow-xl">
          {/* Dekoratif daireler */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
                {title}
              </h2>
              <p className="mt-3 text-base sm:text-lg text-indigo-100 max-w-2xl">
                {text}
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <a
                href={buttonLink}
                className="inline-flex items-center justify-center min-h-[52px] px-8 py-3.5 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
              >
                {buttonText}
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ApplyCTASection;
