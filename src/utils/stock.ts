import { Ingredient, PreparedStock, Product, SaleItem } from '../types';

export type StockNeeds = {
  neededPrepped: Record<number, number>;
  neededIngredients: Record<number, number>;
};

export const calculateStockNeeds = (
  items: SaleItem[],
  products: Product[]
): StockNeeds => {
  const neededPrepped: Record<number, number> = {};
  const neededIngredients: Record<number, number> = {};

  const addNeeds = (productId: number, qty: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    (product.preparedStockLinks || []).forEach((link) => {
      neededPrepped[link.preparedStockId] =
        (neededPrepped[link.preparedStockId] || 0) + link.portionsPerSale * qty;
    });
    (product.ingredientLinks || []).forEach((link) => {
      neededIngredients[link.ingredientId] =
        (neededIngredients[link.ingredientId] || 0) + link.quantityUsed * qty;
    });
  };

  items.forEach((item) => {
    addNeeds(item.productId, item.qty);
    item.extras?.forEach((extra) => addNeeds(extra.productId, item.qty));
  });

  return { neededPrepped, neededIngredients };
};

export const checkStockAvailability = (
  items: SaleItem[],
  products: Product[],
  ingredients: Ingredient[],
  preparedStock: PreparedStock[]
): { ok: boolean; outOfStockItems: string[] } => {
  const { neededPrepped, neededIngredients } = calculateStockNeeds(items, products);
  const outOfStockItems: string[] = [];

  Object.entries(neededPrepped).forEach(([id, needed]) => {
    const ps = preparedStock.find((p) => p.id === Number(id));
    if (ps && ps.portions < needed) outOfStockItems.push(ps.name);
  });

  Object.entries(neededIngredients).forEach(([id, needed]) => {
    const ing = ingredients.find((i) => i.id === Number(id));
    if (ing && ing.qty < needed) outOfStockItems.push(ing.name);
  });

  return { ok: outOfStockItems.length === 0, outOfStockItems };
};

/** Deduct stock for an order (consume on complete). */
export const deductStock = (
  items: SaleItem[],
  products: Product[],
  ingredients: Ingredient[],
  preparedStock: PreparedStock[]
): { ingredients: Ingredient[]; preparedStock: PreparedStock[] } | null => {
  const check = checkStockAvailability(items, products, ingredients, preparedStock);
  if (!check.ok) return null;
  const { neededPrepped, neededIngredients } = calculateStockNeeds(items, products);
  return {
    preparedStock: preparedStock.map((ps) => ({
      ...ps,
      portions: Math.max(0, ps.portions - (neededPrepped[ps.id] || 0)),
    })),
    ingredients: ingredients.map((ing) => ({
      ...ing,
      qty: Math.max(0, ing.qty - (neededIngredients[ing.id] || 0)),
    })),
  };
};

/** Restore stock when an order is voided/cancelled after completion. */
export const restoreStock = (
  items: SaleItem[],
  products: Product[],
  ingredients: Ingredient[],
  preparedStock: PreparedStock[]
): { ingredients: Ingredient[]; preparedStock: PreparedStock[] } => {
  const { neededPrepped, neededIngredients } = calculateStockNeeds(items, products);
  return {
    preparedStock: preparedStock.map((ps) => ({
      ...ps,
      portions: ps.portions + (neededPrepped[ps.id] || 0),
    })),
    ingredients: ingredients.map((ing) => ({
      ...ing,
      qty: ing.qty + (neededIngredients[ing.id] || 0),
    })),
  };
};
