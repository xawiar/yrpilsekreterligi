# YRP İl Sekreterliği Seçim Sandık Sistemi — Video Anlatım Metni

> Bu metin, ekran kayıtlarınızla senkronize voiceover (seslendirme) için hazırlanmıştır.
> Her sahne `[ekran: ...]` notuyla başlar; doğrudan o ekranı gösterirken anlatıcı satırını okuyacaksınız.
> Tahmini süre yan parantezde verilmiştir.

---

## AÇILIŞ — Sistem Tanıtımı (~30 sn)

[ekran: ana giriş — login sayfası]

> Yeniden Refah Partisi İl Sekreterliği Seçim Sandık Takip Sistemine hoş geldiniz.
> Bu sistem, seçim öncesi hazırlık aşamasından sandık sonuçlarının resmi takibine kadar tüm süreci tek bir dijital platformda yönetmenizi sağlar.
> İl, ilçe, bölge ve kurum sorumluları ile sahadaki başmüşahitler arasında, hiyerarşik bir görev paylaşımı kurulur. Her kullanıcı yalnızca kendi sorumluluk alanındaki sandıkları görür ve gerekli işlemleri yapar.
> Şimdi sistemi adım adım inceleyelim.

---

## BÖLÜM 1 — COĞRAFİ YAPILANDIRMA (~60 sn)

[ekran: Ayarlar → Coğrafi sekmesi]

> Sistemin omurgası coğrafi hiyerarşidir. Her sandık sırasıyla bir İl, İlçe, Belde, Mahalle veya Köy ve Kuruma bağlanır.
> İlk adım coğrafi tanımlamayı yapmaktır.

**1.1. İl Ekleme**
[ekran: İl Ekle butonu → form açılır]

> Önce ilinizi sisteme tanımlıyorsunuz. İl adı ve plaka kodunu girip kaydediyorsunuz. Birden fazla il yönetilecekse hepsini buraya ekleyebilirsiniz.

**1.2. İlçe Ekleme**
[ekran: İlçe Ekle sekmesi]

> İlçe eklerken hangi ile bağlı olduğunu seçmeniz gerekir. Bu zincir olmadan altındaki mahalle, köy ve sandıklar yetim kalır.
> İlçe adını yazın, ilini seçin, kaydedin.

**1.3. Belde, Mahalle ve Köy Eklemeleri**
[ekran: Belde / Mahalle / Köy sekmeleri]

> Aynı mantıkla, beldeleri ilçeye, mahalleleri ilçe ve beldeye, köyleri yine ilçeye bağlayarak ekliyorsunuz.
> Mahalle ve köyler için ayrıca bir grup numarası verebilirsiniz. Bu numara ileride bölge sorumlularına dağıtım yaparken işinize yarayacak.

---

## BÖLÜM 2 — SANDIK EKLEME (~75 sn)

[ekran: Sandıklar sayfası — "Sandık Ekle" butonu]

> Coğrafi yapı hazır olunca artık sandık eklemeye geçebilirsiniz.

**2.1. Tek Sandık Ekleme**
[ekran: sandık ekleme formu]

> "Yeni Sandık Ekle" butonuna tıkladığınızda form açılır. Sandık numarasını ve sandığın bulunduğu kurum adını yazın — örneğin "Çaydaçıra İlkokulu".
> Konum bilgilerini sırayla seçin: önce **İl**, sonra **İlçe**. Dikkat: ilçe açılır listesi sadece seçtiğiniz ile bağlı ilçeleri gösterir. Eğer il seçmemişseniz ilçe pasif kalır.
> Ardından gerekirse Belde, sonra Mahalle veya Köy seçin.
> Son olarak hangi seçim için olduğunu seçer ve kaydedersiniz.

**2.2. Toplu Sandık Yükleme — Excel**
[ekran: Excel yükle butonu, şablon indirme]

