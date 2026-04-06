import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const defaultPrivacyText = `
<h2>1. Veri Sorumlusu</h2>
<p>Kisisel verileriniz, 6698 sayili Kisisel Verilerin Korunmasi Kanunu ("KVKK") kapsaminda veri sorumlusu sifatiyla <strong>YRP Elazig Il Baskanligi</strong> tarafindan islenmektedir.</p>
<p><strong>Adres:</strong> Elazig Il Baskanligi<br/>
<strong>Telefon:</strong> Il baskanliginiz ile iletisime geciniz<br/>
<strong>E-posta:</strong> Il baskanliginiz ile iletisime geciniz</p>

<h2>2. Islenen Kisisel Veriler</h2>
<p>Asagidaki kisisel verileriniz islenmektedir:</p>
<ul>
  <li><strong>Kimlik Bilgileri:</strong> Ad, soyad, T.C. kimlik numarasi</li>
  <li><strong>Iletisim Bilgileri:</strong> Telefon numarasi, adres</li>
  <li><strong>Mesleki Bilgiler:</strong> Gorev, bolge, pozisyon</li>
  <li><strong>Ozel Nitelikli Kisisel Veriler:</strong> Siyasi parti uyeligi (KVKK Madde 6 kapsaminda ozel nitelikli kisisel veri)</li>
  <li><strong>Gorsel Veriler:</strong> Profil fotografi (istege bagli)</li>
  <li><strong>Toplanti/Etkinlik Verileri:</strong> Katilim bilgileri, mazeret kayitlari</li>
  <li><strong>Secim Verileri:</strong> Sandik sonuclari, gozlemci atamalari</li>
</ul>

<h2>3. Ozel Nitelikli Kisisel Veriler</h2>
<p>KVKK Madde 6 kapsaminda, siyasi parti uyeliginize iliskin bilgiler <strong>ozel nitelikli kisisel veri</strong> olarak degerlendirilmektedir. Bu veriler, <strong>acik rizaniz</strong> dogrultusunda ve yalnizca parti teskilat faaliyetlerinin yurutulmesi amaciyla islenmektedir. Acik rizanizi herhangi bir zamanda geri cekebilirsiniz; ancak bu durumda uyelik islemleriniz surdurulemeyebilir.</p>

<h2>4. Kisisel Verilerin Islenme Amaclari</h2>
<p>Kisisel verileriniz asagidaki amaclarla islenmektedir:</p>
<ul>
  <li>Parti teskilat yapisinin yonetilmesi</li>
  <li>Uyelik kayitlarinin tutulmasi ve guncellenmesi</li>
  <li>Toplanti ve etkinliklerin organizasyonu ve katilim takibi</li>
  <li>SMS ve bildirim yoluyla iletisim faaliyetlerinin yurutulmesi</li>
  <li>Yasal yukumluluklerin yerine getirilmesi</li>
  <li>Secim hazirliklari ve sonuc takip sureclerinin yonetilmesi</li>
  <li>Performans degerlendirme ve raporlama faaliyetleri</li>
  <li>Ilgili kamu kurum ve kuruluslarina yasal bildirim yukumlulukleri</li>
</ul>

<h2>5. Yasal Dayanak</h2>
<p>Kisisel verileriniz, KVKK'nin 5. ve 6. maddeleri kapsaminda asagidaki hukuki sebeplere dayanilarak islenmektedir:</p>
<ul>
  <li><strong>Acik rizaniz</strong> (KVKK m.5/1, m.6/2) - Ozellikle ozel nitelikli kisisel verilerin islenmesi icin</li>
  <li><strong>Bir sozlesmenin kurulmasi veya ifasiyla dogrudan ilgili olmasi</strong> (KVKK m.5/2-c) - Uyelik sozlesmesinin yerine getirilmesi</li>
  <li><strong>Veri sorumlusunun hukuki yukumlulugunu yerine getirmesi</strong> (KVKK m.5/2-c) - 2820 sayili Siyasi Partiler Kanunu ve diger mevzuat gereklilikleri</li>
  <li><strong>Veri sorumlusunun mesru menfaati</strong> (KVKK m.5/2-f) - Teskilat yonetimi ve raporlama</li>
</ul>

<h2>6. Kisisel Verilerin Aktarilmasi</h2>
<p>Kisisel verileriniz asagidaki alicilara aktarilabilecektir:</p>
<ul>
  <li><strong>Parti Genel Merkezi:</strong> Teskilat yonetimi ve yasal bildirim yukumlulukleri kapsaminda</li>
  <li><strong>Yetkili Kamu Kurum ve Kuruluslari:</strong> Yasal zorunluluklar geregi (YSK, Iceisleri Bakanligi vb.)</li>
  <li><strong>Firebase (Google LLC, ABD):</strong> Bulut altyapisi hizmeti saglayicisi olarak, AB Standart Sozlesme Maddeleri (SCCs) cercevesinde yurt disina aktarim yapilmaktadir</li>
  <li><strong>NetGSM (Turkiye):</strong> SMS bildirim hizmeti saglayicisi olarak yurt ici aktarim yapilmaktadir</li>
</ul>
<p><strong>Yurt Disina Aktarim:</strong> Firebase (Google LLC) kullanimi nedeniyle verileriniz ABD'deki sunucularda islenebilmektedir. Bu aktarim, KVKK'nin 9. maddesi kapsaminda yeterli koruma saglanmasi kosuluna (Standart Sozlesme Maddeleri - SCCs) dayanilarak gerceklestirilmektedir.</p>

<h2>7. Veri Saklama Suresi</h2>
<p>Kisisel verileriniz, isleme amacinin gerektirdigi sure boyunca ve ilgili mevzuatta ongorulen zamanasimi sureleri kadar saklanmaktadir:</p>
<ul>
  <li><strong>Kimlik Bilgileri:</strong> Uyelik suresi + 10 yil (yasal saklama yukumlulugu)</li>
  <li><strong>Iletisim Bilgileri:</strong> Uyelik suresi + 5 yil</li>
  <li><strong>Toplanti/Etkinlik Verileri:</strong> Uyelik suresi + 3 yil</li>
  <li><strong>Secim Verileri:</strong> Secim donemi + 10 yil</li>
  <li><strong>Profil Fotografi:</strong> Uyelik suresi boyunca</li>
</ul>
<p>Saklama suresinin sona ermesi halinde verileriniz silinecek, yok edilecek veya anonim hale getirilecektir.</p>

<h2>8. Veri Sahibi Olarak Haklariniz</h2>
<p>KVKK'nin 11. maddesi uyarinca asagidaki haklara sahipsiniz:</p>
<ul>
  <li>Kisisel verilerinizin islenip islenmedigini ogrenme</li>
  <li>Kisisel verileriniz islenmisse buna iliskin bilgi talep etme</li>
  <li>Kisisel verilerinizin islenme amacini ve amacina uygun kullanilip kullanilmadigini ogrenme</li>
  <li>Yurt icinde veya yurt disinda kisisel verilerinizin aktarildigi ucuncu kisileri bilme</li>
  <li>Kisisel verilerinizin eksik veya yanlis islenmis olmasi halinde duzeltilmesini isteme</li>
  <li>KVKK'nin 7. maddesinde ongorulen sartlar cercevesinde kisisel verilerinizin silinmesini veya yok edilmesini isteme</li>
  <li>Duzeltme ve silme islemlerinin kisisel verilerinizin aktarildigi ucuncu kisilere bildirilmesini isteme</li>
  <li>Islenen verilerinizin munhasiran otomatik sistemler vasitasiyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya cikmasina itiraz etme</li>
  <li>Kisisel verilerinizin kanuna aykiri olarak islenmesi sebebiyle zarara ugramaniz halinde zararin giderilmesini talep etme</li>
</ul>

<h2>9. Basvuru Yontemi</h2>
<p>Yukarida belirtilen haklarinizi kullanmak icin asagidaki yontemlerle basvurabilirsiniz:</p>
<ul>
  <li><strong>Yazili Basvuru:</strong> Il Baskanligi adresine kimlik teyidi yapilarak elden veya noter araciligiyla</li>
  <li><strong>Elektronik Basvuru:</strong> Sistemdeki "Verilerimin Silinmesini Talep Et" butonu araciligiyla</li>
  <li><strong>E-posta:</strong> Il baskanliginizin resmi e-posta adresine guvenli elektronik imza ile</li>
</ul>
<p>Basvurulariniz en gec 30 (otuz) gun icinde ucretsiz olarak sonuclandirilacaktir. Islemin ayrica bir maliyet gerektirmesi halinde KVKK Kurulu tarafindan belirlenen tarife uzerinden ucret alinabilir.</p>

<h2>10. Sikayet Hakki</h2>
<p>Basvurunuzun reddedilmesi, verilen cevabinizi yetersiz bulmaniz veya 30 gun icinde cevap alinamamasi halinde, cevabinizi ogrendiginiz tarihten itibaren 30 gun ve her halde basvuru tarihinden itibaren 60 gun icinde <strong>Kisisel Verileri Koruma Kurulu</strong>'na sikayet basvurusunda bulunabilirsiniz.</p>
<p><strong>KVKK Kurulu:</strong> <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener noreferrer">www.kvkk.gov.tr</a></p>

<h2>11. Degisiklikler</h2>
<p>Isbu aydinlatma metni, yasal duzenlemeler ve veri isleme faaliyetlerimizdeki degisiklikler dogrultusunda guncellenebilir. Guncel metin her zaman bu sayfada yayinlanacaktir.</p>
`;

