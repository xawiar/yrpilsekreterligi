import React from 'react';

const shimmer = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

const Line = ({ width = 'w-full', height = 'h-4', className = '' }) => (
  <div className={`${shimmer} ${width} ${height} ${className}`} />
);

const Circle = ({ size = 'h-10 w-10', className = '' }) => (
  <div className={`${shimmer} rounded-full ${size} ${className}`} />
);

const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="overflow-hidden">
    {/* Header */}
    <div className="hidden md:grid gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Line key={i} width="w-3/4" height="h-3" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div
        key={rowIdx}
        className="grid gap-4 px-4 py-4 border-b border-gray-200 dark:border-gray-700 items-center"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }).map((_, colIdx) => (
          <Line key={colIdx} width={colIdx === 0 ? 'w-full' : 'w-2/3'} height="h-4" />
        ))}
      </div>
    ))}
  </div>
);

const CardSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Circle size="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Line width="w-3/4" height="h-4" />
            <Line width="w-1/2" height="h-3" />
          </div>
        </div>
        <Line width="w-full" height="h-3" />
        <Line width="w-2/3" height="h-3" />
      </div>
    ))}
  </div>
);

const ListSkeleton = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Circle size="h-8 w-8" />
        <div className="flex-1 space-y-2">
          <Line width="w-1/2" height="h-4" />
          <Line width="w-1/3" height="h-3" />
        </div>
      </div>
    ))}
  </div>
);

const StatsSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <Line width="w-1/2" height="h-3" />
        <Line width="w-1/3" height="h-8" />
      </div>
    ))}
  </div>
);

const FormSkeleton = ({ fields = 4 }) => (
  <div className="space-y-4">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-1.5">
        <Line width="w-1/4" height="h-3" />
        <Line width="w-full" height="h-10" className="rounded-md" />
      </div>
    ))}
    <Line width="w-32" height="h-10" className="rounded-md mt-4" />
  </div>
);

const LoadingSkeleton = ({ variant = 'table', 'aria-label': ariaLabel = 'Yükleniyor', ...props }) => {
  const content = (() => {
    switch (variant) {
      case 'table':
        return <TableSkeleton {...props} />;
      case 'card':
      case 'cards':
        return <CardSkeleton {...props} />;
      case 'list':
        return <ListSkeleton {...props} />;
      case 'stats':
        return <StatsSkeleton {...props} />;
      case 'form':
        return <FormSkeleton {...props} />;
      default:
        return <TableSkeleton {...props} />;
    }
  })();

  return (
    <div role="status" aria-label={ariaLabel}>
      {content}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
};

LoadingSkeleton.Table = TableSkeleton;
LoadingSkeleton.Card = CardSkeleton;
LoadingSkeleton.List = ListSkeleton;
LoadingSkeleton.Stats = StatsSkeleton;
LoadingSkeleton.Form = FormSkeleton;
LoadingSkeleton.Line = Line;
LoadingSkeleton.Circle = Circle;

export default LoadingSkeleton;
