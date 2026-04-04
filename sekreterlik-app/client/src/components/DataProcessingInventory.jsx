import React from 'react';

const dataCategories = [
  {
    category: 'Kimlik Bilgileri',
    dataTypes: 'Ad, soyad, T.C. kimlik numarasi',
    purpose: 'Uyelik kayitlarinin tutulmasi, yasal yukumluluklerin yerine getirilmesi, teskilat yapisinin yonetilmesi',
    legalBasis: 'KVKK m.5/2-c (sozlesme ifasi), m.5/2-c (hukuki yukumluluk)',
    retentionPeriod: 'Uyelik suresi + 10 yil',
    recipients: 'Parti genel merkezi, yetkili kamu kurumlari (YSK, Iceisleri Bakanligi)',
    dataSubjects: 'Parti uyeleri, yoneticiler',
    collectionMethod: 'Uyelik formu (web/mobil uygulama)',
    securityMeasures: 'SSL/TLS sifreleme, erisim kontrolu, veritabani sifreleme',
  },
  {
    category: 'Iletisim Bilgileri',
    dataTypes: 'Telefon numarasi, adres',
    purpose: 'Iletisim faaliyetlerinin yurutulmesi, SMS bildirim gonderimi, toplanti davetleri',
    legalBasis: 'KVKK m.5/2-c (sozlesme ifasi), Acik riza (SMS gonderimi)',
    retentionPeriod: 'Uyelik suresi + 5 yil',
    recipients: 'SMS servis saglayicisi (NetGSM - TR, sifreli aktarim)',
    dataSubjects: 'Parti uyeleri',
    collectionMethod: 'Uyelik formu (web/mobil uygulama)',
    securityMeasures: 'SSL/TLS sifreleme, erisim kontrolu',
  },
  {
    category: 'Mesleki/Teskilat Bilgileri',
    dataTypes: 'Gorev, bolge, pozisyon, ilce/belde/mahalle atamasi',
    purpose: 'Teskilat yapisinin yonetilmesi, gorev dagilimi, performans degerlendirmesi',
    legalBasis: 'KVKK m.5/2-f (mesru menfaat)',
    retentionPeriod: 'Uyelik suresi + 5 yil',
    recipients: 'Parti teskilat birimleri',
    dataSubjects: 'Parti uyeleri, yoneticiler, temsilciler',
    collectionMethod: 'Yonetici atamasi, uye kayit sistemi',
    securityMeasures: 'Rol bazli erisim kontrolu (RBAC)',
  },
  {
    category: 'Ozel Nitelikli Veriler',
    dataTypes: 'Siyasi parti uyeligi',
    purpose: 'Parti teskilat faaliyetlerinin yurutulmesi, 2820 sayili Siyasi Partiler Kanunu gereklilikleri',
    legalBasis: 'KVKK m.6/2 (Acik riza)',
    retentionPeriod: 'Uyelik suresi + 10 yil',
    recipients: 'Yetkili kamu kurumlari (yasal zorunluluk halinde)',
    dataSubjects: 'Parti uyeleri',
    collectionMethod: 'Uyelik formu ile acik riza alinarak',
    securityMeasures: 'Acik riza kaydi, sifreleme, erisim kisitlamasi, log kaydi',
  },
  {
    category: 'Toplanti/Etkinlik Verileri',
    dataTypes: 'Katilim bilgileri, mazeret kayitlari, yoklama listeleri',
    purpose: 'Toplanti ve etkinliklerin organizasyonu, katilim takibi, performans degerlendirmesi',
    legalBasis: 'KVKK m.5/2-f (mesru menfaat)',
    retentionPeriod: 'Uyelik suresi + 3 yil',
    recipients: 'Parti teskilat birimleri',
    dataSubjects: 'Toplanti/etkinlik katilimcilari',
    collectionMethod: 'Yoklama sistemi, etkinlik kayit modulu',
    securityMeasures: 'Erisim kontrolu, veritabani yedeklemesi',
  },
  {
    category: 'Fotograf',
    dataTypes: 'Profil fotografi',
    purpose: 'Uye tanimlamasi, teskilat rehberi',
    legalBasis: 'Acik riza',
    retentionPeriod: 'Uyelik suresi',
    recipients: 'Firebase Storage (Google LLC, ABD - SCCs kapsaminda)',
    dataSubjects: 'Fotograf yukleyen uyeler',
    collectionMethod: 'Istege bagli yukleme (uyelik formu)',
    securityMeasures: 'Firebase Storage guvenligi, erisim kurallari',
  },
  {
    category: 'Secim Verileri',
    dataTypes: 'Sandik sonuclari, gozlemci atamalari, koordinator bilgileri',
    purpose: 'Secim hazirliklari, sonuc takibi, raporlama',
    legalBasis: 'KVKK m.5/2-c (hukuki yukumluluk)',
    retentionPeriod: 'Secim donemi + 10 yil',
    recipients: 'Yetkili secim kurullari, parti genel merkezi',
    dataSubjects: 'Gozlemciler, koordinatorler, secim gorevlileri',
    collectionMethod: 'Secim modulu (web/mobil uygulama)',
    securityMeasures: 'Rol bazli erisim kontrolu, denetim kaydi',
  },
  {
    category: 'Oturum ve Log Verileri',
    dataTypes: 'IP adresi, tarayici bilgisi, giris/cikis kayitlari',
    purpose: 'Sistem guvenligi, yetkisiz erisim tespiti',
    legalBasis: 'KVKK m.5/2-f (mesru menfaat)',
    retentionPeriod: '2 yil',
    recipients: 'Yalnizca sistem ici kullanim',
    dataSubjects: 'Tum sistem kullanicilari',
    collectionMethod: 'Otomatik (sunucu loglari)',
    securityMeasures: 'Log dosyasi erisim kisitlamasi, sifreleme',
  },
];

