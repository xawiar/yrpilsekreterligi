import React, { useEffect, useState } from 'react';
import ApiService from '../../../utils/ApiService';

const TYPE_META = {
  video: {
    label: 'Video',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    chip: 'bg-red-500',
    icon: (
      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
    )
  },
  pdf: {
    label: 'Belge',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    chip: 'bg-orange-500',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  },
  text: {
    label: 'Yazı',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    chip: 'bg-blue-500',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    )
  }
};

const youtubeEmbedUrl = (url) => {
  if (!url) return '';
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
};

const youtubeThumb = (url) => {
  if (!url) return '';
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : '';
};

// Tek bir eğitim kartı — public landing estetiğinde (NewsCard ile uyumlu)
const TrainingCard = ({ material, onOpen }) => {
  const type = material?.content_type || 'text';
  const meta = TYPE_META[type] || TYPE_META.text;

  // Thumbnail kaynağı: explicit thumbnail_url > YouTube > yok (gradient)
  const thumb = material?.thumbnail_url || (type === 'video' && material?.video_source === 'youtube' ? youtubeThumb(material?.video_url) : '');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 overflow-hidden"
    >
      {/* Görsel alanı (16:9) */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-red-700 via-red-600 to-rose-600">
        {thumb ? (
          <img
            src={thumb}
            alt={material.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/80">
            {meta.icon}
          </div>
        )}

        {/* Tip rozet */}
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1 ${meta.chip} text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md`}>
          {type === 'video' && (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
          {type === 'pdf' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          )}
          {type === 'text' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
          )}
          {meta.label}
        </span>

        {/* Video play overlay */}
        {type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
            <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <svg className="w-7 h-7 text-primary-700 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        )}

        {/* Alt gradient */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* İçerik */}
      <div className="flex-1 flex flex-col p-6">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
          {material.title || 'İsimsiz'}
        </h3>
        {material.description && (
          <p className="mt-3 text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 flex-1">
            {material.description}
          </p>
        )}
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 group-hover:gap-2 transition-all">
          {type === 'video' ? 'İzle' : type === 'pdf' ? 'Belgeyi Aç' : 'Oku'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </span>
      </div>
    </button>
  );
};

// Materyal viewer modal — public erişimde takip mantığı yok, sadece görüntüleme
const TrainingViewer = ({ material, onClose }) => {
  if (!material) return null;
  const type = material.content_type || 'text';
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{material.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-3xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {material.description && (
            <p className="text-base text-gray-600 dark:text-gray-400">{material.description}</p>
          )}

          {type === 'video' && material.video_source === 'youtube' && material.video_url && (
            <div className="aspect-video w-full">
              <iframe
                src={youtubeEmbedUrl(material.video_url)}
                title={material.title}
                className="w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
          {type === 'video' && material.video_source === 'storage' && material.video_url && (
            <video controls className="w-full rounded-lg" src={material.video_url} />
          )}

          {type === 'pdf' && material.pdf_url && (
            <div>
              <iframe src={material.pdf_url} title={material.title} className="w-full h-[70vh] rounded-lg border" />
              <a
                href={material.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline"
              >
                Yeni sekmede aç
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </a>
            </div>
          )}

          {type === 'text' && material.text_content && (
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
              {material.text_content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Public landing — Eğitim ve Bilgilendirme bölümü.
 * Görsel zenginlik: gradient arka plan, başlık + alt çizgi, video play overlay, hover animasyonları.
 * Boş ise bütün section gizlenir (parent koşulu).
 */
const TrainingSection = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMaterial, setActiveMaterial] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await ApiService.getTrainingMaterials('public', true);
        if (mounted) setMaterials(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[TrainingSection] Load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return null;
  if (materials.length === 0) return null; // hiç materyal yoksa section'ı gizle

  return (
    <section
      id="training"
      className="relative w-full py-20 md:py-28 lg:py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-hidden"
    >
      {/* Dekoratif arka plan blob'ları */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-red-200/40 dark:bg-red-900/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-200/40 dark:bg-rose-900/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Başlık */}
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
            Eğitim & Bilgilendirme
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            Bilinçli Vatandaşlık İçin Eğitim İçerikleri
          </h2>
          <div className="mt-6 h-1 w-16 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Seçim süreçleri, görev ve sorumluluklar üzerine hazırladığımız video, belge ve yazılı eğitim materyalleri.
          </p>
        </div>

        {/* Kart grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {materials.map((m) => (
            <TrainingCard key={m.id} material={m} onOpen={() => setActiveMaterial(m)} />
          ))}
        </div>
      </div>

      <TrainingViewer material={activeMaterial} onClose={() => setActiveMaterial(null)} />
    </section>
  );
};

export default TrainingSection;
