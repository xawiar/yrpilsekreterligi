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

/**
 * Belediye Meclisi Üyesi Seçimi - Kontenjan + D'Hondt Sistemi
 * 
 * Türkiye'de belediye meclisi üyeleri şu şekilde seçilir:
 * 1. En çok oyu alan partiye kontenjan üyeleri verilir (1-3 kişi, nüfusa göre)
 * 2. Kalan üyeler D'Hondt sistemi ile dağıtılır
 * 
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları: { 'Parti Adı': oySayısı }
 * @param {number} totalSeats - Toplam meclis üyesi sayısı
 * @param {number} population - Belediye nüfusu (kontenjan sayısını belirlemek için)
 * @returns {Object} - Detaylı sonuç: { distribution, quotaSeats, dhondtSeats, chartData, totalSeats }
 */
export const calculateMunicipalCouncilSeats = (partyVotes, totalSeats, population = 0) => {
  if (!partyVotes || typeof partyVotes !== 'object') {
    return {
      distribution: {},
      quotaSeats: 0,
      dhondtSeats: totalSeats,
      chartData: [],
      totalSeats,
      quotaParty: null
    };
  }

  if (totalSeats <= 0 || !Number.isInteger(totalSeats)) {
    return {
      distribution: {},
      quotaSeats: 0,
      dhondtSeats: totalSeats,
      chartData: [],
      totalSeats,
      quotaParty: null
    };
  }

  // Kontenjan sayısını belirle (nüfusa göre)
  let quotaSeats = 0;
  if (population < 10000) {
    quotaSeats = 1;
  } else if (population >= 10000 && population < 100000) {
    quotaSeats = 2;
  } else if (population >= 100000) {
    quotaSeats = 3;
  }

  // En fazla 3 kontenjan üyesi
  quotaSeats = Math.min(quotaSeats, 3);
  // Kontenjan, toplam sandalye sayısını geçemez
  quotaSeats = Math.min(quotaSeats, totalSeats);

  // Parti oylarını sayıya çevir ve sıfır olmayanları filtrele
  const votes = Object.entries(partyVotes)
    .map(([party, votes]) => ({
      party,
      votes: parseInt(votes) || 0
    }))
    .filter(p => p.votes > 0);

  if (votes.length === 0) {
    return {
      distribution: {},
      quotaSeats: 0,
      dhondtSeats: totalSeats,
      chartData: [],
      totalSeats,
      quotaParty: null
    };
  }

  // En çok oyu alan parti (kontenjan için)
  const sortedByVotes = [...votes].sort((a, b) => b.votes - a.votes);
  const quotaParty = sortedByVotes.length > 0 ? sortedByVotes[0].party : null;

  // D'Hondt için kalan sandalye sayısı
  const dhondtSeats = totalSeats - quotaSeats;

  // D'Hondt hesaplaması (kalan sandalyeler için)
  const dhondtDistribution = dhondtSeats > 0 
    ? calculateDHondt(partyVotes, dhondtSeats)
    : {};

  // Final dağılım: Kontenjan + D'Hondt
  const finalDistribution = {};
  votes.forEach(({ party }) => {
    finalDistribution[party] = (dhondtDistribution[party] || 0);
    if (party === quotaParty && quotaSeats > 0) {
      finalDistribution[party] += quotaSeats;
    }
  });

  // Chart data için
  const chartData = Object.entries(finalDistribution)
    .map(([party, seats]) => ({
      party,
      seats,
      votes: partyVotes[party] || 0,
      quotaSeats: (party === quotaParty && quotaSeats > 0) ? quotaSeats : 0,
      dhondtSeats: seats - ((party === quotaParty && quotaSeats > 0) ? quotaSeats : 0)
    }))
    .sort((a, b) => b.seats - a.seats);

  return {
    distribution: finalDistribution,
    quotaSeats,
    dhondtSeats,
    chartData,
    totalSeats,
    quotaParty,
    quotaPartyVotes: quotaParty ? partyVotes[quotaParty] || 0 : 0
  };
};

