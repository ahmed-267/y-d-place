import { Ingredient, PreparedStock, Product, Sale, SaleItem, ShiftLog, User } from '../types';

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
  idPrefix = 'ORD'
}: FinalizeSaleInput): FinalizeSaleResult => {
  const neededPrepped: Record<number, number> = {};
  const neededIngredients: Record<number, number> = {};

  const calculateNeeds = (productId: number, qty: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    (product.preparedStockLinks || []).forEach(link => {
      neededPrepped[link.preparedStockId] = (neededPrepped[link.preparedStockId] || 0) + (link.portionsPerSale * qty);
    });

    (product.ingredientLinks || []).forEach(link => {
      neededIngredients[link.ingredientId] = (neededIngredients[link.ingredientId] || 0) + (link.quantityUsed * qty);
    });
  };

  items.forEach(item => {
    calculateNeeds(item.productId, item.qty);
    item.extras?.forEach(extra => {
      calculateNeeds(extra.productId, item.qty);
    });
  });

  const outOfStockItems: string[] = [];

  Object.entries(neededPrepped).forEach(([id, needed]) => {
    const ps = preparedStock.find(p => p.id === Number(id));
    if (ps && ps.portions < needed) {
      outOfStockItems.push(ps.name);
    }
  });

  Object.entries(neededIngredients).forEach(([id, needed]) => {
    const ing = ingredients.find(i => i.id === Number(id));
    if (ing && ing.qty < needed) {
      outOfStockItems.push(ing.name);
    }
  });

  if (outOfStockItems.length > 0) {
    return { ok: false, outOfStockItems };
  }

  const saleTimestamp = timestamp || Date.now();
  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);

  const sale: Sale = {
    id: `${idPrefix}-${saleTimestamp}`,
    timestamp: saleTimestamp,
    items: items.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras }) => ({
      productId, nameEN, qty, unitPrice, lineTotal, extras
    })),
    subtotal,
    paymentMethod,
    cashierUsername: cashier.username,
    cashierFullName: cashier.fullName
  };

  const updatedPrepped = preparedStock.map(ps => {
    const needed = neededPrepped[ps.id] || 0;
    return { ...ps, portions: Math.max(0, ps.portions - needed) };
  });

  const updatedIngredients = ingredients.map(ing => {
    const needed = neededIngredients[ing.id] || 0;
    return { ...ing, qty: Math.max(0, ing.qty - needed) };
  });

  const updatedShiftLogs = shiftLogs.map(log => {
    if (log.username === cashier.username && !log.logoutTime) {
      return { ...log, ordersProcessed: log.ordersProcessed + 1 };
    }
    return log;
  });

  return {
    ok: true,
    sale,
    updatedIngredients,
    updatedPreparedStock: updatedPrepped,
    updatedShiftLogs
  };
};
