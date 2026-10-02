import { CashSession, Sale } from '../types';
import { isCountableSale, saleCardAmount, saleCashAmount, salePayable } from './ticketMoney';

export const openCashSession = (openedBy: string, openingFloat: number): CashSession => ({
  id: `TILL-${Date.now()}`,
  openedAt: Date.now(),
  openingFloat: Math.max(0, openingFloat || 0),
  openedBy,
});

export const tillTotals = (sales: Sale[], session: CashSession) => {
  const from = session.openedAt;
  const to = session.closedAt || Date.now();
  const inWindow = sales.filter(s => s.timestamp >= from && s.timestamp <= to);
  const completed = inWindow.filter(isCountableSale);
  const refunded = inWindow.filter(s => s.status === 'refunded');
  const voided = inWindow.filter(s => s.status === 'voided');

  const cashSales = completed.reduce((a, s) => a + saleCashAmount(s), 0);
  const cardRecorded = completed.reduce((a, s) => a + saleCardAmount(s), 0);
  const refunds = refunded.reduce((a, s) => a + salePayable(s), 0);
  const cashRefunds = refunded.reduce((a, s) => a + saleCashAmount(s), 0);

  return {
    orderCount: completed.length,
    cashSales,
    cardRecorded,
    refunds,
    cashRefunds,
    voids: voided.length,
    expectedCash: session.openingFloat + cashSales - cashRefunds,
  };
};
