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
function calculateDHondt(partyVotes, totalSeats) {
  if (!partyVotes || typeof partyVotes !== 'object') {
    return {};
  }

  if (totalSeats <= 0 || !Number.isInteger(totalSeats)) {
    return {};
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
  // Eşit quotient durumunda daha yüksek oyu olan parti önce gelir (deterministik sıralama)
  quotients.sort((a, b) => {
    const diff = b.quotient - a.quotient;
    if (Math.abs(diff) < 1e-9) {
      const aVotes = votes.find(v => v.party === a.party)?.votes || 0;
      const bVotes = votes.find(v => v.party === b.party)?.votes || 0;
      return bVotes - aVotes;
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

  return distribution;
}

/**
 * D'Hondt hesaplaması yapar ve detaylı sonuç döner
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları
 * @param {number} totalSeats - Toplam milletvekili sayısı
 * @returns {Object} - Detaylı D'Hondt sonuçları
 */
function calculateDHondtDetailed(partyVotes, totalSeats) {
  const distribution = calculateDHondt(partyVotes, totalSeats);
  
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

module.exports = {
  calculateDHondt,
  calculateDHondtDetailed,
  applyThreshold
};

