import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPaginationPageNumbers } from '../utils/analytics';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemLabel: string;
  onPageChange: (nextPage: number) => void;
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  itemLabel,
  onPageChange,
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const pageNumbers = getPaginationPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
      <p className="text-xs text-slate-600">
        Showing{' '}
        <span className="font-mono font-semibold tabular-nums text-slate-900">
          {startIndex}–{endIndex}
        </span>{' '}
        of{' '}
        <span className="font-mono font-semibold tabular-nums text-slate-900">
          {totalItems}
        </span>{' '}
        {itemLabel}
      </p>

      <nav
        aria-label={`${itemLabel} pagination`}
        className="flex items-center gap-1 self-start sm:self-auto"
      >
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((entry, idx) =>
            entry === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-xs font-mono text-slate-400 select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                className={`min-w-[30px] rounded-lg px-2 py-1.5 text-xs font-mono font-medium tabular-nums transition-colors ${
                  entry === page
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {entry}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
