import React from 'react';

/**
 * NewsSection — Haberler ve duyurular.
 * Props: { news } (array of {id, title, content, date, image, link?})
 * Bos liste durumunda bu bolum hic render edilmez (parent kontrolunde).
 */

const formatDate = (d) => {
  if (!d) return '';
  try {
    const dt = d.toDate ? d.toDate() : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

const NewsCard = ({ item }) => {
  const title = item?.title || 'Başlıksız';
  const content = item?.content || item?.summary || item?.description || '';
  const image = item?.image || item?.imageUrl || item?.photo || '';
  const date = formatDate(item?.date || item?.created_at || item?.createdAt);
  const link = item?.link || '';

  const CardInner = (
    <article className="group relative flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 overflow-hidden">
      {/* Gorsel (16:9) */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-white dark:from-primary-900/60 dark:via-gray-800 dark:to-gray-900">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-primary-300 dark:text-primary-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2z" />
            </svg>
          </div>
        )}
        {/* Dekor alt gradient */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Gövde */}
      <div className="flex-1 flex flex-col p-6">
        {date && (
          <time className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-400 mb-3">
            {date}
          </time>
        )}
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        {content && (
          <p className="mt-3 text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2 flex-1">
            {content}
          </p>
        )}
        {link && (
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 group-hover:gap-2 transition-all">
            Devamını Oku
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        )}
      </div>
    </article>
  );

  if (link) {
    return (
      <a
        href={link}
        target={link.startsWith('http') ? '_blank' : undefined}
        rel={link.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="block h-full"
      >
        {CardInner}
      </a>
    );
  }
  return <div className="h-full">{CardInner}</div>;
};

const NewsSection = ({ news = [] }) => {
  const list = Array.isArray(news) ? news : [];

  return (
    <section
      id="news"
      className="relative w-full py-20 md:py-28 lg:py-32 bg-white dark:bg-gray-950"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Baslik */}
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
            Haberler & Duyurular
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            Güncel Haberler
          </h2>
          <div className="mt-6 h-1 w-16 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Teşkilatımızdan son gelişmeler, etkinlikler ve duyurular.
          </p>
        </div>

        {/* Grid veya placeholder */}
        {list.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {list.map(item => (
              <NewsCard key={item.id || item.title} item={item} />
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">
              Yakında haberler ve duyurular burada paylaşılacak.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default NewsSection;
