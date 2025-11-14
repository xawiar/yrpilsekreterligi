/**
 * Üye Performans Puanı Hesaplama Sistemi
 * 
 * Puan Kriterleri (varsayılan, Firebase'den yüklenebilir):
 * - Katıldığı toplantı başına: +10 puan
 * - Katıldığı etkinlik başına: +10 puan
 * - Mazeretsiz katılmadığı toplantı için: -5 puan
 * - Mazeretli katılmadığı toplantı için: 0 puan (ceza yok)
 * - Kaydettiği üye başına: +5 puan
 * 
 * Bonus Puanlar (Ay Sonu, varsayılan):
 * - O ay tüm toplantılara katılmışsa: +50 puan/ay
 * - O ay tüm etkinliklere katılmışsa: +50 puan/ay
 * 
 * Dinamik Seviye Sistemi:
 * - Sistemdeki ilk toplantı tarihini baz alarak max puan hesaplanır
 * - Seviyeler max puana göre yüzdelik olarak belirlenir:
 *   - 95-100%: Platinyum (5 yıldız)
 *   - 80-95%: Gold (4 yıldız)
 *   - 50-80%: Gümüş (3 yıldız)
 *   - 20-50%: Bronz (2 yıldız)
 *   - 0-20%: Pasif Üye (1 yıldız)
 */

/**
 * Performans puanı ayarlarını Firebase'den yükle
 * @returns {Promise<Object>} Performans puanı ayarları
 */
let cachedSettings = null;
let settingsLoadPromise = null;

export const loadPerformanceScoreSettings = async () => {
  // Cache varsa direkt döndür
  if (cachedSettings) {
    return cachedSettings;
  }
  
  // Zaten yükleniyorsa promise'i döndür
  if (settingsLoadPromise) {
    return settingsLoadPromise;
  }
  
  // Yükleme promise'i oluştur
  settingsLoadPromise = (async () => {
    try {
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        const FirebaseService = (await import('./FirebaseService')).default;
        try {
          const configDoc = await FirebaseService.getById('performance_score_config', 'main', false);
          if (configDoc) {
            cachedSettings = {
              meetingAttendancePoints: configDoc.meetingAttendancePoints || 10,
              eventAttendancePoints: configDoc.eventAttendancePoints || 10,
              absencePenalty: configDoc.absencePenalty || -5,
              memberRegistrationPoints: configDoc.memberRegistrationPoints || 5,
              perfectMeetingBonus: configDoc.perfectMeetingBonus || 50,
              perfectEventBonus: configDoc.perfectEventBonus || 50
            };
            return cachedSettings;
          }
        } catch (error) {
          console.warn('Performance score config not found, using defaults:', error);
        }
      }
      
      // Varsayılan değerler
      cachedSettings = {
        meetingAttendancePoints: 10,
        eventAttendancePoints: 10,
        absencePenalty: -5,
        memberRegistrationPoints: 5,
        perfectMeetingBonus: 50,
        perfectEventBonus: 50
      };
      return cachedSettings;
    } catch (error) {
      console.error('Error loading performance score settings:', error);
      // Hata durumunda varsayılan değerler
      cachedSettings = {
        meetingAttendancePoints: 10,
        eventAttendancePoints: 10,
        absencePenalty: -5,
        memberRegistrationPoints: 5,
        perfectMeetingBonus: 50,
        perfectEventBonus: 50
      };
      return cachedSettings;
    } finally {
      settingsLoadPromise = null;
    }
  })();
  
  return settingsLoadPromise;
};

/**
 * Cache'i temizle (ayarlar güncellendiğinde çağrılmalı)
 */
export const clearPerformanceScoreSettingsCache = () => {
  cachedSettings = null;
  settingsLoadPromise = null;
};

/**
 * Üye performans puanını hesapla
 * @param {Object} member - Üye objesi
 * @param {Array} meetings - Tüm toplantılar
 * @param {Array} events - Tüm etkinlikler
 * @param {Array} memberRegistrations - Üye kayıtları (registrar bilgisi ile)
 * @param {Object} options - Hesaplama seçenekleri
 * @returns {Promise<Object>} Performans puanı ve detayları
 */
