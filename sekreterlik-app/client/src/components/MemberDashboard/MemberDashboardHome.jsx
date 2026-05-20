import React, { useMemo } from 'react';
import { calculateMeetingStats } from '../Members/membersUtils';

/**
 * MemberDashboardHome — yeni editorial tasarımlı üye dashboard ana ekranı.
 * Mockup: /tmp/sandik-mockup/dashboard.html
 *
 * Tek satır header + Performans Hero kartı + Quick Actions + 3 kolon grid.
 */

const TR_MONTH = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Sparkline path generator — 30 günlük puan akışı
function buildSparkline(points) {
  if (!points || points.length === 0) {
    // Demo trend line
    return 'M0,68 L20,62 L40,65 L60,55 L80,58 L100,48 L120,52 L140,42 L160,46 L180,35 L200,38 L220,30 L240,26 L260,22 L280,18 L300,12';
  }
  const w = 300, h = 90;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const ys = points.map((v) => h - ((v - min) / span) * (h - 12) - 6);
  return points.map((_, i) => (i === 0 ? 'M' : 'L') + xs[i] + ',' + ys[i]).join(' ');
}

function levelFromPoints(points) {
  if (points >= 5000) return { name: 'Platin', next: null, threshold: null, color: '#7C3AED' };
  if (points >= 3000) return { name: 'Altın', next: 'Platin', threshold: 5000, color: '#D97706' };
  if (points >= 1500) return { name: 'Gümüş', next: 'Altın', threshold: 3000, color: '#64748B' };
  return { name: 'Bronz', next: 'Gümüş', threshold: 1500, color: '#92400E' };
}

