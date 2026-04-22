import React from 'react';

/**
 * LeadersSection
 * Il Baskani + Divan uyelerini grid olarak gosterir.
 * ONEMLI: TC, telefon, e-posta, adres GOSTERILMEZ.
 * Sadece name, position, region, photo, muvefettislik.
 * Props: { members = [], title = 'Yonetim Kademesi' }
 */

const initialsOf = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toLocaleUpperCase('tr-TR')).join('');
};

const LeaderCard = ({ member }) => {
  // Sadece guvenli alanlari kullan
  const name = member?.name || '';
  const position = member?.position || '';
  const region = member?.region || '';
  const photo = member?.photo || '';
  const muvefettislik = member?.muvefettislik || '';

  return (
    <article className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
      {/* Avatar */}
      <div className="relative aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-300 select-none">
            {initialsOf(name)}
          </span>
        )}
      </div>

      {/* Bilgi */}
      <div className="p-4 text-center">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
          {name || 'Isimsiz'}
        </h3>
        {position && (
          <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400 font-medium truncate">
            {position}
          </p>
        )}
        {region && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
            {region}
          </p>
        )}
        {muvefettislik && (
          <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            {muvefettislik}
          </span>
        )}
      </div>
    </article>
  );
};

const LeadersSection = ({ members = [], title = 'Yonetim Kademesi' }) => {
  if (!Array.isArray(members) || members.length === 0) {
    return null;
  }

  return (
    <section
      id="leaders"
      className="w-full py-12 md:py-20 bg-gray-50 dark:bg-gray-950"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="mt-3 w-16 h-1 bg-indigo-600 dark:bg-indigo-400 mx-auto rounded-full" />
          <p className="mt-4 text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Il baskanimiz ve divan uyelerimizle gorev basindayiz.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {members.map((m) => (
            <LeaderCard key={m.id || m.name} member={m} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default LeadersSection;
