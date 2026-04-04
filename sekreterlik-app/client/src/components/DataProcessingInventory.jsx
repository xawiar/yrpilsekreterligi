import React from 'react';

const dataCategories = [
  {
    category: 'Kimlik Bilgileri',
    dataTypes: 'Ad, soyad, T.C. kimlik numarasi',
    purpose: 'Uyelik kayitlarinin tutulmasi, yasal yukumluluklerin yerine getirilmesi',
    legalBasis: 'KVKK m.5/2-c, m.5/2-c',
    retentionPeriod: 'Uyelik suresi + 10 yil',
    recipients: 'Parti genel merkezi, yetkili kamu kurumlari'
  },
  {
    category: 'Iletisim Bilgileri',
    dataTypes: 'Telefon numarasi, adres',
    purpose: 'Iletisim faaliyetlerinin yurutulmesi, SMS bildirim gonderimi',
    legalBasis: 'KVKK m.5/2-c, Acik riza',
    retentionPeriod: 'Uyelik suresi + 5 yil',
    recipients: 'SMS servis saglayicisi (sifreli)'
  },
  {
    category: 'Mesleki Bilgiler',
    dataTypes: 'Gorev, bolge, pozisyon',
    purpose: 'Teskilat yapisinin yonetilmesi',
    legalBasis: 'KVKK m.5/2-f (mesru menfaat)',
    retentionPeriod: 'Uyelik suresi + 5 yil',
    recipients: 'Parti teskilat birimleri'
  },
  {
    category: 'Ozel Nitelikli Veriler',
    dataTypes: 'Siyasi parti uyeligi',
    purpose: 'Parti teskilat faaliyetlerinin yurutulmesi',
    legalBasis: 'KVKK m.6/2 (Acik riza)',
    retentionPeriod: 'Uyelik suresi + 10 yil',
    recipients: 'Yetkili kamu kurumlari (yasal zorunluluk halinde)'
  },
  {
    category: 'Toplanti/Etkinlik Verileri',
    dataTypes: 'Katilim bilgileri, mazeret kayitlari',
    purpose: 'Toplanti ve etkinliklerin organizasyonu, performans degerlendirmesi',
    legalBasis: 'KVKK m.5/2-f (mesru menfaat)',
    retentionPeriod: 'Uyelik suresi + 3 yil',
    recipients: 'Parti teskilat birimleri'
  },
  {
    category: 'Fotograf',
    dataTypes: 'Profil fotografi',
    purpose: 'Uye tanimlamasi',
    legalBasis: 'Acik riza',
    retentionPeriod: 'Uyelik suresi',
    recipients: 'Yalnizca sistem ici kullanim'
  },
  {
    category: 'Secim Verileri',
    dataTypes: 'Sandik sonuclari, gozlemci atamalari',
    purpose: 'Secim hazirliklari ve sonuc takibi',
    legalBasis: 'KVKK m.5/2-c',
    retentionPeriod: 'Secim donemi + 10 yil',
    recipients: 'Yetkili secim kurullari'
  },
];

const DataProcessingInventory = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Veri Isleme Envanteri
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          KVKK Madde 16 uyarinca tutulan kisisel veri isleme envanteri. Bu tablo, hangi kisisel verilerin hangi amaclarla toplandigi, ne kadar saklandigi ve kimlerle paylasildigini gostermektedir.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Veri Kategorisi</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Veri Turleri</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Isleme Amaci</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hukuki Dayanak</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Saklama Suresi</th>
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
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.recipients}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Not:</strong> Bu envanter ornektir. Kurumunuzun gercek veri isleme faaliyetlerine gore guncellenmeli ve hukuk danismaniniz tarafindan onaylanmalidir. Envanter yillik olarak gozden gecirilmelidir.
        </p>
      </div>
    </div>
  );
};

export default DataProcessingInventory;
