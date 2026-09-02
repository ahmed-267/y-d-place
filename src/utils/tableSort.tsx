import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export function sortByColumn<T>(
  rows: T[],
  sortKey: string,
  sortDirection: SortDirection,
  getValue: (row: T, key: string) => string | number | boolean | null | undefined
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const av = getValue(a, sortKey);
    const bv = getValue(b, sortKey);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    if (typeof av === 'boolean' && typeof bv === 'boolean') return Number(av) - Number(bv);
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
  });
  return sortDirection === 'desc' ? sorted.reverse() : sorted;
}

export function useColumnSort<K extends string>(
  defaultKey: K,
  defaultDir: SortDirection = 'asc'
) {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDir);

  const toggleSort = (key: K) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  return { sortKey, sortDirection, toggleSort };
}

type SortableThProps<K extends string> = {
  label: string;
  column: K;
  sortKey: K;
  sortDirection: SortDirection;
  onSort: (key: K) => void;
  className?: string;
  align?: 'left' | 'right';
};

export function SortableTh<K extends string>({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
  className = 'p-4',
  align = 'left',
}: SortableThProps<K>) {
  const active = sortKey === column;
  return (
    <th className={`${className} ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 font-inherit uppercase tracking-widest hover:text-bakery-brown transition-colors ${
          align === 'right' ? 'ml-auto' : ''
        } ${active ? 'text-bakery-brown' : 'text-inherit'}`}
      >
        <span>{label}</span>
        {active ? (
          sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronsUpDown size={12} className="opacity-35" />
        )}
      </button>
    </th>
  );
}
