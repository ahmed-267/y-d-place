/** E.164 country calling codes for supported / common PreVisio countries. */
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  GB: '+44',
  FR: '+33',
  DE: '+49',
  BE: '+32',
  ES: '+34',
  US: '+1',
  IT: '+39',
  NL: '+31',
  AE: '+971',
  PT: '+351',
  TR: '+90',
  PL: '+48',
  RO: '+40',
  CN: '+86',
  JP: '+81',
  SA: '+966',
  EG: '+20',
  MA: '+212',
  CA: '+1',
  AU: '+61',
};

export const getDialCode = (countryCode?: string | null): string => {
  if (!countryCode) return '';
  return COUNTRY_DIAL_CODES[countryCode.toUpperCase()] || '';
};

/** Strip an existing leading +country code / leading zeros from national number. */
export const stripDialPrefix = (phone: string): string => {
  const trimmed = (phone || '').trim();
  if (!trimmed) return '';
  // Remove +digits prefix
  const withoutIntl = trimmed.replace(/^\+\d{1,4}[\s-]*/, '');
  // Remove a single leading trunk 0 after stripping intl
  return withoutIntl.replace(/^0+/, '').trim();
};

/** Apply/replace country dial code on a phone string. Keeps local digits. */
export const applyCountryDialCode = (phone: string, countryCode?: string | null): string => {
  const dial = getDialCode(countryCode);
  const national = stripDialPrefix(phone);
  if (!dial) return national;
  if (!national) return `${dial} `;
  return `${dial} ${national}`;
};
