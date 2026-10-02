import { Sale } from '../types';

export const isCountableSale = (sale: Sale) => !sale.status || sale.status === 'completed';

export const computeDiscountAmount = (subtotal: number, percent?: number, amount?: number) => {
  const fromPct = subtotal * (Math.max(0, percent || 0) / 100);
  const raw = amount != null && amount > 0 ? amount : fromPct;
  return Math.min(Math.max(0, subtotal), Math.max(0, raw));
};

/** Payable total: items − discount + tip. */
export const salePayable = (sale: Pick<Sale, 'subtotal' | 'discountAmount' | 'tipAmount'>) => {
  const discount = Math.min(sale.subtotal || 0, Math.max(0, sale.discountAmount || 0));
  return Math.max(0, (sale.subtotal || 0) - discount) + Math.max(0, sale.tipAmount || 0);
};

export const paymentMethodLabel = (
  method: 'Cash' | 'Card' | 'Split',
  t: (k: string) => string
) => {
  if (method === 'Card') return t('cardRecorded');
  if (method === 'Split') return t('splitTender');
  return t('cash');
};

/** Cash portion of a sale for till math. */
export const saleCashAmount = (sale: Sale) => {
  const payable = salePayable(sale);
  if (sale.paymentMethod === 'Cash') return payable;
  if (sale.paymentMethod === 'Split') return Math.min(payable, Math.max(0, sale.cashAmount || 0));
  return 0;
};

/** Card-recorded portion of a sale. */
export const saleCardAmount = (sale: Sale) => {
  const payable = salePayable(sale);
  if (sale.paymentMethod === 'Card') return payable;
  if (sale.paymentMethod === 'Split') return Math.min(payable, Math.max(0, sale.cardAmount || 0));
  return 0;
};
