# 🔑 API Key Kullanım Dokümantasyonu

## 📋 Genel Bakış

Bu sistem, API key ile sınırsız erişim sağlayan bir Public API sunmaktadır. API key'ler **Ayarlar > API Keys** sayfasından oluşturulabilir ve yönetilebilir.

## 🎯 API Key Oluşturma

1. **Ayarlar** sayfasına gidin
2. **API Keys** sekmesine tıklayın
3. **Yeni API Key Oluştur** butonuna tıklayın
4. API key adı ve izinler (permissions) belirleyin
5. Oluşturulan API key'i **hemen kopyalayın** (sadece bir kez gösterilir!)

## 🔐 API Key Kullanımı

### Header ile Kullanım (Önerilen)

```javascript
// JavaScript/TypeScript
const API_KEY = 'your-api-key-here';
const API_BASE_URL = 'https://sekreterlik-backend.onrender.com/api/public';

// Fetch ile
const response = await fetch(`${API_BASE_URL}/members`, {
  headers: {
    'X-API-Key': API_KEY
  }
});

const data = await response.json();
console.log(data);
```

### Authorization Header ile Kullanım

```javascript
const response = await fetch(`${API_BASE_URL}/members`, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
});
```

### cURL ile Kullanım

```bash
# X-API-Key header ile
curl -H "X-API-Key: your-api-key-here" \
  https://sekreterlik-backend.onrender.com/api/public/members

# Authorization header ile
curl -H "Authorization: Bearer your-api-key-here" \
  https://sekreterlik-backend.onrender.com/api/public/members
```

### Python ile Kullanım

```python
import requests

API_KEY = 'your-api-key-here'
API_BASE_URL = 'https://sekreterlik-backend.onrender.com/api/public'

# X-API-Key header ile
headers = {
    'X-API-Key': API_KEY
}

response = requests.get(f'{API_BASE_URL}/members', headers=headers)
data = response.json()
print(data)
```

### PHP ile Kullanım

```php
<?php
$apiKey = 'your-api-key-here';
$apiBaseUrl = 'https://sekreterlik-backend.onrender.com/api/public';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $apiBaseUrl . '/members');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'X-API-Key: ' . $apiKey
]);

$response = curl_exec($ch);
$data = json_decode($response, true);
curl_close($ch);

print_r($data);
?>
```

## 📡 Mevcut Endpoint'ler

### Üyeler (Members)

```javascript
// Tüm üyeleri getir
GET /api/public/members

// Belirli bir üyeyi getir
GET /api/public/members/:id
```

### Toplantılar (Meetings)

```javascript
// Tüm toplantıları getir
GET /api/public/meetings

// Belirli bir toplantıyı getir
GET /api/public/meetings/:id
```

### Etkinlikler (Events)

```javascript
// Tüm etkinlikleri getir
GET /api/public/events

// Belirli bir etkinliği getir
GET /api/public/events/:id
```

### İlçeler (Districts)

```javascript
// Tüm ilçeleri getir
GET /api/public/districts

// Belirli bir ilçeyi getir
GET /api/public/districts/:id
```

### Beldeler (Towns)

```javascript
// Tüm beldeleri getir
GET /api/public/towns

// Belirli bir beldeyi getir
GET /api/public/towns/:id
```

### Mahalleler (Neighborhoods)

```javascript
// Tüm mahalleleri getir
GET /api/public/neighborhoods

// Belirli bir mahalleyi getir
GET /api/public/neighborhoods/:id
```

### Köyler (Villages)

```javascript
// Tüm köyleri getir
GET /api/public/villages

// Belirli bir köyü getir
GET /api/public/villages/:id
```

### STK'lar

```javascript
// Tüm STK'ları getir
GET /api/public/stks

// Belirli bir STK'yı getir
GET /api/public/stks/:id
```

### Kamu Kurumları (Public Institutions)

```javascript
// Tüm kamu kurumlarını getir
GET /api/public/public-institutions

// Belirli bir kamu kurumunu getir
GET /api/public/public-institutions/:id
```

