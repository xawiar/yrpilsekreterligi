/**
 * Gemini Function Calling araç tanımları
 * AI bu araçları gerektiğinde çağırarak hesaplama, arama ve analiz yapabilir
 */

export const TOOL_DECLARATIONS = [
  {
    name: 'hesaplaDHondt',
    description: 'D\'Hondt yöntemiyle milletvekili veya meclis üyesi sandalye dağılımı hesaplar. Parti oyları ve toplam sandalye sayısı gereklidir.',
    parameters: {
      type: 'object',
      properties: {
        partyVotes: {
          type: 'object',
          description: 'Parti adı ve oy sayısı çiftleri. Örnek: {"AK PARTİ": 15000, "CHP": 12000, "MHP": 8000}'
        },
        totalSeats: {
          type: 'integer',
          description: 'Dağıtılacak toplam sandalye sayısı'
        },
        thresholdPercent: {
          type: 'number',
          description: 'Seçim barajı yüzdesi (varsayılan %7)'
        }
      },
      required: ['partyVotes', 'totalSeats']
    }
  },
  {
    name: 'araUye',
    description: 'Üye veritabanında isim, TC, bölge veya görev ile arama yapar. Sonuçta üyenin detaylı bilgileri, katılım oranı ve performans puanı döner.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Aranacak metin (isim, TC veya bölge)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'getirSecimSonuclari',
    description: 'Belirtilen seçimin sandık bazlı sonuçlarını getirir. Parti oy sayıları, katılım oranı ve itiraz bilgilerini içerir.',
    parameters: {
      type: 'object',
      properties: {
        electionId: {
          type: 'string',
          description: 'Seçim ID\'si'
        }
      },
      required: ['electionId']
    }
  },
  {
    name: 'karsilastirSecimler',
    description: 'İki seçimi karşılaştırır: parti bazlı oy değişimi, katılım oranı farkı, kazanım/kayıp analizi yapar.',
    parameters: {
      type: 'object',
      properties: {
        election1Id: {
          type: 'string',
          description: 'İlk seçim (eski) ID\'si'
        },
        election2Id: {
          type: 'string',
          description: 'İkinci seçim (yeni) ID\'si'
        }
      },
      required: ['election1Id', 'election2Id']
    }
  },
  {
    name: 'analizEtBolge',
    description: 'Belirli bir bölge, mahalle veya ilçenin detaylı analizini yapar: üye sayısı, katılım oranları, ziyaret sayıları, temsilci durumu.',
    parameters: {
      type: 'object',
      properties: {
        bolgeAdi: {
          type: 'string',
          description: 'Bölge, mahalle veya ilçe adı'
        }
      },
      required: ['bolgeAdi']
    }
  },
  {
    name: 'olusturRapor',
    description: 'Belirtilen tarih aralığı ve tür için faaliyet raporu üretir. Toplantı, etkinlik, üye kazanımı ve ziyaret istatistiklerini içerir.',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Başlangıç tarihi (YYYY-MM-DD)'
        },
        endDate: {
          type: 'string',
          description: 'Bitiş tarihi (YYYY-MM-DD)'
        },
        tur: {
          type: 'string',
          description: 'Rapor türü: genel, toplanti, etkinlik, secim',
          enum: ['genel', 'toplanti', 'etkinlik', 'secim']
        }
      },
      required: ['startDate', 'endDate']
    }
  }
];

// Tool başına erişim kontrolü — hangi roller hangi tool'ları kullanabilir
const TOOL_PERMISSIONS = {
  hesaplaDHondt: ['admin', 'member', 'coordinator', 'chief_observer'],
  araUye: ['admin'],
  getirSecimSonuclari: ['admin', 'coordinator', 'chief_observer'],
  karsilastirSecimler: ['admin', 'coordinator'],
  analizEtBolge: ['admin'],
  olusturRapor: ['admin'],
};

/**
 * Tool çağrılarını işle — her tool adı bir handler fonksiyonuna eşlenir
 */
