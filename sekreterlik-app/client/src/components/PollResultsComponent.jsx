import React from 'react';

const PollResultsComponent = ({ results }) => {
  if (!results || !results.results) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        Sonuçlar yükleniyor...
      </div>
    );
  }

  const { totalVotes, results: pollResults } = results;

  return (
    <div className="space-y-4">
      <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {totalVotes}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Oy</p>
      </div>
      
      <div className="space-y-3">
        {pollResults.map((result, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {result.option}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {result.voteCount} oy ({result.percentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all"
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PollResultsComponent;

