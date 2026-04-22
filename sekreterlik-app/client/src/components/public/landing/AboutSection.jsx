import React from 'react';

/**
 * AboutSection — Kurumsal "hakkimizda".
 * Sol: eyebrow + H2 + paragraflar + CTA link
 * Sag: gorsel VEYA 3 deger karti (Adalet / Hizmet / Guven)
 * Props: { title, content, image }
 */

const VALUES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    title: 'Adalet',
    text: 'Her vatandaşımız için eşit, tarafsız ve hakkaniyetli hizmet anlayışı.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    title: 'Hizmet',
    text: 'Milletin kapısını çalan, sahada çözüm üreten aktif bir teşkilat.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    title: 'Güven',
    text: 'Şeffaf yönetim, hesap verebilirlik ve sözünün arkasında duran bir kadro.',
  },
];

const AboutSection = ({
  title = 'Hakkımızda',
  content = '',
  image = '',
}) => {
  const paragraphs = typeof content === 'string'
    ? content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    : [];

  return (
    <section
      id="about"
      className="relative w-full py-20 md:py-28 lg:py-32 bg-white dark:bg-gray-950"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Metin kolonu */}
          <div className="lg:col-span-6">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
              Hakkımızda
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              {title}
            </h2>
            <div className="mt-6 h-1 w-16 bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />

            <div className="mt-8 space-y-5 text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-prose">
              {paragraphs.length > 0 ? (
                paragraphs.map((p, idx) => <p key={idx}>{p}</p>)
              ) : (
                <>
                  <p>
                    Yeniden Refah Partisi Elazığ İl Sekreterliği; milletin hizmetinde, sahada aktif,
                    ilkeli bir siyaset anlayışını benimser. Teşkilat olarak ilimizin her köşesinde
                    vatandaşlarımızla omuz omuza çalışıyoruz.
                  </p>
                  <p>
                    Amacımız, yerel ihtiyaçları dinleyip çözüm üretmek; adaletli, üretken ve
                    refah dolu bir Türkiye vizyonuna katkı sunmaktır.
                  </p>
                </>
              )}
            </div>

            <a
              href="#leaders"
              className="mt-10 inline-flex items-center gap-2 text-primary-700 dark:text-primary-400 font-semibold hover:gap-3 transition-all group"
            >
              Yönetim Kadromuzu Tanıyın
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>

          {/* Sag kolon: gorsel VEYA deger kartlari */}
          <div className="lg:col-span-6">
            {image ? (
              <div className="relative">
                <img
                  src={image}
                  alt={title}
                  className="w-full rounded-2xl shadow-2xl object-cover aspect-[4/3] ring-1 ring-black/5"
                  loading="lazy"
                />
                {/* Dekor */}
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-amber-400 to-primary-600 rounded-2xl -z-10 blur-2xl opacity-30" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {VALUES.map((v, idx) => (
                  <div
                    key={idx}
                    className="group relative p-6 md:p-7 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-start gap-5">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {v.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {v.title}
                        </h3>
                        <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                          {v.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
