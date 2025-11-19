const express = require('express');
const router = express.Router();
const { cache } = require('../middleware/cache');
const { calculateDHondtDetailed } = require('../utils/dhondt');

// Cache for external API calls (5 minutes)
const externalApiCache = cache(300);

/**
 * Public Information Page
 * Herkese açık bilgi sayfası
 * - Seçim sonuçları
 * - Hava durumu
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

// Helper function to calculate election results with D'Hondt
function calculateElectionResults(election, results) {
  if (!election || !results || results.length === 0) return null;
  
  const calculated = {
    totalBallotBoxes: results.length,
    totalVotes: 0,
    validVotes: 0,
    invalidVotes: 0,
    categories: {}
  };
  
  // Aggregate votes by category
  results.forEach(result => {
    calculated.totalVotes += parseInt(result.used_votes) || 0;
    calculated.validVotes += parseInt(result.valid_votes) || 0;
    calculated.invalidVotes += parseInt(result.invalid_votes) || 0;
    
    // CB votes
    if (result.cb_votes && typeof result.cb_votes === 'object') {
      if (!calculated.categories.cb) {
        calculated.categories.cb = {};
      }
      Object.entries(result.cb_votes).forEach(([candidate, votes]) => {
        calculated.categories.cb[candidate] = (calculated.categories.cb[candidate] || 0) + (parseInt(votes) || 0);
      });
    }
    
    // MV votes
    if (result.mv_votes && typeof result.mv_votes === 'object') {
      if (!calculated.categories.mv) {
        calculated.categories.mv = {};
      }
      Object.entries(result.mv_votes).forEach(([party, votes]) => {
        calculated.categories.mv[party] = (calculated.categories.mv[party] || 0) + (parseInt(votes) || 0);
      });
    }
    
    // Mayor votes
    if (result.mayor_votes && typeof result.mayor_votes === 'object') {
      if (!calculated.categories.mayor) {
        calculated.categories.mayor = {};
      }
      Object.entries(result.mayor_votes).forEach(([candidate, votes]) => {
        calculated.categories.mayor[candidate] = (calculated.categories.mayor[candidate] || 0) + (parseInt(votes) || 0);
      });
    }
  });
  
  // Calculate D'Hondt for MV if it's a general election
  if (election.type === 'genel' && calculated.categories.mv && election.mv_total_seats) {
    const totalSeats = parseInt(election.mv_total_seats) || 10;
    calculated.dhondtMV = calculateDHondtDetailed(calculated.categories.mv, totalSeats);
    
    // Calculate winning candidates
    if (calculated.dhondtMV && calculated.dhondtMV.chartData) {
      calculated.winningCandidatesMV = [];
      calculated.dhondtMV.chartData.forEach(item => {
        const party = election.parties?.find(p => {
          const pName = typeof p === 'string' ? p : (p?.name || String(p));
          return pName === item.party;
        });
        
        if (party && typeof party === 'object' && party.mv_candidates && Array.isArray(party.mv_candidates)) {
          const seats = item.seats || 0;
          for (let i = 0; i < Math.min(seats, party.mv_candidates.length); i++) {
            calculated.winningCandidatesMV.push({
              name: party.mv_candidates[i],
              party: item.party,
              votes: item.votes,
              percentage: item.percentage,
              order: i + 1
            });
          }
        }
      });
      // Sort by votes (highest to lowest)
      calculated.winningCandidatesMV.sort((a, b) => b.votes - a.votes);
    }
  }
  
  // Calculate CB results (sort by votes)
  if (calculated.categories.cb) {
    calculated.cbResults = Object.entries(calculated.categories.cb)
      .map(([candidate, votes]) => ({
        candidate,
        votes: parseInt(votes) || 0,
        percentage: calculated.validVotes > 0 ? ((parseInt(votes) || 0) / calculated.validVotes * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.votes - a.votes);
  }
  
  // Calculate Mayor results (sort by votes)
  if (calculated.categories.mayor) {
    calculated.mayorResults = Object.entries(calculated.categories.mayor)
      .map(([candidate, votes]) => ({
        candidate,
        votes: parseInt(votes) || 0,
        percentage: calculated.validVotes > 0 ? ((parseInt(votes) || 0) / calculated.validVotes * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.votes - a.votes);
  }
  
  return calculated;
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
        // Firebase implementation using Admin SDK
        const { getAdmin } = require('../config/firebaseAdmin');
        const admin = getAdmin();
        if (admin) {
          const firestore = admin.firestore();
          const electionsSnapshot = await firestore.collection('elections')
            .orderBy('date', 'desc')
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();
          elections = electionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
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
      }
    } catch (err) {
      console.error('Error fetching elections:', err);
    }

    const [weather, financial] = await Promise.all([
      getWeatherData(),
      getFinancialData()
    ]);

    // Get latest election results and calculate D'Hondt
    let latestElection = null;
    let electionResults = [];
    let calculatedResults = null;
    
    if (elections && elections.length > 0) {
      latestElection = elections[0]; // Most recent election
      if (latestElection && latestElection.id) {
        try {
          let results = [];
          if (USE_FIREBASE) {
            // Firebase implementation using Admin SDK
            const { getAdmin } = require('../config/firebaseAdmin');
            const admin = getAdmin();
            if (admin) {
              const firestore = admin.firestore();
              const resultsSnapshot = await firestore.collection('election_results')
                .where('election_id', '==', String(latestElection.id))
                .orderBy('created_at', 'desc')
                .get();
              results = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
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
          
          // Calculate D'Hondt results if we have election results
          if (electionResults.length > 0) {
            calculatedResults = calculateElectionResults(latestElection, electionResults);
          }
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
      calculatedResults,
      weather,
      financial
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error rendering public page:', error);
    console.error('Error stack:', error.stack);
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
        <pre>${error.message}</pre>
      </body>
      </html>
    `);
  }
});

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Public route is working!', path: '/public/test' });
});

// Helper function to generate HTML - Information page with red theme
function generatePublicPageHTML(data) {
  const { elections, latestElection, electionResults, calculatedResults, weather, financial } = data;

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
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white;
      padding: 1.5rem 1rem;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-bottom: 3px solid #b91c1c;
    }
    
    .header h1 {
      font-size: 1.8rem;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }
    
    .header p {
      opacity: 0.95;
      font-size: 1rem;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }
    
    /* Top bar - Weather and Financial (small, compact) */
    .top-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    
    .top-bar-card {
      background: white;
      border-radius: 8px;
      padding: 0.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 3px solid #dc2626;
    }
    
    .top-bar-card h3 {
      font-size: 0.85rem;
      color: #dc2626;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    
    .top-bar-content {
      font-size: 0.9rem;
      color: #333;
    }
    
    /* Main content grid */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    /* Election Results - Main content */
    .election-section {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-top: 4px solid #dc2626;
    }
    
    .election-section h2 {
      color: #dc2626;
      font-size: 1.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #fee2e2;
    }
    
    .election-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: #fef2f2;
      border-radius: 6px;
    }
    
    .stat-item {
      text-align: center;
    }
    
    .stat-value {
      font-size: 1.8rem;
      font-weight: bold;
      color: #dc2626;
    }
    
    .stat-label {
      font-size: 0.85rem;
      color: #666;
      margin-top: 0.25rem;
    }
    
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }
    
    .results-table th {
      background: #dc2626;
      color: white;
      padding: 0.75rem;
      text-align: left;
      font-size: 0.9rem;
    }
    
    .results-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .results-table tr:hover {
      background: #fef2f2;
    }
    
    .party-name {
      font-weight: 600;
      color: #333;
    }
    
    .vote-count {
      color: #666;
      font-size: 0.9rem;
    }
    
    .percentage {
      font-weight: bold;
      color: #dc2626;
      font-size: 1.1rem;
    }
    
    .seats {
      font-weight: bold;
      color: #dc2626;
      background: #fee2e2;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
    }
    
    .winning-candidates {
      margin-top: 1.5rem;
    }
    
    .winning-candidates h3 {
      color: #dc2626;
      font-size: 1.2rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #fee2e2;
    }
    
    .candidate-item {
      padding: 0.75rem;
      margin: 0.5rem 0;
      background: #fef2f2;
      border-radius: 6px;
      border-left: 3px solid #dc2626;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .candidate-name {
      font-weight: 600;
      color: #333;
    }
    
    .candidate-party {
      font-size: 0.85rem;
      color: #666;
      margin-top: 0.25rem;
    }
    
    .candidate-votes {
      text-align: right;
    }
    
    
    .footer {
      background: #1f1f1f;
      color: white;
      text-align: center;
      padding: 2rem 1rem;
      margin-top: 3rem;
    }
    
    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.5rem;
      }
      
      .top-bar {
        grid-template-columns: 1fr;
      }
      
      .main-grid {
        grid-template-columns: 1fr;
      }
      
      .election-stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Yeniden Refah Partisi Elazığ</h1>
    <p>Seçim Sonuçları</p>
  </div>
  
  <div class="container">
    <!-- Top Bar - Weather and Financial (Small) -->
    <div class="top-bar">
      ${weather ? `
      <div class="top-bar-card">
        <h3>🌤️ Hava Durumu</h3>
        <div class="top-bar-content">
          <div style="font-size: 1.2rem; font-weight: bold; color: #dc2626;">${weather.current.temperature}°C</div>
          <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">${getWeatherDescription(weather.current.weatherCode)}</div>
          <div style="font-size: 0.75rem; color: #999; margin-top: 0.25rem;">Max: ${weather.today.max}°C / Min: ${weather.today.min}°C</div>
        </div>
      </div>
      ` : ''}
      
      ${financial ? `
      <div class="top-bar-card">
        <h3>💰 Altın</h3>
        <div class="top-bar-content">
          <div style="font-size: 1.1rem; font-weight: bold; color: #dc2626;">${financial.gold.buy} ₺</div>
          <div style="font-size: 0.75rem; color: ${financial.gold.change.startsWith('+') ? '#10b981' : '#ef4444'}; margin-top: 0.25rem;">
            ${financial.gold.change} (${financial.gold.changePercent})
          </div>
        </div>
      </div>
      <div class="top-bar-card">
        <h3>💵 Döviz</h3>
        <div class="top-bar-content">
          <div style="font-size: 0.9rem; margin-bottom: 0.25rem;"><strong>USD:</strong> ${financial.usd.buy} ₺</div>
          <div style="font-size: 0.9rem;"><strong>EUR:</strong> ${financial.eur.buy} ₺</div>
        </div>
      </div>
      ` : ''}
    </div>
    
    <!-- Main Content Grid -->
    <div class="main-grid">
      <!-- Election Results - Main Column -->
      <div class="election-section">
        ${latestElection ? `
        <h2>🗳️ ${latestElection.name || 'Seçim Sonuçları'}</h2>
        ${latestElection.date ? `<p style="color: #666; margin-bottom: 1rem;">Tarih: ${new Date(latestElection.date).toLocaleDateString('tr-TR')}</p>` : ''}
        
        ${calculatedResults ? `
        <div class="election-stats">
          <div class="stat-item">
            <div class="stat-value">${calculatedResults.totalBallotBoxes}</div>
            <div class="stat-label">Sandık</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${calculatedResults.totalVotes.toLocaleString('tr-TR')}</div>
            <div class="stat-label">Toplam Oy</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${calculatedResults.validVotes.toLocaleString('tr-TR')}</div>
            <div class="stat-label">Geçerli Oy</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${calculatedResults.invalidVotes.toLocaleString('tr-TR')}</div>
            <div class="stat-label">Geçersiz Oy</div>
          </div>
        </div>
        
        ${calculatedResults.dhondtMV ? `
        <h3 style="color: #dc2626; font-size: 1.2rem; margin-top: 1.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #fee2e2;">
          Milletvekili Seçimi - D'Hondt Sonuçları
        </h3>
        <table class="results-table">
          <thead>
            <tr>
              <th>Parti</th>
              <th>Oy</th>
              <th>Oran</th>
              <th>Milletvekili</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedResults.dhondtMV.chartData.map(item => `
            <tr>
              <td>
                <div class="party-name">${item.party}</div>
              </td>
              <td>
                <div class="vote-count">${item.votes.toLocaleString('tr-TR')} oy</div>
              </td>
              <td>
                <div class="percentage">%${item.percentage}</div>
              </td>
              <td>
                <span class="seats">${item.seats} MV</span>
              </td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
        
        ${calculatedResults.winningCandidatesMV && calculatedResults.winningCandidatesMV.length > 0 ? `
        <div class="winning-candidates">
          <h3>Kazanan Milletvekili Adayları (Oy Sırasına Göre)</h3>
          ${calculatedResults.winningCandidatesMV.map(candidate => `
          <div class="candidate-item">
            <div>
              <div class="candidate-name">${candidate.name}</div>
              <div class="candidate-party">${candidate.party}</div>
            </div>
            <div class="candidate-votes">
              <div class="percentage">%${candidate.percentage}</div>
              <div class="vote-count">${candidate.votes.toLocaleString('tr-TR')} oy</div>
            </div>
          </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${calculatedResults.cbResults && calculatedResults.cbResults.length > 0 ? `
        <h3 style="color: #dc2626; font-size: 1.2rem; margin-top: 1.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #fee2e2;">
          Cumhurbaşkanı Seçimi
        </h3>
        <table class="results-table">
          <thead>
            <tr>
              <th>Aday</th>
              <th>Oy</th>
              <th>Oran</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedResults.cbResults.map(item => `
            <tr>
              <td><div class="party-name">${item.candidate}</div></td>
              <td><div class="vote-count">${item.votes.toLocaleString('tr-TR')} oy</div></td>
              <td><div class="percentage">%${item.percentage}</div></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
        
        ${calculatedResults.mayorResults && calculatedResults.mayorResults.length > 0 ? `
        <h3 style="color: #dc2626; font-size: 1.2rem; margin-top: 1.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #fee2e2;">
          Belediye Başkanı Seçimi
        </h3>
        <table class="results-table">
          <thead>
            <tr>
              <th>Aday</th>
              <th>Oy</th>
              <th>Oran</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedResults.mayorResults.map(item => `
            <tr>
              <td><div class="party-name">${item.candidate}</div></td>
              <td><div class="vote-count">${item.votes.toLocaleString('tr-TR')} oy</div></td>
              <td><div class="percentage">%${item.percentage}</div></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
        ` : electionResults.length > 0 ? `
        <p style="color: #666; padding: 1rem; background: #fef2f2; border-radius: 6px;">
          <strong>Girilen Sandık Sayısı:</strong> ${electionResults.length}<br>
          <small>Sonuçlar hesaplanıyor...</small>
        </p>
        ` : '<p style="color: #666;">Henüz seçim sonucu girilmemiş.</p>'}
        ` : '<h2>🗳️ Seçim Sonuçları</h2><p style="color: #666;">Henüz seçim kaydı bulunmamaktadır.</p>'}
      </div>
    </div>
  </div>
  
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} Yeniden Refah Partisi Elazığ. Tüm hakları saklıdır.</p>
  </div>
</body>
</html>`;
}

module.exports = router;

