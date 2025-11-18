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

/**
 * İl Genel Meclisi Üyesi Seçimi - İlçe Bazlı D'Hondt Sistemi
 * 
 * Türkiye'de il genel meclisi üyeleri şu şekilde seçilir:
 * 1. Her ilçe ayrı bir seçim çevresidir
 * 2. Her ilçede ayrı D'Hondt uygulanır
 * 3. İlçeye nüfusa göre farklı sayıda üye tahsis edilir
 * 4. Tüm ilçelerden gelen üyeler birleşir → İl Genel Meclisi oluşur
 * 
 * @param {Array} results - Seçim sonuçları array'i (her biri bir sandık)
 * @param {Object} districtSeats - İlçe isimleri ve üye sayıları: { 'İlçe Adı': üyeSayısı }
 * @returns {Object} - Detaylı sonuç: { districtResults, totalDistribution, chartData }
 */
export const calculateProvincialAssemblySeats = (results, districtSeats) => {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return {
      districtResults: {},
      totalDistribution: {},
      chartData: [],
      totalSeats: 0
    };
  }

  if (!districtSeats || typeof districtSeats !== 'object') {
    return {
      districtResults: {},
      totalDistribution: {},
      chartData: [],
      totalSeats: 0
    };
  }

  const districtResults = {};
  const totalDistribution = {};

  // Her ilçe için ayrı D'Hondt hesaplaması
  Object.entries(districtSeats).forEach(([districtName, seats]) => {
    const seatsCount = parseInt(seats) || 0;
    if (seatsCount <= 0) return;

    // Bu ilçedeki sandıklardan parti oylarını topla
    const districtPartyVotes = {};
    results.forEach(result => {
      // İlçe eşleşmesi kontrolü
      if (result.district_name === districtName && result.provincial_assembly_votes) {
        Object.entries(result.provincial_assembly_votes).forEach(([party, votes]) => {
          districtPartyVotes[party] = (districtPartyVotes[party] || 0) + (parseInt(votes) || 0);
        });
      }
    });

    // Bu ilçe için D'Hondt hesaplaması
    if (Object.keys(districtPartyVotes).length > 0) {
      const dhondtResult = calculateDHondt(districtPartyVotes, seatsCount);
      districtResults[districtName] = {
        seats: seatsCount,
        partyVotes: districtPartyVotes,
        distribution: dhondtResult
      };

      // Toplam dağılıma ekle
      Object.entries(dhondtResult).forEach(([party, seats]) => {
        totalDistribution[party] = (totalDistribution[party] || 0) + seats;
      });
    }
  });

  // Chart data için
  const chartData = Object.entries(totalDistribution)
    .map(([party, seats]) => ({
      party,
      seats,
      votes: 0 // Toplam oy hesaplanabilir ama şu an gerekli değil
    }))
    .sort((a, b) => b.seats - a.seats);

  const totalSeats = Object.values(districtSeats).reduce((sum, seats) => sum + (parseInt(seats) || 0), 0);

  return {
    districtResults,
    totalDistribution,
    chartData,
    totalSeats
  };
};

/**
 * Baraj kontrolü - Parti veya ittifak barajı geçiyor mu?
 * @param {number} votes - Parti veya ittifak oy sayısı
 * @param {number} totalVotes - Toplam geçerli oy sayısı
 * @param {number} thresholdPercent - Baraj yüzdesi (default 7.0)
 * @returns {boolean} - Barajı geçiyor mu?
 */
export const applyThreshold = (votes, totalVotes, thresholdPercent = 7.0) => {
  if (!totalVotes || totalVotes <= 0) return false;
  const threshold = (totalVotes * thresholdPercent) / 100;
  return votes >= threshold;
};

/**
 * İttifak oylarını hesapla
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları: { 'Parti Adı': oySayısı }
 * @param {Array} alliances - İttifaklar: [{id: 1, name: 'İttifak Adı', party_ids: ['Parti1', 'Parti2']}]
 * @returns {Object} - İttifak ID'leri ve toplam oyları: { allianceId: toplamOy }
 */
