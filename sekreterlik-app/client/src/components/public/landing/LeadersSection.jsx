import React from 'react';

/**
 * LeadersSection — Yonetim kadrosu, 3 grup: İl Başkanı, Divan Kurulu, İl Yönetimi.
 * ONEMLI: TC, telefon, e-posta, adres GOSTERILMEZ.
 * Grup alt başlıklarıyla ayrıştırılmış grid yapısı.
 * Props: { members = [], title }
 *
 * Her member objesinde _group alanı bulunur: 'ilBaskani' | 'divan' | 'ilYonetim'
 */

const initialsOf = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toLocaleUpperCase('tr-TR')).join('');
};

// Standart kart (Divan ve Il Yonetimi icin)
const LeaderCard = ({ member, size = 'md' }) => {
  const name = member?.name || '';
  const position = member?.position || '';
  const region = member?.region || '';
  const photo = member?.photo || '';
  const muvefettislik = member?.muvefettislik || '';

  const padding = size === 'sm' ? 'p-4' : 'p-5';
  const nameClass = size === 'sm' ? 'text-sm md:text-base' : 'text-base md:text-lg';

  return (
    <article className={`group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 overflow-hidden`}>
      {/* Avatar */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-white dark:from-primary-900/60 dark:via-gray-800 dark:to-gray-900">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent select-none">
              {initialsOf(name)}
            </span>
          </div>
        )}
        {/* Alt gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

        {muvefettislik && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500 text-white shadow-md backdrop-blur-sm">
            {muvefettislik}
          </span>
        )}
      </div>

      {/* Bilgi */}
      <div className={padding}>
        <h3 className={`${nameClass} font-semibold text-gray-900 dark:text-white truncate`} title={name}>
          {name || 'İsimsiz'}
        </h3>
        {position && (
          <p className="mt-1 text-sm text-primary-700 dark:text-primary-400 font-semibold truncate" title={position}>
            {position}
          </p>
        )}
        {region && size !== 'sm' && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 truncate flex items-center gap-1.5" title={region}>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {region}
          </p>
        )}
      </div>
    </article>
  );
};

// Il Baskani icin ozel buyuk merkezi kart
const PresidentCard = ({ member }) => {
  const name = member?.name || '';
  const position = member?.position || '';
  const region = member?.region || '';
  const photo = member?.photo || '';
  const muvefettislik = member?.muvefettislik || '';

  return (
    <article className="relative mx-auto max-w-md group">
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden">
        {/* Üst dekorasyon bandı */}
        <div className="h-2 bg-gradient-to-r from-primary-600 via-amber-500 to-primary-700" />

        <div className="px-6 pt-8 pb-6 text-center">
          {/* Dairesel avatar */}
          <div className="relative mx-auto w-44 h-44 md:w-52 md:h-52">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-600 via-primary-700 to-amber-500 blur-md opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative w-full h-full rounded-full overflow-hidden ring-4 ring-white dark:ring-gray-900 shadow-lg bg-gradient-to-br from-primary-100 via-primary-50 to-white dark:from-primary-900/60 dark:via-gray-800 dark:to-gray-900">
              {photo ? (
                <img
                  src={photo}
                  alt={name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl md:text-7xl font-bold bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent select-none">
                    {initialsOf(name)}
                  </span>
                </div>
              )}
            </div>
            {muvefettislik && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500 text-white shadow-md whitespace-nowrap">
                {muvefettislik}
              </span>
            )}
          </div>

          <div className="mt-8">
            <span className="inline-block px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[11px] font-bold uppercase tracking-[0.2em]">
              {position || 'İl Başkanı'}
            </span>
            <h3 className="mt-4 text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              {name || 'İsimsiz'}
            </h3>
            {region && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {region}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

const GroupHeading = ({ eyebrow, title, subtitle }) => (
  <div className="text-center mb-10 md:mb-14">
    <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-primary-700 dark:text-primary-400 mb-3">
      {eyebrow}
    </p>
    <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
      {title}
    </h3>
    <div className="mt-4 h-0.5 w-10 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
    {subtitle && (
      <p className="mt-4 text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
        {subtitle}
      </p>
    )}
  </div>
);

const EmptyPlaceholder = () => (
  <div className="max-w-lg mx-auto text-center p-10 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
    <div className="w-14 h-14 mx-auto rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
      <svg className="w-7 h-7 text-primary-700 dark:text-primary-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </div>
    <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
      Yönetim kadromuz yakında açıklanacak
    </h3>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
      İl yönetim listesi tamamlandığında bu alanda yayınlanacaktır.
    </p>
  </div>
);

const LeadersSection = ({ members = [], title = 'Yönetim Kademesi' }) => {
  const list = Array.isArray(members) ? members : [];

  const ilBaskani = list.filter(m => m._group === 'ilBaskani');
  const divan = list.filter(m => m._group === 'divan');
  const ilYonetim = list.filter(m => m._group === 'ilYonetim');

  const hasAny = ilBaskani.length > 0 || divan.length > 0 || ilYonetim.length > 0;

  return (
    <section
      id="leaders"
      className="relative w-full py-20 md:py-28 lg:py-32 bg-gray-50 dark:bg-gray-900"
    >
      {/* Arka plan dekoratif pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
        aria-hidden="true"
      >
        <defs>
          <pattern id="leaders-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1200" height="800" fill="url(#leaders-grid)" />
      </svg>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Bolum basligi */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
            Yönetim Kadromuz
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            {title}
          </h2>
          <div className="mt-6 h-1 w-16 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            İl Başkanımız, divan üyelerimiz ve il yönetim kadromuzla; sahada, vatandaşın yanında, sözümüzün arkasındayız.
          </p>
        </div>

        {!hasAny && <EmptyPlaceholder />}

        {/* 1. İl Başkanı */}
        {ilBaskani.length > 0 && (
          <div className="mb-20 md:mb-24">
            <GroupHeading
              eyebrow="Partimizin Lideri"
              title="İl Başkanı"
            />
            <div className="grid grid-cols-1 gap-8 justify-items-center">
              {ilBaskani.map(m => (
                <PresidentCard key={m.id || m.name} member={m} />
              ))}
            </div>
          </div>
        )}

        {/* 2. Divan Kurulu */}
        {divan.length > 0 && (
          <div className="mb-20 md:mb-24">
            <GroupHeading
              eyebrow="Karar Mercii"
              title="Divan Kurulu"
              subtitle="İl sekreterliğinin karar organı; teşkilatımızın omurgasını oluşturan divan üyelerimiz."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
              {divan.map(m => (
                <LeaderCard key={m.id || m.name} member={m} />
              ))}
            </div>
          </div>
        )}

        {/* 3. Il Yonetimi */}
        {ilYonetim.length > 0 && (
          <div>
            <GroupHeading
              eyebrow="İl Teşkilatı"
              title="İl Yönetim Kurulu"
              subtitle="Teşkilatımızın her noktasında görev alan il yönetim kurulu üyelerimiz."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
              {ilYonetim.map(m => (
                <LeaderCard key={m.id || m.name} member={m} size="sm" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default LeadersSection;
