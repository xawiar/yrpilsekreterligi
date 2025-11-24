/**
 * Gelişmiş Analiz Utility
 * Tahminleme, anomali tespiti, öneri motoru
 */

/**
 * Toplantı katılım tahmini
 * @param {Array} meetings - Geçmiş toplantılar
 * @param {Object} upcomingMeeting - Yaklaşan toplantı
 * @returns {Object} - Tahmin sonuçları
 */
export function predictMeetingAttendance(meetings, upcomingMeeting) {
  if (!meetings || meetings.length === 0) {
    return {
      predictedAttendance: 0,
      confidence: 0,
      factors: [],
      recommendation: 'Yeterli veri yok'
    };
  }

  // Son 5 toplantının ortalaması
  const recentMeetings = meetings
    .filter(m => m.attendees && m.attendees.length > 0)
    .slice(-5);

  if (recentMeetings.length === 0) {
    return {
      predictedAttendance: 0,
      confidence: 0,
      factors: [],
      recommendation: 'Yeterli veri yok'
    };
  }

  // Ortalama katılım oranı
  const avgAttendance = recentMeetings.reduce((sum, m) => {
    const attended = m.attendees.filter(a => a.attended === true).length;
    const total = m.attendees.length;
    return sum + (total > 0 ? (attended / total) * 100 : 0);
  }, 0) / recentMeetings.length;

  // Trend analizi
  const attendanceTrend = recentMeetings.map(m => {
    const attended = m.attendees.filter(a => a.attended === true).length;
    const total = m.attendees.length;
    return total > 0 ? (attended / total) * 100 : 0;
  });

  const trend = attendanceTrend.length > 1
    ? attendanceTrend[attendanceTrend.length - 1] - attendanceTrend[0]
    : 0;

  // Tahmin (trend'e göre ayarlama)
  const predictedAttendance = Math.max(0, Math.min(100, avgAttendance + (trend * 0.3)));

  // Güven skoru (daha fazla veri = daha yüksek güven)
  const confidence = Math.min(0.9, 0.5 + (recentMeetings.length / 10));

  // Faktörler
  const factors = [];
  if (trend > 5) {
    factors.push('Katılım trendi artış gösteriyor');
  } else if (trend < -5) {
    factors.push('Katılım trendi düşüş gösteriyor');
  }

  if (avgAttendance > 80) {
    factors.push('Yüksek ortalama katılım');
  } else if (avgAttendance < 50) {
    factors.push('Düşük ortalama katılım');
  }

  // Öneriler
  let recommendation = '';
  if (predictedAttendance < 50) {
    recommendation = 'Katılımı artırmak için üyelere hatırlatma yapılması önerilir';
  } else if (predictedAttendance > 80) {
    recommendation = 'Yüksek katılım bekleniyor, toplantı hazırlıkları yapılabilir';
  } else {
    recommendation = 'Normal katılım bekleniyor';
  }

  return {
    predictedAttendance: Math.round(predictedAttendance),
    confidence: Math.round(confidence * 100),
    factors,
    recommendation,
    trend: Math.round(trend * 10) / 10
  };
}

/**
 * Anomali tespiti (düşük katılım, eksik veri vb.)
 * @param {Object} siteData - Site verileri
 * @returns {Array} - Anomali listesi
 */
export function detectAnomalies(siteData) {
  const anomalies = [];

  // Toplantı katılım anomalileri
  if (siteData.meetings && siteData.meetings.length > 0) {
    const recentMeetings = siteData.meetings
      .filter(m => !m.archived && m.attendees && m.attendees.length > 0)
      .slice(-10);

    if (recentMeetings.length > 0) {
      const lowAttendanceMeetings = recentMeetings.filter(m => {
        const attended = m.attendees.filter(a => a.attended === true).length;
        const total = m.attendees.length;
        const rate = total > 0 ? (attended / total) * 100 : 0;
        return rate < 40; // %40'ın altı düşük
      });

      if (lowAttendanceMeetings.length > 0) {
        anomalies.push({
          type: 'low_attendance',
          severity: 'medium',
          message: `${lowAttendanceMeetings.length} toplantıda düşük katılım tespit edildi (%40'ın altı)`,
          count: lowAttendanceMeetings.length,
          recommendations: [
            'Toplantı öncesi hatırlatma yapılması',
            'Toplantı zamanlarının gözden geçirilmesi',
            'Üye geri bildirimlerinin alınması'
          ]
        });
      }
    }
  }

  // Eksik veri anomalileri
  if (siteData.members && siteData.members.length > 0) {
    const membersWithoutData = siteData.members.filter(m => {
      return !m.phone || !m.address || !m.region;
    });

    if (membersWithoutData.length > 0) {
      const percentage = (membersWithoutData.length / siteData.members.length) * 100;
      if (percentage > 10) {
        anomalies.push({
          type: 'missing_data',
          severity: 'low',
          message: `Üyelerin %${Math.round(percentage)}'inde eksik veri var`,
          count: membersWithoutData.length,
          recommendations: [
            'Eksik verilerin tamamlanması',
            'Veri girişi kontrolü yapılması'
          ]
        });
      }
    }
  }

  // Etkinlik anomalileri
  if (siteData.events && siteData.events.length > 0) {
    const recentEvents = siteData.events
      .filter(e => !e.archived)
      .slice(-10);

    const eventsWithoutAttendees = recentEvents.filter(e => 
      !e.attendees || e.attendees.length === 0
    );

    if (eventsWithoutAttendees.length > 0) {
      anomalies.push({
        type: 'missing_event_data',
        severity: 'low',
        message: `${eventsWithoutAttendees.length} etkinlikte katılımcı bilgisi yok`,
        count: eventsWithoutAttendees.length,
        recommendations: [
          'Etkinlik katılımcı bilgilerinin güncellenmesi'
        ]
      });
    }
  }

  // Seçim sonuç anomalileri
  if (siteData.elections && siteData.elections.length > 0 && siteData.electionResults) {
    siteData.elections.forEach(election => {
      const results = siteData.electionResults.filter(r => 
        String(r.election_id || r.electionId) === String(election.id)
      );
      const ballotBoxes = siteData.ballotBoxes || [];
      
      // Sonuç girilmemiş sandıklar
      const boxesWithoutResults = ballotBoxes.filter(box => {
        return !results.some(r => 
          String(r.ballot_box_id || r.ballotBoxId) === String(box.id)
        );
      });

      if (boxesWithoutResults.length > 0 && boxesWithoutResults.length > ballotBoxes.length * 0.2) {
        anomalies.push({
          type: 'missing_election_results',
          severity: 'high',
          message: `"${election.name}" seçiminde ${boxesWithoutResults.length} sandık için sonuç girilmemiş`,
          count: boxesWithoutResults.length,
          recommendations: [
            'Eksik seçim sonuçlarının girilmesi',
            'Sandık sorumlularına hatırlatma yapılması'
          ]
        });
      }
    });
  }

  return anomalies;
}

