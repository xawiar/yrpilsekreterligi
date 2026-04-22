import React from 'react';

/**
 * ElectionSummarySection
 * Tek bir secim sonucunun ozetini (en yuksek 3-5 parti/aday) gosterir.
 * Props: { electionResult }
 * electionResult yoksa null doner.
 */
const ElectionSummarySection = ({ electionResult }) => {
  if (!electionResult) return null;

  const {
    id,
    title,
    name,
    date,
    election_date,
    results,
    parties,
    candidates,
  } = electionResult;

  const displayTitle = title || name || 'Secim Sonucu';
  const displayDate = date || election_date || '';

  // Farkli veri sekillerini normalize et:
  //   results: [{name, votes, percentage, color}]
  //   parties: [{name, votes}]
  //   candidates: [{name, votes}]
  let rows = [];
  if (Array.isArray(results) && results.length > 0) rows = results;
  else if (Array.isArray(parties) && parties.length > 0) rows = parties;
  else if (Array.isArray(candidates) && candidates.length > 0) rows = candidates;

  // En yuksek oy sirala, ilk 5
  rows = rows
    .map(r => ({
      name: r.name || r.party || r.candidate || 'Bilinmeyen',
      votes: Number(r.votes || r.vote_count || 0),
      percentage: r.percentage != null ? Number(r.percentage) : null,
      color: r.color || null,
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);

  const totalVotes = rows.reduce((s, r) => s + r.votes, 0);

  // Eger hic satir yoksa bile baslik ile minimal goster
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
      className="w-full py-12 md:py-20 bg-white dark:bg-gray-900"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Secim Sonuclari Ozeti
          </h2>
          <div className="mt-3 w-16 h-1 bg-indigo-600 dark:bg-indigo-400 mx-auto rounded-full" />
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
              {displayTitle}
            </h3>
            {formattedDate && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formattedDate}
              </span>
            )}
          </div>

          {rows.length > 0 ? (
            <ul className="space-y-3">
              {rows.map((r, idx) => {
                const pct = r.percentage != null
                  ? r.percentage
                  : (totalVotes > 0 ? (r.votes / totalVotes) * 100 : 0);
                const barColor = r.color || ['#4f46e5', '#db2777', '#059669', '#d97706', '#0891b2'][idx % 5];

                return (
                  <li key={idx}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                        {r.name}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 tabular-nums shrink-0 ml-2">
                        {r.votes > 0 && `${r.votes.toLocaleString('tr-TR')} · `}
                        %{pct.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Henuz detayli veri girilmemis.
            </p>
          )}

          {id && (
            <div className="mt-6 text-center">
              <a
                href={`/public/election-results/${id}`}
                className="inline-flex items-center min-h-[44px] px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
              >
                Detaylari Gor
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ElectionSummarySection;
