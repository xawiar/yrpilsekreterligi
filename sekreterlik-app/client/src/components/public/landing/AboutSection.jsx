import React from 'react';

/**
 * AboutSection
 * Mobile-first: tek sutun dikey. Masaustu: iki sutun (metin + resim).
 * Props: { title, content, image }
 */
const AboutSection = ({
  title = 'Hakkimizda',
  content = '',
  image = '',
}) => {
  // content string olabilir; paragraflara ayir
  const paragraphs = typeof content === 'string'
    ? content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    : [];

  return (
    <section
      id="about"
      className="w-full py-12 md:py-20 bg-white dark:bg-gray-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Metin */}
          <div className="order-2 md:order-1">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {title}
            </h2>
            <div className="w-16 h-1 bg-indigo-600 dark:bg-indigo-400 mb-6 rounded-full" />

            {paragraphs.length > 0 ? (
              <div className="space-y-4 text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                Icerik admin tarafindan eklenecek.
              </p>
            )}
          </div>

          {/* Gorsel */}
          <div className="order-1 md:order-2 flex justify-center">
            {image ? (
              <img
                src={image}
                alt={title}
                className="w-full max-w-lg rounded-2xl shadow-xl object-cover aspect-[4/3]"
                loading="lazy"
              />
            ) : (
              <div className="w-full max-w-lg aspect-[4/3] rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center">
                <svg className="w-24 h-24 text-indigo-400 dark:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
