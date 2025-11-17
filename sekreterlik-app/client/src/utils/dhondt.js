/**
 * D'Hondt Sistemi - Milletvekili Dağılımı Hesaplama
 * 
 * D'Hondt sistemi, nispi temsil sisteminde milletvekili dağılımını hesaplamak için kullanılır.
 * Her parti için oy sayısı 1, 2, 3, ... ile bölünür ve en yüksek bölümler milletvekili kazanır.
 */

/**
 * D'Hondt hesaplaması yapar
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları: { 'Parti Adı': oySayısı }
 * @param {number} totalSeats - Toplam milletvekili sayısı
 * @returns {Object} - Parti isimleri ve kazandıkları milletvekili sayıları: { 'Parti Adı': mvSayısı }
 */
export const calculateDHondt = (partyVotes, totalSeats) => {
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
  quotients.sort((a, b) => b.quotient - a.quotient);

  // İlk totalSeats kadar bölümü al (en yüksek bölümler)
  const topQuotients = quotients.slice(0, totalSeats);

  // Her parti için kazanılan milletvekili sayısını hesapla
  const seatDistribution = {};
  votes.forEach(({ party }) => {
    seatDistribution[party] = 0;
  });

  topQuotients.forEach(({ party }) => {
    seatDistribution[party] = (seatDistribution[party] || 0) + 1;
  });

  return seatDistribution;
};

/**
 * D'Hondt hesaplaması yapar ve detaylı sonuç döner
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları
 * @param {number} totalSeats - Toplam milletvekili sayısı
 * @returns {Object} - Detaylı sonuç: { distribution, details, chartData }
 */
export const calculateDHondtDetailed = (partyVotes, totalSeats) => {
  const distribution = calculateDHondt(partyVotes, totalSeats);

  // Detaylı bilgi için bölümleri hesapla
  const votes = Object.entries(partyVotes)
    .map(([party, votes]) => ({
      party,
      votes: parseInt(votes) || 0
    }))
    .filter(p => p.votes > 0);

  const details = votes.map(({ party, votes }) => {
    const quotients = [];
    for (let divisor = 1; divisor <= totalSeats; divisor++) {
      quotients.push({
        divisor,
        quotient: votes / divisor,
        won: false
      });
    }
    return {
      party,
      votes,
      seats: distribution[party] || 0,
      quotients
    };
  });

  // Chart data için
  const chartData = Object.entries(distribution)
    .map(([party, seats]) => ({
      party,
      seats,
      votes: partyVotes[party] || 0
    }))
    .sort((a, b) => b.seats - a.seats);

  return {
    distribution,
    details,
    chartData,
    totalSeats
  };
};

/**
 * İl bazlı D'Hondt hesaplaması (her il için ayrı hesaplama)
 * @param {Array} results - Seçim sonuçları array'i (her biri bir sandık)
 * @param {number} totalSeats - İl için toplam milletvekili sayısı
 * @returns {Object} - Parti isimleri ve kazandıkları milletvekili sayıları
 */
export const calculateDHondtByProvince = (results, totalSeats) => {
  // Tüm sandıklardan parti oylarını topla
  const partyVotes = {};
  
  results.forEach(result => {
    if (result.mv_votes && typeof result.mv_votes === 'object') {
      Object.entries(result.mv_votes).forEach(([party, votes]) => {
        partyVotes[party] = (partyVotes[party] || 0) + (parseInt(votes) || 0);
      });
    }
  });

  return calculateDHondt(partyVotes, totalSeats);
};

