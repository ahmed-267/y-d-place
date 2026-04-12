export const toSearchValue = (value: unknown) => {
  if (typeof value === 'string') return value.toLowerCase();
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
};

const normalizeNumber = (value: string) => value.replace(/,/g, '.').replace(/[^0-9.]/g, '');

export const priceMatchesQuery = (value: unknown, query: string) => {
  const rawQuery = query.trim();
  const normalizedQuery = normalizeNumber(rawQuery);
  if (!normalizedQuery || !/\d/.test(rawQuery)) return false;

  let valueString = '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    valueString = value.toFixed(2);
  } else if (typeof value === 'string') {
    valueString = normalizeNumber(value);
  } else {
    valueString = normalizeNumber(String(value ?? ''));
  }

  if (!valueString) return false;
  return valueString.startsWith(normalizedQuery);
};