### Camiler (Mosques)

```javascript
// Tüm camileri getir
GET /api/public/mosques

// Belirli bir camiyi getir
GET /api/public/mosques/:id
```

## 💻 Tam Örnek: Başka Bir Siteden Veri Çekme

### HTML + JavaScript Örneği

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seçim Sonuçları - Harici Site</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .member-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            background: #f9f9f9;
        }
        .loading {
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <h1>Seçim Sonuçları - Harici Site</h1>
    <div id="loading" class="loading">Yükleniyor...</div>
    <div id="members-container"></div>

    <script>
        // API Key ve Base URL
        const API_KEY = 'your-api-key-here'; // Buraya kendi API key'inizi yazın
        const API_BASE_URL = 'https://sekreterlik-backend.onrender.com/api/public';

        // Üyeleri getir
        async function fetchMembers() {
            try {
                const response = await fetch(`${API_BASE_URL}/members`, {
                    headers: {
                        'X-API-Key': API_KEY,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const members = await response.json();
                displayMembers(members);
            } catch (error) {
                console.error('Hata:', error);
                document.getElementById('loading').innerHTML = 
                    `<div style="color: red;">Hata: ${error.message}</div>`;
            }
        }

        // Üyeleri göster
        function displayMembers(members) {
            const container = document.getElementById('members-container');
            const loading = document.getElementById('loading');
            
            loading.style.display = 'none';

            if (!members || members.length === 0) {
                container.innerHTML = '<p>Üye bulunamadı.</p>';
                return;
            }

            container.innerHTML = members.map(member => `
                <div class="member-card">
                    <h3>${member.name || 'İsimsiz'}</h3>
                    <p><strong>TC:</strong> ${member.tc || '-'}</p>
                    <p><strong>Bölge:</strong> ${member.region || '-'}</p>
                    <p><strong>Görev:</strong> ${member.position || '-'}</p>
                    <p><strong>Telefon:</strong> ${member.phone || '-'}</p>
                    ${member.email ? `<p><strong>E-posta:</strong> ${member.email}</p>` : ''}
                </div>
            `).join('');
        }

        // Sayfa yüklendiğinde üyeleri getir
        fetchMembers();
    </script>
</body>
</html>
```

### React Örneği

```jsx
import React, { useState, useEffect } from 'react';

const API_KEY = 'your-api-key-here';
const API_BASE_URL = 'https://sekreterlik-backend.onrender.com/api/public';

function ExternalSiteComponent() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/members`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMembers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Hata:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Yükleniyor...</div>;
  if (error) return <div style={{ color: 'red' }}>Hata: {error}</div>;

  return (
    <div>
      <h1>Seçim Sonuçları - Harici Site</h1>
      <div>
        {members.map(member => (
          <div key={member.id} style={{ border: '1px solid #ddd', padding: '15px', margin: '10px 0' }}>
            <h3>{member.name || 'İsimsiz'}</h3>
            <p><strong>TC:</strong> {member.tc || '-'}</p>
            <p><strong>Bölge:</strong> {member.region || '-'}</p>
            <p><strong>Görev:</strong> {member.position || '-'}</p>
            <p><strong>Telefon:</strong> {member.phone || '-'}</p>
            {member.email && <p><strong>E-posta:</strong> {member.email}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExternalSiteComponent;
```

### Node.js Örneği

```javascript
const axios = require('axios');

const API_KEY = 'your-api-key-here';
const API_BASE_URL = 'https://sekreterlik-backend.onrender.com/api/public';

async function fetchMembers() {
  try {
    const response = await axios.get(`${API_BASE_URL}/members`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });

    console.log('Üyeler:', response.data);
    return response.data;
  } catch (error) {
    console.error('Hata:', error.response?.data || error.message);
    throw error;
  }
}

// Kullanım
fetchMembers()
  .then(members => {
    console.log(`${members.length} üye bulundu`);
  })
  .catch(error => {
    console.error('Üyeler getirilemedi:', error);
  });
```

## ❓ Sık Sorulan Sorular

### 1. Başka bir sitenin API key'ini kullanabilir miyim?

**Evet!** API key'ler sınırsız erişim sağlar. Başka bir sitenin API key'ini kullanarak o siteden veri çekebilirsiniz.

**Örnek Senaryo:**
- Site A: `https://site-a.com` → API Key: `abc123`
- Site B: `https://site-b.com` → Site A'nın API key'ini kullanarak Site A'dan veri çekebilir

```javascript
// Site B'den Site A'nın verilerini çekme
const siteA_API_KEY = 'abc123'; // Site A'nın API key'i
const siteA_API_URL = 'https://site-a-backend.onrender.com/api/public';

const response = await fetch(`${siteA_API_URL}/members`, {
  headers: {
    'X-API-Key': siteA_API_KEY
  }
});
```

### 2. API key güvenliği nasıl sağlanıyor?

- API key'ler SHA-256 ile hash'lenerek saklanır
- Sadece oluşturulduğunda plain text olarak gösterilir
- API key'ler deaktif edilebilir
- Her API key için izinler (permissions) belirlenebilir

### 3. Rate limiting var mı?

Şu anda rate limiting yok, ancak gelecekte eklenebilir. API key bazlı rate limiting eklenmesi önerilir.

### 4. Hangi HTTP metodları destekleniyor?

Şu anda sadece **GET** metodları destekleniyor (read-only). Write işlemleri için gelecekte eklenebilir.

### 5. CORS sorunu yaşıyorum

Backend CORS yapılandırması tüm origin'lere izin veriyor. Eğer sorun yaşıyorsanız:
- Backend URL'ini kontrol edin
- API key'in doğru olduğundan emin olun
- Network tab'ında request/response'ları kontrol edin

## 🔒 Güvenlik Önerileri

1. **API key'i güvenli tutun**
   - API key'i asla public repository'lere commit etmeyin
   - Environment variable olarak saklayın
   - Client-side kodda kullanıyorsanız, sadece read-only key kullanın

2. **HTTPS kullanın**
   - Tüm API çağrıları HTTPS üzerinden yapılmalı

3. **Rate limiting ekleyin** (isteğe bağlı)
   - Kendi sitenizde rate limiting ekleyebilirsiniz

## 📝 Örnek: WordPress'te Kullanım

```php
<?php
// functions.php veya plugin dosyası
function fetch_sekreterlik_data() {
    $api_key = 'your-api-key-here';
    $api_url = 'https://sekreterlik-backend.onrender.com/api/public/members';
    
    $response = wp_remote_get($api_url, [
        'headers' => [
            'X-API-Key' => $api_key
        ]
    ]);
    
    if (is_wp_error($response)) {
        return [];
    }
    
    $body = wp_remote_retrieve_body($response);
    return json_decode($body, true);
}

// Shortcode olarak kullan
add_shortcode('sekreterlik_uyeler', function() {
    $members = fetch_sekreterlik_data();
    
    $output = '<div class="members-list">';
    foreach ($members as $member) {
        $output .= sprintf(
            '<div class="member-item"><h3>%s</h3><p>%s</p></div>',
            esc_html($member['name']),
            esc_html($member['position'])
        );
    }
    $output .= '</div>';
    
    return $output;
});
?>
```

## 🚀 Hızlı Başlangıç

1. **API Key Oluştur**
   - Ayarlar > API Keys > Yeni API Key Oluştur

2. **Test Et**
   ```bash
   curl -H "X-API-Key: YOUR_API_KEY" \
     https://sekreterlik-backend.onrender.com/api/public/members
   ```

3. **Kendi Sitenizde Kullanın**
   - Yukarıdaki örneklerden birini kullanın
   - API key'i environment variable olarak saklayın

## 📞 Destek

Sorularınız için:
- GitHub Issues
- E-posta: [destek e-postası]

