/**
 * Üye Performans Puanı Hesaplama Sistemi
 * 
 * Puan Kriterleri:
 * - Katıldığı toplantı başına: +10 puan
 * - Katıldığı etkinlik başına: +10 puan
 * - Mazeretsiz katılmadığı toplantı için: -5 puan
 * - Mazeretli katılmadığı toplantı için: 0 puan (ceza yok)
 * - Kaydettiği üye başına: +5 puan
 * 
 * Bonus Puanlar (Ay Sonu):
 * - O ay tüm toplantılara katılmışsa: +200 puan/ay
 * - O ay tüm etkinliklere katılmışsa: +100 puan/ay
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
 * Üye performans puanını hesapla
 * @param {Object} member - Üye objesi
 * @param {Array} meetings - Tüm toplantılar
 * @param {Array} events - Tüm etkinlikler
 * @param {Array} memberRegistrations - Üye kayıtları (registrar bilgisi ile)
 * @param {Object} options - Hesaplama seçenekleri
 * @returns {Object} Performans puanı ve detayları
 */
export const calculatePerformanceScore = (member, meetings, events, memberRegistrations = [], options = {}) => {
  const {
    includeBonus = true,
    timeRange = 'all', // 'all', '3months', '6months'
    weightRecent = false // Son 3 ayın katılımları 1.5x
  } = options;

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
        
        // Puan hesapla (ağırlıklandırma varsa)
        const basePoints = 10;
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
          // Mazeretsiz katılmama: -5 puan
          const penalty = -5;
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
      
      // Puan hesapla (ağırlıklandırma varsa)
      const basePoints = 10;
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
  const registrationPoints = registrations.length * 5;
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

    // Bonus puanları hesapla
    const meetingBonus = perfectMeetingMonths * 200;
    const eventBonus = perfectEventMonths * 100;

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
 * Maksimum puanı hesapla (tüm toplantılara katılım + tüm etkinliklere katılım + aylık 3 üye kaydı + bonus puanlar)
 */
const calculateMaxScore = (meetings, events, firstMeetingDate) => {
  if (!firstMeetingDate) return 1000; // Default max score if no meetings
  
  const now = new Date();
  
  // Gerçek ay sayısını hesapla (tarih farkından)
  let monthsSinceFirst = 0;
  const startYear = firstMeetingDate.getFullYear();
  const startMonth = firstMeetingDate.getMonth();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  
  // Yıl ve ay farkını hesapla
  monthsSinceFirst = (endYear - startYear) * 12 + (endMonth - startMonth);
  
  // Eğer bugün ayın ilk gününden sonra ise, o ayı da say
  if (now.getDate() >= firstMeetingDate.getDate()) {
    monthsSinceFirst += 1;
  }
  
  monthsSinceFirst = Math.max(1, monthsSinceFirst); // En az 1 ay
  
  // Toplantı puanları (her toplantı +10)
  const meetingPoints = meetings.length * 10;
  
  // Etkinlik puanları (her etkinlik +10)
  const eventPoints = events.length * 10;
  
  // Üye kayıt puanları (aylık 3 üye * 5 puan = 15 puan/ay)
  const registrationPoints = monthsSinceFirst * 15; // Aylık 3 üye * 5 puan
  
  // Bonus puanlar (her ay için mükemmel katılım)
  // Her ay tüm toplantılara katılım bonusu: +200 puan/ay
  const meetingBonus = monthsSinceFirst * 200;
  
  // Her ay tüm etkinliklere katılım bonusu: +100 puan/ay
  const eventBonus = monthsSinceFirst * 100;
  
  return meetingPoints + eventPoints + registrationPoints + meetingBonus + eventBonus;
};

/**
 * Seviye belirleme (max puana göre yüzdelik)
 */
const determineLevel = (score, maxScore) => {
  if (maxScore === 0) {
    return {
      level: 'Pasif Üye',
      levelColor: '#808080',
      stars: 1,
      percentage: 0
    };
  }
  
  const percentage = (score / maxScore) * 100;
  
  if (percentage >= 95) {
    return {
      level: 'Platinyum',
      levelColor: '#E5E4E2',
      stars: 5,
      percentage: Math.round(percentage)
    };
  } else if (percentage >= 80) {
    return {
      level: 'Gold',
      levelColor: '#FFD700',
      stars: 4,
      percentage: Math.round(percentage)
    };
  } else if (percentage >= 50) {
    return {
      level: 'Gümüş',
      levelColor: '#C0C0C0',
      stars: 3,
      percentage: Math.round(percentage)
    };
  } else if (percentage >= 20) {
    return {
      level: 'Bronz',
      levelColor: '#CD7F32',
      stars: 2,
      percentage: Math.round(percentage)
    };
  } else {
    return {
      level: 'Pasif Üye',
      levelColor: '#808080',
      stars: 1,
      percentage: Math.round(percentage)
    };
  }
};

/**
 * Tüm üyeler için performans puanlarını hesapla ve sırala
 */
export const calculateAllMemberScores = (members, meetings, events, memberRegistrations, options = {}) => {
  // İlk toplantı tarihini bul
  const firstMeetingDate = findFirstMeetingDate(meetings);
  
  // Maksimum puanı hesapla
  const maxScore = calculateMaxScore(meetings, events, firstMeetingDate);
  
  // Her üye için puan hesapla ve seviye belirle
  return members.map(member => {
    const score = calculatePerformanceScore(member, meetings, events, memberRegistrations, options);
    const levelInfo = determineLevel(score.totalScore, maxScore);
    
    return {
      member,
      ...score,
      ...levelInfo,
      maxScore
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
};

