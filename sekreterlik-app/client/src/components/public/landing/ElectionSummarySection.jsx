import React from 'react';

/**
 * ElectionSummarySection — Kurumsal seffaflik.
 * Sol: ilk 5 parti/aday + yatay progress bar
 * Sag: 3 ozet kart (Toplam Sandik, Toplam Oy, Katilim %)
 * Alt: "Tum Sonuclari Gor" buton (id varsa)
 * electionResult null ise: placeholder kart ("Yaklasan secim sonuclari burada yayinlanacak")
 * Props: { electionResult }
 */

const BAR_COLORS = ['#16a34a', '#dc2626', '#2563eb', '#d97706', '#7c3aed'];

const formatTR = (n) => {
  if (n == null || isNaN(n)) return '-';
  return Number(n).toLocaleString('tr-TR');
};

const EmptyState = () => (
  <section
    id="election"
    className="w-full py-20 md:py-28 bg-white dark:bg-gray-950"
  >
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
          Seçim Sonuçları
        </p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
          Şeffaf ve Güvenilir Seçim Bilgileri
        </h2>
        <div className="mt-6 h-1 w-16 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
      </div>

      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-10 md:p-14 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary-700 dark:text-primary-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <h3 className="mt-5 text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
          Yaklaşan Seçim Sonuçları
        </h3>
        <p className="mt-3 text-base text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          Yaklaşan seçimin sonuçları ve detaylı sandık analizleri burada, şeffaf ve anlaşılır bir biçimde yayınlanacaktır.
        </p>
      </div>
    </div>
  </section>
);

const ElectionSummarySection = ({ electionResult }) => {
  if (!electionResult) return <EmptyState />;

  const {
    id,
    title,
    name,
    date,
    election_date,
    results,
    parties,
    candidates,
    total_ballot_boxes,
    totalBallotBoxes,
    total_votes,
    totalVotes: totalVotesField,
    participation,
    participation_rate,
  } = electionResult;

  const displayTitle = title || name || 'Seçim Sonucu';
  const displayDate = date || election_date || '';

  let rows = [];
  if (Array.isArray(results) && results.length > 0) rows = results;
  else if (Array.isArray(parties) && parties.length > 0) rows = parties;
  else if (Array.isArray(candidates) && candidates.length > 0) rows = candidates;

  rows = rows
    .map(r => ({
      name: r.name || r.party || r.candidate || 'Bilinmeyen',
      votes: Number(r.votes || r.vote_count || 0),
      percentage: r.percentage != null ? Number(r.percentage) : null,
      color: r.color || null,
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);

  const sumVotes = rows.reduce((s, r) => s + r.votes, 0);
  const totalBoxes = total_ballot_boxes ?? totalBallotBoxes ?? null;
  const totalVotesVal = total_votes ?? totalVotesField ?? (sumVotes > 0 ? sumVotes : null);
  const participationVal = participation ?? participation_rate ?? null;

  const formattedDate = (() => {
    if (!displayDate) return '';
    try {
      const d = new Date(displayDate);
      if (isNaN(d.getTime())) return displayDate;
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return displayDate;
    }
  })();

  return (
    <section
      id="election"
      className="w-full py-20 md:py-28 lg:py-32 bg-white dark:bg-gray-950"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Baslik */}
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-16">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary-700 dark:text-primary-400 mb-4">
            Seçim Sonuçları
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            {displayTitle}
          </h2>
          {formattedDate && (
            <p className="mt-4 text-base md:text-lg text-gray-500 dark:text-gray-400">
              {formattedDate}
            </p>
          )}
          <div className="mt-6 h-1 w-16 mx-auto bg-gradient-to-r from-primary-600 to-amber-500 rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sol: progress bar list */}
          <div className="lg:col-span-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 md:p-8 shadow-sm">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-700 dark:text-primary-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              İlk 5 Sıralama
            </h3>

            {rows.length > 0 ? (
              <ul className="space-y-5">
                {rows.map((r, idx) => {
                  const pct = r.percentage != null
                    ? r.percentage
                    : (sumVotes > 0 ? (r.votes / sumVotes) * 100 : 0);
                  const barColor = r.color || BAR_COLORS[idx % BAR_COLORS.length];

                  return (
                    <li key={idx}>
                      <div className="flex items-baseline justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-gray-400 tabular-nums w-5">
                            #{idx + 1}
                          </span>
                          <span className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">
                            {r.name}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 shrink-0">
                          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                            {r.votes > 0 ? formatTR(r.votes) : ''}
                          </span>
                          <span className="text-base md:text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                            %{pct.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Henüz detaylı veri girilmemiş.
              </p>
            )}
          </div>

          {/* Sag: ozet kartlar */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            <SummaryCard
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              label="Toplam Sandık"
              value={totalBoxes != null ? formatTR(totalBoxes) : '—'}
            />
            <SummaryCard
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              label="Toplam Oy"
              value={totalVotesVal != null ? formatTR(totalVotesVal) : '—'}
            />
            <SummaryCard
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
              label="Katılım"
              value={participationVal != null ? `%${Number(participationVal).toFixed(1)}` : '—'}
              highlight
            />
          </div>
        </div>

        {id && (
          <div className="mt-10 text-center">
            <a
              href={`/public/election-results/${id}`}
              className="inline-flex items-center min-h-[48px] px-6 py-3 rounded-md bg-primary-700 hover:bg-primary-800 active:scale-95 text-white text-sm font-semibold shadow-sm transition-all"
            >
              Tüm Sonuçları Gör
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

const SummaryCard = ({ icon, label, value, highlight = false }) => (
  <div
    className={`rounded-2xl p-5 md:p-6 border transition-colors ${
      highlight
        ? 'bg-gradient-to-br from-primary-700 to-primary-900 border-primary-700 text-white shadow-lg'
        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
    }`}
  >
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        highlight
          ? 'bg-white/15 text-white'
          : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400'
      }`}
    >
      {icon}
    </div>
    <p
      className={`mt-4 text-xs font-semibold uppercase tracking-wider ${
        highlight ? 'text-white/70' : 'text-gray-500 dark:text-gray-500'
      }`}
    >
      {label}
    </p>
    <p
      className={`mt-1 text-2xl md:text-3xl font-bold tabular-nums ${
        highlight ? 'text-white' : 'text-gray-900 dark:text-white'
      }`}
    >
      {value}
    </p>
  </div>
);

export default ElectionSummarySection;