export const computeAllianceVotes = (partyVotes, alliances = []) => {
  const allianceVotes = {};
  
  alliances.forEach(alliance => {
    const partyIds = alliance.party_ids || alliance.partyIds || [];
    allianceVotes[alliance.id] = partyIds.reduce((sum, partyId) => {
      // partyId parti ismi olabilir veya parti objesi olabilir
      const partyName = typeof partyId === 'string' ? partyId : (partyId.name || String(partyId));
      return sum + (parseInt(partyVotes[partyName]) || 0);
    }, 0);
  });
  
  return allianceVotes;
};

/**
 * Parti ismine göre ittifak ID'sini bul
 * @param {string} partyName - Parti ismi
 * @param {Array} alliances - İttifaklar
 * @returns {number|null} - İttifak ID veya null
 */
const getAllianceIdForParty = (partyName, alliances = []) => {
  for (const alliance of alliances) {
    const partyIds = alliance.party_ids || alliance.partyIds || [];
    if (partyIds.some(pid => {
      const pidName = typeof pid === 'string' ? pid : (pid.name || String(pid));
      return pidName === partyName;
    })) {
      return alliance.id;
    }
  }
  return null;
};

/**
 * İttifaklı D'Hondt - 2 Aşamalı Hesaplama
 * 
 * Aşama 1: İttifaklar arası D'Hondt (ittifaklar + solo partiler)
 * Aşama 2: İttifak içi D'Hondt (her ittifak kazandığı sandalyeleri içindeki partilere dağıtır)
 * 
 * @param {Object} partyVotes - Parti isimleri ve oy sayıları: { 'Parti Adı': oySayısı }
 * @param {number} totalSeats - Toplam sandalye sayısı
 * @param {Array} alliances - İttifaklar: [{id: 1, name: 'İttifak', party_ids: ['Parti1', 'Parti2']}]
 * @param {number} thresholdPercent - Baraj yüzdesi (default 7.0)
 * @param {Array} parties - Parti listesi (allianceId bilgisi için): [{name: 'Parti', allianceId: 1}]
 * @returns {Object} - Detaylı sonuç: { distribution, allianceSeats, auditLog, chartData }
 */
