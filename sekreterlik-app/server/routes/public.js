const express = require('express');
const router = express.Router();
const { cache } = require('../middleware/cache');

// Cache for external API calls (5 minutes)
const externalApiCache = cache(300);

/**
 * Public News/Information Page
 * Herkese açık haber sitesi benzeri sayfa
 * - Seçim sonuçları
 * - Hava durumu
 * - Haberler
 * - Borsa/Altın bilgileri
 */

// Helper function to fetch weather data
async function getWeatherData() {
  try {
    // Elazığ için hava durumu (Open-Meteo API - ücretsiz)
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=38.6753&longitude=39.2206&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe/Istanbul');
    if (response.ok) {
      const data = await response.json();
      return {
        current: {
          temperature: data.current?.temperature_2m || 'N/A',
          weatherCode: data.current?.weather_code || 0,
          windSpeed: data.current?.wind_speed_10m || 0
        },
        today: {
          max: data.daily?.temperature_2m_max?.[0] || 'N/A',
          min: data.daily?.temperature_2m_min?.[0] || 'N/A',
          weatherCode: data.daily?.weather_code?.[0] || 0
        }
      };
    }
  } catch (error) {
    console.error('Error fetching weather:', error);
  }
  return null;
}

// Helper function to get weather description from code
function getWeatherDescription(code) {
  const weatherCodes = {
    0: 'Açık',
    1: 'Çoğunlukla açık',
    2: 'Kısmen bulutlu',
    3: 'Kapalı',
    45: 'Sisli',
    48: 'Yoğun sisli',
    51: 'Hafif çisenti',
    53: 'Orta çisenti',
    55: 'Yoğun çisenti',
    61: 'Hafif yağmur',
    63: 'Orta yağmur',
    65: 'Yoğun yağmur',
    71: 'Hafif kar',
    73: 'Orta kar',
    75: 'Yoğun kar',
    80: 'Hafif sağanak',
    81: 'Orta sağanak',
    82: 'Yoğun sağanak',
    85: 'Hafif kar sağanağı',
    86: 'Yoğun kar sağanağı',
    95: 'Fırtına',
    96: 'Fırtına (dolu)',
    99: 'Şiddetli fırtına (dolu)'
  };
  return weatherCodes[code] || 'Bilinmeyen';
}

// Helper function to fetch news
async function getNews() {
  try {
    // NewsAPI yerine alternatif: RSS feed veya başka ücretsiz API
    // Şimdilik örnek haberler döndürelim
    // Gerçek API için NewsAPI key gerekir (ücretsiz plan: 100 req/gün)
    return [
      {
        title: 'Yerel Haberler',
        source: 'Yerel Basın',
        publishedAt: new Date().toISOString(),
        description: 'Yerel haberler burada görüntülenecek.'
      }
    ];
  } catch (error) {
    console.error('Error fetching news:', error);
  }
  return [];
}

// Helper function to fetch stock/gold prices
async function getFinancialData() {
  try {
    // Altın fiyatları için ücretsiz API (örnek)
    // Gerçek API için API key gerekebilir
    const now = new Date();
    return {
      gold: {
        buy: '2,450.00',
        sell: '2,448.00',
        change: '+5.50',
        changePercent: '+0.22%'
      },
      usd: {
        buy: '32.45',
        sell: '32.50',
        change: '+0.15',
        changePercent: '+0.46%'
      },
      eur: {
        buy: '35.20',
        sell: '35.25',
        change: '-0.10',
        changePercent: '-0.28%'
      },
      borsaIstanbul: {
        index: '8,450.25',
        change: '+125.50',
        changePercent: '+1.51%'
      },
      lastUpdate: now.toLocaleString('tr-TR')
    };
  } catch (error) {
    console.error('Error fetching financial data:', error);
  }
  return null;
}