> Tek tek girmek yerine Excel ile toplu yükleme yapabilirsiniz. "Şablon İndir" butonu hazır bir tablo verir.
> Şablonda her satır bir sandıktır: numara, kurum adı, ilçe, mahalle/köy bilgileri.
> Doldurup yükledikten sonra sistem hepsini tek seferde tanımlar.

**2.3. Sandık Kart Görünümü**
[ekran: sandık listesi kartları]

> Eklediğiniz sandıklar kart şeklinde listelenir. Her kartın sağ üstünde **dört noktalı durum göstergesi** vardır:
> Birinci nokta ilçe atanmış mı, ikinci nokta mahalle veya köy atanmış mı, üçüncü nokta başmüşahit atanmış mı, dördüncü nokta sandık başında müşahit var mı.
> Yeşil noktalar tamam, kırmızı noktalar eksik anlamına gelir. Bir bakışta tüm sandıkların hazırlık durumunu görürsünüz.
> Detay, Düzenle ve Sil butonları her kartın altındadır.

---

## BÖLÜM 3 — BAŞMÜŞAHİT EKLEME (~60 sn)

[ekran: Müşahitler sayfası]

> Sandık başına atanacak sorumlu kişiye **başmüşahit** diyoruz. Sandığın gözü ve kulağıdır; resmi tutanak fotoğrafını yükleyen ve sayım sonucunu sisteme giren kişidir.

**3.1. Başmüşahit Ekleme Formu**
[ekran: Başmüşahit Ekle butonu → form]

> "Müşahit Ekle" butonuna tıklayın. Açılan formda **"Başmüşahit"** kutucuğunu işaretleyin.
> TC kimlik numarası, ad-soyad, telefon, ve hangi sandığa atayacağınızı seçin.
> Kaydet'e bastığınızda sistem otomatik olarak başmüşahit için bir kullanıcı hesabı oluşturur.
> Kullanıcı adı sandık numarasıdır, şifresi başlangıçta TC kimlik numarasıdır.

**3.2. Toplu Başmüşahit Yüklemesi**
[ekran: Excel toplu yükleme]

> Yine Excel şablonuyla yüzlerce başmüşahiti tek seferde yükleyebilirsiniz. Şablonda her satır bir kişi: TC, ad-soyad, telefon, sandık numarası.

**3.3. Başmüşahit Listesi**
[ekran: kart grid görünümü]

> Eklediğiniz başmüşahitler kart şeklinde listelenir. Her kartta TC numarası maskeli, ad-soyad, telefon, atanan sandık numarası ve konum bilgisi vardır.
> Düzenle butonuyla kişiyi başka bir sandığa kaydırabilir, Sil butonuyla kaldırabilirsiniz.

---

## BÖLÜM 4 — BÖLGE OLUŞTURMA (Mahalle/Köy Gruplama) (~60 sn)

[ekran: Bölgeler sayfası]

> Şimdi mahalleleri ve köyleri **bölgelere** ayırıyoruz. Bir bölge, birkaç mahalle ve köyün birleştiği coğrafi gruptur. Her bölgenin başında bir Bölge Sorumlusu olur.

**4.1. Yeni Bölge Oluşturma**
[ekran: "Bölge Ekle" formu]

> "Yeni Bölge" butonuna tıklayın. Bölgeye anlamlı bir isim verin — örneğin "Karakoçan Merkez Doğu" veya "Kovancılar Köyleri 1. Grup".
> Listeden bu bölgeye dahil edeceğiniz mahalleleri ve köyleri seçin. Birden fazla seçim yapabilirsiniz.
> Daha sonra bu bölgeye atayacağınız Bölge Sorumlusunu seçin. Henüz sorumlu eklemediyseniz bu kısmı boş bırakıp ileride atayabilirsiniz.

**4.2. Bölgenin Sandık Sayısı**
[ekran: bölge kartı]

> Bölgeyi kaydettikten sonra sistem otomatik olarak o bölgedeki mahallelerde ve köylerde kaç sandık olduğunu hesaplar ve gösterir.
> Bu sayı, Bölge Sorumlusunun sorumluluk alanındaki toplam sandık sayısıdır.