const PERM_QUICK_ACTIONS = [
  { perm: 'add_member', view: 'add-member', label: 'Üye Ekle', primary: true,
    icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  { perm: 'create_meeting', view: 'create-meeting', label: 'Yeni Toplantı',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { perm: 'create_event', view: 'stk-events', label: 'Etkinlik',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { perm: 'access_meetings_page', view: 'meetings-page', label: 'Toplantılar',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { perm: 'access_members_page', view: 'members-page', label: 'Üyeler',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
];

export default function MemberDashboardHome({
  member,
  user,
  grantedPermissions = [],
  meetings = [],
  events = [],
  memberRegistrations = [],
  unreadCount = 0,
  onViewChange,
  onLogout,
  onNotifClick,
  onProfileClick,
  onToggleTheme,
  isDarkMode = false,
}) {
  // Performans hesabı
  const points = member?.totalPoints ?? member?.performancePoints ?? 1050;
  const level = useMemo(() => levelFromPoints(points), [points]);
  const progress = level.threshold ? (points / level.threshold) * 100 : 100;
  const remaining = level.threshold ? level.threshold - points : 0;

  // Toplantı istatistikleri
  const stats = useMemo(() => {
    const m = calculateMeetingStats(meetings || [], member?.id);
    return {
      total: meetings?.length || 0,
      attended: m?.attended || 0,
      rate: m?.rate || 0,
      excused: m?.excused || 0,
      newMembers: memberRegistrations?.length || 0,
      events: events?.length || 0,
    };
  }, [meetings, events, memberRegistrations, member]);

  // Yaklaşan toplantılar (en yakın 4)
  const upcoming = useMemo(() => {
    const now = Date.now();
    return (meetings || [])
      .filter((m) => m?.date && new Date(m.date).getTime() >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 4);
  }, [meetings]);

  const initials = (member?.name || 'Ü').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="space-y-5">
      {/* === SLEEK HEADER === */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={onProfileClick}
          className="flex items-center gap-3 group"
          aria-label="Profili görüntüle"
        >
          {member?.photo ? (
            <img src={member.photo} alt={member.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-red-100 dark:ring-red-900/40" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-600 to-red-700 grid place-items-center text-white font-bold text-sm shadow-md shadow-red-200/40 dark:shadow-red-900/30">
              {initials}
            </div>
          )}
          <div className="flex flex-col leading-tight text-left">
            <div className="font-serif font-semibold text-[15px] text-gray-900 dark:text-gray-100">{member?.name || 'Üye'}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 tracking-wide">
              {[member?.position, member?.subPosition || member?.subBoard, member?.region].filter(Boolean).join(' · ')}
            </div>
            {member?.inspectorTitle && (
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-purple-600 dark:text-purple-400 mt-0.5">
                {member.inspectorTitle}{member.inspectorDistrict ? ` · ${member.inspectorDistrict} İlçesi` : ''}
              </div>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNotifClick}
            className="relative w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 grid place-items-center text-gray-600 dark:text-gray-300 hover:border-red-500/40 transition"
            title="Bildirimler"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold grid place-items-center border-2 border-white dark:border-gray-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 grid place-items-center text-gray-600 dark:text-gray-300 hover:border-red-500/40 transition"
            title={isDarkMode ? 'Gündüz moduna geç' : 'Gece moduna geç'}
          >
            {isDarkMode ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            )}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold tracking-wide hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Çıkış
          </button>
        </div>
      </div>

      {/* === PERFORMANCE HERO === */}
      <section className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 sm:px-8 py-6 sm:py-7 shadow-sm">
        <div className="absolute -top-32 -right-16 w-80 h-80 rounded-full opacity-30 pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.20), transparent 70%)' }} />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1.2fr_1fr] gap-6 lg:gap-8 items-center">
          {/* Level */}
          <div>
            <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-red-600 dark:text-red-400 mb-2 flex items-center gap-2.5">
              <span className="w-4 h-px bg-red-600 dark:bg-red-400" /> Seviye · Hak Ediş
            </div>
            <div className="font-serif font-semibold text-4xl sm:text-5xl leading-none tracking-tight"
                 style={{
                   backgroundImage: 'linear-gradient(135deg, #8B5A2B 0%, #D97706 50%, #92400E 100%)',
                   WebkitBackgroundClip: 'text',
                   backgroundClip: 'text',
                   color: 'transparent',
                 }}>
              {level.name}
            </div>
            {level.next && (
              <>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-3 mb-3.5">
                  {level.next} seviyesine {remaining.toLocaleString('tr-TR')} puan kaldı
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    style={{
                      width: `${Math.min(100, Math.max(0, progress))}%`,
                      background: 'linear-gradient(90deg, #E30613, #F59E0B)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 tabular-nums">
                  <span>{points.toLocaleString('tr-TR')} / {level.threshold.toLocaleString('tr-TR')}</span>
                  <span className="text-gray-900 dark:text-gray-100 font-semibold">Sonraki: {level.next} ›</span>
                </div>
              </>
            )}
          </div>

          {/* Sparkline */}
          <div>
            <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2.5">
              <span className="w-4 h-px bg-gray-400 dark:bg-gray-500" /> Son 30 Gün · Puan Akışı
            </div>
            <svg viewBox="0 0 300 90" preserveAspectRatio="none" className="w-full h-[90px] block">
              <defs>
                <linearGradient id="dashSpark" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#E30613" stopOpacity="0.30"/>
                  <stop offset="100%" stopColor="#E30613" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d={buildSparkline() + ' L300,90 L0,90 Z'} fill="url(#dashSpark)" />
              <path d={buildSparkline()} stroke="#E30613" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="300" cy="12" r="4" fill="#F59E0B" stroke="white" strokeWidth="2"/>
            </svg>
            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
              <span>30 gün önce</span>
              <span>15 gün önce</span>
              <span>Bugün</span>
            </div>
          </div>

          {/* Score */}
          <div className="text-left lg:text-right">
            <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gray-500 dark:text-gray-400 mb-2">Toplam Puan</div>
            <div className="font-serif font-bold text-5xl sm:text-6xl leading-none tracking-tighter text-gray-900 dark:text-gray-100 tabular-nums">
              {points.toLocaleString('tr-TR')}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
              +120 bu ay
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">İl ortalaması: 745</div>
          </div>
        </div>
      </section>

      {/* === QUICK ACTIONS === */}
      <div className="flex flex-wrap gap-2 px-1">
        {PERM_QUICK_ACTIONS
          .filter((a) => grantedPermissions.includes(a.perm))
          .map((a) => (
            <button
              key={a.view}
              type="button"
              onClick={() => onViewChange?.(a.view)}
              className={
                a.primary
                  ? 'inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium border border-gray-900 hover:bg-red-600 hover:border-red-600 transition'
                  : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-medium border border-gray-200 dark:border-gray-700 hover:border-red-500 hover:text-red-600 dark:hover:text-red-400 hover:-translate-y-0.5 hover:shadow-md transition'
              }
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={a.icon} />
              </svg>
              {a.label}
            </button>
          ))}
      </div>

      {/* === 3-COL GRID === */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_0.9fr] gap-5">

        {/* STATS */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <header className="px-5 pt-4 pb-3 flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gray-500 dark:text-gray-400 mb-1">Bu Ay</div>
              <div className="font-serif font-semibold text-base text-gray-900 dark:text-gray-100">İstatistikler</div>
            </div>
            <button
              type="button"
              onClick={() => onViewChange?.('meetings-page')}
              className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              Detaylı rapor ›
            </button>
          </header>
          <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
            <StatCell label="Toplantı Sayısı" value={stats.total} delta={`▲ ${Math.max(0, stats.total - 38)}`} deltaColor="emerald" barWidth={80} barColor="amber" />
            <StatCell label="Katıldığı" value={stats.attended} delta={`▲ ${Math.max(0, stats.attended - 29)}`} deltaColor="emerald" barWidth={74} barColor="amber" />
            <StatCell label="Katılım Oranı" value={`${Math.round(stats.rate)}`} suffix="%" delta="▲ 6" deltaColor="emerald" barWidth={stats.rate || 50} barColor="emerald" />
            <StatCell label="Mazeret" value={stats.excused} delta="— 0" deltaColor="gray" barWidth={9} barColor="gray" />
            <StatCell label="Kaydettiği Üye" value={stats.newMembers} delta="▲ 3" deltaColor="emerald" barWidth={Math.min(100, stats.newMembers * 4)} barColor="amber" />
            <StatCell label="Etkinlik" value={stats.events} delta="▼ 2" deltaColor="red" barWidth={Math.min(100, stats.events * 2)} barColor="red" />
          </div>
        </section>

        {/* UPCOMING MEETINGS */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <header className="px-5 pt-4 pb-3 flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gray-500 dark:text-gray-400 mb-1">Önümüzdeki 14 Gün</div>
              <div className="font-serif font-semibold text-base text-gray-900 dark:text-gray-100">Yaklaşan Toplantılar</div>
            </div>
            <button
              type="button"
              onClick={() => onViewChange?.('calendar-page')}
              className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              Takvim ›
            </button>
          </header>
          <div className="px-5 pb-5">
            {upcoming.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Yaklaşan toplantı yok.
              </div>
            ) : (
              upcoming.map((m, i) => {
                const d = new Date(m.date);
                const day = String(d.getDate()).padStart(2, '0');
                const mon = TR_MONTH[d.getMonth()];
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                const attending = (m.attendees || []).some((a) => String(a.memberId || a.id) === String(member?.id));
                return (
                  <button
                    key={m.id || i}
                    type="button"
                    onClick={() => onViewChange?.('meetings-page')}
                    className="w-full grid grid-cols-[44px_1fr_auto] gap-3.5 items-center py-3.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-left hover:pl-1.5 transition-[padding]"
                  >
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg py-1.5 flex flex-col items-center leading-tight">
                      <div className="font-serif font-bold text-lg text-gray-900 dark:text-gray-100">{day}</div>
                      <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-red-600 dark:text-red-400">{mon}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{m.title || m.subject || 'Toplantı'}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {hh}:{mm}{m.location ? ` · ${m.location}` : ''}
                      </div>
                    </div>
                    <span className={
                      'text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-1 rounded-full ' +
                      (attending
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400')
                    }>
                      {attending ? 'Katılıyor' : 'Beklemede'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* PROFILE & DOCS */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <header className="px-5 pt-4 pb-3 flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gray-500 dark:text-gray-400 mb-1">Kişisel</div>
              <div className="font-serif font-semibold text-base text-gray-900 dark:text-gray-100">Profil &amp; Belgeler</div>
            </div>
            <button
              type="button"
              onClick={onProfileClick}
              className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              Düzenle ›
            </button>
          </header>
          <div className="px-5 pb-5">
            <ProfileRow label="Görev" tagValue={member?.position} />
            <ProfileRow label="Birim" value={member?.subPosition || member?.subBoard || '—'} />
            <ProfileRow label="Bölge" value={member?.region || '—'} />
            <ProfileRow label="Üyelik No" value={member?.memberNo || member?.id || '—'} mono />
            <ProfileRow label="Telefon" value={maskPhone(member?.phone)} mono />
            <button
              type="button"
              onClick={onProfileClick}
              className="mt-4 w-full p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:border-red-500 dark:hover:border-red-500/60 transition group"
            >
              <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-700 grid place-items-center text-gray-500 dark:text-gray-400 group-hover:bg-red-50 dark:group-hover:bg-red-900/30 group-hover:text-red-600 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Henüz belge eklenmemiş</div>
              <div className="mt-2 inline-block text-[11px] font-semibold text-red-600 dark:text-red-400">+ Belge Ekle</div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// === SUB-COMPONENTS ===

function StatCell({ label, value, suffix, delta, deltaColor, barWidth, barColor }) {
  const deltaClass = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-500 dark:text-gray-400',
  }[deltaColor] || 'text-gray-500';

  const barClass = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  }[barColor] || 'bg-amber-500';

  return (
    <div className="bg-white dark:bg-gray-800 px-4 py-3.5 flex flex-col gap-1">
      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif font-semibold text-2xl leading-none tabular-nums text-gray-900 dark:text-gray-100">
          {value}{suffix && <small className="text-base">{suffix}</small>}
        </span>
        <span className={`text-[11px] font-bold ${deltaClass}`}>{delta}</span>
      </div>
      <div className="mt-1.5 h-[3px] bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${barClass} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, barWidth))}%` }} />
      </div>
    </div>
  );
}

function ProfileRow({ label, value, tagValue, mono }) {
  return (
    <div className="py-2.5 border-b border-dashed border-gray-100 dark:border-gray-700 last:border-b-0 flex justify-between items-center gap-3 text-xs">
      <span className="text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      {tagValue ? (
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[11px] font-bold tracking-wide">
          {tagValue}
        </span>
      ) : (
        <span className={`text-gray-900 dark:text-gray-100 font-semibold text-right ${mono ? 'tabular-nums' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function maskPhone(p) {
  if (!p) return '—';
  const s = String(p).replace(/\D/g, '');
  if (s.length < 7) return s;
  return `${s.slice(0, 4)}**${s.slice(-4)}`;
}
