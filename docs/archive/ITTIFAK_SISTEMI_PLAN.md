# İttifak Sistemi Entegrasyon Planı

## 📋 Mevcut Durum Analizi

### ✅ Mevcut Özellikler
- D'Hondt hesaplama sistemi (`dhondt.js`)
- Parti yapısı: `[{name: 'Parti', mv_candidates: [...]}]`
- Milletvekili, Belediye Meclisi, İl Genel Meclisi hesaplamaları
- Seçim oluşturma formu (`SeçimEkleSettings.jsx`)

### ❌ Eksik Özellikler
- İttifak sistemi yok
- Baraj kontrolü yok (%7)
- İttifak bazlı 2 aşamalı D'Hondt yok
- Alliance veri modeli yok

## 🎯 Entegrasyon Stratejisi

### 1. Veri Modeli Genişletme

#### A) Veritabanı Değişiklikleri
```sql
-- Yeni tablo: alliances
CREATE TABLE IF NOT EXISTS alliances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  party_ids TEXT, -- JSON array: [1, 2, 3]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (election_id) REFERENCES elections(id)
);

-- Elections tablosuna baraj ekle
ALTER TABLE elections ADD COLUMN baraj_percent REAL DEFAULT 7.0;

-- Parties yapısını genişlet (JSON içinde allianceId ekle)
-- Mevcut: {name: 'Parti', mv_candidates: [...]}
-- Yeni: {name: 'Parti', allianceId: 1, mv_candidates: [...]}
```

#### B) Frontend Veri Yapısı
```javascript
// SeçimEkleSettings.jsx - formData'ya ekle
alliances: [], // [{id: 1, name: 'Cumhur İttifakı', partyIds: [1, 2]}]
barajPercent: 7.0, // Default %7

// Parties yapısını genişlet
parties: [
  {
    name: 'AK Parti',
    allianceId: 1, // null = ittifaksız
    mv_candidates: ['Aday1', 'Aday2']
  }
]
```

### 2. Hesaplama Motoru Geliştirme

#### A) Yeni Fonksiyonlar (`dhondt.js`'e eklenecek)

```javascript
/**
 * Baraj kontrolü - Parti veya ittifak barajı geçiyor mu?
 */
export const applyThreshold = (votes, totalVotes, thresholdPercent = 7.0) => {
  const threshold = (totalVotes * thresholdPercent) / 100;
  return votes >= threshold;
};

/**
 * İttifak oylarını hesapla
 */
export const computeAllianceVotes = (partyVotes, alliances) => {
  const allianceVotes = {};
  alliances.forEach(alliance => {
    allianceVotes[alliance.id] = alliance.partyIds.reduce((sum, partyId) => {
      const partyName = getPartyNameById(partyId);
      return sum + (partyVotes[partyName] || 0);
    }, 0);
  });
  return allianceVotes;
};

/**
 * İttifaklı D'Hondt - 2 Aşamalı
 * Aşama 1: İttifaklar arası dağıtım
 * Aşama 2: İttifak içi parti dağıtımı
 */
export const calculateDHondtWithAlliances = (
  partyVotes,
  totalSeats,
  alliances = [],
  thresholdPercent = 7.0
) => {
  // 1. Toplam oy hesapla
  const totalVotes = Object.values(partyVotes).reduce((sum, v) => sum + v, 0);
  
  // 2. Baraj kontrolü
  const allianceVotes = computeAllianceVotes(partyVotes, alliances);
  const passedAlliances = alliances.filter(a => 
    applyThreshold(allianceVotes[a.id], totalVotes, thresholdPercent)
  );
  const soloParties = Object.entries(partyVotes)
    .filter(([name, votes]) => {
      const party = getPartyByName(name);
      if (!party || party.allianceId) return false; // İttifaklı partiler hariç
      return applyThreshold(votes, totalVotes, thresholdPercent);
    });
  
  // 3. Aşama 1: İttifaklar arası D'Hondt
  const allianceSeats = {};
  const entities = [
    ...passedAlliances.map(a => ({ type: 'alliance', id: a.id, votes: allianceVotes[a.id] })),
    ...soloParties.map(([name, votes]) => ({ type: 'party', name, votes }))
  ];
  
  const firstStageResult = calculateDHondt(
    Object.fromEntries(entities.map(e => [
      e.type === 'alliance' ? `alliance_${e.id}` : e.name,
      e.votes
    ])),
    totalSeats
  );
  
  // 4. Aşama 2: İttifak içi D'Hondt
  const finalPartySeats = {};
  
  passedAlliances.forEach(alliance => {
    const allianceSeatCount = firstStageResult[`alliance_${alliance.id}`] || 0;
    if (allianceSeatCount > 0) {
      const alliancePartyVotes = {};
      alliance.partyIds.forEach(partyId => {
        const partyName = getPartyNameById(partyId);
        alliancePartyVotes[partyName] = partyVotes[partyName] || 0;
      });
      
      const internalDistribution = calculateDHondt(
        alliancePartyVotes,
        allianceSeatCount
      );
      
      Object.entries(internalDistribution).forEach(([party, seats]) => {
        finalPartySeats[party] = (finalPartySeats[party] || 0) + seats;
      });
    }
  });
  
  // Solo partiler
  soloParties.forEach(([name, votes]) => {
    const seats = firstStageResult[name] || 0;
    if (seats > 0) {
      finalPartySeats[name] = (finalPartySeats[name] || 0) + seats;
    }
  });
  
  return {
    distribution: finalPartySeats,
    allianceSeats: firstStageResult,
    auditLog: {
      totalVotes,
      threshold: (totalVotes * thresholdPercent) / 100,
      passedAlliances: passedAlliances.map(a => a.name),
      soloParties: soloParties.map(([name]) => name),
      firstStage: firstStageResult,
      finalDistribution: finalPartySeats
    }
  };
};
```