---

## BÖLÜM 5 — SORUMLU ATAMALARI VE HİYERARŞİ (~120 sn)

[ekran: Sorumlular sayfası]

> Sistemde 4 farklı sorumlu rolü vardır. Hiyerarşi şu şekilde işler:
> En üstte **İl Genel Sorumlusu** — tüm ili yönetir.
> Onun altında **İlçe Sorumluları** — her ilçeye bir kişi.
> İlçe sorumlusunun altında **Bölge Sorumluları** — bir ilçe içinde birden fazla bölge olabilir.
> Bölgenin altında **Kurum Sorumluları** — okul, cami, lise gibi her kurum için bir kişi.
> En altta sahada **Başmüşahitler** — her sandık başında bir kişi.

**5.1. İl Genel Sorumlusu Ekleme**
[ekran: Sorumlu Ekle formu — rol "İl Genel Sorumlusu"]

> "Sorumlu Ekle" butonuna tıklayın. Rol olarak "İl Genel Sorumlusu" seçin. TC, ad-soyad, telefon bilgilerini girin.
> İl genel sorumlusunun üst bağlantısı yoktur, çünkü piramidin tepesindedir.

**5.2. İlçe Sorumlusu Ekleme**
[ekran: rol "İlçe Sorumlusu"]

> Rol olarak "İlçe Sorumlusu" seçtiğinizde formda yeni bir alan görünür: **bağlı olduğu il genel sorumlusu**.
> Yani her ilçe sorumlusu mutlaka bir il genel sorumlusuna bağlanır. Bu seçim zorunludur.

**5.3. Bölge Sorumlusu Ekleme**
[ekran: rol "Bölge Sorumlusu"]

> Bölge Sorumlusu eklerken bağlı olduğu **ilçe sorumlusunu** seçersiniz.
> Sonra Bölgeler sayfasına dönüp ilgili bölgenin Sorumlu alanına bu kişiyi atarsınız. Böylece bölge ile sorumlu eşleşir.

**5.4. Kurum Sorumlusu Ekleme**
[ekran: rol "Kurum Sorumlusu"]

> Kurum sorumlusu, belirli bir kurumun — örneğin bir okulun — tüm sandıklarından sorumludur.
> Form'da kurum adını girin. Bu kurumun mahallesi hangi bölgedeyse, sistem otomatik olarak o bölgenin sorumlusunu **kurum sorumlusunun üst sorumlusu** olarak belirler.
> Yani kurum sorumlusu için manuel parent atamasına gerek yoktur — coğrafi zincir kendiliğinden çalışır.

**5.5. Sorumlu Listesi ve Üst Sorumlu Görünümü**
[ekran: sorumlular kart listesi]

> Eklediğiniz sorumlular kart şeklinde listelenir. Her kartta:
> Rolü (İl/İlçe/Bölge/Kurum), ad-soyadı, üst sorumlusu, ve kaç sandığa erişiminin olduğu yazar.
> Üst sorumlu bilgisi sayesinde piramidi tek bakışta görürsünüz.

---

## BÖLÜM 6 — SORUMLULARIN YETKİ VE GÖRÜNÜM ALANLARI (~75 sn)

[ekran: dev panel — rol değiştirme]

> Her sorumlunun gördüğü ekran, rolüne göre filtrelenir. Hiyerarşinin temel ilkesi şudur: bir sorumlu, kendi altındaki TÜM sandıkları görebilir.

**6.1. İl Genel Sorumlusu Dashboard**
[ekran: provincial coordinator dashboard]

> İl Genel Sorumlusu giriş yaptığında ilin tüm ilçelerindeki tüm sandıkları görür. Toplam sandık sayısı, sorumlu olduğu bölgeler ve girilen sonuç sayısı üst başlıkta listelenir.