export const calculatePerformanceScore = async (member, meetings, events, memberRegistrations = [], options = {}) => {
  const {
    includeBonus = true,
    timeRange = 'all', // 'all', '3months', '6months'
    weightRecent = false // Son 3 ayın katılımları 1.5x
  } = options;
  
  // Performans puanı ayarlarını yükle
  const settings = await loadPerformanceScoreSettings();

  const memberId = String(member.id);
  const now = new Date();
  let startDate = null;

  // Zaman aralığı belirleme
  if (timeRange === '3months') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  } else if (timeRange === '6months') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  }

  // Tarih filtreleme fonksiyonu
  const isInRange = (dateStr) => {
    if (!startDate || !dateStr) return true;
    try {
      let date;
      if (typeof dateStr === 'string') {
        if (dateStr.includes('T')) {
          date = new Date(dateStr);
        } else if (dateStr.includes('.')) {
          const [day, month, year] = dateStr.split('.');
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateStr);
        }
      } else {
        date = new Date(dateStr);
      }
      return date >= startDate;
    } catch (e) {
      return true;
    }
  };

  let totalScore = 0;
  const details = {
    meetingAttendance: 0,
    meetingAbsence: 0,
    meetingExcused: 0,
    eventAttendance: 0,
    memberRegistrations: 0,
    bonuses: {
      perfectMeetingAttendance: 0,
      perfectEventAttendance: 0,
      perfectMeetingMonths: 0,
      perfectEventMonths: 0
    },
    breakdown: {
      meetingPoints: 0,
      eventPoints: 0,
      absencePenalty: 0,
      registrationPoints: 0,
      bonusPoints: 0
    }
  };

  // Toplantı katılımları
  let recentMeetingCount = 0;
  let recentAttendedCount = 0;
  const monthlyMeetings = {};

  meetings.forEach(meeting => {
    if (!isInRange(meeting.date)) return;

    const attendee = meeting.attendees?.find(att => {
      const attId = String(att.memberId || att.member_id);
      return attId === memberId;
    });

    if (attendee) {
      recentMeetingCount++;
      
      // Tarih parse et
      let meetingDate;
      try {
        if (typeof meeting.date === 'string') {
          if (meeting.date.includes('T')) {
            meetingDate = new Date(meeting.date);
          } else if (meeting.date.includes('.')) {
            const [day, month, year] = meeting.date.split('.');
            meetingDate = new Date(year, month - 1, day);
          } else {
            meetingDate = new Date(meeting.date);
          }
        } else {
          meetingDate = new Date(meeting.date);
        }
      } catch (e) {
        return;
      }

      // Aylık toplantı sayısını takip et
      if (meetingDate && !isNaN(meetingDate.getTime())) {
        const monthKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyMeetings[monthKey] = (monthlyMeetings[monthKey] || 0) + 1;
      }

      if (attendee.attended) {
        details.meetingAttendance++;
        recentAttendedCount++;
        
        // Puan hesapla (ayarlardan al, ağırlıklandırma varsa)
        const basePoints = settings.meetingAttendancePoints;
        const points = weightRecent && isRecent(meeting.date) ? basePoints * 1.5 : basePoints;
        details.breakdown.meetingPoints += points;
        totalScore += points;
      } else {
        // Mazeret kontrolü
        const hasExcuse = attendee.excuse?.hasExcuse || false;
        if (hasExcuse) {
          details.meetingExcused++;
          // Mazeretli katılmama: 0 puan (ceza yok)
        } else {
          details.meetingAbsence++;
          // Mazeretsiz katılmama: ayarlardan alınan ceza puanı
          const penalty = settings.absencePenalty;
          details.breakdown.absencePenalty += penalty;
          totalScore += penalty;
        }
      }
    }
  });

  // Etkinlik katılımları
  events.forEach(event => {
    if (!isInRange(event.date)) return;

    const attendee = event.attendees?.find(att => {
      const attId = String(att.memberId || att.member_id);
      return attId === memberId;
    });

    if (attendee && attendee.attended) {
      details.eventAttendance++;
      
      // Puan hesapla (ayarlardan al, ağırlıklandırma varsa)
      const basePoints = settings.eventAttendancePoints;
      const points = weightRecent && isRecent(event.date) ? basePoints * 1.5 : basePoints;
      details.breakdown.eventPoints += points;
      totalScore += points;
    }
  });

  // Üye kayıtları
  const registrations = memberRegistrations.filter(reg => {
    const regMemberId = String(reg.memberId || reg.registrar_id || reg.created_by);
    return regMemberId === memberId;
  });

  details.memberRegistrations = registrations.length;
  const registrationPoints = registrations.length * settings.memberRegistrationPoints;
  details.breakdown.registrationPoints = registrationPoints;
  totalScore += registrationPoints;

  // Bonus puanlar (Ay bazlı %100 katılım)
  if (includeBonus) {
    // Aylık toplantı ve etkinlik katılımlarını grupla
    const monthlyMeetingAttendance = {}; // { '2024-01': { total: 5, attended: 5 } }
    const monthlyEventAttendance = {}; // { '2024-01': { total: 3, attended: 3 } }

    // Toplantı katılımlarını aylara göre grupla
    meetings.forEach(meeting => {
      if (!isInRange(meeting.date)) return;
      
      const attendee = meeting.attendees?.find(att => {
        const attId = String(att.memberId || att.member_id);
        return attId === memberId;
      });
      
      if (!attendee) return; // Üye bu toplantıya davet edilmemiş
      
      try {
        let meetingDate;
        if (typeof meeting.date === 'string') {
          if (meeting.date.includes('T')) {
            meetingDate = new Date(meeting.date);
          } else if (meeting.date.includes('.')) {
            const [day, month, year] = meeting.date.split('.');
            meetingDate = new Date(year, month - 1, day);
          } else {
            meetingDate = new Date(meeting.date);
          }
        } else {
          meetingDate = new Date(meeting.date);
        }
        
        if (meetingDate && !isNaN(meetingDate.getTime())) {
          const monthKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyMeetingAttendance[monthKey]) {
            monthlyMeetingAttendance[monthKey] = { total: 0, attended: 0 };
          }
          
          monthlyMeetingAttendance[monthKey].total++;
          if (attendee.attended) {
            monthlyMeetingAttendance[monthKey].attended++;
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Etkinlik katılımlarını aylara göre grupla
    events.forEach(event => {
      if (!isInRange(event.date)) return;
      
      const attendee = event.attendees?.find(att => {
        const attId = String(att.memberId || att.member_id);
        return attId === memberId;
      });
      
      if (!attendee) return; // Üye bu etkinliğe davet edilmemiş
      
      try {
        let eventDate;
        if (typeof event.date === 'string') {
          if (event.date.includes('T')) {
            eventDate = new Date(event.date);
          } else if (event.date.includes('.')) {
            const [day, month, year] = event.date.split('.');
            eventDate = new Date(year, month - 1, day);
          } else {
            eventDate = new Date(event.date);
          }
        } else {
          eventDate = new Date(event.date);
        }
        
        if (eventDate && !isNaN(eventDate.getTime())) {
          const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyEventAttendance[monthKey]) {
            monthlyEventAttendance[monthKey] = { total: 0, attended: 0 };
          }
          
          monthlyEventAttendance[monthKey].total++;
          if (attendee.attended) {
            monthlyEventAttendance[monthKey].attended++;
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Ay bazlı %100 katılım bonusları
    let perfectMeetingMonths = 0;
    let perfectEventMonths = 0;

    // Tüm toplantılara katılım bonusu (ay bazlı)
    Object.keys(monthlyMeetingAttendance).forEach(monthKey => {
      const monthData = monthlyMeetingAttendance[monthKey];
      // O ay en az 1 toplantı varsa ve hepsine katılmışsa
      if (monthData.total > 0 && monthData.attended === monthData.total) {
        perfectMeetingMonths++;
      }
    });

    // Tüm etkinliklere katılım bonusu (ay bazlı)
    Object.keys(monthlyEventAttendance).forEach(monthKey => {
      const monthData = monthlyEventAttendance[monthKey];
      // O ay en az 1 etkinlik varsa ve hepsine katılmışsa
      if (monthData.total > 0 && monthData.attended === monthData.total) {
        perfectEventMonths++;
      }
    });

    // Bonus puanları hesapla (ayarlardan al)
    const meetingBonus = perfectMeetingMonths * settings.perfectMeetingBonus;
    const eventBonus = perfectEventMonths * settings.perfectEventBonus;

    if (meetingBonus > 0) {
      details.bonuses.perfectMeetingAttendance = meetingBonus;
      details.breakdown.bonusPoints += meetingBonus;
      totalScore += meetingBonus;
    }

    if (eventBonus > 0) {
      details.bonuses.perfectEventAttendance = eventBonus;
      details.breakdown.bonusPoints += eventBonus;
      totalScore += eventBonus;
    }

    // Bonus detaylarını güncelle
    details.bonuses.perfectMeetingMonths = perfectMeetingMonths;
    details.bonuses.perfectEventMonths = perfectEventMonths;
  }

  return {
    totalScore: Math.round(totalScore),
    details,
    timeRange
  };
};

/**
 * Tarihin son 3 ay içinde olup olmadığını kontrol et
 */
const isRecent = (dateStr) => {
  if (!dateStr) return false;
  try {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    
    let date;
    if (typeof dateStr === 'string') {
      if (dateStr.includes('T')) {
        date = new Date(dateStr);
      } else if (dateStr.includes('.')) {
        const [day, month, year] = dateStr.split('.');
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateStr);
    }
    
    return date >= threeMonthsAgo;
  } catch (e) {
    return false;
  }
};

/**
 * Sistemdeki ilk toplantı tarihini bul
 */
const findFirstMeetingDate = (meetings) => {
  if (!meetings || meetings.length === 0) return null;
  
  let firstDate = null;
  meetings.forEach(meeting => {
    if (!meeting.date) return;
    
    try {
      let date;
      if (typeof meeting.date === 'string') {
        if (meeting.date.includes('T')) {
          date = new Date(meeting.date);
        } else if (meeting.date.includes('.')) {
          const [day, month, year] = meeting.date.split('.');
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(meeting.date);
        }
      } else {
        date = new Date(meeting.date);
      }
      
      if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
        if (!firstDate || date < firstDate) {
          firstDate = date;
        }
      }
    } catch (e) {
      // Skip invalid dates
    }
  });
  
  return firstDate;
};

/**
 * Tarih parse helper
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    let date;
    if (typeof dateStr === 'string') {
      if (dateStr.includes('T')) {
        date = new Date(dateStr);
      } else if (dateStr.includes('.')) {
        const [day, month, year] = dateStr.split('.');
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateStr);
    }
    if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
      return date;
    }
  } catch (e) {
    // Invalid date
  }
  return null;
};

/**
 * Maksimum puanı hesapla (tüm toplantılara katılım + tüm etkinliklere katılım + aylık 3 üye kaydı + bonus puanlar)
 */
const calculateMaxScore = (meetings, events, firstMeetingDate, settings = null) => {
  // Varsayılan ayarlar (eğer settings yoksa)
  const defaultSettings = {
    meetingAttendancePoints: 10,
    eventAttendancePoints: 10,
    memberRegistrationPoints: 5,
    perfectMeetingBonus: 50,
    perfectEventBonus: 50
  };
  const scoreSettings = settings || defaultSettings;
  if (!firstMeetingDate) return 1000; // Default max score if no meetings
  
  const now = new Date();
  
  // İlk toplantı tarihinden sonraki toplantı ve etkinlikleri filtrele
  const meetingsAfterFirst = meetings.filter(meeting => {
    const meetingDate = parseDate(meeting.date);
    return meetingDate && meetingDate >= firstMeetingDate;
  });
  
  const eventsAfterFirst = events.filter(event => {
    const eventDate = parseDate(event.date);
    return eventDate && eventDate >= firstMeetingDate;
  });
  
  // Ay sayısını doğru hesapla (yıl ve ay farkı)
  const startYear = firstMeetingDate.getFullYear();
  const startMonth = firstMeetingDate.getMonth();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  
  // Yıl ve ay farkını hesapla
  let monthsSinceFirst = (endYear - startYear) * 12 + (endMonth - startMonth);
  
  // Eğer bugün ayın ilk gününden sonra ise, o ayı da say
  if (now.getDate() >= firstMeetingDate.getDate()) {
    monthsSinceFirst += 1;
  }
  
  monthsSinceFirst = Math.max(1, monthsSinceFirst); // En az 1 ay
  
  // Toplantı puanları (ilk toplantı tarihinden sonraki toplantılar)
  const meetingPoints = meetingsAfterFirst.length * scoreSettings.meetingAttendancePoints;
  
  // Etkinlik puanları (ilk toplantı tarihinden sonraki etkinlikler)
  const eventPoints = eventsAfterFirst.length * scoreSettings.eventAttendancePoints;
  
  // Üye kayıt puanları (aylık 3 üye * memberRegistrationPoints puan)
  const registrationPoints = monthsSinceFirst * 3 * scoreSettings.memberRegistrationPoints; // Aylık 3 üye
  
  // Bonus puanlar (her ay için mükemmel katılım)
  // Her ay tüm toplantılara katılım bonusu (ayarlardan)
  const meetingBonus = monthsSinceFirst * scoreSettings.perfectMeetingBonus;
  
  // Her ay tüm etkinliklere katılım bonusu (ayarlardan)
  const eventBonus = monthsSinceFirst * scoreSettings.perfectEventBonus;
  
  return meetingPoints + eventPoints + registrationPoints + meetingBonus + eventBonus;
};

/**
 * Seviye belirleme (max puana göre yüzdelik)
 * Manuel yıldız ile performans yıldızının ortalamasını alır
 */
const determineLevel = (score, maxScore, manualStars = null) => {
  if (maxScore === 0) {
    // Manuel yıldız varsa onu kullan, yoksa 1 yıldız
    const finalStars = manualStars !== null ? manualStars : 1;
    return {
      level: 'Pasif Üye',
      levelColor: '#808080',
      stars: finalStars,
      performanceStars: 1,
      manualStars: manualStars,
      averageStars: finalStars,
      percentage: 0
    };
  }
  
  const percentage = (score / maxScore) * 100;
  
  // Performans puanına göre yıldız belirle
  let performanceStars = 1;
  let level = 'Pasif Üye';
  let levelColor = '#808080';
  
  if (percentage >= 95) {
    level = 'Platinyum';
    levelColor = '#E5E4E2';
    performanceStars = 5;
  } else if (percentage >= 80) {
    level = 'Gold';
    levelColor = '#FFD700';
    performanceStars = 4;
  } else if (percentage >= 50) {
    level = 'Gümüş';
    levelColor = '#C0C0C0';
    performanceStars = 3;
  } else if (percentage >= 20) {
    level = 'Bronz';
    levelColor = '#CD7F32';
    performanceStars = 2;
  } else {
    level = 'Pasif Üye';
    levelColor = '#808080';
    performanceStars = 1;
  }
  
  // Manuel yıldız varsa, performans yıldızı ile ortalamasını al
  let averageStars = performanceStars;
  if (manualStars !== null && manualStars !== undefined) {
    averageStars = Math.round((performanceStars + manualStars) / 2);
    // Ortalama yıldızı 1-5 arasında tut
    averageStars = Math.max(1, Math.min(5, averageStars));
  }
  
  return {
    level,
    levelColor,
    stars: averageStars, // Ortalama yıldızı göster
    performanceStars, // Performans yıldızı
    manualStars: manualStars !== null ? manualStars : null, // Manuel yıldız
    averageStars, // Ortalama yıldız
    percentage: Math.round(percentage)
  };
};

/**
 * Tüm üyeler için performans puanlarını hesapla ve sırala
 */
export const calculateAllMemberScores = async (members, meetings, events, memberRegistrations, options = {}) => {
  // İlk toplantı tarihini bul
  const firstMeetingDate = findFirstMeetingDate(meetings);
  
  // Performans puanı ayarlarını yükle (max score hesaplaması için)
  const settings = await loadPerformanceScoreSettings();
  
  // Maksimum puanı hesapla (ayarlardan bonus puanları kullanarak)
  const maxScore = calculateMaxScore(meetings, events, firstMeetingDate, settings);
  
  // Her üye için puan hesapla ve seviye belirle
  const scores = await Promise.all(members.map(async (member) => {
    const score = await calculatePerformanceScore(member, meetings, events, memberRegistrations, options);
    // Manuel yıldızı member'dan al (manual_stars field'ı)
    const manualStars = member.manual_stars !== null && member.manual_stars !== undefined 
      ? parseInt(member.manual_stars) 
      : null;
    const levelInfo = determineLevel(score.totalScore, maxScore, manualStars);
    
    return {
      member,
      ...score,
      ...levelInfo,
      maxScore
    };
  }));
  
  return scores.sort((a, b) => b.totalScore - a.totalScore);
};