### 3. UI Değişiklikleri

#### A) Seçim Oluşturma Formu (`SeçimEkleSettings.jsx`)

**Eklemeler:**
1. İttifak oluşturma bölümü
2. Partilere ittifak atama dropdown'u
3. Baraj yüzdesi input (default 7)
4. İttifak görselleştirme

#### B) Sonuç Sayfası (`ElectionResultsPage.jsx`)

**Değişiklikler:**
1. İttifak bazlı sonuç gösterimi
2. Barajı geçemeyen partileri grileştirme
3. İttifak oylarını toplu gösterme
4. Audit log görüntüleme

### 4. Geriye Dönük Uyumluluk

**Strateji:**
- Mevcut seçimler `allianceId: null` olarak işlenecek
- Eski D'Hondt hesaplamaları çalışmaya devam edecek
- Yeni seçimler için ittifak opsiyonel

## 📝 Uygulama Adımları

### Faz 1: Veri Modeli (1-2 saat)
1. `alliances` tablosu oluştur
2. `elections` tablosuna `baraj_percent` ekle
3. Migration script yaz

### Faz 2: Backend API (2-3 saat)
1. Alliance CRUD endpoints
2. Hesaplama fonksiyonlarını genişlet
3. Test yaz

### Faz 3: Frontend Form (2-3 saat)
1. İttifak yönetimi UI
2. Parti-ittifak ilişkilendirme
3. Validasyon

### Faz 4: Hesaplama Entegrasyonu (2-3 saat)
1. `ElectionResultsPage`'de yeni hesaplama
2. Görselleştirme
3. Test

### Faz 5: Test & Dokümantasyon (1-2 saat)
1. Edge case testleri
2. Kullanıcı dokümantasyonu

## ⚠️ Dikkat Edilmesi Gerekenler

1. **Geriye Dönük Uyumluluk**: Mevcut seçimler bozulmamalı
2. **Performans**: Büyük seçimlerde 2 aşamalı D'Hondt yavaş olabilir
3. **Validasyon**: Bir parti birden fazla ittifaka ait olamaz
4. **UI Karmaşıklığı**: İttifak yönetimi kullanıcı dostu olmalı

## ✅ Sonuç

**Önerilen sistem tamamen uyumlu ve uygulanabilir!**

Mevcut yapıya minimal müdahale ile entegre edilebilir. Adım adım ilerleyerek riski minimize edebiliriz.