**6.2. İlçe Sorumlusu Dashboard**
[ekran: district supervisor dashboard]

> İlçe Sorumlusu sadece kendi ilçesindeki sandıkları görür. Bağlı olduğu il sorumlusu üst kısımda görünür. Karşı ilçedeki sandıklar erişimine kapalıdır.

**6.3. Bölge Sorumlusu Dashboard**
[ekran: region supervisor dashboard]

> Bölge Sorumlusu yalnızca kendi bölgesindeki — yani atadığı mahalle ve köylerdeki — sandıkları görür. Ekranda bölgesinin adı, kapsadığı mahalle ve köy listesi, ve toplam sandık sayısı yer alır.

**6.4. Kurum Sorumlusu Dashboard**
[ekran: institution supervisor dashboard]

> Kurum Sorumlusu sadece kendi kurumundaki — örneğin Çaydaçıra İlkokulu'ndaki — sandıkları görür. Bir kurumda 4 farklı salonda 4 sandık varsa, dördü de tek bir kurum sorumlusunun ekranında listelenir.

**6.5. Yetki Matrisi**
[ekran: Ayarlar → Yetkilendirme]

> Her rolün hangi işleri yapabileceği yetki matrisinden ayarlanır. Tutanak yükleme, sonuç onaylama, başmüşahit ekleme, toplu SMS gibi her yetki için checkbox vardır.
> Admin tüm yetkilere doğal olarak sahiptir; diğer rollerin yetkileri buradan kişiselleştirilir.

---

## BÖLÜM 7 — BAŞMÜŞAHİT SEÇİM SONUCU GİRİŞİ (~120 sn)

[ekran: başmüşahit girişi — login ekranı]

> Seçim günü sandık başında olan başmüşahit, kendi telefonundan veya tabletten sisteme giriş yapar.
> Kullanıcı adı **sandık numarasıdır**, ilk şifre **kendi TC numarasıdır**. Şifresini ilk girişte değiştirebilir.

**7.1. Başmüşahit Dashboard'u**
[ekran: chief observer dashboard]

> Giriş yaptığında ekranda sadece kendi sandığı görünür. Diğer sandıklara erişimi yoktur.
> "Seçim Sonucu Gir" butonuna tıkladığında ilgili formu açar.

**7.2. Tutanak Fotoğrafı Yükleme — Otomatik OCR**
[ekran: fotoğraf yükle butonu]

> Önce **imzalı tutanak fotoğrafını** yükler. Telefonun kamerasıyla doğrudan çekebilir veya galeriden seçebilir.
> Sistem fotoğrafı **yapay zeka ile** otomatik analiz eder. Tutanaktaki sayıları okur ve form alanlarını **otomatik doldurur**.
> Başmüşahitin elle yapması gereken iş çok azdır.

**7.3. Form Alanları — Seçim Tipine Göre Değişir**
[ekran: form alanları]

> Sistem o seçimde hangi seçimlerin yapıldığını bilir. Örneğin genel seçimde:
> Cumhurbaşkanı adayları için ayrı oy sayısı,
> Milletvekili için her partinin aldığı oy ve aday tercih dağılımı,
> Geçerli oy, geçersiz oy, kullanılan oy, kayıtlı seçmen sayısı,
> Bütün rakamlar gösterilir. Başmüşahit OCR'ın doldurduğu rakamları kontrol eder, gerekirse düzeltir.

**7.4. İtiraz Tutanağı (Varsa)**
[ekran: itiraz tutanağı yükleme alanı]

> Sandık başında itiraz olduysa **itiraz tutanağı fotoğrafını** ayrıca yükleyebilir. Bu opsiyoneldir, ama varsa eklenmesi gerekir.

**7.5. Kontrol Toplamları**
[ekran: form altında doğrulama bilgisi]