export async function executeToolCall(toolName, args, siteData, userRole) {
  // Erişim kontrolü
  const allowedRoles = TOOL_PERMISSIONS[toolName];
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return JSON.stringify({ error: 'Bu işlem için yetkiniz yok', tool: toolName });
  }
  switch (toolName) {
    case 'hesaplaDHondt': {
      const { calculateDHondtDetailed } = await import('./dhondt');
      const result = calculateDHondtDetailed(args.partyVotes, args.totalSeats);
      return JSON.stringify(result, null, 2);
    }

    case 'araUye': {
      const members = siteData?.members || [];
      const query = (args.query || '').toLowerCase();
      const found = members.filter(m => {
        const name = (m.name || '').toLowerCase();
        const region = (m.region || '').toLowerCase();
        const position = (m.position || '').toLowerCase();
        return name.includes(query) || region.includes(query) || position.includes(query);
      }).slice(0, 10);
      return JSON.stringify(found.map(m => ({
        name: m.name,
        region: m.region,
        position: m.position,
        stars: m.manual_stars || m.stars,
        attendanceRate: m.attendanceRate
      })), null, 2);
    }

    case 'getirSecimSonuclari': {
      const ApiService = (await import('./ApiService')).default;
      const results = await ApiService.getElectionResults(args.electionId);
      const data = Array.isArray(results) ? results : results?.data || [];
      // Aggregate
      const partyTotals = {};
      let totalValid = 0, totalUsed = 0, totalVoters = 0;
      data.forEach(r => {
        totalValid += parseInt(r.valid_votes) || 0;
        totalUsed += parseInt(r.used_votes) || 0;
        totalVoters += parseInt(r.total_voters) || 0;
        const votes = r.cb_votes || r.mv_votes || r.mayor_votes || {};
        Object.entries(votes).forEach(([p, v]) => {
          partyTotals[p] = (partyTotals[p] || 0) + (parseInt(v) || 0);
        });
      });
      return JSON.stringify({
        sandikSayisi: data.length,
        toplamSecmen: totalVoters,
        kullanilanOy: totalUsed,
        gecerliOy: totalValid,
        katilimOrani: totalVoters > 0 ? (totalUsed / totalVoters * 100).toFixed(1) + '%' : '0%',
        partiOylari: partyTotals
      }, null, 2);
    }

    case 'karsilastirSecimler': {
      const ApiService = (await import('./ApiService')).default;
      const [r1, r2] = await Promise.all([
        ApiService.getElectionResults(args.election1Id),
        ApiService.getElectionResults(args.election2Id)
      ]);
      const d1 = Array.isArray(r1) ? r1 : r1?.data || [];
      const d2 = Array.isArray(r2) ? r2 : r2?.data || [];
      const agg = (data) => {
        const t = {}; let tv = 0;
        data.forEach(r => {
          tv += parseInt(r.valid_votes) || 0;
          const v = r.cb_votes || r.mv_votes || r.mayor_votes || {};
          Object.entries(v).forEach(([p, c]) => { t[p] = (t[p] || 0) + (parseInt(c) || 0); });
        });
        return { totals: t, totalValid: tv };
      };
      const a1 = agg(d1), a2 = agg(d2);
      const parties = [...new Set([...Object.keys(a1.totals), ...Object.keys(a2.totals)])];
      const comparison = parties.map(p => ({
        parti: p,
        eskiOy: a1.totals[p] || 0,
        yeniOy: a2.totals[p] || 0,
        fark: (a2.totals[p] || 0) - (a1.totals[p] || 0),
        eskiYuzde: a1.totalValid > 0 ? ((a1.totals[p] || 0) / a1.totalValid * 100).toFixed(2) + '%' : '0%',
        yeniYuzde: a2.totalValid > 0 ? ((a2.totals[p] || 0) / a2.totalValid * 100).toFixed(2) + '%' : '0%'
      }));
      return JSON.stringify(comparison, null, 2);
    }

    case 'analizEtBolge': {
      const members = siteData?.members || [];
      const neighborhoods = siteData?.neighborhoods || [];
      const query = (args.bolgeAdi || '').toLowerCase();
      const matchedMembers = members.filter(m => (m.region || '').toLowerCase().includes(query) || (m.district || '').toLowerCase().includes(query));
      const matchedNeighborhoods = neighborhoods.filter(n => (n.name || '').toLowerCase().includes(query));
      return JSON.stringify({
        uyeSayisi: matchedMembers.length,
        mahalleSayisi: matchedNeighborhoods.length,
        temsilciAtanmis: matchedNeighborhoods.filter(n => n.representative_name).length,
        ziyaretYapilmis: matchedNeighborhoods.filter(n => (n.visit_count || 0) > 0).length
      }, null, 2);
    }

    case 'olusturRapor': {
      const meetings = siteData?.meetings || [];
      const events = siteData?.events || [];
      const start = new Date(args.startDate);
      const end = new Date(args.endDate);
      const inRange = (dateStr) => {
        const d = new Date(dateStr);
        return d >= start && d <= end;
      };
      const filteredMeetings = meetings.filter(m => inRange(m.date));
      const filteredEvents = events.filter(e => inRange(e.date));
      return JSON.stringify({
        donem: `${args.startDate} — ${args.endDate}`,
        tur: args.tur || 'genel',
        toplantiSayisi: filteredMeetings.length,
        etkinlikSayisi: filteredEvents.length,
        toplamKatilimci: filteredMeetings.reduce((sum, m) => sum + (m.attendees?.filter(a => a.attended)?.length || 0), 0),
        ortalamaKatilim: filteredMeetings.length > 0
          ? (filteredMeetings.reduce((sum, m) => {
              const total = m.attendees?.length || 0;
              const attended = m.attendees?.filter(a => a.attended)?.length || 0;
              return sum + (total > 0 ? attended / total : 0);
            }, 0) / filteredMeetings.length * 100).toFixed(1) + '%'
          : '0%'
      }, null, 2);
    }

    default:
      return JSON.stringify({ error: `Bilinmeyen araç: ${toolName}` });
  }
}