/**
 * Öneri motoru - Otomatik iyileştirme önerileri
 * @param {Object} siteData - Site verileri
 * @param {string} userRole - Kullanıcı rolü
 * @returns {Array} - Öneri listesi
 */
export function generateRecommendations(siteData, userRole) {
  const recommendations = [];

  // Toplantı önerileri
  if (siteData.meetings && siteData.meetings.length > 0) {
    const recentMeetings = siteData.meetings
      .filter(m => !m.archived)
      .slice(-5);

    if (recentMeetings.length > 0) {
      const avgAttendance = recentMeetings.reduce((sum, m) => {
        if (!m.attendees || m.attendees.length === 0) return sum;
        const attended = m.attendees.filter(a => a.attended === true).length;
        return sum + (attended / m.attendees.length) * 100;
      }, 0) / recentMeetings.length;

      if (avgAttendance < 60) {
        recommendations.push({
          type: 'meeting_improvement',
          priority: 'high',
          title: 'Toplantı Katılımını Artırma',
          description: `Ortalama katılım oranı %${Math.round(avgAttendance)}. Katılımı artırmak için:`,
          suggestions: [
            'Toplantı öncesi SMS/WhatsApp hatırlatması gönderin',
            'Toplantı zamanlarını üyelerin uygun olduğu saatlere ayarlayın',
            'Toplantı gündemini önceden paylaşın',
            'Mazeretli üyelerden geri bildirim alın'
          ]
        });
      }
    }
  }

  // Üye aktivite önerileri
  if (siteData.members && siteData.members.length > 0) {
    const inactiveMembers = siteData.members.filter(m => {
      // Son 30 günde toplantıya katılmamış üyeler
      if (!siteData.meetings) return false;
      const recentMeetings = siteData.meetings
        .filter(meeting => {
          const meetingDate = new Date(meeting.date?.split('.').reverse().join('-') || meeting.date);
          const daysDiff = (Date.now() - meetingDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 30 && daysDiff >= 0;
        });

      return !recentMeetings.some(meeting => 
        meeting.attendees?.some(a => 
          String(a.memberId) === String(m.id) && a.attended === true
        )
      );
    });

    if (inactiveMembers.length > siteData.members.length * 0.2) {
      recommendations.push({
        type: 'member_engagement',
        priority: 'medium',
        title: 'Pasif Üyeleri Aktifleştirme',
        description: `${inactiveMembers.length} üye son 30 günde toplantıya katılmamış.`,
        suggestions: [
          'Pasif üyelere kişisel iletişim kurun',
          'Yeni etkinlikler düzenleyin',
          'Üye geri bildirimlerini toplayın',
          'Görev ve sorumluluklar verin'
        ]
      });
    }
  }

  // Veri kalitesi önerileri
  if (siteData.members && siteData.members.length > 0) {
    const incompleteMembers = siteData.members.filter(m => 
      !m.phone || !m.address || !m.region
    );

    if (incompleteMembers.length > 0) {
      recommendations.push({
        type: 'data_quality',
        priority: 'low',
        title: 'Veri Tamamlama',
        description: `${incompleteMembers.length} üyenin eksik bilgisi var.`,
        suggestions: [
          'Eksik bilgileri tamamlayın',
          'Düzenli veri kontrolü yapın',
          'Üye bilgilerini güncel tutun'
        ]
      });
    }
  }

  return recommendations;
}

/**
 * Trend analizi
 * @param {Array} data - Zaman serisi verisi
 * @param {string} metric - Metrik adı
 * @returns {Object} - Trend analizi sonucu
 */
export function analyzeTrend(data, metric = 'value') {
  if (!data || data.length < 2) {
    return {
      trend: 'stable',
      change: 0,
      percentage: 0,
      message: 'Yeterli veri yok'
    };
  }

  const values = data.map(d => d[metric] || 0);
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = secondAvg - firstAvg;
  const percentage = firstAvg > 0 ? (change / firstAvg) * 100 : 0;

  let trend = 'stable';
  let message = '';

  if (percentage > 10) {
    trend = 'increasing';
    message = `%${Math.round(percentage)} artış var`;
  } else if (percentage < -10) {
    trend = 'decreasing';
    message = `%${Math.round(Math.abs(percentage))} azalış var`;
  } else {
    trend = 'stable';
    message = 'Değişiklik yok';
  }

  return {
    trend,
    change: Math.round(change * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
    message
  };
}