> Form sonunda sistem otomatik kontrol yapar:
> Partilere atılan oy + bağımsız oylar = geçerli oy mu?
> Geçerli + geçersiz = kullanılan oy mu?
> Kullanılan oy ≤ kayıtlı seçmen mi?
> Tutmayan toplamlar varsa kırmızı ile işaretler, başmüşahit düzeltmeden gönderemez.

**7.6. Gönderim**
[ekran: "Onaya Gönder" butonu]

> Her şey doğruysa "Onaya Gönder" butonuna basar. Sonuç sisteme **bekleyen onay** durumunda kaydedilir.
> Başmüşahitin işi burada biter. Üst sorumlu onayını bekler.

---

## BÖLÜM 8 — ONAY SÜRECİ (~75 sn)

> Başmüşahit sonucu girdikten sonra üç onay durumu vardır: **Beklemede** (yeni gelen), **Onaylı** (kabul edildi), **Reddedildi** (yeniden girilmesi istendi).

**8.1. Üst Sorumlu Bildirimi**
[ekran: bildirim ikonu]

> Yeni bir sonuç geldiğinde, ilgili Kurum Sorumlusu, Bölge Sorumlusu ve İlçe Sorumlusu bildirim alır.
> Hiyerarşideki herkes görebilir, ama onayı genelde en yakın üst yapar — Kurum Sorumlusu.

**8.2. Onay Ekranı**
[ekran: bekleyen sonuçlar listesi]

> Sorumlu Dashboard'unda "Bekleyen Sonuçlar" bölümüne tıklar. Her satırda: sandık no, sonuç giriş zamanı, kim girdi, parti dağılımı özetinin küçük tablosu.
> Tutanak fotoğrafına tıklayıp büyük açabilir, gerçek sayıları kontrol edebilir.

**8.3. Onayla**
[ekran: onayla butonu]

> Eğer sayılar tutanakla uyumluysa "Onayla" butonuna basar. Sonuç **kesinleşir**, üst raporlara dahil olur.

**8.4. Reddet**
[ekran: reddet + sebep yazma]

> Bir hata varsa "Reddet" butonuna basar. Açılan kutuya kısa bir not yazar — örneğin "AKP oyu tutanaktan farklı, lütfen tekrar girin".
> Bu mesaj başmüşahitin telefonuna bildirim olarak düşer. Başmüşahit aynı sandık için yeniden giriş yapabilir.

---

## BÖLÜM 9 — ÜST SORUMLUNUN SONUÇ DÜZENLEME YETKİSİ (~60 sn)

