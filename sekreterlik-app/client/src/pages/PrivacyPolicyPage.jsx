import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const defaultPrivacyText = `
<h2>1. Veri Sorumlusu</h2>
<p>Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla İl Sekreterliği tarafından işlenmektedir.</p>

<h2>2. İşlenen Kişisel Veriler</h2>
<p>Aşağıdaki kişisel verileriniz işlenmektedir:</p>
<ul>
  <li><strong>Kimlik Bilgileri:</strong> Ad, soyad, T.C. kimlik numarası</li>
  <li><strong>İletişim Bilgileri:</strong> Telefon numarası, adres</li>
  <li><strong>Mesleki Bilgiler:</strong> Görev, bölge, pozisyon</li>
</ul>

<h2>3. Özel Nitelikli Kişisel Veriler</h2>
<p>KVKK Madde 6 kapsamında, siyasi parti üyeliğinize ilişkin bilgiler <strong>özel nitelikli kişisel veri</strong> olarak değerlendirilmektedir. Bu veriler, açık rızanız doğrultusunda ve yalnızca parti teşkilat faaliyetlerinin yürütülmesi amacıyla işlenmektedir.</p>

<h2>4. Kişisel Verilerin İşlenme Amaçları</h2>
<p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
<ul>
  <li>Parti teşkilat yapısının yönetilmesi</li>
  <li>Üyelik kayıtlarının tutulması ve güncellenmesi</li>
  <li>Toplantı ve etkinliklerin organizasyonu</li>
  <li>İletişim faaliyetlerinin yürütülmesi</li>
  <li>Yasal yükümlülüklerin yerine getirilmesi</li>
  <li>Seçim hazırlık süreçlerinin yönetilmesi</li>
</ul>

<h2>5. Yasal Dayanak</h2>
<p>Kişisel verileriniz, KVKK'nın 5. ve 6. maddeleri kapsamında aşağıdaki hukuki sebeplere dayanılarak işlenmektedir:</p>
<ul>
  <li>Açık rızanız (KVKK m.5/1, m.6/2)</li>
  <li>Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (KVKK m.5/2-c)</li>
  <li>Veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi (KVKK m.5/2-ç)</li>
  <li>Veri sorumlusunun meşru menfaati (KVKK m.5/2-f)</li>
</ul>

<h2>6. Kişisel Verilerin Aktarılması</h2>
<p>Kişisel verileriniz, yasal zorunluluklar ve yukarıda belirtilen amaçlar doğrultusunda yetkili kamu kurum ve kuruluşlarına, parti genel merkezi ve ilgili teşkilat birimlerine aktarılabilecektir.</p>

<h2>7. Veri Saklama Süresi</h2>
<p>Kişisel verileriniz, işleme amacının gerektirdiği süre boyunca ve ilgili mevzuatta öngörülen zamanaşımı süreleri kadar saklanmaktadır. Saklama süresinin sona ermesi halinde verileriniz silinecek, yok edilecek veya anonim hale getirilecektir.</p>

<h2>8. Veri Sahibi Olarak Haklarınız</h2>
<p>KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
<ul>
  <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
  <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
  <li>Kişisel verilerinizin işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
  <li>Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme</li>
  <li>Kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde düzeltilmesini isteme</li>
  <li>KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme</li>
  <li>Düzeltme ve silme işlemlerinin kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
  <li>İşlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
  <li>Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme</li>
</ul>

<h2>9. Başvuru Yöntemi</h2>
<p>Yukarıda belirtilen haklarınızı kullanmak için İl Sekreterliği'ne yazılı olarak veya sistemdeki "Verilerimin Silinmesini Talep Et" butonu aracılığıyla başvurabilirsiniz.</p>

<h2>10. Değişiklikler</h2>
<p>İşbu aydınlatma metni, yasal düzenlemeler ve veri işleme faaliyetlerimizdeki değişiklikler doğrultusunda güncellenebilir. Güncel metin her zaman bu sayfada yayınlanacaktır.</p>
`;

const PrivacyPolicyPage = () => {
  const [privacyText, setPrivacyText] = useState(defaultPrivacyText);
  const [loading, setLoading] = useState(true);

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
        console.warn('KVKK metni Firestore\'dan yüklenemedi, varsayılan metin kullanılıyor:', error);
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
                  Kişisel Verilerin İşlenmesi Hakkında Aydınlatma Metni
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  6698 Sayılı KVKK Madde 10 Uyarınca
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
                prose-ul:list-disc prose-ul:ml-4"
              dangerouslySetInnerHTML={{ __html: privacyText }}
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