const transferRecipients = [
  {
    recipient: 'Firebase / Google LLC',
    country: 'ABD',
    purpose: 'Bulut veritabani, dosya depolama, kimlik dogrulama',
    legalBasis: 'AB Standart Sozlesme Maddeleri (SCCs)',
    dataTransferred: 'Uyelik bilgileri, profil fotografi, oturum verileri',
  },
  {
    recipient: 'NetGSM',
    country: 'Turkiye',
    purpose: 'SMS bildirim gonderimi',
    legalBasis: 'Acik riza, hizmet sozlesmesi',
    dataTransferred: 'Telefon numarasi, mesaj icerigi',
  },
  {
    recipient: 'Parti Genel Merkezi',
    country: 'Turkiye',
    purpose: 'Teskilat yonetimi, yasal raporlama',
    legalBasis: 'KVKK m.5/2-c, 2820 sayili Kanun',
    dataTransferred: 'Uyelik bilgileri, teskilat verileri',
  },
];

const DataProcessingInventory = () => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Veri Isleme Envanteri
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          KVKK Madde 16 uyarinca tutulan kisisel veri isleme envanteri. Bu envanter, hangi kisisel verilerin hangi amaclarla toplandigi, hukuki dayanagi, saklama suresi, guvenlik onlemleri ve kimlerle paylasildigini detayli olarak gostermektedir.
        </p>
      </div>

      {/* Main Inventory Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Kisisel Veri Isleme Faaliyetleri
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Veri Kategorisi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Veri Turleri</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Isleme Amaci</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hukuki Dayanak</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Saklama Suresi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Veri Konusu Kisiler</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Toplama Yontemi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Guvenlik Onlemleri</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Alicilar</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {dataCategories.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.dataTypes}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.purpose}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.legalBasis}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.retentionPeriod}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.dataSubjects}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.collectionMethod}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.securityMeasures}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Transfer Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Veri Aktarim Alicilari
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Alici</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ulke</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Aktarim Amaci</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hukuki Dayanak</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Aktarilan Veriler</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {transferRecipients.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{item.recipient}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.country}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.purpose}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.legalBasis}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.dataTransferred}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technical and Administrative Measures */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Teknik ve Idari Tedbirler
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Teknik Tedbirler</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 list-disc list-inside">
              <li>SSL/TLS sifreleme (HTTPS)</li>
              <li>Veritabani sifreleme (AES-256)</li>
              <li>JWT tabanli kimlik dogrulama</li>
              <li>Rol bazli erisim kontrolu (RBAC)</li>
              <li>Otomatik oturum sonlandirma</li>
              <li>Rate limiting ve DDoS korumasi</li>
              <li>Duzenli veritabani yedeklemesi</li>
              <li>Guvenlik basliklari (Helmet.js)</li>
              <li>Input validasyonu ve sanitizasyonu</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Idari Tedbirler</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 list-disc list-inside">
              <li>Veri isleme envanteri tutulmasi</li>
              <li>Kisisel veri isleme politikasi</li>
              <li>Calisanlara KVKK egitimi</li>
              <li>Gizlilik sozlesmeleri</li>
              <li>Duzzenli denetim ve kontrol</li>
              <li>Veri ihlali bildirim proseduru</li>
              <li>Veri imha politikasi</li>
              <li>Ucuncu taraf risk degerlendirmesi</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Not:</strong> Bu envanter ornektir. Kurumunuzun gercek veri isleme faaliyetlerine gore guncellenmeli ve hukuk danismaniniz tarafindan onaylanmalidir. Envanter en az yillik olarak gozden gecirilmeli ve degisiklikler kayit altina alinmalidir.
        </p>
      </div>
    </div>
  );
};

export default DataProcessingInventory;
