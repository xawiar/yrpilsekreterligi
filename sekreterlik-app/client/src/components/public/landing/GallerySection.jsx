import React, { useEffect, useState, useCallback } from 'react';

/**
 * GallerySection — Etkinlik / saha galerisi.
 * Props: { gallery } (array of {id, url, caption, date, image?})
 * Hover'da caption overlay. Tıklanınca lightbox-like modal.
 * Bos listede render yapilmaz (parent kontrolunde).
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

const GalleryItem = ({ item, onOpen }) => {
  const url = item?.url || item?.image || item?.imageUrl || item?.photo || '';
  const caption = item?.caption || item?.title || '';
  const date = formatDate(item?.date || item?.created_at || item?.createdAt);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-white dark:from-primary-900/60 dark:via-gray-800 dark:to-gray-900 shadow-sm hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      aria-label={caption || 'Galeri görseli'}
    >
      {url ? (
        <img
          src={url}
          alt={caption || 'Galeri görseli'}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg className="w-10 h-10 text-primary-300 dark:text-primary-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
      )}

      {/* Alt gradient + caption overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-left">
        {caption && (
          <p className="text-white text-sm font-semibold line-clamp-2 drop-shadow">
            {caption}
          </p>
        )}
        {date && (
          <p className="text-white/80 text-xs mt-1 drop-shadow">
            {date}
          </p>
        )}
      </div>

      {/* Ust sag koşe büyüt ikonu */}
      <div className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/85 dark:bg-gray-900/85 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow">
        <svg className="w-4 h-4 text-gray-900 dark:text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
        </svg>
      </div>
    </button>
  );
};

const Lightbox = ({ active, onClose, onPrev, onNext, hasPrev, hasNext }) => {
  const url = active?.url || active?.image || active?.imageUrl || active?.photo || '';
  const caption = active?.caption || active?.title || '';
  const date = formatDate(active?.date || active?.created_at || active?.createdAt);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-10 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Galeri görüntüleyici"
      onClick={onClose}
    >
      {/* Kapat */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 md:top-6 md:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Kapat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Onceki */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Önceki"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Sonraki */}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Sonraki"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Icerik */}
      <div
        className="relative max-w-6xl max-h-full w-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {url && (
          <img
            src={url}
            alt={caption || 'Galeri görseli'}
            className="max-h-[80vh] w-auto max-w-full rounded-xl shadow-2xl object-contain"
          />
        )}
        {(caption || date) && (
          <div className="mt-4 md:mt-6 text-center max-w-2xl">
            {caption && (
              <p className="text-white text-base md:text-lg font-semibold leading-relaxed">
                {caption}
              </p>
            )}
            {date && (
              <p className="text-white/70 text-sm mt-1">
                {date}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const GallerySection = ({ gallery = [] }) => {
  const list = Array.isArray(gallery) ? gallery : [];
  const [activeIdx, setActiveIdx] = useState(-1);

  const open = useCallback((item) => {
    const idx = list.findIndex(g => (g.id || g.url) === (item.id || item.url));
    setActiveIdx(idx >= 0 ? idx : 0);
  }, [list]);

  const close = useCallback(() => setActiveIdx(-1), []);

  const prev = useCallback(() => {
    setActiveIdx(i => (i > 0 ? i - 1 : i));
  }, []);

  const next = useCallback(() => {
    setActiveIdx(i => (i < list.length - 1 ? i + 1 : i));
  }, [list.length]);

  // Klavye: ESC kapat, ok tuslari onceki/sonraki
  useEffect(() => {
    if (activeIdx < 0) return;
    const handler = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIdx, close, prev, next]);

  // Body scroll kilidi
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (activeIdx >= 0) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [activeIdx]);

  // Empty placeholder
  if (list.length === 0) {
    return (
      <section id="gallery" className="relative w-full py-20 md:py-28 lg:py-32 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
              Saha Çalışmalarımız
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              Etkinlik Galerisi
            </h2>
            <div className="mt-6 h-1 w-16 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
          </div>
          <div className="max-w-md mx-auto text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-950">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">
              Yakında saha çalışmalarımızdan görseller paylaşılacak.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const active = activeIdx >= 0 ? list[activeIdx] : null;

  return (
    <section
      id="gallery"
      className="relative w-full py-20 md:py-28 lg:py-32 bg-gray-50 dark:bg-gray-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Baslik */}
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
            Saha Çalışmalarımız
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            Etkinlik Galerisi
          </h2>
          <div className="mt-6 h-1 w-16 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Etkinliklerimiz, ziyaretlerimiz ve saha çalışmalarımızdan kareler.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {list.map(item => (
            <GalleryItem key={item.id || item.url} item={item} onOpen={open} />
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {active && (
        <Lightbox
          active={active}
          onClose={close}
          onPrev={prev}
          onNext={next}
          hasPrev={activeIdx > 0}
          hasNext={activeIdx < list.length - 1}
        />
      )}
    </section>
  );
};

export default GallerySection;
