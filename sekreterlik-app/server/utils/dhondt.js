/**
 * D'Hondt Sistemi - Milletvekili Dağılımı Hesaplama
 * Backend version
 */

/**
 * D'Hondt hesaplaması yapar
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları: { 'Parti Adı': oySayısı }
 * @param {number} totalSeats - Toplam milletvekili sayısı
 * @returns {Object} - Parti isimleri ve kazandıkları milletvekili sayıları: { 'Parti Adı': mvSayısı }
 */
function calculateDHondt(partyVotes, totalSeats, thresholdPercent = 0) {
  if (!partyVotes || typeof partyVotes !== 'object') {
    return {};
  }

  if (totalSeats <= 0 || !Number.isInteger(totalSeats)) {
    return {};
  }

  // Filter parties below threshold (baraj)
  if (thresholdPercent > 0) {
    const totalVotes = Object.values(partyVotes).reduce((s, v) => s + (parseInt(v) || 0), 0);
    if (totalVotes > 0) {
      for (const party of Object.keys(partyVotes)) {
        if (((parseInt(partyVotes[party]) || 0) / totalVotes * 100) < thresholdPercent) {
          delete partyVotes[party];
        }
      }
    }
  }

  // Parti oylarını sayıya çevir ve sıfır olmayanları filtrele
  const votes = Object.entries(partyVotes)
    .map(([party, votes]) => ({
      party,
      votes: parseInt(votes) || 0
    }))
    .filter(p => p.votes > 0);

  if (votes.length === 0) {
    return {};
  }

  // Her parti için bölümleri hesapla (1, 2, 3, ... ile böl)
  const quotients = [];
  votes.forEach(({ party, votes }) => {
    for (let divisor = 1; divisor <= totalSeats; divisor++) {
      quotients.push({
        party,
        quotient: votes / divisor,
        divisor
      });
    }
  });

  // Bölümleri büyükten küçüğe sırala
  // Eşit quotient durumunda:
  // 1. Daha yüksek oyu olan parti önce
  // 2. Oylar da eşitse: rastgele sıralama (kura çekme)
  //    Türk seçim hukuku gereği eşitlik durumunda "kura çekme" yapılır.
  //    Deterministik olmayan sıralama ile bu simüle edilir.
  const tieBreaks = [];
  quotients.sort((a, b) => {
    const diff = b.quotient - a.quotient;
    if (Math.abs(diff) < 1e-9) {
      const aVotes = votes.find(v => v.party === a.party)?.votes || 0;
      const bVotes = votes.find(v => v.party === b.party)?.votes || 0;
      if (aVotes !== bVotes) {
        return bVotes - aVotes;
      }
      // Oylar da eşitse: kura çekme (rastgele) — Türk seçim hukuku gereği
      tieBreaks.push({ parties: [a.party, b.party], quotient: a.quotient });
      return Math.random() - 0.5;
    }
    return diff;
  });

  // İlk totalSeats kadar bölümü al (en yüksek bölümler)
  const topQuotients = quotients.slice(0, totalSeats);

  // Her parti için kazandığı milletvekili sayısını hesapla
  const distribution = {};
  topQuotients.forEach(({ party }) => {
    distribution[party] = (distribution[party] || 0) + 1;
  });

  // Eşitlik (kura) bilgisini non-enumerable olarak ekle
  Object.defineProperty(distribution, 'tieBreaks', {
    value: tieBreaks,
    enumerable: false,
    configurable: true
  });

  return distribution;
}

/**
 * D'Hondt hesaplaması yapar ve detaylı sonuç döner
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları
 * @param {number} totalSeats - Toplam milletvekili sayısı
 * @returns {Object} - Detaylı D'Hondt sonuçları
 */
function calculateDHondtDetailed(partyVotes, totalSeats, thresholdPercent = 0) {
  const distribution = calculateDHondt(partyVotes, totalSeats, thresholdPercent);
  
  // Toplam oy sayısını hesapla
  const totalVotes = Object.values(partyVotes).reduce((sum, votes) => sum + (parseInt(votes) || 0), 0);
  
  // Chart data oluştur
  const chartData = Object.entries(distribution).map(([party, seats]) => {
    const votes = parseInt(partyVotes[party]) || 0;
    const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
    return {
      party,
      votes,
      seats,
      percentage: parseFloat(percentage.toFixed(2))
    };
  }).sort((a, b) => b.votes - a.votes);
  
  return {
    distribution,
    chartData,
    totalVotes,
    totalSeats
  };
}

/**
 * Seçim barajı uygular
 * @param {number} votes - Partinin oy sayısı
 * @param {number} totalVotes - Toplam oy sayısı
 * @param {number} thresholdPercent - Baraj yüzdesi (varsayılan %7)
 * @returns {boolean} - Barajı geçip geçmediği
 */
function applyThreshold(votes, totalVotes, thresholdPercent = 7.0) {
  if (!totalVotes || totalVotes <= 0) return false;
  return (votes * 100) >= (totalVotes * thresholdPercent);
}

/**
 * İkinci tur seçim için aday belirleme
 * Belediye başkanlığı seçimlerinde %50+1 oy alamayan adaylar için
 * en çok oy alan 2 aday ikinci tura kalır
 * @param {Object} candidateVotes - Aday adı ve oy sayısı çiftleri
 * @param {number} totalValidVotes - Toplam geçerli oy
 * @returns {Object} { needsSecondRound, winner, runoffCandidates, results }
 */
function checkRunoffEligibility(candidateVotes, totalValidVotes) {
  const sorted = Object.entries(candidateVotes)
    .map(([name, votes]) => ({ name, votes: parseInt(votes) || 0 }))
    .sort((a, b) => b.votes - a.votes);

  if (sorted.length === 0) {
    return { needsSecondRound: false, winner: null, runoffCandidates: [], results: [] };
  }

  const threshold = Math.floor(totalValidVotes / 2) + 1; // %50+1
  const leader = sorted[0];

  if (leader.votes >= threshold) {
    return {
      needsSecondRound: false,
      winner: leader.name,
      winnerVotes: leader.votes,
      winnerPercentage: ((leader.votes / totalValidVotes) * 100).toFixed(2),
      runoffCandidates: [],
      results: sorted,
    };
  }

  return {
    needsSecondRound: true,
    winner: null,
    runoffCandidates: sorted.slice(0, 2).map(c => c.name),
    runoffCandidateVotes: sorted.slice(0, 2),
    results: sorted,
  };
}

module.exports = {
  calculateDHondt,
  calculateDHondtDetailed,
  applyThreshold,
  checkRunoffEligibility
};