[ekran: sorumlu dashboard'da kendi sandıkları]

> Bazen başmüşahit ulaşılamaz olabilir, telefonu çalışmayabilir, ya da sayıları kabaca yanlış girebilir.
> Bu durumda **üst sorumlu** kendi alanındaki herhangi bir sandığın sonucunu **kendisi düzenleyebilir**.

**9.1. Sandık Detayına Girme**
[ekran: sandık kartı → Detay]

> Sorumlu, dashboard'daki sandık kartında "Detay" butonuna tıklar. Sandığın tüm bilgileri açılır.

**9.2. Sonuç Düzenleme**
[ekran: "Sonucu Düzenle" butonu]

> "Sonucu Düzenle" butonuyla aynı formu açar — sayıları manuel olarak değiştirebilir. Tutanak fotoğrafını da değiştirebilir.
> Yetki matrisinde "Tutanak Onaylama" yetkisi olan her rol bunu yapabilir.

**9.3. Değişiklik Kaydı**
[ekran: değişiklik geçmişi]

> Sistem her değişikliği tarih ve kullanıcı bilgisiyle kaydeder. "Bu sandığın sonucunu Bölge Sorumlusu Hüseyin Bey saat 21:42'de düzenledi" şeklinde iz bırakır.
> Bu sayede şeffaflık ve denetlenebilirlik sağlanır.

---

## BÖLÜM 10 — ADMİN SEÇİM SONUÇLARI VE CANLI TAKİP (~90 sn)

[ekran: Admin → Seçim Sonuçları]

> Admin paneli, seçim gecesi tüm verilerin kuş bakışı görüldüğü yerdir.

**10.1. Seçim Listesi**
[ekran: seçimler listesi]

> Admin önce hangi seçimi izlemek istediğini seçer — örneğin "31 Mart 2024 Yerel Seçimi". Aktif seçim varsa sistem otomatik onu açar.

**10.2. Canlı İlerleme Çubuğu**
[ekran: progress bar]

> Üstte büyük bir ilerleme çubuğu vardır:
> "Toplam 800 sandığın 612'sinden sonuç geldi. %76,5 tamamlandı."
> Bu çubuk her yeni sonuçta otomatik güncellenir, sayfayı yenilemenize gerek yoktur.

**10.3. İlçe Bazında Dağılım**
[ekran: ilçe tablosu]

> Aşağıda her ilçenin tek tek tablosu vardır:
> Karakoçan: 245 sandığın 198'i geldi.
> Maden: 87 sandığın 81'i geldi.
> Hangi ilçenin geri kaldığını anında görürsünüz.

**10.4. Parti / Aday Toplam Tablosu**
[ekran: oy sıralaması tablosu]

> Sağ tarafta partiler ve adaylar büyükten küçüğe sıralanır. Her partinin:
> Aldığı toplam oy, oy yüzdesi, ne kadar değişti son 1 saatte — hepsi anlık görünür.

**10.5. Harita Görünümü (varsa)**
[ekran: il haritası]

> Mahalle ve köy bazında renk kodlu harita: hangi bölge hangi partiye gitti.

**10.6. Sandık Detayına İniş**
[ekran: bir sandığa tıklama]

> Herhangi bir sandığa tıkladığınızda o sandığın detayını — tutanak fotoğrafı dahil — açabilirsiniz. Tüm sayıları orijinal kaynağıyla doğrulayabilirsiniz.

---

## BÖLÜM 11 — D'HONDT, İTTİFAK, CB VE MV HESAPLAMA (~150 sn)

> Sistemin en güçlü kısımlarından biri **otomatik koltuk hesaplamasıdır**. Türkiye'deki seçim mevzuatı karmaşıktır; sistem hepsini sizin için hesaplar.

**11.1. Cumhurbaşkanlığı Hesabı**
[ekran: CB sonuç ekranı]

> Cumhurbaşkanlığında sistem her adayın aldığı toplam oyu il genelinde toplar. %50+1 alan aday varsa tek turda kazanır. Aksi halde sistem otomatik olarak ilk iki adayı belirler ve "İkinci Tur" seçimi oluşturmak için size buton gösterir.

**11.2. Milletvekili Hesabı — D'Hondt**
[ekran: MV koltuk dağılımı]

> Milletvekili dağılımı **D'Hondt yöntemiyle** hesaplanır.
> İlin toplam milletvekili sayısı seçim oluştururken belirtilir — örneğin Elazığ için 5.
> Sistem her partinin aldığı toplam oyu 1, 2, 3, 4, 5 ile böler. En yüksek 5 bölüm 5 koltuğu kazanır.
> Önce **%7 baraj kontrolü** yapılır. Barajı geçemeyen partiler dağılıma alınmaz.

**11.3. İttifak Sistemi**
[ekran: ittifak yapılandırma]

> Türkiye'de partiler ittifak kurabilir. Seçim oluştururken hangi partilerin hangi ittifakta olduğunu girersiniz.
> İttifak içindeki partilerin oyu **önce ittifak olarak toplanır**, baraj kontrolü ittifak üzerinden yapılır.
> İttifak barajı geçtiyse, içindeki **her parti** ayrı ayrı D'Hondt hesabına dahil olur — partilerin kendi ittifak içi oranı ile.
> Sistem bu karmaşık matematiği otomatik yapar.

**11.4. Bağımsız Aday**
[ekran: bağımsız MV alanı]

> Bağımsız milletvekili adayı varsa, partilerden bağımsız değerlendirilir. Sadece o ilin "seçim sayısını" — yani toplam oy ÷ koltuk sayısı — geçerse koltuk alır.

**11.5. Belediye Başkanı**
[ekran: yerel seçim sonucu]

> Belediye başkanlığında **çoğunluk sistemi** uygulanır. En çok oyu alan aday/parti kazanır, basit ve nettir.

**11.6. İl Genel Meclisi ve Belediye Meclisi**
[ekran: meclis koltuk dağılımı]

> İl Genel Meclisi her ilçeye kendi koltuk sayısı atanarak hesaplanır. Belediye Meclisi içinse şehir nüfusuna göre toplam koltuk sayısı bellidir.
> İkisinde de yine D'Hondt + ittifak + baraj zinciri çalışır.
> Sistem partilerin aday sıralamasından kim kazandığını da gösterir: "AKP'nin Karakoçan'dan ilk 3 adayı meclis üyesi oldu" gibi.

**11.7. Karşılaştırma**
[ekran: önceki seçimle karşılaştırma]

> İsterseniz bu seçimi geçmiş seçimlerle karşılaştırabilirsiniz: "AKP geçen seçime göre 4.200 oy kaybetti" gibi mahalle bazında detaylı analiz çıkar.

---

## BÖLÜM 12 — BİLDİRİM VE TOPLU İLETİŞİM (~45 sn)

[ekran: Bildirimler ve Toplu SMS sayfaları]

> Sistem süreç boyunca **otomatik bildirimler** gönderir.
> Yeni başmüşahit ataması yapıldığında, sonuç onaya geldiğinde, sonuç reddedildiğinde, ya da seçim durumu değiştiğinde — ilgili kullanıcılara hem uygulama içi bildirim hem opsiyonel SMS düşer.
> İl genel sorumlusu istediği anda Toplu SMS sayfasından tüm başmüşahitlere — örneğin saat 16'da "Sayıma 1 saat kaldı, hatırlatma" mesajı — gönderebilir.

---

## KAPANIŞ (~30 sn)

[ekran: ana dashboard]

> Özetle Yeniden Refah Partisi İl Sekreterliği Seçim Sandık Takip Sistemi:
> Coğrafi yapıyı kuran, sandıkları ve sorumluları organize eden, başmüşahitlerin sonuçlarını yapay zeka destekli olarak hızlıca girmesini sağlayan, üst sorumlular tarafından onaylanan, ve D'Hondt + ittifak + baraj kurallarına tam uyumlu otomatik koltuk hesaplaması yapan, **uçtan uca** bir seçim takip sistemidir.
> Her kullanıcı yalnızca kendi yetki alanındaki bilgiyi görür; veriler şeffaf, denetlenebilir, ve canlı takip edilebilir.
> Sahadaki binlerce başmüşahitten il merkezinde tek bir ekrana — saniyeler içinde.

---

## EK NOTLAR — Çekim Önerileri

- **Tempo**: Her bölümün yaklaşık süreleri verildi; toplam ~14-15 dakika tutar. Sıkıştırılmış 7-8 dakikalık bir versiyon istenirse her bölümden 1-2 alt başlık atlanabilir.
- **Ses tonu**: Resmi ama anlaşılır. Hızlı değil; izleyici işlemleri ekranda takip edebilmeli.
- **Vurgu**: Şu kelimeler özellikle vurgulanmalı — "**hiyerarşik**", "**otomatik**", "**yapay zeka**", "**onay**", "**şeffaflık**", "**D'Hondt**", "**ittifak**".
- **Geçişler**: Her büyük bölüm arası 1-2 saniyelik siyah ekran veya bölüm başlığı kart geçişi rahatlatır.
- **Demo verileri**: Çekimde gerçek isimler (TC, telefon) yerine "Demo Mahallesi", "Test Sandığı 1001" gibi maskeli/uydurma veriler kullanın — yayınlandığında kişisel veri çıkmasın.
