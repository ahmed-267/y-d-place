import React, { useEffect, useState } from 'react';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type DataTablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

export function useTablePagination(
  totalItems: number,
  defaultPageSize = 10,
  resetKey?: string | number
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, resetKey]);

  const start = (page - 1) * pageSize;

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    start,
    end: start + pageSize,
    slice: <T,>(items: T[]) => items.slice(start, start + pageSize),
  };
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [...PAGE_SIZE_OPTIONS],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize) || 1);
  const [draftPage, setDraftPage] = useState(String(page));

  useEffect(() => {
    setDraftPage(String(page));
  }, [page]);

  const commitPage = () => {
    const n = parseInt(draftPage, 10);
    if (Number.isNaN(n)) {
      setDraftPage(String(page));
      return;
    }
    onPageChange(Math.min(totalPages, Math.max(1, n)));
  };

  if (totalItems === 0) return null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1 ${className}`}>
      <label className="flex items-center gap-2 text-xs font-bold text-bakery-brown/60">
        <span>Items per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-9 min-w-[4.5rem] px-2 rounded-lg border border-bakery-beige bg-white text-bakery-brown font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          className="h-9 w-9 rounded-lg border border-bakery-beige bg-white text-bakery-brown disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bakery-beige/50 flex items-center justify-center"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-9 w-9 rounded-lg border border-bakery-beige bg-white text-bakery-brown disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bakery-beige/50 flex items-center justify-center"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-bakery-brown">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={draftPage}
            onChange={(e) => setDraftPage(e.target.value)}
            onBlur={commitPage}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitPage();
              }
            }}
            className="h-9 w-12 text-center rounded-lg border border-bakery-beige bg-white font-bold outline-none focus:ring-2 focus:ring-bakery-caramel [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-bakery-brown/50">of {totalPages}</span>
        </div>

        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-9 w-9 rounded-lg border border-bakery-beige bg-white text-bakery-brown disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bakery-beige/50 flex items-center justify-center"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          aria-label="Last page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="h-9 w-9 rounded-lg border border-bakery-beige bg-white text-bakery-brown disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bakery-beige/50 flex items-center justify-center"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

/** @deprecated Prefer DataTablePagination — kept for gradual migration. */
export const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  t: (key: string) => string;
  pageSize?: number;
  totalItems?: number;
  onPageSizeChange?: (size: number) => void;
}> = ({ currentPage, totalPages, onPageChange, pageSize = 10, totalItems, onPageSizeChange }) => {
  const inferredTotal = totalItems ?? Math.max(0, totalPages * pageSize);
  return (
    <DataTablePagination
      page={currentPage}
      pageSize={pageSize}
      totalItems={inferredTotal}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange || (() => undefined)}
    />
  );
};
