# 🆓 Ücretsiz API Önerileri - Seçim/Parti Sekreterlik Sistemi

Bu dokümantasyon, [public-apis](https://github.com/public-apis/public-apis) GitHub reposundan seçilmiş, seçim/parti sekreterlik sisteminize entegre edilebilecek ücretsiz API'leri içerir.

## 📊 Kategorilere Göre Öneriler

### 1. 🌤️ Hava Durumu API'leri (Etkinlikler için)

#### Open-Meteo (Önerilen ⭐)
- **URL**: https://open-meteo.com/
- **Auth**: Gereksiz
- **HTTPS**: ✅
- **CORS**: ✅
- **Kullanım**: Etkinlikler için hava durumu tahmini
- **Örnek**:
```javascript
// Etkinlik tarihinde hava durumu
const response = await fetch(
  'https://api.open-meteo.com/v1/forecast?latitude=38.67&longitude=39.22&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe/Istanbul'
);
const data = await response.json();
```

#### WeatherAPI
- **URL**: https://www.weatherapi.com/
- **Auth**: apiKey (ücretsiz tier: 1M istek/ay)
- **HTTPS**: ✅
- **CORS**: ✅
- **Kullanım**: Detaylı hava durumu, astronomi, jeolokasyon

### 2. 📍 Harita ve Konum API'leri

#### OpenStreetMap Nominatim (Önerilen ⭐)
- **URL**: https://nominatim.openstreetmap.org/
- **Auth**: Gereksiz (rate limit: 1 istek/saniye)
- **HTTPS**: ✅
- **CORS**: ✅
- **Kullanım**: Adres → koordinat, koordinat → adres dönüşümü
- **Örnek**:
```javascript
// Adres arama
const response = await fetch(
  'https://nominatim.openstreetmap.org/search?q=Elazığ&format=json&limit=1',
  {
    headers: {
      'User-Agent': 'SekreterlikApp/1.0'
    }
  }
);
```

#### IPStack (IP Lokasyon)
- **URL**: https://ipstack.com/
- **Auth**: apiKey (ücretsiz tier: 10K istek/ay)
- **HTTPS**: ✅
- **Kullanım**: Ziyaretçi IP'sinden konum tespiti

### 3. 📅 Takvim ve Tarih API'leri

#### Calendarific (Önerilen ⭐)
- **URL**: https://calendarific.com/
- **Auth**: apiKey (ücretsiz tier: 1K istek/ay)
- **HTTPS**: ✅
- **Kullanım**: Türkiye resmi tatilleri, bayramlar
- **Örnek**:
```javascript
const response = await fetch(
  'https://calendarific.com/api/v2/holidays?api_key=YOUR_KEY&country=TR&year=2024'
);
```

#### Nager.Date
- **URL**: https://date.nager.at/
- **Auth**: Gereksiz
- **HTTPS**: ✅
- **CORS**: ✅
- **Kullanım**: Ülke bazlı resmi tatiller

### 4. 📰 Haber API'leri

#### NewsAPI (Önerilen ⭐)
- **URL**: https://newsapi.org/
- **Auth**: apiKey (ücretsiz tier: 100 istek/gün)
- **HTTPS**: ✅
- **CORS**: ✅
- **Kullanım**: Seçim haberleri, parti haberleri
- **Örnek**:
```javascript
const response = await fetch(
  'https://newsapi.org/v2/everything?q=seçim&language=tr&apiKey=YOUR_KEY'
);
```

#### Mediastack
- **URL**: https://mediastack.com/
- **Auth**: apiKey (ücretsiz tier: 500 istek/ay)
- **HTTPS**: ✅
- **Kullanım**: Türkçe haberler

### 5. 📊 İstatistik ve Veri API'leri

#### REST Countries
- **URL**: https://restcountries.com/
- **Auth**: Gereksiz
- **HTTPS**: ✅
- **CORS**: ✅
- **Kullanım**: Ülke bilgileri, bayraklar, nüfus

#### World Bank API
- **URL**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
- **Auth**: Gereksiz
- **HTTPS**: ✅
- **Kullanım**: Nüfus, ekonomi verileri

### 6. 📧 E-posta ve SMS API'leri

#### EmailJS (Önerilen ⭐)
- **URL**: https://www.emailjs.com/
- **Auth**: apiKey (ücretsiz tier: 200 e-posta/ay)
- **HTTPS**: ✅
- **Kullanım**: Client-side e-posta gönderimi
- **Örnek**:
```javascript
emailjs.send('service_id', 'template_id', {
  to_name: 'Üye Adı',
  message: 'Toplantı hatırlatması',
  to_email: 'uye@example.com'
}, 'YOUR_PUBLIC_KEY');
```

#### Twilio (SMS)
- **URL**: https://www.twilio.com/
- **Auth**: apiKey (ücretsiz tier: $15.50 kredi)
- **HTTPS**: ✅
- **Kullanım**: SMS gönderimi

### 7. 🔔 Bildirim API'leri

#### OneSignal
- **URL**: https://onesignal.com/
- **Auth**: apiKey (ücretsiz tier: 10K abone)
- **HTTPS**: ✅
- **Kullanım**: Push bildirimleri

#### Firebase Cloud Messaging (Zaten kullanıyorsunuz)
- **URL**: https://firebase.google.com/docs/cloud-messaging
- **Auth**: Firebase config
- **HTTPS**: ✅
- **Kullanım**: Push bildirimleri (mevcut sistem)

### 8. 📸 Görsel ve Medya API'leri

#### Unsplash (Önerilen ⭐)
- **URL**: https://unsplash.com/developers
- **Auth**: apiKey (ücretsiz tier: 50 istek/saat)
- **HTTPS**: ✅
- **CORS**: ✅
- **Kullanım**: Etkinlik görselleri, arka plan görselleri

#### Pexels
- **URL**: https://www.pexels.com/api/
- **Auth**: apiKey (ücretsiz tier: 200 istek/saat)
- **HTTPS**: ✅
- **Kullanım**: Ücretsiz stok fotoğraflar

### 9. 🗳️ Seçim ve Siyaset API'leri

#### The Ballot API
- **URL**: https://ballotapi.org/
- **Auth**: Gereksiz
- **HTTPS**: ✅
- **Kullanım**: ABD seçim verileri (Türkiye için uygun değil, referans)

**Not**: Türkiye için özel seçim API'si bulunmuyor. Mevcut sisteminiz zaten bu ihtiyacı karşılıyor.

### 10. 📞 Telefon ve İletişim API'leri

#### Numverify (Önerilen ⭐)
- **URL**: https://numverify.com/
- **Auth**: apiKey (ücretsiz tier: 1K istek/ay)
- **HTTPS**: ✅
- **Kullanım**: Telefon numarası doğrulama
- **Örnek**:
```javascript
const response = await fetch(
  'http://apilayer.net/api/validate?access_key=YOUR_KEY&number=905551234567&country_code=TR&format=1'
);
```

### 11. 🔐 Güvenlik ve Doğrulama API'leri

#### Have I Been Pwned
- **URL**: https://haveibeenpwned.com/API/v3
- **Auth**: apiKey (ücretsiz tier: rate limited)
- **HTTPS**: ✅
- **Kullanım**: E-posta güvenlik kontrolü

### 12. 📊 Veri Analizi API'leri

#### Google Analytics API (Zaten kullanılabilir)
- **URL**: https://developers.google.com/analytics
- **Auth**: OAuth
- **HTTPS**: ✅
- **Kullanım**: Site istatistikleri

## 🎯 Sisteminize En Uygun 5 API

### 1. **Open-Meteo** (Hava Durumu)
- ✅ Tamamen ücretsiz
- ✅ CORS desteği
- ✅ Etkinlikler için hava durumu tahmini
- **Entegrasyon**: Etkinlik detay sayfasına hava durumu widget'ı

### 2. **OpenStreetMap Nominatim** (Harita)
- ✅ Tamamen ücretsiz
- ✅ CORS desteği
- ✅ Adres → koordinat dönüşümü
- **Entegrasyon**: Üye/etkinlik konumları için harita gösterimi

### 3. **Calendarific** (Tatiller)
- ✅ Ücretsiz tier mevcut
- ✅ Türkiye resmi tatilleri
- **Entegrasyon**: Toplantı/etkinlik planlama, tatil kontrolü

### 4. **NewsAPI** (Haberler)
- ✅ Ücretsiz tier mevcut
- ✅ Türkçe haber desteği
- **Entegrasyon**: Dashboard'a seçim/parti haberleri widget'ı

### 5. **EmailJS** (E-posta)
- ✅ Ücretsiz tier mevcut
- ✅ Client-side entegrasyon
- **Entegrasyon**: Toplantı hatırlatmaları, bildirimler

## 💻 Entegrasyon Örnekleri

### Hava Durumu Widget'ı (Etkinlik Detay Sayfası)

```javascript
// utils/weatherService.js
export const getWeatherForecast = async (latitude, longitude, date) => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe/Istanbul&start_date=${date}&end_date=${date}`
    );
    const data = await response.json();
    return data.daily;
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
};
```

### Harita Entegrasyonu (Üye/Etkinlik Konumları)

```javascript
// utils/mapService.js
export const geocodeAddress = async (address) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'SekreterlikApp/1.0'
        }
      }
    );
    const data = await response.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};
