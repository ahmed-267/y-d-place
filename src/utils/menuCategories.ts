/** Normalize a menu category for fuzzy matching (extras, toppings, add-ons, etc.). */
export const normalizeCategoryKey = (category: string): string =>
  category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const ADDON_CATEGORY_KEYS = new Set([
  'extras',
  'extra',
  'toppings',
  'topping',
  'addons',
  'addon',
  'add-ons',
  'supplements',
  'supplement',
  'modifiers',
  'modifier',
  'garnishes',
  'garnish',
  'optionals',
  'optional',
  'additions',
  'addition',
  'sideorders',
  'sideorder',
  'customizations',
  'customization',
  'enhancements',
  'enhancement',
]);

/**
 * Treat a category as add-ons / toppings / extras even when the name differs
 * (e.g. "Toppings", "Add-ons", "Suppléments").
 */
export const isAddonCategory = (category: string, extraNames: string[] = []): boolean => {
  const trimmed = (category || '').trim();
  if (!trimmed) return false;

  if (extraNames.some(name => name.toLowerCase() === trimmed.toLowerCase())) return true;

  const key = normalizeCategoryKey(trimmed);
  if (ADDON_CATEGORY_KEYS.has(key)) return true;

  // Prefix/suffix patterns for localized or custom names
  if (/^extra/.test(key) || /extra$/.test(key)) return true;
  if (/topping/.test(key)) return true;
  if (/addon/.test(key) || /addons/.test(key)) return true;
  if (/supplement/.test(key)) return true;
  if (/modifier/.test(key)) return true;

  return false;
};

export const getAddonCategories = (categories: string[], extraNames: string[] = []): string[] =>
  categories.filter(cat => isAddonCategory(cat, extraNames));

export const partitionProductsByAddonCategory = <T extends { category: string; active?: boolean }>(
  products: T[],
  extraNames: string[] = []
): { menuProducts: T[]; addonProducts: T[] } => {
  const addonProducts: T[] = [];
  const menuProducts: T[] = [];
  for (const product of products) {
    if (product.active === false) continue;
    if (isAddonCategory(product.category, extraNames)) {
      addonProducts.push(product);
    } else {
      menuProducts.push(product);
    }
  }
  return { menuProducts, addonProducts };
};
