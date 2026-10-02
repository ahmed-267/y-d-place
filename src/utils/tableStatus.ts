import { FloorTable, Order, TableLiveStatus } from '../types';

export const openOrderForTable = (orders: Order[], tableId: string) =>
  orders.find(
    o =>
      o.tableId === tableId &&
      o.type === 'DineIn' &&
      (o.status === 'Preparing' || o.status === 'Ready') &&
      !o.saleId
  );

/** Live floor status from order + dirty/server metadata on the table. */
export const resolveTableLiveStatus = (table: FloorTable, orders: Order[]): TableLiveStatus => {
  if (table.dirty) return 'dirty';
  const open = openOrderForTable(orders, table.id);
  if (!open) return 'free';
  if (open.status === 'Ready') return 'bill';
  if ((open.items?.length || 0) === 0) return 'seated';
  return 'ordered';
};

export const tableStatusLabelKey = (status: TableLiveStatus): string => {
  switch (status) {
    case 'seated':
      return 'tableSeated';
    case 'ordered':
      return 'tableOrdered';
    case 'bill':
      return 'tableBill';
    case 'dirty':
      return 'tableDirty';
    default:
      return 'tableFree';
  }
};

/** Average dine-in turn minutes for completed table checks in range. */
export const averageTableTurnMinutes = (
  orders: Order[],
  fromTs: number,
  toTs: number
): number | null => {
  const turns = orders.filter(
    o =>
      o.type === 'DineIn' &&
      o.status === 'Completed' &&
      o.completedAt &&
      o.completedAt >= fromTs &&
      o.completedAt <= toTs &&
      o.tableId
  );
  if (!turns.length) return null;
  const total = turns.reduce((acc, o) => acc + Math.max(0, (o.completedAt || 0) - o.createdAt), 0);
  return Math.round(total / turns.length / 60000);
};