// Main public page
router.get('/', externalApiCache, async (req, res) => {
  try {
    // Fetch data in parallel
    const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';
    
    // Fetch elections
    let elections = [];
    try {
      if (USE_FIREBASE) {
        // Firebase implementation
        const { collections } = require('../config/database');
        const electionsSnapshot = await collections.elections
          .orderBy('date', 'desc')
          .orderBy('created_at', 'desc')
          .limit(10)
          .get();
        elections = electionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        // SQLite implementation
        const db = require('../config/database');
        elections = await db.all('SELECT * FROM elections ORDER BY date DESC, created_at DESC LIMIT 10');
        // Parse JSON fields (only for SQLite, Firebase already has objects)
        elections = elections.map(election => ({
          ...election,
          cb_candidates: election.cb_candidates ? (typeof election.cb_candidates === 'string' ? JSON.parse(election.cb_candidates) : election.cb_candidates) : [],
          parties: election.parties ? (typeof election.parties === 'string' ? JSON.parse(election.parties) : election.parties) : [],
          independent_cb_candidates: election.independent_cb_candidates ? (typeof election.independent_cb_candidates === 'string' ? JSON.parse(election.independent_cb_candidates) : election.independent_cb_candidates) : [],
          independent_mv_candidates: election.independent_mv_candidates ? (typeof election.independent_mv_candidates === 'string' ? JSON.parse(election.independent_mv_candidates) : election.independent_mv_candidates) : [],
          mayor_parties: election.mayor_parties ? (typeof election.mayor_parties === 'string' ? JSON.parse(election.mayor_parties) : election.mayor_parties) : [],
          mayor_candidates: election.mayor_candidates ? (typeof election.mayor_candidates === 'string' ? JSON.parse(election.mayor_candidates) : election.mayor_candidates) : [],
          provincial_assembly_parties: election.provincial_assembly_parties ? (typeof election.provincial_assembly_parties === 'string' ? JSON.parse(election.provincial_assembly_parties) : election.provincial_assembly_parties) : [],
          municipal_council_parties: election.municipal_council_parties ? (typeof election.municipal_council_parties === 'string' ? JSON.parse(election.municipal_council_parties) : election.municipal_council_parties) : [],
          baraj_percent: election.baraj_percent || 7.0
        }));
    } catch (err) {
      console.error('Error fetching elections:', err);
    }

    const [weather, news, financial] = await Promise.all([
      getWeatherData(),
      getNews(),
      getFinancialData()
    ]);

    // Get latest election results
    let latestElection = null;
    let electionResults = [];
    if (elections && elections.length > 0) {
      latestElection = elections[0]; // Most recent election
      if (latestElection && latestElection.id) {
        try {
          let results = [];
          if (USE_FIREBASE) {
            // Firebase implementation
            const { collections } = require('../config/database');
            const resultsSnapshot = await collections.election_results
              .where('election_id', '==', String(latestElection.id))
              .orderBy('created_at', 'desc')
              .get();
            results = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          } else {
            // SQLite implementation
            const db = require('../config/database');
            results = await db.all(
              'SELECT * FROM election_results WHERE election_id = ? ORDER BY created_at DESC',
              [latestElection.id]
            );
          }
          // Parse JSON fields (only for SQLite, Firebase already has objects)
          electionResults = results.map(result => ({
            ...result,
            cb_votes: result.cb_votes ? (typeof result.cb_votes === 'string' ? JSON.parse(result.cb_votes) : result.cb_votes) : {},
            mv_votes: result.mv_votes ? (typeof result.mv_votes === 'string' ? JSON.parse(result.mv_votes) : result.mv_votes) : {},
            mayor_votes: result.mayor_votes ? (typeof result.mayor_votes === 'string' ? JSON.parse(result.mayor_votes) : result.mayor_votes) : {},
            provincial_assembly_votes: result.provincial_assembly_votes ? (typeof result.provincial_assembly_votes === 'string' ? JSON.parse(result.provincial_assembly_votes) : result.provincial_assembly_votes) : {},
            municipal_council_votes: result.municipal_council_votes ? (typeof result.municipal_council_votes === 'string' ? JSON.parse(result.municipal_council_votes) : result.municipal_council_votes) : {}
          }));
        } catch (err) {
          console.error('Error fetching election results:', err);
        }
      }
    }

    // Render HTML page
    const html = generatePublicPageHTML({
      elections: elections || [],
      latestElection,
      electionResults,
      weather,
      news: news || [],
      financial
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error rendering public page:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hata - Public Sayfa</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <h1>Sayfa yüklenirken hata oluştu</h1>
        <p>Lütfen daha sonra tekrar deneyin.</p>
      </body>
      </html>
    `);
  }
});

// Helper function to generate HTML
function generatePublicPageHTML(data) {
  const { elections, latestElection, electionResults, weather, news, financial } = data;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yeniden Refah Partisi Elazığ - Seçim Sonuçları ve Haberler</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem 1rem;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .card h2 {
      color: #667eea;
      margin-bottom: 1rem;
      font-size: 1.5rem;
      border-bottom: 2px solid #667eea;
      padding-bottom: 0.5rem;
    }
    
    .weather-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .weather-card h2 {
      color: white;
      border-bottom-color: rgba(255,255,255,0.3);
    }
    
    .weather-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
    }
    
    .temp-large {
      font-size: 3rem;
      font-weight: bold;
    }
    
    .temp-details {
      text-align: right;
    }
    
    .financial-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    
    .financial-item {
      text-align: center;
      padding: 1rem;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
    }
    
    .financial-item.positive {
      color: #10b981;
    }
    
    .financial-item.negative {
      color: #ef4444;
    }
    
    .election-results {
      margin-top: 1rem;
    }
    
    .result-item {
      padding: 0.75rem;
      margin: 0.5rem 0;
      background: #f8f9fa;
      border-radius: 6px;
      border-left: 4px solid #667eea;
    }
    
    .news-item {
      padding: 1rem;
      margin: 0.5rem 0;
      border-left: 4px solid #667eea;
      background: #f8f9fa;
      border-radius: 6px;
    }
    
    .news-item h3 {
      color: #667eea;
      margin-bottom: 0.5rem;
    }
    
    .footer {
      background: #333;
      color: white;
      text-align: center;
      padding: 2rem 1rem;
      margin-top: 3rem;
    }
    
    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.5rem;
      }
      
      .grid {
        grid-template-columns: 1fr;
      }
      
      .temp-large {
        font-size: 2rem;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Yeniden Refah Partisi Elazığ</h1>
    <p>Seçim Sonuçları ve Güncel Bilgiler</p>
  </div>
  
  <div class="container">
    <div class="grid">
      ${weather ? `
      <div class="card weather-card">
        <h2>🌤️ Hava Durumu</h2>
        <div class="weather-info">
          <div>
            <div class="temp-large">${weather.current.temperature}°C</div>
            <div>${getWeatherDescription(weather.current.weatherCode)}</div>
          </div>
          <div class="temp-details">
            <div>Max: ${weather.today.max}°C</div>
            <div>Min: ${weather.today.min}°C</div>
            <div>Rüzgar: ${weather.current.windSpeed} km/h</div>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${financial ? `
      <div class="card weather-card">
        <h2>💰 Finansal Veriler</h2>
        <div class="financial-grid">
          <div class="financial-item">
            <div style="font-size: 0.9rem; opacity: 0.9;">Altın (Alış)</div>
            <div style="font-size: 1.2rem; font-weight: bold;">${financial.gold.buy} ₺</div>
            <div class="financial-item ${financial.gold.change.startsWith('+') ? 'positive' : 'negative'}">
              ${financial.gold.change} (${financial.gold.changePercent})
            </div>
          </div>
          <div class="financial-item">
            <div style="font-size: 0.9rem; opacity: 0.9;">USD/TRY</div>
            <div style="font-size: 1.2rem; font-weight: bold;">${financial.usd.buy} ₺</div>
            <div class="financial-item ${financial.usd.change.startsWith('+') ? 'positive' : 'negative'}">
              ${financial.usd.change} (${financial.usd.changePercent})
            </div>
          </div>
          <div class="financial-item">
            <div style="font-size: 0.9rem; opacity: 0.9;">EUR/TRY</div>
            <div style="font-size: 1.2rem; font-weight: bold;">${financial.eur.buy} ₺</div>
            <div class="financial-item ${financial.eur.change.startsWith('+') ? 'positive' : 'negative'}">
              ${financial.eur.change} (${financial.eur.changePercent})
            </div>
          </div>
          <div class="financial-item">
            <div style="font-size: 0.9rem; opacity: 0.9;">Borsa İstanbul</div>
            <div style="font-size: 1.2rem; font-weight: bold;">${financial.borsaIstanbul.index}</div>
            <div class="financial-item positive">
              ${financial.borsaIstanbul.change} (${financial.borsaIstanbul.changePercent})
            </div>
          </div>
        </div>
        <div style="text-align: center; margin-top: 1rem; font-size: 0.85rem; opacity: 0.8;">
          Son Güncelleme: ${financial.lastUpdate}
        </div>
      </div>
      ` : ''}
      
      ${latestElection ? `
      <div class="card">
        <h2>🗳️ Seçim Sonuçları</h2>
        <h3 style="margin-bottom: 1rem; color: #667eea;">${latestElection.name || 'Seçim'}</h3>
        ${latestElection.date ? `<p style="margin-bottom: 1rem; color: #666;">Tarih: ${new Date(latestElection.date).toLocaleDateString('tr-TR')}</p>` : ''}
        ${electionResults.length > 0 ? `
        <div class="election-results">
          <p style="margin-bottom: 0.5rem;"><strong>Girilen Sandık Sayısı:</strong> ${electionResults.length}</p>
          <p style="color: #666; font-size: 0.9rem;">Detaylı sonuçlar için admin paneline giriş yapın.</p>
        </div>
        ` : '<p style="color: #666;">Henüz seçim sonucu girilmemiş.</p>'}
      </div>
      ` : '<div class="card"><h2>🗳️ Seçim Sonuçları</h2><p>Henüz seçim kaydı bulunmamaktadır.</p></div>'}
      
      ${news.length > 0 ? `
      <div class="card">
        <h2>📰 Güncel Haberler</h2>
        ${news.map(item => `
        <div class="news-item">
          <h3>${item.title}</h3>
          <p>${item.description || ''}</p>
          <small style="color: #666;">${item.source} - ${new Date(item.publishedAt).toLocaleDateString('tr-TR')}</small>
        </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  </div>
  
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} Yeniden Refah Partisi Elazığ. Tüm hakları saklıdır.</p>
  </div>
</body>
</html>`;
}

module.exports = router;

