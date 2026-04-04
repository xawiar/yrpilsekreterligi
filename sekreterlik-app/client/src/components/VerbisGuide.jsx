import React from 'react';

const VerbisGuide = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          VERBIS Kayit Rehberi
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Veri Sorumlulari Sicil Bilgi Sistemi (VERBIS) nedir ve nasil kayit olunur?
        </p>
      </div>

      {/* VERBIS Nedir */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">VERBIS Nedir?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          VERBIS (Veri Sorumlulari Sicil Bilgi Sistemi), 6698 sayili KVKK'nin 16. maddesi uyarinca kurulan ve veri sorumlularinin kayit olmak zorunda oldugu bir sistemdir. Kisisel verileri isleme amaci, veri kategorisi, aktarim yapilan alici gruplari ve veri saklama surelerinin beyan edildigi sicildir.
        </p>
      </div>

      {/* Kimler Kayit Olmali */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Kimler VERBIS'e Kayit Olmalidir?</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
          <li>Yillik calisan sayisi 50'den fazla olan gercek ve tuzel kisiler</li>
          <li>Yillik mali bilanco toplami 25 milyon TL'den fazla olanlar</li>
          <li>Ana faaliyet konusu ozel nitelikli kisisel veri isleme olanlar</li>
          <li>Kamu kurum ve kuruluslari</li>
        </ul>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Siyasi partiler:</strong> Siyasi partiler ozel nitelikli kisisel veri (siyasi gorusler/uyelik) islemesi nedeniyle VERBIS kaydi degerlendirmesine tabi olabilir. Kesin durum icin KVKK Kurulu'nun guncel duyurulari ve hukuk danismaniniz kontrol edilmelidir.
          </p>
        </div>
      </div>

      {/* Kayit Adimlari */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">VERBIS Kayit Adimlari</h3>
        <div className="space-y-4">
          {[
            {
              step: 1,
              title: 'VERBIS Sistemine Erisim',
              desc: 'verbis.kvkk.gov.tr adresinden sisteme erisim saglayin.'
            },
            {
              step: 2,
              title: 'Irtibat Kisisi Belirleme',
              desc: 'Turkiye\'de yerlesik bir irtibat kisisi belirleyin. Bu kisi KVKK ile iletisimden sorumlu olacaktir.'
            },
            {
              step: 3,
              title: 'Basvuru Formunu Doldurma',
              desc: 'Veri sorumlusu bilgileri, irtibat kisisi bilgileri ve iletisim bilgilerini sisteme girin.'
            },
            {
              step: 4,
              title: 'Veri Isleme Envanterini Yukleme',
              desc: 'Islenen kisisel verilerin kategorileri, isleme amaclari, hukuki dayanaklari, saklama sureleri ve aktarim bilgilerini beyan edin.'
            },
            {
              step: 5,
              title: 'Basvuruyu Tamamlama',
              desc: 'Tum bilgileri kontrol edin ve basvuruyu onaylayin. Onay sonrasi sicil numaranizi alacaksiniz.'
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{item.step}</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gerekli Bilgiler */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">VERBIS Kaydi Icin Gerekli Bilgiler</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Veri sorumlusunun unvani / adi',
            'Veri sorumlusunun adresi',
            'Tebligat adresi',
            'Vergi kimlik numarasi',
            'Irtibat kisisi ad-soyad',
            'Irtibat kisisi iletisim bilgileri',
            'Islenen kisisel veri kategorileri',
            'Veri isleme amaclari',
            'Veri aktarim yapilan alici gruplari',
            'Veri konusu kisi gruplari',
            'Veri saklama sureleri',
            'Yabanci ulkelere veri aktarimi (varsa)',
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Faydali linkler */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">Faydali Baglantilar</h3>
        <div className="space-y-1">
          <p className="text-sm text-indigo-700 dark:text-indigo-400">
            VERBIS: <a href="https://verbis.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">verbis.kvkk.gov.tr</a>
          </p>
          <p className="text-sm text-indigo-700 dark:text-indigo-400">
            KVKK: <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">www.kvkk.gov.tr</a>
          </p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Not:</strong> VERBIS kayit yukumlulugunuz hakkinda kesin bilgi icin KVKK Kurulu'nun guncel duyurularini ve hukuk danismaninizi kontrol ediniz. VERBIS kayit sureleri ve muafiyetler guncellenebilmektedir.
        </p>
      </div>
    </div>
  );
};

export default VerbisGuide;
