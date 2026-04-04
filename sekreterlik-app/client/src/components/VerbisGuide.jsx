import React from 'react';

const VerbisGuide = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          VERBIS Kayit Rehberi
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Veri Sorumlulari Sicil Bilgi Sistemi (VERBIS) nedir, kimler kayit olmalidir ve nasil kayit olunur? Bu rehber, siyasi parti il baskanliklarinin VERBIS yukumlulugunu anlamasini ve gerekli adimlari uygulamasini kolaylastirmak icin hazirlanmistir.
        </p>
      </div>

      {/* VERBIS Nedir */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">VERBIS Nedir?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
          VERBIS (Veri Sorumlulari Sicil Bilgi Sistemi), 6698 sayili KVKK'nin 16. maddesi uyarinca kurulan ve veri sorumlularinin kayit olmak zorunda oldugu bir sistemdir. Kisisel verileri isleme amaci, veri kategorisi, aktarim yapilan alici gruplari ve veri saklama surelerinin beyan edildigi resmi sicildir.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          VERBIS kaydinin temel amaci, kisisel veri isleme faaliyetlerinde seffafligin saglanmasi ve veri sahiplerinin haklarini kullanabilmesi icin veri sorumlularinin kamuya acik bir sicilde yer almasidir.
        </p>
      </div>

      {/* Siyasi Partiler Ozel Durumu */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
        <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mb-3">Siyasi Partiler Icin Ozel Durum</h3>
        <div className="text-sm text-indigo-800 dark:text-indigo-300 space-y-3">
          <p>Siyasi partiler, asagidaki nedenlerle KVKK kapsaminda ozel bir konumdadir:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li><strong>Ozel nitelikli veri isleme:</strong> Siyasi parti uyeligi, KVKK Madde 6 kapsaminda ozel nitelikli kisisel veridir</li>
            <li><strong>2820 sayili Siyasi Partiler Kanunu:</strong> Parti teskilatlari uye kayit yukumlulugu altindadir</li>
            <li><strong>Genis veri isleme faaliyeti:</strong> Uye yonetimi, etkinlik organizasyonu, secim hazirliklari gibi kapsamli veri isleme soz konusudur</li>
          </ul>
          <div className="mt-3 p-3 bg-indigo-100 dark:bg-indigo-800/30 rounded-lg">
            <p><strong>Sonuc:</strong> Siyasi parti il baskanliklarinin, ozel nitelikli kisisel veri islemeleri ve uye sayilari dikkate alindiginda, VERBIS kaydinin degerlendirmesi yapilmasi gerekmektedir. Kesin karar icin KVKK Kurulu'nun guncel duyurulari ve hukuk danismaniniz kontrol edilmelidir.</p>
          </div>
        </div>
      </div>

      {/* Kimler Kayit Olmali */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Kimler VERBIS'e Kayit Olmalidir?</h3>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Asagidaki kosullardan en az birini saglayan veri sorumlulari VERBIS'e kayit olmak zorundadir:</p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
            <li>Yillik calisan sayisi 50'den fazla olan gercek ve tuzel kisiler</li>
            <li>Yillik mali bilanco toplami 25 milyon TL'den fazla olanlar</li>
            <li>Ana faaliyet konusu ozel nitelikli kisisel veri isleme olanlar</li>
            <li>Kamu kurum ve kuruluslari</li>
          </ul>
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">
              <strong>Muafiyetler:</strong> Yillik calisan sayisi 50'den az ve yillik mali bilanco toplami 25 milyon TL'den az olan gercek veya tuzel kisiler, isledikleri veriler ozel nitelikli degilse, VERBIS kaydindan muaf tutulabilir. Ancak KVKK'nin diger yukumlulukleri (aydinlatma, veri guvenligi vb.) devam eder.
            </p>
          </div>
        </div>
      </div>

      {/* Kayit Oncesi Hazirlik */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Kayit Oncesi Hazirlik</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">VERBIS kaydina baslamadan once asagidaki hazirliklarin tamamlanmasi gerekir:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: 'Veri Isleme Envanteri', desc: 'Tum kisisel veri isleme faaliyetlerinin envanterinin cikarilmasi (bu sistemdeki "Veri Isleme Envanteri" sekmesini kullanabilirsiniz)' },
            { title: 'Kisisel Veri Politikasi', desc: 'Kisisel verilerin korunmasi ve islenmesine iliskin politika belgesi hazirlanmasi' },
            { title: 'Aydinlatma Metni', desc: 'KVKK Madde 10 uyarinca aydinlatma metninin hazirlanmasi (mevcut "Aydinlatma Metni" sayfanizi gozden gecirin)' },
            { title: 'Irtibat Kisisi Belirleme', desc: 'KVKK ile iletisimden sorumlu irtibat kisisinin belirlenmesi' },
            { title: 'Acik Riza Mekanizmasi', desc: 'Ozel nitelikli kisisel veriler icin acik riza alma mekanizmasinin kurulmasi' },
            { title: 'Veri Guvenligi Tedbirleri', desc: 'Teknik ve idari guvenliktedbirlerinin dokumante edilmesi' },
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{index + 1}</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
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
              desc: 'verbis.kvkk.gov.tr adresinden sisteme erisin. Ilk giris icin kurumsal e-posta adresi ve kurumsal bilgileriniz gerekecektir.',
              details: 'E-Devlet uzerinden de giris yapilabilmektedir.'
            },
            {
              step: 2,
              title: 'Irtibat Kisisi Atama',
              desc: 'Turkiye\'de yerlesik bir irtibat kisisi belirleyin. Bu kisi KVKK Kurulu ile tum yaziflmalardansorumlu olacaktir.',
              details: 'Irtibat kisisi, veri sorumlusu organizasyonu icinde ust duzey yoneticilerden biri olmalidir.'
            },
            {
              step: 3,
              title: 'Veri Sorumlusu Bilgilerini Girme',
              desc: 'Kurum unvani, adresi, vergi kimlik numarasi, iletisim bilgileri ve tebligat adresi gibi bilgileri sisteme girin.',
              details: 'Tuzel kisiler icin ticaret sicil numarasi veya kurum sicil bilgisi gerekebilir.'
            },
            {
              step: 4,
              title: 'Veri Isleme Faaliyetlerini Beyan Etme',
              desc: 'Islenen kisisel verilerin kategorilerini, isleme amaclarini, hukuki dayanaklarini, saklama surelerini ve aktarim bilgilerini sisteme girin.',
              details: 'Bu adim icin onceden hazirladiginiz "Veri Isleme Envanteri"ni kullanabilirsiniz.'
            },
            {
              step: 5,
              title: 'Yurt Disi Aktarim Beyani',
              desc: 'Eger kisisel veriler yurt disina aktariliyorsa (ornegin Firebase/Google sunuculari), bu aktarimi ve hukuki dayanagini (SCCs vb.) beyan edin.',
              details: 'Bu sistemde Firebase kullanimi nedeniyle yurt disi aktarim beyani gereklidir.'
            },
            {
              step: 6,
              title: 'Basvuruyu Tamamlama ve Onay',
              desc: 'Tum bilgileri kontrol edin ve basvuruyu onaylayin. Onay sonrasi VERBIS sicil numaranizi alacaksiniz.',
              details: 'Sicil numaranizi aydinlatma metninizde ve ilgili dokumanlarda belirtmeniz onerilir.'
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{item.step}</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{item.desc}</p>
                {item.details && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">{item.details}</p>
                )}
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
            'Yabanci ulkelere veri aktarimi (Firebase - ABD)',
            'Alinan teknik ve idari tedbirler',
            'Ozel nitelikli veri isleme dayanaklari',
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

      {/* Kayit Sonrasi Yukumlulukler */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Kayit Sonrasi Yukumlulukler</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
          <li><strong>Guncelleme yukumlulugu:</strong> Veri isleme faaliyetlerinde degisiklik olmasi halinde VERBIS kayitlarinin 7 gun icinde guncellenmesi</li>
          <li><strong>Yillik gozden gecirme:</strong> En az yilda bir kez kayitlarin gozden gecirilmesi ve gerekli guncellemelerin yapilmasi</li>
          <li><strong>Sicil numarasi kullanimi:</strong> Aydinlatma metinlerinde ve ilgili dokumanlarda VERBIS sicil numarasinin belirtilmesi</li>
          <li><strong>Veri ihlali bildirimi:</strong> Kisisel veri ihlali durumunda KVKK Kurulu'na 72 saat icinde bildirim yapilmasi</li>
          <li><strong>Veri sahibi basvurulari:</strong> Veri sahiplerinden gelen basvurularin 30 gun icinde cevaplandirmasi</li>
        </ul>
      </div>

      {/* Cezai Yaptirimlar */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
        <h3 className="text-lg font-bold text-red-900 dark:text-red-200 mb-3">Cezai Yaptirimlar</h3>
        <div className="text-sm text-red-800 dark:text-red-300 space-y-2">
          <p>VERBIS kayit yukumlulugune uyulmaması halinde KVKK Madde 18 uyarinca asagidaki idari para cezalari uygulanabilir:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Aydinlatma yukumlulugune aykirilik:</strong> 10.000 TL - 200.000 TL</li>
            <li><strong>Veri guvenligine iliskin yukumluluklere aykirilik:</strong> 30.000 TL - 2.000.000 TL</li>
            <li><strong>KVKK Kurulu kararlarına aykirilik:</strong> 50.000 TL - 2.000.000 TL</li>
            <li><strong>VERBIS'e kayit ve bildirim yukumlulugune aykirilik:</strong> 40.000 TL - 2.000.000 TL</li>
          </ul>
          <p className="mt-2 italic text-xs">Not: Ceza miktarlari her yil guncellenmektedir. Guncel tutarlar icin KVKK web sitesini kontrol ediniz.</p>
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
          <p className="text-sm text-indigo-700 dark:text-indigo-400">
            KVKK Rehberler: <a href="https://www.kvkk.gov.tr/Icerik/2030/Rehberler" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">Rehberler Sayfasi</a>
          </p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Not:</strong> Bu rehber genel bilgilendirme amaclidir. VERBIS kayit yukumlulugu, muafiyetler ve cezai yaptirimlar hakkinda kesin bilgi icin KVKK Kurulu'nun guncel duyurularini kontrol ediniz ve hukuk danismaniniza danismaniz. VERBIS kayit sureleri ve muafiyetler mevzuat degisiklikleriyle guncellenebilmektedir.
        </p>
      </div>
    </div>
  );
};

export default VerbisGuide;