const defaultCookiePolicyText = `
<h2>Cerez ve Yerel Depolama Politikasi</h2>

<h3>1. Cerez ve Yerel Depolama Nedir?</h3>
<p>Cerezler (cookies), web siteleri tarafindan tarayicinizda saklanan kucuk metin dosyalaridir. Yerel depolama (localStorage), tarayicinizda daha buyuk miktarda veri saklamaniza olanak taniyan bir web depolama teknolojisidir.</p>

<h3>2. Kullanilan Cerez ve Depolama Turleri</h3>
<table>
  <thead>
    <tr>
      <th>Tur</th>
      <th>Amac</th>
      <th>Saklama Suresi</th>
      <th>Zorunlu mu?</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Oturum Cerezleri</strong></td>
      <td>Kullanici kimlik dogrulamasi ve oturum yonetimi (JWT token)</td>
      <td>Oturum suresi (24 saat)</td>
      <td>Evet</td>
    </tr>
    <tr>
      <td><strong>Tercih Cerezleri</strong></td>
      <td>Karanlik/aydinlik tema tercihi, dil secimi</td>
      <td>1 yil</td>
      <td>Hayir</td>
    </tr>
    <tr>
      <td><strong>Yerel Depolama</strong></td>
      <td>Kullanici tercihleri, cerez onayi durumu, uygulama ayarlari</td>
      <td>Temizlenene kadar</td>
      <td>Evet (islevsel)</td>
    </tr>
    <tr>
      <td><strong>Service Worker</strong></td>
      <td>PWA islevselligi, cevrimdisi destek, push bildirimler</td>
      <td>Kayit kaldirilana kadar</td>
      <td>Hayir</td>
    </tr>
  </tbody>
</table>

<h3>3. Ucuncu Taraf Cerezleri</h3>
<p>Bu uygulama asagidaki ucuncu taraf servislerini kullanmaktadir:</p>
<ul>
  <li><strong>Firebase Authentication:</strong> Kimlik dogrulama icin oturum cerezleri</li>
  <li><strong>Firebase Cloud Messaging:</strong> Push bildirim aboneligi icin</li>
</ul>
<p>Bu servisler Google LLC tarafindan saglanmakta olup, kendi gizlilik politikalarina tabidir.</p>

<h3>4. Cerezleri Yonetme</h3>
<p>Tarayici ayarlariniz uzerinden cerezleri silebilir veya engelleyebilirsiniz. Ancak zorunlu cerezlerin engellenmesi durumunda uygulamanin bazi ozellikleri duzgun calismayabilir.</p>
<ul>
  <li><strong>Chrome:</strong> Ayarlar > Gizlilik ve Guvenlik > Cerezler</li>
  <li><strong>Firefox:</strong> Secenekler > Gizlilik ve Guvenlik</li>
  <li><strong>Safari:</strong> Tercihler > Gizlilik</li>
  <li><strong>Edge:</strong> Ayarlar > Cerezler ve site izinleri</li>
</ul>

<h3>5. Yerel Depolamayi Temizleme</h3>
<p>Tarayicinizin gelistirici araclari uzerinden (F12 > Application > Local Storage) yerel depolama verilerini goruntuleyebilir ve silebilirsiniz.</p>
`;