```

### Resmi Tatil Kontrolü (Toplantı Planlama)

```javascript
// utils/holidayService.js
export const checkHoliday = async (date) => {
  try {
    const year = new Date(date).getFullYear();
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/TR`
    );
    const holidays = await response.json();
    const dateStr = date.split('T')[0];
    return holidays.find(h => h.date === dateStr);
  } catch (error) {
    console.error('Holiday API error:', error);
    return null;
  }
};
```

### Haber Widget'ı (Dashboard)

```javascript
// utils/newsService.js
export const getElectionNews = async (query = 'seçim', limit = 5) => {
  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=tr&sortBy=publishedAt&pageSize=${limit}&apiKey=YOUR_API_KEY`
    );
    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error('News API error:', error);
    return [];
  }
};
```

## 🔧 Entegrasyon Adımları

### 1. API Key'leri Ayarlara Ekle

`SettingsPage.jsx`'e yeni bir sekme ekleyin: **"Harici API'ler"**

```javascript
// components/ExternalApiSettings.jsx
const ExternalApiSettings = () => {
  const [apiKeys, setApiKeys] = useState({
    newsApi: '',
    weatherApi: '',
    emailJs: '',
    // ...
  });

  // API key'leri kaydet
  const handleSave = async () => {
    // localStorage veya backend'e kaydet
  };

  return (
    <div>
      <h3>Harici API Ayarları</h3>
      {/* API key input'ları */}
    </div>
  );
};
```

### 2. API Service Dosyaları Oluştur

```
utils/
  ├── weatherService.js
  ├── mapService.js
  ├── holidayService.js
  ├── newsService.js
  └── emailService.js
