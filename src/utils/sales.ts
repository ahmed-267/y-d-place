import { Ingredient, PreparedStock, Product, Sale, SaleItem, ShiftLog, User } from '../types';
import { checkStockAvailability, deductStock } from './stock';

export interface FinalizeSaleInput {
  items: SaleItem[];
  products: Product[];
  ingredients: Ingredient[];
  preparedStock: PreparedStock[];
  shiftLogs: ShiftLog[];
  cashier: User;
  paymentMethod: 'Cash' | 'Card' | 'Split';
  timestamp?: number;
  idPrefix?: string;
  existingSaleId?: string;
  discountPercent?: number;
  discountAmount?: number;
  tipAmount?: number;
  tenderedCash?: number;
  changeGiven?: number;
  cashAmount?: number;
  cardAmount?: number;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
}

export interface FinalizeSaleResult {
  ok: boolean;
  sale?: Sale;
  updatedIngredients?: Ingredient[];
  updatedPreparedStock?: PreparedStock[];
  updatedShiftLogs?: ShiftLog[];
  outOfStockItems?: string[];
}

export const finalizeSale = ({
  items,
  products,
  ingredients,
  preparedStock,
  shiftLogs,
  cashier,
  paymentMethod,
  timestamp,
  idPrefix = 'ORD',
  existingSaleId,
  discountPercent,
  discountAmount,
  tipAmount,
  tenderedCash,
  changeGiven,
  cashAmount,
  cardAmount,
  customerName,
  customerPhone,
  customerId,
}: FinalizeSaleInput): FinalizeSaleResult => {
  const stockCheck = checkStockAvailability(items, products, ingredients, preparedStock);
  if (!stockCheck.ok) {
    return { ok: false, outOfStockItems: stockCheck.outOfStockItems };
  }

  const deducted = deductStock(items, products, ingredients, preparedStock);
  if (!deducted) {
    return { ok: false, outOfStockItems: stockCheck.outOfStockItems };
  }

  const saleTimestamp = timestamp || Date.now();
  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);

  const sale: Sale = {
    id: existingSaleId || `${idPrefix}-${saleTimestamp}`,
    timestamp: saleTimestamp,
    items: items.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras, note }) => ({
      productId, nameEN, qty, unitPrice, lineTotal, extras, note
    })),
    subtotal,
    discountPercent,
    discountAmount: discountAmount || 0,
    tipAmount: tipAmount || 0,
    tenderedCash,
    changeGiven,
    cashAmount,
    cardAmount,
    paymentMethod,
    cashierUsername: cashier.username,
    cashierFullName: cashier.fullName,
    status: 'completed',
    customerName,
    customerPhone,
    customerId,
  };

  const updatedShiftLogs = shiftLogs.map(log => {
    if (log.username === cashier.username && !log.logoutTime) {
      return { ...log, ordersProcessed: log.ordersProcessed + 1 };
    }
    return log;
  });

  return {
    ok: true,
    sale,
    updatedIngredients: deducted.ingredients,
    updatedPreparedStock: deducted.preparedStock,
    updatedShiftLogs
  };
};
