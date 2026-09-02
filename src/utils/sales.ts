import { Ingredient, PreparedStock, Product, Sale, SaleItem, ShiftLog, User } from '../types';
import { checkStockAvailability, deductStock } from './stock';

export interface FinalizeSaleInput {
  items: SaleItem[];
  products: Product[];
  ingredients: Ingredient[];
  preparedStock: PreparedStock[];
  shiftLogs: ShiftLog[];
  cashier: User;
  paymentMethod: 'Cash' | 'Card';
  timestamp?: number;
  idPrefix?: string;
  /** When set, reuse this id (idempotent completes). */
  existingSaleId?: string;
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
    items: items.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras }) => ({
      productId, nameEN, qty, unitPrice, lineTotal, extras
    })),
    subtotal,
    paymentMethod,
    cashierUsername: cashier.username,
    cashierFullName: cashier.fullName
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