export const calculateDHondtWithAlliances = (
  partyVotes,
  totalSeats,
  alliances = [],
  thresholdPercent = 7.0,
  parties = []
) => {
  if (!partyVotes || typeof partyVotes !== 'object') {
    return {
      distribution: {},
      allianceSeats: {},
      auditLog: { error: 'Geçersiz parti oyları' },
      chartData: [],
      totalSeats
    };
  }

  if (totalSeats <= 0 || !Number.isInteger(totalSeats)) {
    return {
      distribution: {},
      allianceSeats: {},
      auditLog: { error: 'Geçersiz sandalye sayısı' },
      chartData: [],
      totalSeats
    };
  }

  // 1. Toplam geçerli oy hesapla
  const totalVotes = Object.values(partyVotes).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  
  if (totalVotes <= 0) {
    return {
      distribution: {},
      allianceSeats: {},
      auditLog: { error: 'Toplam oy sıfır', totalVotes: 0 },
      chartData: [],
      totalSeats
    };
  }

  // 2. İttifak oylarını hesapla
  const allianceVotes = computeAllianceVotes(partyVotes, alliances);
  
  // 3. Baraj kontrolü - İttifaklar
  const passedAlliances = alliances.filter(alliance => {
    const votes = allianceVotes[alliance.id] || 0;
    return applyThreshold(votes, totalVotes, thresholdPercent);
  });
  
  // 4. Baraj kontrolü - Solo partiler (ittifakta olmayan partiler)
  const soloParties = Object.entries(partyVotes)
    .filter(([partyName, votes]) => {
      // İttifakta olan partileri hariç tut
      const allianceId = getAllianceIdForParty(partyName, alliances);
      if (allianceId !== null) return false;
      
      // Baraj kontrolü
      return applyThreshold(parseInt(votes) || 0, totalVotes, thresholdPercent);
    })
    .map(([partyName, votes]) => ({
      name: partyName,
      votes: parseInt(votes) || 0
    }));

  // 5. Aşama 1: İttifaklar arası D'Hondt
  const firstStageEntities = {};
  
  // İttifakları ekle
  passedAlliances.forEach(alliance => {
    firstStageEntities[`alliance_${alliance.id}`] = allianceVotes[alliance.id] || 0;
  });
  
  // Solo partileri ekle
  soloParties.forEach(party => {
    firstStageEntities[party.name] = party.votes;
  });

  // İlk aşama D'Hondt
  const firstStageResult = calculateDHondt(firstStageEntities, totalSeats);
  
  // 6. Aşama 2: İttifak içi D'Hondt
  const finalPartySeats = {};
  const allianceSeats = {};
  
  // İttifaklar için iç dağıtım
  passedAlliances.forEach(alliance => {
    const allianceSeatCount = firstStageResult[`alliance_${alliance.id}`] || 0;
    allianceSeats[alliance.id] = allianceSeatCount;
    
    if (allianceSeatCount > 0) {
      // İttifak içi parti oyları
      const alliancePartyVotes = {};
      const partyIds = alliance.party_ids || alliance.partyIds || [];
      
      partyIds.forEach(partyId => {
        const partyName = typeof partyId === 'string' ? partyId : (partyId.name || String(partyId));
        const votes = partyVotes[partyName] || 0;
        if (votes > 0) {
          alliancePartyVotes[partyName] = votes;
        }
      });
      
      // İttifak içi D'Hondt
      if (Object.keys(alliancePartyVotes).length > 0) {
        const internalDistribution = calculateDHondt(alliancePartyVotes, allianceSeatCount);
        
        Object.entries(internalDistribution).forEach(([party, seats]) => {
          finalPartySeats[party] = (finalPartySeats[party] || 0) + seats;
        });
      }
    }
  });
  
  // Solo partiler için sandalye sayısını ekle
  soloParties.forEach(party => {
    const seats = firstStageResult[party.name] || 0;
    if (seats > 0) {
      finalPartySeats[party.name] = (finalPartySeats[party.name] || 0) + seats;
    }
  });

  // 7. Chart data oluştur
  const chartData = Object.entries(finalPartySeats)
    .map(([party, seats]) => ({
      party,
      seats,
      votes: partyVotes[party] || 0
    }))
    .sort((a, b) => b.seats - a.seats);

  // 8. Audit log
  const auditLog = {
    totalVotes,
    threshold: (totalVotes * thresholdPercent) / 100,
    thresholdPercent,
    passedAlliances: passedAlliances.map(a => ({ id: a.id, name: a.name, votes: allianceVotes[a.id] })),
    soloParties: soloParties.map(p => ({ name: p.name, votes: p.votes })),
    firstStage: firstStageResult,
    allianceSeats,
    finalDistribution: finalPartySeats
  };

  return {
    distribution: finalPartySeats,
    allianceSeats,
    auditLog,
    chartData,
    totalSeats
  };
};

/**
 * İttifaklı D'Hondt - Detaylı versiyon (calculateDHondtDetailed benzeri)
 * @param {Object} partyVotes - Parti oyları
 * @param {number} totalSeats - Toplam sandalye
 * @param {Array} alliances - İttifaklar
 * @param {number} thresholdPercent - Baraj yüzdesi
 * @param {Array} parties - Parti listesi
 * @returns {Object} - Detaylı sonuç
 */
export const calculateDHondtWithAlliancesDetailed = (
  partyVotes,
  totalSeats,
  alliances = [],
  thresholdPercent = 7.0,
  parties = []
) => {
  const result = calculateDHondtWithAlliances(
    partyVotes,
    totalSeats,
    alliances,
    thresholdPercent,
    parties
  );

  // Detaylı bilgi ekle
  const details = Object.entries(result.distribution).map(([party, seats]) => ({
    party,
    votes: partyVotes[party] || 0,
    seats,
    allianceId: getAllianceIdForParty(party, alliances)
  }));

  return {
    ...result,
    details
  };
};

