import React from 'react';

const steps = [
  {
    step: 1,
    title: 'Ihlalin Tespiti',
    description: 'Kisisel veri ihlali tespit edildiginde, durum derhal veri sorumlusuna (il sekreteri veya yetkili yonetici) bildirilir.',
    timeframe: 'Derhal',
  },
  {
    step: 2,
    title: 'Ihlalin Degerlendirilmesi',
    description: 'Ihlalin kapsami, etkilenen kisi sayisi, veri turleri ve olasi sonuclari degerlendirilir. Ihlal kaydi tutulur.',
    timeframe: 'Ilk 24 saat',
  },
  {
    step: 3,
    title: 'KVKK Kuruluna Bildirim',
    description: 'KVKK Madde 12/5 uyarinca, veri ihlali en kisa surede ve en gec 72 saat icinde Kisisel Verileri Koruma Kurulu\'na bildirilir.',
    timeframe: '72 saat icinde (zorunlu)',
  },
  {
    step: 4,
    title: 'Ilgili Kisilere Bildirim',
    description: 'Kurul karari veya gerekli goruldugunde, etkilenen kisisel veri sahiplerine ihlal hakkinda bilgilendirme yapilir.',
    timeframe: 'Kurul karari sonrasi',
  },
  {
    step: 5,
    title: 'Onleyici Tedbirler',
    description: 'Ihlalin tekrarlanmasini onlemek icin gerekli teknik ve idari tedbirler alinir. Sistemler gozden gecirilir.',
    timeframe: 'Derhal baslayarak surekli',
  },
  {
    step: 6,
    title: 'Dokumantasyon',
    description: 'Tum ihlal sureci, alinan onlemler ve sonuclari kayit altina alinir. Ihlal kaydi en az 5 yil saklanir.',
    timeframe: 'Surekli',
  },
];

const DataBreachProcedure = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Veri Ihlali Bildirim Proseduru
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          KVKK Madde 12 kapsaminda kisisel veri ihlali durumunda izlenecek prosedur adimlari.
        </p>
      </div>

      {/* Uyari banner */}
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.732 17c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Onemli Uyari</h3>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              Veri ihlali durumunda KVKK Kurulu'na <strong>en gec 72 saat icinde</strong> bildirim yapilmasi yasal zorunluluktur. Bildirim yapilmamasi idari para cezasina tabi olabilir.
            </p>
          </div>
        </div>
      </div>

      {/* Prosedur adimlari */}
      <div className="space-y-4">
        {steps.map((item) => (
          <div key={item.step} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{item.step}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.title}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
                    {item.timeframe}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* KVKK Kurulu iletisim */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">KVKK Kurulu Iletisim</h3>
        <div className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <p>Web: <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">www.kvkk.gov.tr</a></p>
          <p>Veri Ihlali Bildirim Formu: KVKK web sitesi uzerinden elektronik olarak yapilmaktadir.</p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Not:</strong> Bu prosedur genel bilgilendirme amaciyla hazirlanmistir. Kurumunuza ozgu veri ihlali mudahale plani, hukuk danismaniniz ile birlikte hazirlanmalidir.
        </p>
      </div>
    </div>
  );
};

export default DataBreachProcedure;