const PrivacyPolicyPage = () => {
  const [privacyText, setPrivacyText] = useState(defaultPrivacyText);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('privacy'); // 'privacy' | 'cookies'

  useEffect(() => {
    const fetchPrivacyPolicy = async () => {
      try {
        if (db) {
          const docRef = doc(db, 'settings', 'privacy_policy');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().content) {
            setPrivacyText(docSnap.data().content);
          }
        }
      } catch (error) {
        console.warn('KVKK metni Firestore\'dan yuklenemedi, varsayilan metin kullaniliyor:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrivacyPolicy();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Gizlilik ve KVKK
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  6698 Sayili KVKK Madde 10 Uyarinca
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Geri
            </Link>
          </div>

          {/* Section Tabs */}
          <div className="flex space-x-4 mt-4">
            <button
              onClick={() => setActiveSection('privacy')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeSection === 'privacy'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Aydinlatma Metni
            </button>
            <button
              onClick={() => setActiveSection('cookies')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeSection === 'cookies'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Cerez Politikasi
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div
              className="prose prose-sm sm:prose dark:prose-invert max-w-none
                prose-headings:text-gray-900 dark:prose-headings:text-gray-100
                prose-p:text-gray-700 dark:prose-p:text-gray-300
                prose-li:text-gray-700 dark:prose-li:text-gray-300
                prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3
                prose-h2:border-b prose-h2:border-gray-200 dark:prose-h2:border-gray-700 prose-h2:pb-2
                prose-h3:text-base prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
                prose-ul:list-disc prose-ul:ml-4
                prose-table:border-collapse prose-table:w-full
                prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-3 prose-th:py-2 prose-th:bg-gray-50 dark:prose-th:bg-gray-700 prose-th:text-left prose-th:text-sm prose-th:font-semibold
                prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-3 prose-td:py-2 prose-td:text-sm"
              dangerouslySetInnerHTML={{ __html: (activeSection === 'privacy' ? privacyText : defaultCookiePolicyText).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/on\w+\s*=/gi, 'data-blocked=') }}
            />
          </div>
          {/* Avukat notu */}
          <div className="mx-6 sm:mx-8 mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.732 17c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Onemli Not:</strong> Bu metin ornek olarak hazirlanmistir ve genel bilgilendirme amaci tasimaktadir. Kurumunuza ozgu hukuki sureclerin eksiksiz yansitilmasi icin bu metnin bir hukuk danismaniniz tarafindan gozden gecirilmesi ve onaylanmasi onerilir.
              </p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 px-6 sm:px-8 py-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Son guncelleme: {new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