```

### 3. Component'lere Entegre Et

- **EventDetailsPage**: Hava durumu widget'ı
- **MemberDetailsPage**: Harita gösterimi
- **MeetingForm**: Tatil kontrolü
- **DashboardPage**: Haber widget'ı

## ⚠️ Önemli Notlar

1. **Rate Limits**: Ücretsiz tier'ların rate limit'lerine dikkat edin
2. **API Key Güvenliği**: API key'leri asla client-side'da expose etmeyin (NewsAPI gibi)
3. **CORS**: Bazı API'ler CORS desteklemiyor, backend proxy gerekebilir
4. **Fallback**: API hatalarında fallback mekanizması ekleyin
5. **Caching**: API response'larını cache'leyin (localStorage/IndexedDB)

## 📚 Kaynaklar

- [public-apis GitHub Repo](https://github.com/public-apis/public-apis)
- [APILayer.com](https://apilayer.com/) - API marketplace
- [RapidAPI](https://rapidapi.com/) - API hub

## 🚀 Hızlı Başlangıç

1. **Open-Meteo** ile başlayın (en kolay, auth gereksiz)
2. **OpenStreetMap Nominatim** ekleyin (harita özellikleri için)
3. **Calendarific** veya **Nager.Date** ile tatil kontrolü
4. İhtiyaca göre diğer API'leri ekleyin

## 💡 Öneriler

- **İlk aşama**: Open-Meteo + OpenStreetMap (auth gereksiz, kolay entegrasyon)
- **İkinci aşama**: NewsAPI + EmailJS (ücretsiz tier yeterli)
- **Üçüncü aşama**: Twilio (SMS için, ücretli ama çok kullanışlı)

