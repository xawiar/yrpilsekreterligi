import React from 'react';

/**
 * ContactSection
 * Adres, telefon (tel:), e-posta (mailto:), sosyal medya ikonlari.
 * Harita yok, iframe yok.
 * Props: { address, phone, email, social = {} }
 */

const socialIcons = {
  facebook: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  ),
  instagram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.849.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.849c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.265.058-1.645.069-4.849.069s-3.584-.012-4.849-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.647 2.163 15.267 2.163 12s.012-3.584.07-4.849c.062-1.366.336-2.633 1.311-3.608C4.519 2.569 5.786 2.295 7.152 2.233 8.417 2.175 8.796 2.163 12 2.163zm0 1.837c-3.17 0-3.548.012-4.796.069-.969.044-1.496.207-1.845.344-.463.18-.795.395-1.144.744-.35.35-.564.681-.744 1.144-.137.35-.3.876-.344 1.845C2.012 8.452 2 8.83 2 12c0 3.17.012 3.548.069 4.796.044.969.207 1.495.344 1.845.18.463.395.795.744 1.144.35.35.681.564 1.144.744.35.137.876.3 1.845.344 1.248.057 1.626.069 4.796.069s3.548-.012 4.796-.069c.969-.044 1.496-.207 1.845-.344.463-.18.795-.395 1.144-.744.35-.35.564-.681.744-1.144.137-.35.3-.876.344-1.845.057-1.248.069-1.626.069-4.796s-.012-3.548-.069-4.796c-.044-.969-.207-1.496-.344-1.845a3.09 3.09 0 00-.744-1.144 3.09 3.09 0 00-1.144-.744c-.35-.137-.876-.3-1.845-.344C15.548 4.012 15.17 4 12 4zm0 3.838a4.162 4.162 0 110 8.324 4.162 4.162 0 010-8.324zm0 1.837a2.325 2.325 0 100 4.65 2.325 2.325 0 000-4.65zm4.406-2.29a.973.973 0 110 1.946.973.973 0 010-1.947z" />
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  youtube: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
};

const socialLabels = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  youtube: 'YouTube',
};

const ContactSection = ({
  address = '',
  phone = '',
  email = '',
  social = {},
}) => {
  const hasAny = address || phone || email || Object.values(social || {}).some(Boolean);
  if (!hasAny) {
    // Yine de baslik gostermek icin minimal fallback
  }

  // Telefon icin href temizle
  const telHref = phone
    ? 'tel:' + phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
    : '';

  return (
    <section
      id="contact"
      className="w-full py-12 md:py-20 bg-white dark:bg-gray-900"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Iletisim
          </h2>
          <div className="mt-3 w-16 h-1 bg-indigo-600 dark:bg-indigo-400 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Adres */}
          {address && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Adres</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line break-words">
                {address}
              </p>
            </div>
          )}

          {/* Telefon */}
          {phone && (
            <a
              href={telHref}
              className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors block"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Telefon</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 break-all">{phone}</p>
            </a>
          )}

          {/* E-posta */}
          {email && (
            <a
              href={'mailto:' + email}
              className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors block"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">E-posta</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 break-all">{email}</p>
            </a>
          )}
        </div>

        {/* Sosyal medya */}
        {social && Object.values(social).some(Boolean) && (
          <div className="mt-8 md:mt-12 flex flex-wrap justify-center gap-3">
            {Object.entries(social).map(([key, url]) => {
              if (!url || !socialIcons[key]) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLabels[key] || key}
                  className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
                >
                  {socialIcons[key]}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ContactSection;
