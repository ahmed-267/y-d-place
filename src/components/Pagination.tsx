
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  t: (key: string) => string;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, t }) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);
      
      if (end === totalPages) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (start > 1) {
        if (start > 2) pages.unshift('...');
        pages.unshift(1);
      }
      
      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
      <p className="text-xs font-black uppercase tracking-widest text-bakery-brown/40">
        {t('page')} {currentPage} {t('of')} {totalPages}
      </p>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg bg-bakery-beige text-bakery-brown disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bakery-brown hover:text-white transition-all active:scale-90"
          title={t('previous')}
        >
          <ChevronLeft size={18} />
        </button>
        
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) => (
            <React.Fragment key={idx}>
              {page === '...' ? (
                <span className="px-2 text-bakery-brown/40 font-black">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  className={`min-w-[36px] h-9 rounded-lg font-black text-sm transition-all active:scale-90 ${
                    currentPage === page 
                      ? 'bg-bakery-brown text-white shadow-md' 
                      : 'bg-bakery-beige text-bakery-brown hover:bg-bakery-caramel/20'
                  }`}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg bg-bakery-beige text-bakery-brown disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bakery-brown hover:text-white transition-all active:scale-90"
          title={t('next')}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
