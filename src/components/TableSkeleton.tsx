export function TableSkeleton({
  rows = 5,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-busy="true"
      aria-label="Loading table data"
    >
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, idx) => (
            <div
              key={idx}
              className="h-3.5 rounded bg-slate-200 animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="grid gap-4 px-4 py-3.5 items-center"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, colIdx) => (
              <div
                key={colIdx}
                className={`h-4 rounded bg-slate-100 animate-pulse ${
                  colIdx === 0 ? 'w-20' : colIdx === columns - 1 ? 'w-16 ml-auto' : 'w-full'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
